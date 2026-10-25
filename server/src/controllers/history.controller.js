import Trip from '../models/Trip.js';
import Ride from '../models/Ride.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';

/**
 * GET /api/history
 * Returns completed and cancelled trips for the caller as both driver and passenger.
 * Supports search, filters, sorting, and pagination.
 */
export async function getHistory(req, res, next) {
  try {
    const {
      search, role, status, paymentStatus,
      dateFrom, dateTo, sortBy, sortOrder,
      page, limit
    } = req.query;

    const userId = req.user._id;
    const orgId = req.organizationId;
    const results = [];

    // 1. Find trips as driver (completed/cancelled)
    if (role === 'all' || role === 'driver') {
      const driverFilter = {
        driver: userId,
        organization: orgId,
        status: { $in: ['COMPLETED', 'CANCELLED'] }
      };
      if (status !== 'all') driverFilter.status = status;
      if (dateFrom || dateTo) {
        driverFilter.createdAt = {};
        if (dateFrom) driverFilter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) driverFilter.createdAt.$lte = new Date(dateTo);
      }

      const driverTrips = await Trip.find(driverFilter).select('ride status startedAt completedAt createdAt').lean();
      const driverRideIds = driverTrips.map((t) => t.ride);

      const driverRides = await Ride.find({ _id: { $in: driverRideIds } })
        .select('originAddress destinationAddress distanceMeters departureAt farePerSeatMinor vehicleSnapshot vehicle totalPassengerSeats').lean();
      const driverRideMap = new Map(driverRides.map((r) => [r._id.toString(), r]));

      // Bookings and payments for earnings calc
      const driverBookings = await Booking.find({ ride: { $in: driverRideIds }, status: 'COMPLETED' })
        .select('ride passenger seats fareTotalMinor paymentStatus').populate('passenger', 'name').lean();

      const driverPayments = await Payment.find({
        driver: userId, trip: { $in: driverTrips.map(t => t._id) }, status: 'PAID'
      }).select('amountMinor trip').lean();
      const paymentByTrip = new Map();
      for (const p of driverPayments) {
        const key = p.trip.toString();
        paymentByTrip.set(key, (paymentByTrip.get(key) || 0) + p.amountMinor);
      }

      for (const trip of driverTrips) {
        const ride = driverRideMap.get(trip.ride.toString());
        if (!ride) continue;

        const passengers = driverBookings
          .filter((b) => b.ride.toString() === trip.ride.toString())
          .map((b) => ({ name: b.passenger?.name || 'Unknown', seats: b.seats, paymentStatus: b.paymentStatus }));

        const earned = paymentByTrip.get(trip._id.toString()) || 0;

        results.push({
          tripId: trip._id,
          role: 'driver',
          originAddress: ride.originAddress,
          destinationAddress: ride.destinationAddress,
          departureAt: ride.departureAt,
          distanceMeters: ride.distanceMeters,
          vehicleModel: ride.vehicleSnapshot?.model || '',
          vehicleRegistration: ride.vehicleSnapshot?.registrationNumber || '',
          fareMinor: earned,
          tripStatus: trip.status,
          bookingStatus: null,
          paymentStatus: passengers.length > 0
            ? (passengers.every((p) => p.paymentStatus === 'PAID') ? 'PAID' : 'UNPAID')
            : 'N/A',
          participants: passengers
        });
      }
    }

    // 2. Find bookings as passenger (completed/cancelled)
    if (role === 'all' || role === 'passenger') {
      const passengerFilter = {
        passenger: userId,
        organization: orgId,
        status: { $in: ['COMPLETED', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER'] }
      };
      if (dateFrom || dateTo) {
        passengerFilter.createdAt = {};
        if (dateFrom) passengerFilter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) passengerFilter.createdAt.$lte = new Date(dateTo);
      }

      const passengerBookings = await Booking.find(passengerFilter)
        .select('ride seats fareTotalMinor status paymentStatus createdAt').lean();
      const passengerRideIds = passengerBookings.map((b) => b.ride);

      const passengerRides = await Ride.find({ _id: { $in: passengerRideIds } })
        .populate('driver', 'name phone')
        .select('driver originAddress destinationAddress distanceMeters departureAt farePerSeatMinor vehicleSnapshot vehicle').lean();
      const passengerRideMap = new Map(passengerRides.map((r) => [r._id.toString(), r]));

      const passengerTrips = await Trip.find({ ride: { $in: passengerRideIds } }).select('ride status').lean();
      const tripByRide = new Map(passengerTrips.map((t) => [t.ride.toString(), t]));

      for (const booking of passengerBookings) {
        const ride = passengerRideMap.get(booking.ride.toString());
        if (!ride) continue;
        const trip = tripByRide.get(booking.ride.toString());

        // Filter by tripStatus if status filter is applied
        if (status !== 'all') {
          if (booking.status === 'COMPLETED' && trip?.status !== status) continue;
          if (booking.status !== 'COMPLETED' && status !== 'CANCELLED') continue;
        }

        // Filter by paymentStatus
        if (paymentStatus !== 'all' && booking.paymentStatus !== paymentStatus) continue;

        results.push({
          tripId: trip?._id || null,
          role: 'passenger',
          originAddress: ride.originAddress,
          destinationAddress: ride.destinationAddress,
          departureAt: ride.departureAt,
          distanceMeters: ride.distanceMeters,
          vehicleModel: ride.vehicleSnapshot?.model || '',
          vehicleRegistration: ride.vehicleSnapshot?.registrationNumber || '',
          fareMinor: booking.fareTotalMinor,
          tripStatus: trip?.status || 'UNKNOWN',
          bookingStatus: booking.status,
          paymentStatus: booking.paymentStatus,
          participants: [{
            name: ride.driver?.name || 'Unknown',
            role: 'driver'
          }]
        });
      }
    }

    // 3. Search filter
    let filtered = results;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((item) =>
        (item.originAddress || '').toLowerCase().includes(q) ||
        (item.destinationAddress || '').toLowerCase().includes(q)
      );
    }

    // Also apply payment status filter to driver results
    if (paymentStatus !== 'all' && role !== 'passenger') {
      filtered = filtered.filter((item) =>
        item.role !== 'driver' || item.paymentStatus === paymentStatus || item.paymentStatus === 'N/A'
      );
    }

    // 4. Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'date') cmp = new Date(a.departureAt) - new Date(b.departureAt);
      else if (sortBy === 'fare') cmp = (a.fareMinor || 0) - (b.fareMinor || 0);
      else if (sortBy === 'distance') cmp = (a.distanceMeters || 0) - (b.distanceMeters || 0);
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    // 5. Paginate
    const total = filtered.length;
    const startIdx = (page - 1) * limit;
    const items = filtered.slice(startIdx, startIdx + limit);

    res.status(200).json({
      success: true,
      data: { items, page, limit, total },
      error: null
    });
  } catch (error) {
    next(error);
  }
}
