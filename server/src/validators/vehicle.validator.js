import { z } from 'zod';
import { VEHICLE_TYPES, FUEL_TYPES } from '../models/Vehicle.js';

// Accepts formats like: KA01AB1234, KA 01 AB 1234, KA-01-AB-1234, 22BH1234AA
const REG_REGEX = /^(?:[A-Z]{2}\s?-?\d{1,2}\s?-?[A-Z]{1,3}\s?-?\d{1,4}|\d{2}BH\d{4}[A-Z]{1,2})$/i;

const DEFAULT_EFFICIENCY = {
  HATCHBACK: 18,
  SEDAN: 15,
  SUV: 12,
  MPV: 13,
  PICKUP: 10,
  VAN: 11,
  OTHER: 14
};

export const createVehicleSchema = z.object({
  model: z.string().trim().min(1, 'Vehicle model is required').max(100),
  registrationNumber: z
    .string()
    .trim()
    .min(1, 'Registration number is required')
    .refine((v) => REG_REGEX.test(v.replace(/[\s-]/g, '')), {
      message: 'Invalid Indian vehicle registration format (e.g. KA01AB1234 or 22BH1234AA)'
    }),
  vehicleType: z.enum(VEHICLE_TYPES, {
    errorMap: () => ({ message: `Vehicle type must be one of: ${VEHICLE_TYPES.join(', ')}` })
  }),
  seatingCapacity: z.coerce
    .number()
    .int('Seating capacity must be an integer')
    .min(2, 'Seating capacity must be at least 2 (including driver)')
    .max(15, 'Seating capacity cannot exceed 15'),
  color: z.string().trim().max(30).optional().default(''),
  imageUrl: z.string().trim().url('Invalid image URL').optional().or(z.literal('')).default(''),
  fuelType: z.enum(FUEL_TYPES, {
    errorMap: () => ({ message: `Fuel type must be one of: ${FUEL_TYPES.join(', ')}` })
  }),
  fuelEfficiencyKmpl: z.coerce
    .number()
    .min(0, 'Fuel efficiency cannot be negative')
    .max(100, 'Fuel efficiency seems unrealistically high')
    .optional()
}).transform((data) => {
  // If fuelEfficiencyKmpl not supplied, provide sensible default
  if (data.fuelEfficiencyKmpl === undefined) {
    if (data.fuelType === 'ELECTRIC') {
      data.fuelEfficiencyKmpl = 0;
    } else {
      data.fuelEfficiencyKmpl = DEFAULT_EFFICIENCY[data.vehicleType] || 15;
    }
  }
  return data;
});

export const updateVehicleSchema = z.object({
  model: z.string().trim().min(1).max(100).optional(),
  color: z.string().trim().max(30).optional(),
  imageUrl: z.string().trim().url().optional().or(z.literal('')),
  fuelEfficiencyKmpl: z.coerce.number().min(0).max(100).optional(),
  seatingCapacity: z.coerce.number().int().min(2).max(15).optional()
});
