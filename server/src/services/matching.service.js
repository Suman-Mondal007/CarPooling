import Ride from '../models/Ride.js';
import Trip from '../models/Trip.js';
import Booking from '../models/Booking.js';
import { projectPointToPolyline, fromGeoJsonPoint } from '../utils/geo.js';

/**
 * Searches and ranks matching rides for a passenger commute request.
 */
export async function searchMatchingRides({
  passengerId,
  organizationId,
  pickup, // { lat, lng }
  drop, // { lat, lng }
  date, // string YYYY-MM-DD
  time, // string HH:mm
  windowMinutes = 30,
  seats = 1,
  recurringWeekdays = null,
  maxPickupDistanceMeters = 2000,
  maxDropDistanceMeters = 2000,
  page = 1,
  limit = 20
}) {
  const now = new Date();

  // 1. Determine time query window
  let windowStart;
  let windowEnd;

  if (date && time) {
    const targetDeparture = new Date(`${date}T${time}:00`);
    windowStart = new Date(targetDeparture.getTime() - windowMinutes * 60 * 1000);
    windowEnd = new Date(targetDeparture.getTime() + windowMinutes * 60 * 1000);
  } else if (date) {
    windowStart = new Date(`${date}T00:00:00`);
    windowEnd = new Date(`${date}T23:59:59`);
  } else {
    // Default: from now up to 7 days
    windowStart = now;
    windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  // Ensure windowStart is not in the past
  if (windowStart < now) {
    windowStart = now;
  }

  // 2. Query Candidate Rides from MongoDB
  const rideQuery = {
    organization: organizationId,
    status: 'OPEN',
    availableSeats: { $gte: Number(seats) },
    departureAt: { $gte: windowStart, $lte: windowEnd },
    driver: { $ne: passengerId }
  };

  const candidateRides = await Ride.find(rideQuery)
    .populate('driver', 'name phone')
    .populate('vehicle', 'model registrationNumber vehicleType color seatingCapacity fuelType verificationStatus')
    .lean();

  if (candidateRides.length === 0) {
    return {
      items: [],
      total: 0,
      page,
      limit,
      groupedByDay: {}
    };
  }

  // 3. Filter by Trip status SCHEDULED
  const candidateRideIds = candidateRides.map((r) => r._id);
  const scheduledTrips = await Trip.find({
    ride: { $in: candidateRideIds },
    status: 'SCHEDULED'
  }).select('ride').lean();

  const scheduledRideIdSet = new Set(scheduledTrips.map((t) => t.ride.toString()));

  // 4. Overlapping passenger commitments check
  // Find passenger's other bookings/rides during the search window to prevent conflict
  const existingBookings = await Booking.find({
    passenger: passengerId,
    status: 'CONFIRMED'
  }).populate('ride', 'departureAt').lean();

  const bookedDepartureTimes = existingBookings
    .filter((b) => b.ride?.departureAt)
    .map((b) => new Date(b.ride.departureAt).getTime());

  const existingOfferedRides = await Ride.find({
    driver: passengerId,
    status: 'OPEN',
    departureAt: { $gte: windowStart, $lte: windowEnd }
  }).select('departureAt').lean();

  const offeredDepartureTimes = existingOfferedRides.map((r) => new Date(r.departureAt).getTime());
  const allConflictTimes = [...bookedDepartureTimes, ...offeredDepartureTimes];

  const hasOverlap = (candidateTime) => {
    const cMs = new Date(candidateTime).getTime();
    return allConflictTimes.some((conflictMs) => Math.abs(cMs - conflictMs) < 30 * 60 * 1000); // 30 min window
  };

  // 5. Match along Route Geometry
  const pickupPoint = [Number(pickup.lng), Number(pickup.lat)];
  const dropPoint = [Number(drop.lng), Number(drop.lat)];
  const preferredDateTime = date && time ? new Date(`${date}T${time}:00`) : null;

  const matchedRides = [];

  for (const ride of candidateRides) {
    // Must have a scheduled trip
    if (!scheduledRideIdSet.has(ride._id.toString())) {
      continue;
    }

    // Must not overlap with passenger's existing bookings/offers
    if (hasOverlap(ride.departureAt)) {
      continue;
    }

    // Filter by recurring weekdays if specified
    if (Array.isArray(recurringWeekdays) && recurringWeekdays.length > 0) {
      const dayOfWeek = new Date(ride.departureAt).getDay(); // 0 = Sun, 1 = Mon...
      if (!recurringWeekdays.includes(dayOfWeek)) {
        continue;
      }
    }

    // Route geometry point projection
    const routeCoordinates = ride.routeGeometry?.coordinates;
    if (!routeCoordinates || routeCoordinates.length < 2) {
      continue;
    }

    const projPickup = projectPointToPolyline(pickupPoint, routeCoordinates);
    const projDrop = projectPointToPolyline(dropPoint, routeCoordinates);

    // Check distance tolerances
    if (projPickup.minDistanceMeters > maxPickupDistanceMeters) {
      continue;
    }
    if (projDrop.minDistanceMeters > maxDropDistanceMeters) {
      continue;
    }

    // Check direction: Pickup must come BEFORE drop along route direction!
    if (projPickup.cumulativeDistanceMeters >= projDrop.cumulativeDistanceMeters) {
      continue;
    }

    // 6. Scoring & Ranking
    let timeDiffMinutes = 0;
    if (preferredDateTime) {
      timeDiffMinutes = Math.round(
        Math.abs(new Date(ride.departureAt).getTime() - preferredDateTime.getTime()) / (60 * 1000)
      );
    }

    // Score calculation
    let matchScore = 100;
    // Detour penalties
    matchScore -= (projPickup.minDistanceMeters / 100);
    matchScore -= (projDrop.minDistanceMeters / 100);
    // Time difference penalty
    matchScore -= (timeDiffMinutes * 0.4);
    // Availability bonus
    matchScore += Math.min(10, ride.availableSeats * 2);

    matchScore = Math.max(15, Math.min(100, Math.round(matchScore)));

    matchedRides.push({
      _id: ride._id,
      departureAt: ride.departureAt,
      originAddress: ride.originAddress,
      destinationAddress: ride.destinationAddress,
      originCoords: fromGeoJsonPoint(ride.origin),
      destinationCoords: fromGeoJsonPoint(ride.destination),
      totalPassengerSeats: ride.totalPassengerSeats,
      availableSeats: ride.availableSeats,
      farePerSeatMinor: ride.farePerSeatMinor,
      farePerSeatRupees: Math.round(ride.farePerSeatMinor / 100),
      distanceMeters: ride.distanceMeters,
      durationSeconds: ride.durationSeconds,
      routeGeometry: ride.routeGeometry,
      notes: ride.notes,
      recurrenceGroupId: ride.recurrenceGroupId,
      driver: {
        _id: ride.driver?._id,
        name: ride.driver?.name || 'Driver'
      },
      vehicle: ride.vehicle
        ? {
            _id: ride.vehicle._id,
            model: ride.vehicle.model,
            registrationNumber: ride.vehicle.registrationNumber,
            vehicleType: ride.vehicle.vehicleType,
            color: ride.vehicle.color,
            fuelType: ride.vehicle.fuelType
          }
        : null,
      match: {
        score: matchScore,
        pickupDistanceMeters: projPickup.minDistanceMeters,
        dropDistanceMeters: projDrop.minDistanceMeters,
        timeDiffMinutes
      }
    });
  }

  // Sort by match score descending, then departureAt ascending
  matchedRides.sort((a, b) => b.match.score - a.match.score || new Date(a.departureAt) - new Date(b.departureAt));

  // Group by day for recurring / multi-day searches
  const groupedByDay = {};
  for (const ride of matchedRides) {
    const dayKey = new Date(ride.departureAt).toISOString().split('T')[0];
    if (!groupedByDay[dayKey]) {
      groupedByDay[dayKey] = [];
    }
    groupedByDay[dayKey].push(ride);
  }

  // Pagination
  const startIndex = (page - 1) * limit;
  const paginatedItems = matchedRides.slice(startIndex, startIndex + limit);

  return {
    items: paginatedItems,
    total: matchedRides.length,
    page: Number(page),
    limit: Number(limit),
    groupedByDay
  };
}
