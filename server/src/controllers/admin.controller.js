import crypto from 'crypto';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import Ride from '../models/Ride.js';
import Trip from '../models/Trip.js';
import Booking from '../models/Booking.js';
import Organization from '../models/Organization.js';
import RefreshSession from '../models/RefreshSession.js';
import { createNotification, notifyRideCancelled } from '../services/notification.service.js';
import { getOrganizationReport, getAdminSummary } from '../services/analytics.service.js';
import { emitTripStatus, getIO } from '../sockets/emitter.js';

// ─── Admin Summary ─────────────────────────────────────
export async function getSummary(req, res, next) {
  try {
    const summary = await getAdminSummary(req.organizationId);
    res.status(200).json({ success: true, data: summary, error: null });
  } catch (error) { next(error); }
}

// ─── Employees ─────────────────────────────────────────
export async function getEmployees(req, res, next) {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const filter = { organization: req.organizationId, role: 'EMPLOYEE' };
    if (status && status !== 'all') filter.status = status;
    if (search) {
      const q = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: q }, { email: q }, { employeeId: q }];
    }

    const total = await User.countDocuments(filter);
    const employees = await User.find(filter)
      .select('name email phone employeeId status licenceNumber licenceExpiry createdAt notificationPreferences')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    // Participation counts
    const userIds = employees.map((e) => e._id);
    const [rideCounts, bookingCounts] = await Promise.all([
      Ride.aggregate([
        { $match: { driver: { $in: userIds }, organization: req.organizationId } },
        { $group: { _id: '$driver', count: { $sum: 1 } } }
      ]),
      Booking.aggregate([
        { $match: { passenger: { $in: userIds }, organization: req.organizationId } },
        { $group: { _id: '$passenger', count: { $sum: 1 } } }
      ])
    ]);

    const rideMap = new Map(rideCounts.map((r) => [r._id.toString(), r.count]));
    const bookMap = new Map(bookingCounts.map((b) => [b._id.toString(), b.count]));

    const items = employees.map((e) => ({
      ...e,
      ridesOffered: rideMap.get(e._id.toString()) || 0,
      bookingsMade: bookMap.get(e._id.toString()) || 0
    }));

    const pages = Math.ceil(total / limitNum) || 1;

    res.status(200).json({
      success: true,
      data: {
        employees: items,
        items,
        page: pageNum,
        limit: limitNum,
        total,
        pagination: { page: pageNum, limit: limitNum, total, pages }
      },
      error: null
    });
  } catch (error) { next(error); }
}

// Allowed status transitions
const ALLOWED_TRANSITIONS = {
  PENDING_APPROVAL: ['ACTIVE', 'DEACTIVATED'],
  ACTIVE: ['SUSPENDED', 'DEACTIVATED'],
  SUSPENDED: ['ACTIVE', 'DEACTIVATED'],
  DEACTIVATED: ['ACTIVE']
};

