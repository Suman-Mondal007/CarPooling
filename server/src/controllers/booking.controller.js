import Ride from '../models/Ride.js';
import Trip from '../models/Trip.js';
import Booking from '../models/Booking.js';
import { toGeoJsonPoint, fromGeoJsonPoint } from '../utils/geo.js';
import { getPassengerLifecycle } from '../utils/lifecycle.js';
import { notifyBookingCreated, notifyBookingCancelled } from '../services/notification.service.js';

function formatBooking(booking, trip = null) {
  const obj = booking.toObject ? booking.toObject() : { ...booking };
  const tripStatus = trip?.status || obj.trip?.status || (obj.ride?.trip ? obj.ride.trip.status : 'SCHEDULED');
  const lifecycle = getPassengerLifecycle({
    tripStatus,
    bookingStatus: obj.status,
    paymentStatus: obj.paymentStatus
  });

  return {
    ...obj,
    pickupCoords: fromGeoJsonPoint(obj.pickupPoint),
    dropCoords: fromGeoJsonPoint(obj.dropPoint),
    fareTotalRupees: obj.fareTotalMinor ? obj.fareTotalMinor / 100 : 0,
    lifecycle
  };
}

/**
 * Atomic seat reservation and booking creation for a single ride.
 */
async function executeSingleBooking({ rideId, seats, pickup, drop, user, organization }) {
  const now = new Date();
  const seatsNum = Number(seats);

  // 1. Fetch candidate ride
  const initialRide = await Ride.findOne({
    _id: rideId,
    organization: organization._id
  });

  if (!initialRide) {
    const err = new Error('Ride not found or does not belong to your organization');
    err.status = 404;
    err.code = 'RIDE_NOT_FOUND';
    throw err;
  }

  // Reject booking own ride
  if (initialRide.driver.toString() === user._id.toString()) {
    const err = new Error('You cannot book a seat on a ride you are offering');
    err.status = 400;
    err.code = 'CANNOT_BOOK_OWN_RIDE';
    throw err;
  }

  // Reject past departure
  if (new Date(initialRide.departureAt) <= now) {
    const err = new Error('Cannot book ride that has already departed');
    err.status = 400;
    err.code = 'RIDE_ALREADY_DEPARTED';
    throw err;
  }

  // Reject non-open rides
  if (initialRide.status !== 'OPEN') {
    const err = new Error(`Ride is ${initialRide.status.toLowerCase()} and no longer bookable`);
    err.status = 400;
    err.code = 'RIDE_NOT_BOOKABLE';
    throw err;
  }

  // 2. Associated Trip must be SCHEDULED
  const trip = await Trip.findOne({ ride: initialRide._id });
  if (!trip || trip.status !== 'SCHEDULED') {
    const err = new Error('Trip is no longer scheduled for booking');
    err.status = 400;
    err.code = 'TRIP_NOT_SCHEDULED';
    throw err;
  }

  // 3. Duplicate confirmed booking check
  const existingBooking = await Booking.findOne({
    ride: initialRide._id,
    passenger: user._id,
    status: 'CONFIRMED'
  });

  if (existingBooking) {
    const err = new Error('You already have a confirmed booking on this ride');
    err.status = 409;
    err.code = 'DUPLICATE_BOOKING';
    throw err;
  }

  // 4. Overlapping commitments check (passenger has active booking or offered ride at same time)
  const candidateDepartureMs = new Date(initialRide.departureAt).getTime();
  const windowMs = 30 * 60 * 1000; // 30 min window

  const conflictingBookings = await Booking.find({
    passenger: user._id,
    status: 'CONFIRMED'
  }).populate('ride', 'departureAt');

  for (const cb of conflictingBookings) {
    if (cb.ride && cb.ride.departureAt) {
      const depMs = new Date(cb.ride.departureAt).getTime();
      if (Math.abs(depMs - candidateDepartureMs) < windowMs) {
        const err = new Error('You have another overlapping confirmed ride booking at this time');
        err.status = 409;
        err.code = 'OVERLAPPING_COMMITMENT';
        throw err;
      }
    }
  }

  const conflictingOffers = await Ride.find({
    driver: user._id,
    status: 'OPEN',
    departureAt: {
      $gte: new Date(candidateDepartureMs - windowMs),
      $lte: new Date(candidateDepartureMs + windowMs)
    }
  });

  if (conflictingOffers.length > 0) {
    const err = new Error('You are offering another ride scheduled at the same time');
    err.status = 409;
    err.code = 'OVERLAPPING_COMMITMENT';
    throw err;
  }

  // 5. ONE Atomic Update to reserve seats on the Ride
  const reservedRide = await Ride.findOneAndUpdate(
    {
      _id: initialRide._id,
      organization: organization._id,
      status: 'OPEN',
      availableSeats: { $gte: seatsNum },
      departureAt: { $gt: now }
    },
    { $inc: { availableSeats: -seatsNum } },
    { new: true }
  );

  if (!reservedRide) {
    const err = new Error('Not enough seats available or ride is no longer bookable');
    err.status = 400;
    err.code = 'SEATS_UNAVAILABLE';
    throw err;
  }

  // 6. Compute fareTotalMinor strictly on server
  const fareTotalMinor = seatsNum * reservedRide.farePerSeatMinor;

  // 7. Create Booking with compensating rollback on failure
  let booking;
  try {
    booking = await Booking.create({
      ride: reservedRide._id,
      passenger: user._id,
      organization: organization._id,
      seats: seatsNum,
      pickupAddress: pickup.address,
      pickupPoint: toGeoJsonPoint(pickup),
      dropAddress: drop.address,
      dropPoint: toGeoJsonPoint(drop),
      fareTotalMinor,
      status: 'CONFIRMED',
      paymentStatus: 'UNPAID'
    });
  } catch (creationError) {
    // Compensating seat restoration
    await Ride.updateOne({ _id: reservedRide._id }, { $inc: { availableSeats: seatsNum } });

    if (creationError.code === 11000) {
      const err = new Error('You already have a confirmed booking on this ride');
      err.status = 409;
      err.code = 'DUPLICATE_BOOKING';
      throw err;
    }
    throw creationError;
  }

  // 8. Trigger notification to driver
  notifyBookingCreated(booking, reservedRide, user).catch(() => {});

  return formatBooking(booking, trip);
}

