import mongoose from 'mongoose';

const RIDE_STATUSES = ['OPEN', 'CANCELLED', 'CLOSED'];

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: {
        validator(coords) {
          return (
            coords.length === 2 &&
            coords[0] >= -180 && coords[0] <= 180 && // lng
            coords[1] >= -90 && coords[1] <= 90      // lat
          );
        },
        message: 'Coordinates must be [longitude, latitude] within valid ranges'
      }
    }
  },
  { _id: false }
);

const rideSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true
    },
    originAddress: {
      type: String,
      required: [true, 'Origin address is required'],
      trim: true
    },
    origin: {
      type: pointSchema,
      required: true
    },
    destinationAddress: {
      type: String,
      required: [true, 'Destination address is required'],
      trim: true
    },
    destination: {
      type: pointSchema,
      required: true
    },
    // Simplified route polyline (≤ 300 points)
    routeGeometry: {
      type: {
        type: String,
        enum: ['LineString'],
        default: 'LineString'
      },
      coordinates: {
        type: [[Number]], // Array of [lng, lat]
        required: true
      }
    },
    distanceMeters: {
      type: Number,
      required: true,
      min: 0
    },
    durationSeconds: {
      type: Number,
      required: true,
      min: 0
    },
    departureAt: {
      type: Date,
      required: [true, 'Departure date and time is required'],
      index: true
    },
    totalPassengerSeats: {
      type: Number,
      required: true,
      min: [1, 'At least 1 passenger seat is required'],
      validate: {
        validator: Number.isInteger,
        message: 'Passenger seats must be a whole number'
      }
    },
    availableSeats: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Available seats must be a whole number'
      }
    },
    farePerSeatMinor: {
      type: Number,
      required: true,
      min: [0, 'Fare cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Fare must be an integer (paise)'
      }
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    // Vehicle snapshot at publish time — survives vehicle soft-delete
    vehicleSnapshot: {
      model: { type: String, default: '' },
      registrationNumber: { type: String, default: '' },
      vehicleType: { type: String, default: '' },
      fuelType: { type: String, default: '' },
      fuelEfficiencyKmpl: { type: Number, default: 0 },
      seatingCapacity: { type: Number, default: 0 }
    },
    status: {
      type: String,
      enum: { values: RIDE_STATUSES, message: 'Invalid ride status' },
      default: 'OPEN',
      index: true
    },
    recurrenceGroupId: {
      type: String,
      default: null,
      index: true
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

// 2dsphere indexes for geographic queries
rideSchema.index({ origin: '2dsphere' });
rideSchema.index({ destination: '2dsphere' });

// Compound index for ride search
rideSchema.index({ organization: 1, status: 1, departureAt: 1, availableSeats: 1 });

export const Ride = mongoose.model('Ride', rideSchema);
export { RIDE_STATUSES };
export default Ride;
