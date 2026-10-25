import Trip from '../models/Trip.js';
import env from '../config/env.js';
import { processDriverLocation } from '../services/tracking.service.js';

export async function simulateLocation(req, res, next) {
  try {
    // Simulator MUST NOT run in production, and requires ENABLE_TRACKING_SIMULATOR=true
    if (env.NODE_ENV === 'production' || !env.ENABLE_TRACKING_SIMULATOR) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'SIMULATOR_DISABLED',
          message: 'Tracking simulator is disabled in production or not enabled',
          details: null
        }
      });
    }

    const { id: tripId } = req.params;
    const trip = await Trip.findOne({
      _id: tripId,
      organization: req.organization._id
    }).populate('ride');

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

    // Driver-only check
    if (trip.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          code: 'DRIVER_ONLY',
          message: 'Only the driver can simulate trip location',
          details: null
        }
      });
    }

    // Status must be STARTED or IN_PROGRESS
    if (trip.status !== 'STARTED' && trip.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_TRIP_STATUS',
          message: `Cannot simulate location when trip status is ${trip.status}. Must be STARTED or IN_PROGRESS.`,
          details: null
        }
      });
    }

    const coordinates = trip.ride?.routeGeometry?.coordinates; // [[lng, lat], ...]
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
      return res.status(422).json({
        success: false,
        data: null,
        error: {
          code: 'NO_ROUTE_GEOMETRY',
          message: 'This trip does not have stored route geometry to walk along',
          details: null
        }
      });
    }

    // Determine coordinate step
    let stepIndex = parseInt(req.body?.stepIndex ?? req.query?.stepIndex, 10);
    if (isNaN(stepIndex) || stepIndex < 0) {
      stepIndex = 0;
    }
    const safeIndex = stepIndex >= coordinates.length ? coordinates.length - 1 : stepIndex;

    const [lng, lat] = coordinates[safeIndex];

    // Compute heading towards next point if available
    let heading = 0;
    if (safeIndex < coordinates.length - 1) {
      const [nextLng, nextLat] = coordinates[safeIndex + 1];
      const dLng = (nextLng - lng) * Math.PI / 180;
      const y = Math.sin(dLng) * Math.cos(nextLat * Math.PI / 180);
      const x = Math.cos(lat * Math.PI / 180) * Math.sin(nextLat * Math.PI / 180) -
                Math.sin(lat * Math.PI / 180) * Math.cos(nextLat * Math.PI / 180) * Math.cos(dLng);
      heading = Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360);
    }

    // Process update with isSimulated: true
    const result = await processDriverLocation({
      tripId: trip._id,
      driverId: req.user._id,
      lat,
      lng,
      heading,
      speed: 40,
      isSimulated: true
    });

    res.status(200).json({
      success: true,
      data: {
        stepIndex: safeIndex,
        totalSteps: coordinates.length,
        nextStepIndex: safeIndex + 1 < coordinates.length ? safeIndex + 1 : safeIndex,
        isCompleted: safeIndex >= coordinates.length - 1,
        location: { lat, lng },
        heading,
        simulated: true,
        tripStatus: trip.status,
        result
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export default {
  simulateLocation
};
