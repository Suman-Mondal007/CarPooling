import { z } from 'zod';

const pointCoordSchema = z.object({
  address: z.string().trim().min(1, 'Address is required'),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180)
});

export const createBookingSchema = z.object({
  rideId: z.string().min(1, 'Ride ID is required'),
  seats: z.coerce.number().int('Seats must be integer').min(1, 'At least 1 seat is required').max(10),
  pickup: pointCoordSchema,
  drop: pointCoordSchema
});

export const seriesBookingSchema = z.object({
  bookings: z.array(createBookingSchema).min(1, 'At least 1 booking is required').max(20)
});