export async function updateEmployeeStatus(req, res, next) {
  try {
    const { status, reason } = req.body;
    const targetId = req.params.id;

    // Cannot change own status
    if (targetId === req.user._id.toString()) {
      return res.status(403).json({
        success: false, data: null,
        error: { code: 'CANNOT_CHANGE_OWN_STATUS', message: 'Admins cannot change their own status' }
      });
    }

    const target = await User.findOne({ _id: targetId, organization: req.organizationId });
    if (!target) {
      return res.status(404).json({
        success: false, data: null,
        error: { code: 'USER_NOT_FOUND', message: 'Employee not found in your organization' }
      });
    }

    // Cannot change another admin's status
    if (target.role === 'COMPANY_ADMIN') {
      return res.status(403).json({
        success: false, data: null,
        error: { code: 'CANNOT_CHANGE_ADMIN', message: 'Cannot change another admin\'s status' }
      });
    }

    // Validate transition
    const allowed = ALLOWED_TRANSITIONS[target.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false, data: null,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Cannot transition from ${target.status} to ${status}`,
          details: { currentStatus: target.status, allowedTransitions: allowed }
        }
      });
    }

    const oldStatus = target.status;
    target.status = status;
    await target.save();

    // On SUSPENDED or DEACTIVATED: revoke sessions, disconnect sockets, cancel future rides/bookings
    if (status === 'SUSPENDED' || status === 'DEACTIVATED') {
      // Revoke all refresh sessions
      await RefreshSession.updateMany(
        { user: target._id, revokedAt: null },
        { revokedAt: new Date() }
      );

      // Disconnect sockets
      const io = getIO();
      if (io) {
        const room = `user:${target._id}`;
        try { io.in(room).disconnectSockets(true); } catch { /* ignore */ }
      }

      // Cancel future OPEN rides offered by this user
      const now = new Date();
      const futureRides = await Ride.find({
        driver: target._id,
        organization: req.organizationId,
        status: 'OPEN',
        departureAt: { $gt: now }
      });

      for (const ride of futureRides) {
        ride.status = 'CANCELLED';
        await ride.save();

        const trip = await Trip.findOne({ ride: ride._id });
        if (trip && trip.status === 'SCHEDULED') {
          trip.status = 'CANCELLED';
          await trip.save();
          emitTripStatus(trip._id, 'CANCELLED', { message: 'Ride cancelled: driver account suspended/deactivated' });
        }

        // Cancel confirmed bookings and return seats
        const bookings = await Booking.find({ ride: ride._id, status: 'CONFIRMED' });
        for (const booking of bookings) {
          booking.status = 'CANCELLED_BY_DRIVER';
          await booking.save();
          // Return seats atomically
          await Ride.updateOne({ _id: ride._id }, { $inc: { availableSeats: booking.seats } });
        }
        notifyRideCancelled(ride, bookings).catch(() => {});
      }

      // Cancel future CONFIRMED bookings as passenger
      const futureBookings = await Booking.find({
        passenger: target._id,
        organization: req.organizationId,
        status: 'CONFIRMED'
      }).populate('ride', 'departureAt driver');

      for (const booking of futureBookings) {
        if (booking.ride?.departureAt > now) {
          booking.status = 'CANCELLED_BY_PASSENGER';
          await booking.save();
          // Return seats
          await Ride.updateOne(
            { _id: booking.ride._id },
            { $inc: { availableSeats: booking.seats } }
          );
          // Notify driver
          createNotification({
            userId: booking.ride.driver,
            organizationId: req.organizationId,
            type: 'BOOKING_CANCELLED',
            title: 'Booking Cancelled',
            message: `${target.name}'s booking was cancelled due to account ${status.toLowerCase()}.`,
            referenceId: booking._id,
            referenceModel: 'Booking'
          }).catch(() => {});
        }
      }

      // Notify the user
      createNotification({
        userId: target._id,
        organizationId: req.organizationId,
        type: 'EMPLOYEE_SUSPENDED',
        title: `Account ${status === 'SUSPENDED' ? 'Suspended' : 'Deactivated'}`,
        message: reason || `Your account has been ${status.toLowerCase()} by an administrator.`,
        referenceModel: null
      }).catch(() => {});
    }

    // Notify approved users
    if (status === 'ACTIVE' && oldStatus === 'PENDING_APPROVAL') {
      createNotification({
        userId: target._id,
        organizationId: req.organizationId,
        type: 'EMPLOYEE_APPROVED',
        title: 'Account Approved',
        message: 'Your account has been approved. You can now use all platform features.',
        referenceModel: null
      }).catch(() => {});
    }

    if (status === 'ACTIVE' && (oldStatus === 'SUSPENDED' || oldStatus === 'DEACTIVATED')) {
      createNotification({
        userId: target._id,
        organizationId: req.organizationId,
        type: 'EMPLOYEE_APPROVED',
        title: 'Account Reactivated',
        message: 'Your account has been reactivated by an administrator.',
        referenceModel: null
      }).catch(() => {});
    }

    res.status(200).json({
      success: true,
      data: {
        userId: target._id,
        previousStatus: oldStatus,
        newStatus: status,
        reason: reason || null
      },
      error: null
    });
  } catch (error) { next(error); }
}

