import mongoose from 'mongoose';

const TRIP_STATUSES = ['SCHEDULED', 'STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

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

const tripSchema = new mongoose.Schema(
  {
    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ride',
      required: true,
      unique: true,
      index: true
    },
    driver: {
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
    status: {
      type: String,
      enum: { values: TRIP_STATUSES, message: 'Invalid trip status' },
      default: 'SCHEDULED',
      index: true
    },
    startedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    lastKnownLocation: {
      type: pointSchema,
      default: undefined
    },
    lastLocationAt: {
      type: Date,
      default: null
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

// Compound index for trip queries
tripSchema.index({ organization: 1, status: 1 });
tripSchema.index({ driver: 1, status: 1 });

export const Trip = mongoose.model('Trip', tripSchema);
export { TRIP_STATUSES };
export default Trip;
