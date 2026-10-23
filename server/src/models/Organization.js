import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    registrationCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    },
    settings: {
      autoApproveEmployees: {
        type: Boolean,
        default: false
      },
      requireEmployeeId: {
        type: Boolean,
        default: false
      },
      fuelPricePerLitre: {
        type: Number,
        default: 100
      },
      operationalCostPerKm: {
        type: Number,
        default: 0
      },
      cancellationCutoffMinutes: {
        type: Number,
        default: 60
      },
      requireVehicleVerification: {
        type: Boolean,
        default: true
      }
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

export const Organization = mongoose.model('Organization', organizationSchema);
export default Organization;
