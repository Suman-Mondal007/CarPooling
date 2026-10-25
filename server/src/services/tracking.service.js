import Trip from '../models/Trip.js';
import Booking from '../models/Booking.js';
import TrackingPoint from '../models/TrackingPoint.js';
import { calculateRoute } from './routing.service.js';
import { emitToTrip, emitTripStatus } from '../sockets/emitter.js';
import { notifyTripInProgress } from './notification.service.js';
import { fromGeoJsonPoint } from '../utils/geo.js';

// In-memory throttling map: tripId -> last processed timestamp (ms)
const lastLocationTimeMap = new Map();

// In-memory ETA cache: tripId -> { data: object, fetchedAt: number }
const etaCache = new Map();

const THROTTLE_INTERVAL_MS = 3000; // 3 seconds
const ETA_REFRESH_INTERVAL_MS = 45000; // 45 seconds

export function clearTrackingMemory() {
  lastLocationTimeMap.clear();
  etaCache.clear();
}

/**
 * Validate participant: must be driver or CONFIRMED passenger of the trip, in same organization
 */
export async function verifyTripParticipant(tripId, userId, organizationId) {
  const trip = await Trip.findById(tripId).populate({
    path: 'ride',
    populate: [
      { path: 'driver', select: 'name phone' },
      { path: 'vehicle', select: 'model registrationNumber vehicleType color' }
    ]
  });

  if (!trip || (organizationId && trip.organization.toString() !== organizationId.toString())) {
    return { authorized: false, reason: 'NOT_A_PARTICIPANT' };
  }

  const uid = userId.toString();
  const isDriver = trip.driver.toString() === uid;

  if (isDriver) {
    return { authorized: true, isDriver: true, trip, ride: trip.ride };
  }

  // Check if passenger has CONFIRMED booking
  const booking = await Booking.findOne({
    ride: trip.ride?._id || trip.ride,
    passenger: userId,
    organization: organizationId || trip.organization,
    status: 'CONFIRMED'
  });

  if (!booking) {
    return { authorized: false, reason: 'NOT_A_PARTICIPANT' };
  }

  return { authorized: true, isDriver: false, isPassenger: true, trip, ride: trip.ride, booking };
}

/**
 * Get or refresh ETA to trip destination, caching for 45s.
 * If routing fails, returns cached ETA marked stale; never fabricates values.
 */
export async function getOrRefreshEta(tripId, currentLocation, destinationLocation) {
  const tid = tripId.toString();
  const now = Date.now();
  const cached = etaCache.get(tid);

  if (cached && (now - cached.fetchedAt < ETA_REFRESH_INTERVAL_MS)) {
    return cached.data;
  }

  if (!currentLocation || !destinationLocation) {
    return cached ? cached.data : null;
  }

  try {
    const route = await calculateRoute(
      { lat: currentLocation.lat, lng: currentLocation.lng },
      { lat: destinationLocation.lat, lng: destinationLocation.lng }
    );

    const etaData = {
      durationSeconds: route.durationSeconds,
      durationMinutes: route.durationMinutes,
      distanceMeters: route.distanceMeters,
      distanceKm: route.distanceKm,
      updatedAt: new Date().toISOString(),
      isStale: false
    };

    etaCache.set(tid, { data: etaData, fetchedAt: now });
    return etaData;
  } catch {
    // If routing provider fails, return cached ETA flagged as stale with no fabricated values
    if (cached) {
      cached.data.isStale = true;
      return cached.data;
    }
    return null;
  }
}

/**
 * Process a location update sent by the driver
 */
