import mongoose from 'mongoose';

const PLACE_TYPES = ['HOME', 'OFFICE', 'CUSTOM'];

const savedPlaceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true
    },
    label: {
      type: String,
      required: [true, 'Place label is required'],
      trim: true,
      maxlength: 50
    },
    placeType: {
      type: String,
      enum: { values: PLACE_TYPES, message: 'Invalid place type' },
      default: 'CUSTOM'
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
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
        required: true,
        validate: {
          validator(coords) {
            return (
              coords.length === 2 &&
              coords[0] >= -180 && coords[0] <= 180 &&
              coords[1] >= -90 && coords[1] <= 90
            );
          },
          message: 'Coordinates must be [longitude, latitude] within valid ranges'
        }
      }
    }
  },
  {
    timestamps: true
  }
);

// 2dsphere index for location queries
savedPlaceSchema.index({ location: '2dsphere' });

// Compound index: user + placeType for quick lookups
savedPlaceSchema.index({ user: 1, placeType: 1 });

export const SavedPlace = mongoose.model('SavedPlace', savedPlaceSchema);
export { PLACE_TYPES };
export default SavedPlace;
