import Vehicle from '../models/Vehicle.js';
import Ride from '../models/Ride.js';
import Trip from '../models/Trip.js';

export async function getVehicles(req, res, next) {
  try {
    const vehicles = await Vehicle.find({
      owner: req.user._id,
      organization: req.organization._id,
      isDeleted: false
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        items: vehicles,
        total: vehicles.length
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function getVehicleById(req, res, next) {
  try {
    const vehicle = await Vehicle.findOne({
      _id: req.params.id,
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
          message: 'Vehicle not found or does not belong to you',
          details: null
        }
      });
    }

    res.status(200).json({
      success: true,
      data: vehicle,
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function createVehicle(req, res, next) {
  try {
    const data = req.validatedData || req.body;
    const normalizedReg = data.registrationNumber.replace(/[\s-]/g, '').toUpperCase();

    // Check if vehicle with same registration already exists in organization
    const existing = await Vehicle.findOne({
      registrationNumber: normalizedReg,
      organization: req.organization._id,
      isDeleted: false
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        data: null,
        error: {
          code: 'REGISTRATION_EXISTS',
          message: 'A vehicle with this registration number is already registered in your organization',
          details: null
        }
      });
    }

    // Determine initial verification status based on organization settings
    // If organization requires verification, default is PENDING, otherwise VERIFIED
    const autoVerified = !req.organization.settings?.requireVehicleVerification;

    const vehicle = await Vehicle.create({
      ...data,
      registrationNumber: normalizedReg,
      owner: req.user._id,
      organization: req.organization._id,
      verificationStatus: autoVerified ? 'VERIFIED' : 'PENDING'
    });

    res.status(201).json({
      success: true,
      data: vehicle,
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function updateVehicle(req, res, next) {
  try {
    const data = req.validatedData || req.body;
    const vehicle = await Vehicle.findOne({
      _id: req.params.id,
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
          message: 'Vehicle not found',
          details: null
        }
      });
    }

    // Apply allowed updates
    if (data.model !== undefined) vehicle.model = data.model;
    if (data.color !== undefined) vehicle.color = data.color;
    if (data.imageUrl !== undefined) vehicle.imageUrl = data.imageUrl;
    if (data.fuelEfficiencyKmpl !== undefined) vehicle.fuelEfficiencyKmpl = data.fuelEfficiencyKmpl;
    if (data.seatingCapacity !== undefined) vehicle.seatingCapacity = data.seatingCapacity;

    await vehicle.save();

    res.status(200).json({
      success: true,
      data: vehicle,
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteVehicle(req, res, next) {
  try {
    const vehicle = await Vehicle.findOne({
      _id: req.params.id,
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
          message: 'Vehicle not found',
          details: null
        }
      });
    }

    // Check if vehicle is assigned to active rides
    const activeRide = await Ride.findOne({
      vehicle: vehicle._id,
      status: 'OPEN'
    });

    if (activeRide) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'VEHICLE_IN_USE',
          message: 'Cannot delete vehicle assigned to active or upcoming rides. Please cancel the rides first.',
          details: null
        }
      });
    }

    // Check active trips
    const activeTrip = await Trip.findOne({
      driver: req.user._id,
      status: { $in: ['SCHEDULED', 'STARTED', 'IN_PROGRESS'] }
    }).populate('ride');

    if (activeTrip && activeTrip.ride && activeTrip.ride.vehicle?.toString() === vehicle._id.toString()) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'VEHICLE_IN_USE',
          message: 'Cannot delete vehicle currently associated with an active trip.',
          details: null
        }
      });
    }

    // Soft-delete
    vehicle.isDeleted = true;
    await vehicle.save();

    res.status(200).json({
      success: true,
      data: { message: 'Vehicle deleted successfully', id: vehicle._id },
      error: null
    });
  } catch (error) {
    next(error);
  }
}
