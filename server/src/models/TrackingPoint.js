import mongoose from 'mongoose';

const trackingPointSchema = new mongoose.Schema(
  {
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true
      }
    },
    speed: {
      type: Number,
      default: null
    },
    heading: {
      type: Number,
      default: null
    },
    recordedAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// TTL index: auto-delete tracking points after 7 days for privacy
trackingPointSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// 2dsphere index for location queries
trackingPointSchema.index({ location: '2dsphere' });

// Compound index for efficient trip-based queries
trackingPointSchema.index({ trip: 1, recordedAt: 1 });

export const TrackingPoint = mongoose.model('TrackingPoint', trackingPointSchema);
export default TrackingPoint;
