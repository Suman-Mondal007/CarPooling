import SavedPlace from '../models/SavedPlace.js';
import { toGeoJsonPoint, fromGeoJsonPoint } from '../utils/geo.js';

function formatPlace(place) {
  const obj = place.toObject ? place.toObject() : { ...place };
  const coords = fromGeoJsonPoint(obj.location);
  return {
    _id: obj._id,
    label: obj.label,
    placeType: obj.placeType,
    address: obj.address,
    lat: coords ? coords.lat : null,
    lng: coords ? coords.lng : null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
}

export async function getSavedPlaces(req, res, next) {
  try {
    const places = await SavedPlace.find({
      user: req.user._id,
      organization: req.organization._id
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        items: places.map(formatPlace),
        total: places.length
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function getSavedPlaceById(req, res, next) {
  try {
    const place = await SavedPlace.findOne({
      _id: req.params.id,
      user: req.user._id,
      organization: req.organization._id
    });

    if (!place) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'PLACE_NOT_FOUND',
          message: 'Saved place not found',
          details: null
        }
      });
    }

    res.status(200).json({
      success: true,
      data: formatPlace(place),
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function createSavedPlace(req, res, next) {
  try {
    const data = req.validatedData || req.body;

    const location = toGeoJsonPoint({ lat: data.lat, lng: data.lng });

    const place = await SavedPlace.create({
      user: req.user._id,
      organization: req.organization._id,
      label: data.label,
      placeType: data.placeType,
      address: data.address,
      location
    });

    res.status(201).json({
      success: true,
      data: formatPlace(place),
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSavedPlace(req, res, next) {
  try {
    const data = req.validatedData || req.body;
    const place = await SavedPlace.findOne({
      _id: req.params.id,
      user: req.user._id,
      organization: req.organization._id
    });

    if (!place) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'PLACE_NOT_FOUND',
          message: 'Saved place not found',
          details: null
        }
      });
    }

    if (data.label !== undefined) place.label = data.label;
    if (data.placeType !== undefined) place.placeType = data.placeType;
    if (data.address !== undefined) place.address = data.address;
    if (data.lat !== undefined && data.lng !== undefined) {
      place.location = toGeoJsonPoint({ lat: data.lat, lng: data.lng });
    }

    await place.save();

    res.status(200).json({
      success: true,
      data: formatPlace(place),
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteSavedPlace(req, res, next) {
  try {
    const place = await SavedPlace.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
      organization: req.organization._id
    });

    if (!place) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'PLACE_NOT_FOUND',
          message: 'Saved place not found',
          details: null
        }
      });
    }

    res.status(200).json({
      success: true,
      data: { message: 'Place deleted successfully', id: place._id },
      error: null
    });
  } catch (error) {
    next(error);
  }
}
