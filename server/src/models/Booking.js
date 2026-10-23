import mongoose from 'mongoose';

const BOOKING_STATUSES = ['CONFIRMED', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER', 'COMPLETED'];
const PAYMENT_STATUSES = ['UNPAID', 'PAYMENT_PENDING', 'PAID'];

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true
    }
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ride',
      required: true,
      index: true
    },
    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    seats: {
      type: Number,
      required: true,
      min: [1, 'At least 1 seat is required'],
      validate: {
        validator: Number.isInteger,
        message: 'Seats must be a whole number'
      }
    },
    pickupAddress: {
      type: String,
      trim: true,
      default: ''
    },
    pickupPoint: {
      type: pointSchema,
      default: undefined
    },
    dropAddress: {
      type: String,
      trim: true,
      default: ''
    },
    dropPoint: {
      type: pointSchema,
      default: undefined
    },
    fareTotalMinor: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Fare must be an integer (paise)'
      }
    },
    status: {
      type: String,
      enum: { values: BOOKING_STATUSES, message: 'Invalid booking status' },
      default: 'CONFIRMED',
      index: true
    },
    paymentStatus: {
      type: String,
      enum: { values: PAYMENT_STATUSES, message: 'Invalid payment status' },
      default: 'UNPAID'
    },
    lateCancellation: {
      type: Boolean,
      default: false
    },
    isSeeded: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Partial unique index: only one CONFIRMED booking per (ride, passenger)
bookingSchema.index(
  { ride: 1, passenger: 1 },
  { unique: true, partialFilterExpression: { status: 'CONFIRMED' } }
);

export const Booking = mongoose.model('Booking', bookingSchema);
export { BOOKING_STATUSES, PAYMENT_STATUSES };
export default Booking;
