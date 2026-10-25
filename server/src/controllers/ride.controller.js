import crypto from 'crypto';
import Ride from '../models/Ride.js';
import Trip from '../models/Trip.js';
import Booking from '../models/Booking.js';
import Vehicle from '../models/Vehicle.js';
import { toGeoJsonPoint, fromGeoJsonPoint } from '../utils/geo.js';
import { searchMatchingRides } from '../services/matching.service.js';
import { notifyRideCancelled } from '../services/notification.service.js';
import { emitTripStatus } from '../sockets/emitter.js';

function formatRide(ride) {
  const obj = ride.toObject ? ride.toObject() : { ...ride };
  return {
    ...obj,
    originCoords: fromGeoJsonPoint(obj.origin),
    destinationCoords: fromGeoJsonPoint(obj.destination),
    farePerSeatRupees: obj.farePerSeatMinor ? obj.farePerSeatMinor / 100 : 0
  };
}

export async function publishRide(req, res, next) {
  try {
    const data = req.validatedData || req.body;

    // 1. Verify vehicle ownership & status
    const vehicle = await Vehicle.findOne({
      _id: data.vehicleId,
      owner: req.user._id,
      organization: req.organization._id,
      isDeleted: false
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'VEHICLE_NOT_FOUND',
          message: 'Selected vehicle not found or does not belong to you',
          details: null
        }
      });
    }

    // 2. Check organization vehicle verification requirement
    if (req.organization.settings?.requireVehicleVerification && vehicle.verificationStatus !== 'VERIFIED') {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          code: 'VEHICLE_NOT_VERIFIED',
          message: 'Your vehicle must be verified by company admin before you can offer rides',
          details: null
        }
      });
    }

    // 3. Check seat constraint (totalPassengerSeats <= vehicle.seatingCapacity - 1)
    const maxAllowedSeats = vehicle.seatingCapacity - 1;
    if (data.totalPassengerSeats > maxAllowedSeats) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'EXCEEDS_SEATING_CAPACITY',
          message: `Passenger seats cannot exceed ${maxAllowedSeats} (vehicle capacity of ${vehicle.seatingCapacity} minus driver seat)`,
          details: null
        }
      });
    }

    // GeoJSON conversion for origin & destination
    const originPoint = toGeoJsonPoint(data.origin);
    const destinationPoint = toGeoJsonPoint(data.destination);

    // Common ride fields
    const baseRideData = {
      organization: req.organization._id,
      driver: req.user._id,
      vehicle: vehicle._id,
      originAddress: data.originAddress,
      origin: originPoint,
      destinationAddress: data.destinationAddress,
      destination: destinationPoint,
      routeGeometry: data.routeGeometry,
      distanceMeters: data.distanceMeters,
      durationSeconds: data.durationSeconds,
      totalPassengerSeats: data.totalPassengerSeats,
      availableSeats: data.totalPassengerSeats,
      farePerSeatMinor: data.farePerSeatMinor,
      notes: data.notes || '',
      status: 'OPEN',
      vehicleSnapshot: {
        model: vehicle.model,
        registrationNumber: vehicle.registrationNumber,
        vehicleType: vehicle.vehicleType,
        fuelType: vehicle.fuelType,
        fuelEfficiencyKmpl: vehicle.fuelEfficiencyKmpl,
        seatingCapacity: vehicle.seatingCapacity
      }
    };

    // 4. Handle recurring or single ride
    if (data.recurring?.enabled && Array.isArray(data.recurring.daysOfWeek) && data.recurring.daysOfWeek.length > 0) {
      const recurrenceGroupId = crypto.randomUUID();
      const targetDays = new Set(data.recurring.daysOfWeek); // e.g. [1, 2, 3, 4, 5]
      const weeks = Math.min(Math.max(data.recurring.weeks || 1, 1), 4);
      const totalDaysToScan = weeks * 7;

      const departureDate = new Date(data.departureAt);
      const startHour = departureDate.getHours();
      const startMinute = departureDate.getMinutes();

      const createdRides = [];

      for (let dayOffset = 0; dayOffset < totalDaysToScan && createdRides.length < 20; dayOffset++) {
        const currentDate = new Date(departureDate);
        currentDate.setDate(departureDate.getDate() + dayOffset);
        currentDate.setHours(startHour, startMinute, 0, 0);

        // Check if day of week matches (0 = Sunday, 1 = Monday, ...)
        if (targetDays.has(currentDate.getDay()) && currentDate > new Date()) {
          const ride = await Ride.create({
            ...baseRideData,
            departureAt: currentDate,
            recurrenceGroupId
          });

          // Create matching scheduled Trip
          const trip = await Trip.create({
            ride: ride._id,
            driver: req.user._id,
            organization: req.organization._id,
            status: 'SCHEDULED'
          });

          createdRides.push({
            ...formatRide(ride),
            tripId: trip._id
          });
        }
      }

      if (createdRides.length === 0) {
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            code: 'NO_FUTURE_DATES',
            message: 'No future dates matched the recurring schedule criteria',
            details: null
          }
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          items: createdRides,
          recurrenceGroupId,
          count: createdRides.length
        },
        error: null
      });
    }

    // Single ride creation
    const ride = await Ride.create({
      ...baseRideData,
      departureAt: data.departureAt,
      recurrenceGroupId: null
    });

    const trip = await Trip.create({
      ride: ride._id,
      driver: req.user._id,
      organization: req.organization._id,
      status: 'SCHEDULED'
    });

    res.status(201).json({
      success: true,
      data: {
        ...formatRide(ride),
        tripId: trip._id
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyOfferedRides(req, res, next) {
  try {
    const rides = await Ride.find({
      driver: req.user._id,
      organization: req.organization._id
    })
      .populate('vehicle', 'model registrationNumber vehicleType color seatingCapacity fuelType verificationStatus')
      .sort({ departureAt: -1 });

    // Fetch matching trips to display trip status
    const rideIds = rides.map((r) => r._id);
    const trips = await Trip.find({ ride: { $in: rideIds } }).select('ride status startedAt completedAt');
    const tripMap = new Map(trips.map((t) => [t.ride.toString(), t]));

    // Fetch booking counts
    const bookings = await Booking.find({
      ride: { $in: rideIds },
      status: 'CONFIRMED'
    }).select('ride seats');

    const bookingCountMap = new Map();
    for (const b of bookings) {
      const id = b.ride.toString();
      bookingCountMap.set(id, (bookingCountMap.get(id) || 0) + b.seats);
    }

    const items = rides.map((ride) => {
      const formatted = formatRide(ride);
      const trip = tripMap.get(ride._id.toString());
      const bookedSeats = bookingCountMap.get(ride._id.toString()) || 0;
      return {
        ...formatted,
        tripStatus: trip?.status || 'SCHEDULED',
        tripId: trip?._id || null,
        bookedSeats
      };
    });

    res.status(200).json({
      success: true,
      data: {
        items,
        total: items.length
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelOfferedRide(req, res, next) {
  try {
    const ride = await Ride.findOne({
      _id: req.params.id,
      driver: req.user._id,
      organization: req.organization._id
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'RIDE_NOT_FOUND',
          message: 'Ride not found or does not belong to you',
          details: null
        }
      });
    }

    const trip = await Trip.findOne({ ride: ride._id });
    if (!trip) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'TRIP_NOT_FOUND',
          message: 'Associated trip not found',
          details: null
        }
      });
    }

    // Driver may cancel a ride ONLY while Trip is SCHEDULED
    if (trip.status !== 'SCHEDULED') {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'CANNOT_CANCEL',
          message: `Cannot cancel ride because trip is already ${trip.status}`,
          details: null
        }
      });
    }

    ride.status = 'CANCELLED';
    await ride.save();

    trip.status = 'CANCELLED';
    await trip.save();

    emitTripStatus(trip._id, 'CANCELLED', { message: 'Ride was cancelled by driver' });

    // Cancel all active bookings on this ride and notify passengers
    const confirmedBookings = await Booking.find({ ride: ride._id, status: 'CONFIRMED' });
    await Booking.updateMany(
      { ride: ride._id, status: 'CONFIRMED' },
      { status: 'CANCELLED_BY_DRIVER' }
    );

    notifyRideCancelled(ride, confirmedBookings).catch(() => {});

    res.status(200).json({
      success: true,
      data: {
        message: 'Ride cancelled successfully',
        rideId: ride._id,
        tripId: trip._id
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function searchRides(req, res, next) {
  try {
    const {
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      date,
      time,
      windowMinutes,
      seats,
      recurringDays,
      page,
      limit
    } = req.query;

    if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'MISSING_COORDINATES',
          message: 'Both pickup (lat, lng) and drop (lat, lng) coordinates are required for ride search',
          details: null
        }
      });
    }

    let parsedRecurringDays = null;
    if (recurringDays) {
      parsedRecurringDays = recurringDays.toString().split(',').map((d) => parseInt(d.trim(), 10)).filter((n) => !isNaN(n));
    }

    const results = await searchMatchingRides({
      passengerId: req.user._id,
      organizationId: req.organization._id,
      pickup: { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) },
      drop: { lat: parseFloat(dropLat), lng: parseFloat(dropLng) },
      date: date || null,
      time: time || null,
      windowMinutes: windowMinutes ? parseInt(windowMinutes, 10) : 30,
      seats: seats ? parseInt(seats, 10) : 1,
      recurringWeekdays: parsedRecurringDays,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20
    });

    res.status(200).json({
      success: true,
      data: results,
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function getRideById(req, res, next) {
  try {
    const ride = await Ride.findOne({
      _id: req.params.id,
      organization: req.organization._id
    })
      .populate('driver', 'name phone')
      .populate('vehicle', 'model registrationNumber vehicleType color seatingCapacity fuelType verificationStatus');

    if (!ride) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'RIDE_NOT_FOUND',
          message: 'Ride not found',
          details: null
        }
      });
    }

    const trip = await Trip.findOne({ ride: ride._id });

    res.status(200).json({
      success: true,
      data: {
        ...formatRide(ride),
        tripStatus: trip?.status || 'SCHEDULED',
        tripId: trip?._id || null
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}