// ─── Vehicles ──────────────────────────────────────────
export async function getVehicles(req, res, next) {
  try {
    const { verificationStatus, status, search, page = 1, limit = 10 } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const vStatus = (verificationStatus && verificationStatus !== 'all')
      ? verificationStatus
      : (status && status !== 'all' ? status : null);

    const filter = { organization: req.organizationId, isDeleted: false };
    if (vStatus) filter.verificationStatus = vStatus;

    if (search) {
      const q = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matchingUsers = await User.find({
        organization: req.organizationId,
        $or: [{ name: q }, { email: q }]
      }).select('_id');
      const userIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { model: q },
        { registrationNumber: q },
        { owner: { $in: userIds } }
      ];
    }

    const total = await Vehicle.countDocuments(filter);
    const vehicles = await Vehicle.find(filter)
      .populate('owner', 'name email employeeId')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const pages = Math.ceil(total / limitNum) || 1;

    res.status(200).json({
      success: true,
      data: {
        vehicles,
        items: vehicles,
        pagination: { page: pageNum, limit: limitNum, total, pages }
      },
      error: null
    });
  } catch (error) { next(error); }
}

export async function verifyVehicle(req, res, next) {
  try {
    const decision = req.body.decision || req.body.status;
    const reason = req.body.reason || req.body.rejectionReason;
    const vehicle = await Vehicle.findOne({
      _id: req.params.id,
      organization: req.organizationId,
      isDeleted: false
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false, data: null,
        error: { code: 'VEHICLE_NOT_FOUND', message: 'Vehicle not found' }
      });
    }

    vehicle.verificationStatus = decision;
    vehicle.rejectionReason = decision === 'REJECTED' ? (reason || null) : null;
    await vehicle.save();

    // Notify owner
    const notifType = decision === 'VERIFIED' ? 'VEHICLE_VERIFIED' : 'VEHICLE_REJECTED';
    createNotification({
      userId: vehicle.owner,
      organizationId: req.organizationId,
      type: notifType,
      title: decision === 'VERIFIED' ? 'Vehicle Verified' : 'Vehicle Rejected',
      message: decision === 'VERIFIED'
        ? `Your vehicle ${vehicle.model} (${vehicle.registrationNumber}) has been verified.`
        : `Your vehicle ${vehicle.model} (${vehicle.registrationNumber}) was rejected: ${reason}`,
      referenceId: vehicle._id,
      referenceModel: 'Vehicle'
    }).catch(() => {});

    res.status(200).json({
      success: true,
      data: { vehicleId: vehicle._id, verificationStatus: decision, reason: reason || null },
      error: null
    });
  } catch (error) { next(error); }
}

// ─── Settings ──────────────────────────────────────────
export async function getSettings(req, res, next) {
  try {
    const org = await Organization.findById(req.organizationId);
    res.status(200).json({
      success: true,
      data: {
        settings: org?.settings || {},
        registrationCode: org?.registrationCode,
        name: org?.name,
        timezone: org?.timezone
      },
      error: null
    });
  } catch (error) { next(error); }
}

export async function updateSettings(req, res, next) {
  try {
    const updates = {};
    const body = req.body;

    // Build nested updates for settings fields
    const settingsFields = [
      'fuelPricePerLitre', 'operationalCostPerKm', 'cancellationCutoffMinutes',
      'autoApproveEmployees', 'requireVehicleVerification', 'requireEmployeeId',
      'allowStartWithoutPassengers'
    ];
    for (const key of settingsFields) {
      if (body[key] !== undefined) updates[`settings.${key}`] = body[key];
    }
    if (body.timezone) updates.timezone = body.timezone;

    const org = await Organization.findByIdAndUpdate(
      req.organizationId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: { settings: org.settings, timezone: org.timezone, registrationCode: org.registrationCode },
      error: null
    });
  } catch (error) { next(error); }
}

