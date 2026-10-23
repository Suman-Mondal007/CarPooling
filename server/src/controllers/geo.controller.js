import { searchLocations, reverseGeocode } from '../services/geocoding.service.js';
import { calculateRoute } from '../services/routing.service.js';

export async function handleSearch(req, res, next) {
  try {
    const q = req.query.q || '';
    if (typeof q !== 'string' || q.trim().length < 3) {
      return res.status(200).json({
        success: true,
        data: [],
        error: null
      });
    }

    const results = await searchLocations(q);

    res.status(200).json({
      success: true,
      data: results,
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function handleReverse(req, res, next) {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_COORDINATES',
          message: 'Valid lat and lng query parameters are required',
          details: null
        }
      });
    }

    const result = await reverseGeocode(parseFloat(lat), parseFloat(lng));

    res.status(200).json({
      success: true,
      data: result,
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function handleRoute(req, res, next) {
  try {
    const { origin, destination } = req.body;

    if (!origin || !destination || origin.lat === undefined || origin.lng === undefined || destination.lat === undefined || destination.lng === undefined) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Origin and destination objects with lat and lng are required',
          details: null
        }
      });
    }

    const routeData = await calculateRoute(origin, destination);

    res.status(200).json({
      success: true,
      data: routeData,
      error: null
    });
  } catch (error) {
    next(error);
  }
}
