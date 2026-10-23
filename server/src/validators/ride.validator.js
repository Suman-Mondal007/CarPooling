import { z } from 'zod';

const coordSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180)
});

export const publishRideSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle is required'),
  originAddress: z.string().trim().min(1, 'Origin address is required'),
  origin: coordSchema,
  destinationAddress: z.string().trim().min(1, 'Destination address is required'),
  destination: coordSchema,
  routeGeometry: z.object({
    type: z.literal('LineString').default('LineString'),
    coordinates: z.array(z.tuple([z.number(), z.number()])).min(2, 'Route geometry must have at least 2 points')
  }),
  distanceMeters: z.coerce.number().min(100, 'Distance must be at least 100 meters'),
  durationSeconds: z.coerce.number().min(60, 'Duration must be at least 1 minute'),
  departureAt: z.coerce.date().refine((d) => d > new Date(), {
    message: 'Departure time must be in the future'
  }),
  totalPassengerSeats: z.coerce
    .number()
    .int('Seats must be a whole number')
    .min(1, 'At least 1 passenger seat must be offered'),
  farePerSeatRupees: z.coerce
    .number()
    .min(0, 'Fare cannot be negative')
    .optional(),
  farePerSeatMinor: z.coerce
    .number()
    .int()
    .min(0, 'Fare cannot be negative')
    .optional(),
  notes: z.string().trim().max(500).optional().default(''),
  recurring: z
    .object({
      enabled: z.boolean().default(false),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(), // 0 = Sunday, 1 = Monday, ...
      weeks: z.number().int().min(1).max(4).default(1)
    })
    .optional()
}).transform((data) => {
  // Convert rupees to paise if farePerSeatMinor not provided
  if (data.farePerSeatMinor === undefined && data.farePerSeatRupees !== undefined) {
    data.farePerSeatMinor = Math.round(data.farePerSeatRupees * 100);
  }
  if (data.farePerSeatMinor === undefined) {
    data.farePerSeatMinor = 0;
  }
  return data;
});
