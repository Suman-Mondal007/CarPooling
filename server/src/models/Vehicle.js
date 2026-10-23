import mongoose from 'mongoose';

/**
 * Indian vehicle registration number pattern.
 * Accepts formats: KA01AB1234, KA 01 AB 1234, KA-01-AB-1234
 * Also accepts BH-series (Bharat series): 22BH1234AA
 */
const REGISTRATION_REGEX = /^(?:[A-Z]{2}\s?-?\d{1,2}\s?-?[A-Z]{1,3}\s?-?\d{1,4}|\d{2}BH\d{4}[A-Z]{1,2})$/i;

const VEHICLE_TYPES = ['SEDAN', 'SUV', 'HATCHBACK', 'MPV', 'PICKUP', 'VAN', 'OTHER'];
const FUEL_TYPES = ['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID'];
const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'];

const vehicleSchema = new mongoose.Schema(
  {
    model: {
      type: String,
      required: [true, 'Vehicle model is required'],
      trim: true,
      maxlength: 100
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      trim: true,
      uppercase: true,
      validate: {
        validator(v) {
          // Normalize: remove spaces and hyphens for validation
          const normalized = v.replace(/[\s-]/g, '');
          return REGISTRATION_REGEX.test(normalized);
        },
        message: 'Please enter a valid Indian vehicle registration number (e.g. KA01AB1234)'
      }
    },
    vehicleType: {
      type: String,
      required: [true, 'Vehicle type is required'],
      enum: { values: VEHICLE_TYPES, message: 'Invalid vehicle type' }
    },
    seatingCapacity: {
      type: Number,
      required: [true, 'Seating capacity is required'],
      min: [2, 'Minimum seating capacity is 2'],
      max: [15, 'Maximum seating capacity is 15'],
      validate: {
        validator: Number.isInteger,
        message: 'Seating capacity must be a whole number'
      }
    },
    color: {
      type: String,
      trim: true,
      maxlength: 30,
      default: ''
    },
    imageUrl: {
      type: String,
      trim: true,
      default: ''
    },
    fuelType: {
      type: String,
      required: [true, 'Fuel type is required'],
      enum: { values: FUEL_TYPES, message: 'Invalid fuel type' }
    },
    fuelEfficiencyKmpl: {
      type: Number,
      required: [true, 'Fuel efficiency is required'],
      min: [0, 'Fuel efficiency cannot be negative'],
      max: [100, 'Fuel efficiency seems too high']
    },
    owner: {
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
    verificationStatus: {
      type: String,
      enum: { values: VERIFICATION_STATUSES, message: 'Invalid verification status' },
      default: 'PENDING'
    },
    isDeleted: {
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

// Compound unique index: registration number is unique within an organization (excluding soft-deleted)
vehicleSchema.index(
  { registrationNumber: 1, organization: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

// Pre-save hook: normalize registration number (remove spaces/hyphens, uppercase)
vehicleSchema.pre('save', function (next) {
  if (this.isModified('registrationNumber')) {
    this.registrationNumber = this.registrationNumber.replace(/[\s-]/g, '').toUpperCase();
  }
  next();
});

export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
export { VEHICLE_TYPES, FUEL_TYPES, VERIFICATION_STATUSES };
export default Vehicle;
