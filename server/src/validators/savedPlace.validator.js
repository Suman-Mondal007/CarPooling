import { z } from 'zod';
import { PLACE_TYPES } from '../models/SavedPlace.js';

export const createSavedPlaceSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(50),
  placeType: z.enum(PLACE_TYPES).default('CUSTOM'),
  address: z.string().trim().min(1, 'Address is required'),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180)
});

export const updateSavedPlaceSchema = z.object({
  label: z.string().trim().min(1).max(50).optional(),
  placeType: z.enum(PLACE_TYPES).optional(),
  address: z.string().trim().min(1).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional()
});