export async function regenerateCode(req, res, next) {
  try {
    // Generate a new unique uppercase code
    const newCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const org = await Organization.findByIdAndUpdate(
      req.organizationId,
      { registrationCode: newCode },
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: {
        registrationCode: org.registrationCode,
        message: 'Registration code regenerated. Existing members are unaffected; the old code will no longer work for new registrations.'
      },
      error: null
    });
  } catch (error) { next(error); }
}

// ─── Ride Monitoring (READ ONLY) ────────────────────────
export async function getRides(req, res, next) {
  try {
    const { status, dateFrom, dateTo, driverId, page, limit } = req.query;
    const filter = { organization: req.organizationId };
    if (status !== 'all') filter.status = status;
    if (driverId) filter.driver = driverId;
    if (dateFrom || dateTo) {
      filter.departureAt = {};
      if (dateFrom) filter.departureAt.$gte = new Date(dateFrom);
      if (dateTo) filter.departureAt.$lte = new Date(dateTo);
    }

    const total = await Ride.countDocuments(filter);
    const rides = await Ride.find(filter)
      .populate('driver', 'name email')
      .populate('vehicle', 'model registrationNumber vehicleType')
      .sort({ departureAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Get trip statuses and booking counts
    const rideIds = rides.map((r) => r._id);
    const [trips, bookings] = await Promise.all([
      Trip.find({ ride: { $in: rideIds } }).select('ride status').lean(),
      Booking.aggregate([
        { $match: { ride: { $in: rideIds }, status: 'CONFIRMED' } },
        { $group: { _id: '$ride', totalSeats: { $sum: '$seats' }, count: { $sum: 1 } } }
      ])
    ]);

    const tripMap = new Map(trips.map((t) => [t.ride.toString(), t.status]));
    const bookingMap = new Map(bookings.map((b) => [b._id.toString(), b]));

    const items = rides.map((r) => ({
      ...r,
      tripStatus: tripMap.get(r._id.toString()) || 'SCHEDULED',
      bookings: {
        count: bookingMap.get(r._id.toString())?.count || 0,
        seatsBooked: bookingMap.get(r._id.toString())?.totalSeats || 0
      }
    }));

    res.status(200).json({
      success: true,
      data: { items, page, limit, total },
      error: null
    });
  } catch (error) { next(error); }
}

// ─── Reports ──────────────────────────────────────────
export async function getReports(req, res, next) {
  try {
    const { from, to, format } = req.query;

    const now = new Date();
    const toDate = to ? new Date(to) : now;
    const fromDate = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Max range 366 days
    const daysDiff = (toDate - fromDate) / (1000 * 60 * 60 * 24);
    if (daysDiff > 366 || daysDiff < 0) {
      return res.status(400).json({
        success: false, data: null,
        error: { code: 'INVALID_DATE_RANGE', message: 'Date range must be between 0 and 366 days' }
      });
    }

    const org = await Organization.findById(req.organizationId);
    const report = await getOrganizationReport(req.organizationId, fromDate, toDate, org.settings);

    if (format === 'csv') {
      // Generate CSV for vehicle-wise table
      let csv = 'Vehicle Model,Registration,Fuel Type,Trips,Distance (km),Fuel (litres),Cost (₹),Cost/km (₹)\n';
      for (const v of report.vehicleWiseCost) {
        csv += `"${v.model}","${v.registrationNumber}","${v.fuelType}",${v.trips},${v.distanceKm},${v.fuelLitres},${v.cost / 100},${v.costPerKm / 100}\n`;
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="organization-report.csv"');
      return res.send(csv);
    }

    res.status(200).json({ success: true, data: report, error: null });
  } catch (error) { next(error); }
}