export async function processDriverLocation({
  tripId,
  driverId,
  lat,
  lng,
  heading = null,
  speed = null,
  isSimulated = false
}) {
  const tid = tripId.toString();
  const did = driverId.toString();

  // Validate coordinates
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (
    isNaN(numLat) || isNaN(numLng) ||
    numLat < -90 || numLat > 90 ||
    numLng < -180 || numLng > 180
  ) {
    const error = new Error('Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180');
    error.code = 'INVALID_COORDINATES';
    throw error;
  }

  const trip = await Trip.findById(tid).populate('ride');
  if (!trip) {
    const error = new Error('Trip not found');
    error.code = 'TRIP_NOT_FOUND';
    throw error;
  }

  // Sender must be the driver
  if (trip.driver.toString() !== did) {
    const error = new Error('Only the trip driver can broadcast location updates');
    error.code = 'UNAUTHORIZED_DRIVER';
    throw error;
  }

  // Trip status must be STARTED or IN_PROGRESS
  if (trip.status !== 'STARTED' && trip.status !== 'IN_PROGRESS') {
    const error = new Error(`Cannot update location for trip with status ${trip.status}`);
    error.code = 'INVALID_TRIP_STATUS';
    throw error;
  }

  // Throttle updates: at most 1 update per 3 seconds per trip
  const now = Date.now();
  const lastUpdate = lastLocationTimeMap.get(tid);
  if (lastUpdate && (now - lastUpdate < THROTTLE_INTERVAL_MS)) {
    // Silently drop
    return { dropped: true };
  }
  lastLocationTimeMap.set(tid, now);

  // Check atomic move from STARTED to IN_PROGRESS
  if (trip.status === 'STARTED') {
    const updatedTrip = await Trip.findOneAndUpdate(
      { _id: tid, status: 'STARTED' },
      { $set: { status: 'IN_PROGRESS' } },
      { new: true }
    );

    if (updatedTrip) {
      trip.status = 'IN_PROGRESS';
      // Notify confirmed passengers
      const confirmedBookings = await Booking.find({
        ride: trip.ride?._id || trip.ride,
        status: 'CONFIRMED'
      });
      notifyTripInProgress(trip, confirmedBookings).catch(() => {});
      // Broadcast new status
      emitTripStatus(tid, 'IN_PROGRESS', { message: 'Trip is now in progress' });
    }
  }

  // Update lastKnownLocation and lastLocationAt on Trip
  const lastLocationAt = new Date();
  const lastKnownLocation = {
    type: 'Point',
    coordinates: [numLng, numLat]
  };

  await Trip.updateOne(
    { _id: tid },
    {
      $set: {
        lastKnownLocation,
        lastLocationAt
      }
    }
  );

  // Persist TrackingPoint in TTL collection
  await TrackingPoint.create({
    trip: tid,
    driver: did,
    location: lastKnownLocation,
    speed: speed != null ? Number(speed) : null,
    heading: heading != null ? Number(heading) : null,
    recordedAt: lastLocationAt
  });

  // Calculate or retrieve ETA
  let eta = null;
  const destCoords = trip.ride?.destination?.coordinates || trip.ride?.destination?.location?.coordinates;
  if (destCoords) {
    eta = await getOrRefreshEta(
      tid,
      { lat: numLat, lng: numLng },
      { lat: destCoords[1], lng: destCoords[0] }
    );
  }

  const locationPayload = {
    tripId: tid,
    location: { lat: numLat, lng: numLng },
    heading: heading != null ? Number(heading) : null,
    speed: speed != null ? Number(speed) : null,
    recordedAt: lastLocationAt.toISOString(),
    eta,
    simulated: Boolean(isSimulated)
  };

  // Broadcast to trip room
  emitToTrip(tid, 'trip:location', locationPayload);

  return {
    success: true,
    data: locationPayload
  };
}

/**
 * Returns tracking state for a trip
 */
export async function getTripTrackingState(tripId, userId, organizationId) {
  const { authorized, isDriver, trip, ride, reason } = await verifyTripParticipant(
    tripId,
    userId,
    organizationId
  );

  if (!authorized) {
    const error = new Error(reason === 'NOT_A_PARTICIPANT' ? 'You are not a participant of this trip' : 'Trip not found');
    error.status = reason === 'NOT_A_PARTICIPANT' ? 403 : 404;
    error.code = reason;
    throw error;
  }

  const isStale = trip.lastLocationAt
    ? (Date.now() - new Date(trip.lastLocationAt).getTime()) > 30000
    : false;

  let eta = null;
  const destinationCoords = ride?.destination?.coordinates || ride?.destination?.location?.coordinates;
  if (
    trip.lastKnownLocation?.coordinates &&
    destinationCoords &&
    (trip.status === 'STARTED' || trip.status === 'IN_PROGRESS')
  ) {
    const currCoords = trip.lastKnownLocation.coordinates; // [lng, lat]
    eta = await getOrRefreshEta(
      trip._id,
      { lat: currCoords[1], lng: currCoords[0] },
      { lat: destinationCoords[1], lng: destinationCoords[0] }
    );
  }

  return {
    tripId: trip._id,
    status: trip.status,
    isDriver,
    lastKnownLocation: trip.lastKnownLocation ? fromGeoJsonPoint(trip.lastKnownLocation) : null,
    lastLocationAt: trip.lastLocationAt,
    isStale,
    eta,
    routeGeometry: ride?.routeGeometry || null,
    pickup: ride?.origin
      ? {
          address: ride.originAddress || ride.origin.address || '',
          coords: fromGeoJsonPoint(ride.origin.location || ride.origin)
        }
      : null,
    destination: ride?.destination
      ? {
          address: ride.destinationAddress || ride.destination.address || '',
          coords: fromGeoJsonPoint(ride.destination.location || ride.destination)
        }
      : null,
    driver: ride?.driver
      ? {
          _id: ride.driver._id,
          name: ride.driver.name,
          phone: ride.driver.phone
        }
      : null,
    vehicle: ride?.vehicle || null
  };
}

export default {
  verifyTripParticipant,
  getOrRefreshEta,
  processDriverLocation,
  getTripTrackingState,
  clearTrackingMemory
};