export async function createBooking(req, res, next) {
  try {
    const data = req.validatedData || req.body;
    const formatted = await executeSingleBooking({
      rideId: data.rideId,
      seats: data.seats,
      pickup: data.pickup,
      drop: data.drop,
      user: req.user,
      organization: req.organization
    });

    res.status(201).json({
      success: true,
      data: formatted,
      error: null
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        data: null,
        error: {
          code: error.code || 'BOOKING_FAILED',
          message: error.message,
          details: null
        }
      });
    }
    next(error);
  }
}

export async function createSeriesBooking(req, res, next) {
  try {
    const { bookings } = req.validatedData || req.body;
    const results = [];

    for (const item of bookings) {
      try {
        const booked = await executeSingleBooking({
          rideId: item.rideId,
          seats: item.seats,
          pickup: item.pickup,
          drop: item.drop,
          user: req.user,
          organization: req.organization
        });
        results.push({
          rideId: item.rideId,
          success: true,
          booking: booked,
          error: null
        });
      } catch (err) {
        results.push({
          rideId: item.rideId,
          success: false,
          booking: null,
          error: {
            code: err.code || 'BOOKING_FAILED',
            message: err.message
          }
        });
      }
    }

    const totalSuccess = results.filter((r) => r.success).length;

    res.status(200).json({
      success: true,
      data: {
        results,
        totalRequested: bookings.length,
        totalSuccess,
        totalFailed: bookings.length - totalSuccess
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelBooking(req, res, next) {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      passenger: req.user._id,
      organization: req.organization._id
    }).populate('ride');

    if (!booking) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: 'Booking not found or does not belong to you',
          details: null
        }
      });
    }

    if (booking.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_BOOKING_STATUS',
          message: `Cannot cancel booking with status ${booking.status}`,
          details: null
        }
      });
    }

    // Verify trip is still SCHEDULED
    const trip = await Trip.findOne({ ride: booking.ride._id });
    if (!trip || trip.status !== 'SCHEDULED') {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'TRIP_ALREADY_STARTED',
          message: 'Cannot cancel booking after the trip has already started or completed',
          details: null
        }
      });
    }

    // Check cancellation cutoff window
    const cutoffMinutes = req.organization.settings?.cancellationCutoffMinutes || 60;
    const timeToDepartureMs = new Date(booking.ride.departureAt).getTime() - Date.now();
    const isLate = timeToDepartureMs <= cutoffMinutes * 60 * 1000;

    // Atomic update guarded on CONFIRMED status
    const updatedBooking = await Booking.findOneAndUpdate(
      { _id: booking._id, status: 'CONFIRMED' },
      {
        status: 'CANCELLED_BY_PASSENGER',
        lateCancellation: isLate
      },
      { new: true }
    );

    if (!updatedBooking) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'ALREADY_CANCELLED',
          message: 'Booking has already been cancelled',
          details: null
        }
      });
    }

    // Return reserved seats atomically
    await Ride.updateOne(
      { _id: booking.ride._id },
      { $inc: { availableSeats: booking.seats } }
    );

    // Notify driver
    notifyBookingCancelled(updatedBooking, booking.ride, req.user._id).catch(() => {});

    res.status(200).json({
      success: true,
      data: {
        booking: formatBooking(updatedBooking, trip),
        lateCancellation: isLate,
        message: isLate
          ? 'Booking cancelled. Note: Marked as late cancellation as departure is near.'
          : 'Booking cancelled successfully.'
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyBookings(req, res, next) {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {
      passenger: req.user._id,
      organization: req.organization._id
    };

    if (status) {
      query.status = status;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate({
          path: 'ride',
          populate: [
            { path: 'driver', select: 'name phone' },
            { path: 'vehicle', select: 'model registrationNumber vehicleType color fuelType' }
          ]
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Booking.countDocuments(query)
    ]);

    // Fetch trips for lifecycle
    const rideIds = bookings.map((b) => b.ride?._id).filter(Boolean);
    const trips = await Trip.find({ ride: { $in: rideIds } }).select('ride status startedAt completedAt');
    const tripMap = new Map(trips.map((t) => [t.ride.toString(), t]));

    const items = bookings.map((b) => {
      const trip = b.ride ? tripMap.get(b.ride._id.toString()) : null;
      return formatBooking(b, trip);
    });

    res.status(200).json({
      success: true,
      data: {
        items,
        total,
        page: pageNum,
        limit: limitNum
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function getBookingById(req, res, next) {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      organization: req.organization._id
    }).populate({
      path: 'ride',
      populate: [
        { path: 'driver', select: 'name phone' },
        { path: 'vehicle', select: 'model registrationNumber vehicleType color fuelType' }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: 'Booking not found',
          details: null
        }
      });
    }

    // Owner passenger or ride driver only
    const isPassenger = booking.passenger.toString() === req.user._id.toString();
    const isDriver = booking.ride?.driver?._id?.toString() === req.user._id.toString();

    if (!isPassenger && !isDriver) {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to view this booking',
          details: null
        }
      });
    }

    const trip = await Trip.findOne({ ride: booking.ride?._id });

    res.status(200).json({
      success: true,
      data: formatBooking(booking, trip),
      error: null
    });
  } catch (error) {
    next(error);
  }
}
