import Trip from '../models/Trip.js';
import Ride from '../models/Ride.js';
import Booking from '../models/Booking.js';
import { getPassengerLifecycle } from '../utils/lifecycle.js';
import { fromGeoJsonPoint } from '../utils/geo.js';
import { notifyTripStarted, notifyTripCompleted } from '../services/notification.service.js';
import { emitTripStatus } from '../sockets/emitter.js';
import { getTripTrackingState } from '../services/tracking.service.js';

export async function getMyTrips(req, res, next) {
  try {
    const { as = 'all', status, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    let tripQuery = { organization: req.organization._id };

    if (status) {
      tripQuery.status = status;
    }

    if (as === 'driver') {
      tripQuery.driver = req.user._id;
    } else if (as === 'passenger') {
      // Find all rides passenger has booked
      const myBookings = await Booking.find({
        passenger: req.user._id,
        organization: req.organization._id
      }).select('ride');
      const bookedRideIds = myBookings.map((b) => b.ride);
      tripQuery.ride = { $in: bookedRideIds };
    } else {
      // Both driver and passenger
      const myBookings = await Booking.find({
        passenger: req.user._id,
        organization: req.organization._id
      }).select('ride');
      const bookedRideIds = myBookings.map((b) => b.ride);

      tripQuery.$or = [
        { driver: req.user._id },
        { ride: { $in: bookedRideIds } }
      ];
    }

    const [trips, total] = await Promise.all([
      Trip.find(tripQuery)
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
      Trip.countDocuments(tripQuery)
    ]);

    const rideIds = trips.map((t) => t.ride?._id).filter(Boolean);

    // Fetch user bookings on these rides
    const userBookings = await Booking.find({
      ride: { $in: rideIds },
      passenger: req.user._id
    });
    const userBookingMap = new Map(userBookings.map((b) => [b.ride.toString(), b]));

    // Fetch total confirmed bookings count per ride
    const allConfirmed = await Booking.find({
      ride: { $in: rideIds },
      status: 'CONFIRMED'
    }).select('ride seats');
    const rideSeatsCountMap = new Map();
    for (const b of allConfirmed) {
      const rid = b.ride.toString();
      rideSeatsCountMap.set(rid, (rideSeatsCountMap.get(rid) || 0) + b.seats);
    }

    const items = trips.map((t) => {
      const obj = t.toObject ? t.toObject() : { ...t };
      const isDriver = t.driver.toString() === req.user._id.toString();
      const myBooking = obj.ride ? userBookingMap.get(obj.ride._id.toString()) : null;

      const lifecycle = getPassengerLifecycle({
        tripStatus: obj.status,
        bookingStatus: myBooking?.status || 'CONFIRMED',
        paymentStatus: myBooking?.paymentStatus || 'UNPAID'
      });

      return {
        ...obj,
        isDriver,
        myBooking: myBooking
          ? {
              _id: myBooking._id,
              seats: myBooking.seats,
              status: myBooking.status,
              paymentStatus: myBooking.paymentStatus,
              fareTotalMinor: myBooking.fareTotalMinor,
              fareTotalRupees: myBooking.fareTotalMinor ? myBooking.fareTotalMinor / 100 : 0
            }
          : null,
        totalBookedSeats: obj.ride ? (rideSeatsCountMap.get(obj.ride._id.toString()) || 0) : 0,
        lifecycle
      };
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

export async function getTripById(req, res, next) {
  try {
    const trip = await Trip.findOne({
      _id: req.params.id,
      organization: req.organization._id
    }).populate({
      path: 'ride',
      populate: [
        { path: 'driver', select: 'name phone' },
        { path: 'vehicle', select: 'model registrationNumber vehicleType color fuelType' }
      ]
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'TRIP_NOT_FOUND',
          message: 'Trip not found',
          details: null
        }
      });
    }

    const isDriver = trip.driver.toString() === req.user._id.toString();

    // Check if passenger has booking
    const myBooking = await Booking.findOne({
      ride: trip.ride?._id,
      passenger: req.user._id
    });

    if (!isDriver && !myBooking) {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to view this trip',
          details: null
        }
      });
    }

    // Fetch bookings for this trip's ride
    const allBookings = await Booking.find({
      ride: trip.ride?._id
    }).populate('passenger', 'name phone');

    const obj = trip.toObject ? trip.toObject() : { ...trip };
    const lifecycle = getPassengerLifecycle({
      tripStatus: obj.status,
      bookingStatus: myBooking?.status || 'CONFIRMED',
      paymentStatus: myBooking?.paymentStatus || 'UNPAID'
    });

    let passengersResponse;
    if (isDriver) {
      // Driver sees all passenger names, phone, pickup/drop, seats, and status
      passengersResponse = allBookings.map((b) => ({
        _id: b._id,
        passenger: {
          _id: b.passenger?._id,
          name: b.passenger?.name,
          phone: b.passenger?.phone
        },
        seats: b.seats,
        status: b.status,
        paymentStatus: b.paymentStatus,
        pickupAddress: b.pickupAddress,
        dropAddress: b.dropAddress,
        pickupCoords: fromGeoJsonPoint(b.pickupPoint),
        dropCoords: fromGeoJsonPoint(b.dropPoint),
        fareTotalRupees: b.fareTotalMinor ? b.fareTotalMinor / 100 : 0
      }));
    } else {
      // Passenger sees their own booking and other passengers' count only (privacy protection)
      const otherPassengersCount = allBookings.filter(
        (b) => b.passenger?._id.toString() !== req.user._id.toString() && b.status === 'CONFIRMED'
      ).length;

      passengersResponse = {
        myBooking: myBooking
          ? {
              _id: myBooking._id,
              seats: myBooking.seats,
              status: myBooking.status,
              paymentStatus: myBooking.paymentStatus,
              pickupAddress: myBooking.pickupAddress,
              dropAddress: myBooking.dropAddress,
              pickupCoords: fromGeoJsonPoint(myBooking.pickupPoint),
              dropCoords: fromGeoJsonPoint(myBooking.dropPoint),
              fareTotalMinor: myBooking.fareTotalMinor || 0,
              fareTotalRupees: myBooking.fareTotalMinor ? myBooking.fareTotalMinor / 100 : 0
            }
          : null,
        otherConfirmedPassengersCount: otherPassengersCount
      };
    }

    const driverObj = obj.ride?.driver && typeof obj.ride.driver === 'object'
      ? obj.ride.driver
      : (typeof obj.driver === 'object' ? obj.driver : { _id: obj.driver });

    res.status(200).json({
      success: true,
      data: {
        ...obj,
        driver: driverObj,
        bookings: isDriver ? allBookings : (myBooking ? [myBooking] : []),
        isDriver,
        passengers: passengersResponse,
        lifecycle
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function startTrip(req, res, next) {
  try {
    const trip = await Trip.findOne({
      _id: req.params.id,
      driver: req.user._id,
      organization: req.organization._id
    }).populate('ride');

    if (!trip) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'TRIP_NOT_FOUND',
          message: 'Trip not found or you are not the driver',
          details: null
        }
      });
    }

    // Transition validation: trip must be SCHEDULED
    if (trip.status !== 'SCHEDULED') {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Cannot start trip with status ${trip.status}`,
          details: null
        }
      });
    }

    // Check confirmed passengers requirement
    const confirmedBookings = await Booking.find({
      ride: trip.ride._id,
      status: 'CONFIRMED'
    });

    const allowWithoutPassengers = req.organization.settings?.allowStartWithoutPassengers || false;
    if (!allowWithoutPassengers && confirmedBookings.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'NO_PASSENGERS',
          message: 'Cannot start trip without at least one confirmed passenger',
          details: null
        }
      });
    }

    // Update Trip status
    trip.status = 'STARTED';
    trip.startedAt = new Date();
    await trip.save();

    // Close Ride for new bookings
    await Ride.updateOne({ _id: trip.ride._id }, { status: 'CLOSED' });

    // Notify all confirmed passengers
    notifyTripStarted(trip, confirmedBookings).catch(() => {});

    // Broadcast trip status update to trip room
    emitTripStatus(trip._id, 'STARTED', { message: 'Trip has started' });

    res.status(200).json({
      success: true,
      data: {
        message: 'Trip started successfully',
        trip: {
          _id: trip._id,
          status: trip.status,
          startedAt: trip.startedAt
        }
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function completeTrip(req, res, next) {
  try {
    const trip = await Trip.findOne({
      _id: req.params.id,
      driver: req.user._id,
      organization: req.organization._id
    }).populate('ride');

    if (!trip) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'TRIP_NOT_FOUND',
          message: 'Trip not found or you are not the driver',
          details: null
        }
      });
    }

    // Transition validation: trip must be STARTED or IN_PROGRESS
    if (trip.status !== 'STARTED' && trip.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Cannot complete trip with status ${trip.status}. Trip must be started first.`,
          details: null
        }
      });
    }

    // Update Trip status
    trip.status = 'COMPLETED';
    trip.completedAt = new Date();
    await trip.save();

    // Close Ride
    await Ride.updateOne({ _id: trip.ride._id }, { status: 'CLOSED' });

    // Update all confirmed bookings to COMPLETED with paymentStatus UNPAID
    const confirmedBookings = await Booking.find({
      ride: trip.ride._id,
      status: 'CONFIRMED'
    });

    await Booking.updateMany(
      { ride: trip.ride._id, status: 'CONFIRMED' },
      { status: 'COMPLETED', paymentStatus: 'UNPAID' }
    );

    // Notify all confirmed passengers
    notifyTripCompleted(trip, confirmedBookings).catch(() => {});

    // Broadcast trip status update and evict room sockets
    emitTripStatus(trip._id, 'COMPLETED', { message: 'Trip has completed' });

    res.status(200).json({
      success: true,
      data: {
        message: 'Trip completed successfully',
        trip: {
          _id: trip._id,
          status: trip.status,
          completedAt: trip.completedAt
        }
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function getTripTracking(req, res, next) {
  try {
    const tracking = await getTripTrackingState(req.params.id, req.user._id, req.organization._id);
    res.status(200).json({
      success: true,
      data: tracking,
      error: null
    });
  } catch (error) {
    next(error);
  }
}

