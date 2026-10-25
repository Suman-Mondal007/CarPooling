import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ['EMPLOYEE', 'COMPANY_ADMIN'],
      default: 'EMPLOYEE'
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    employeeId: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'],
      default: 'PENDING_APPROVAL',
      index: true
    },
    licenceNumber: {
      type: String,
      trim: true,
      default: ''
    },
    licenceExpiry: {
      type: Date
    },
    preferredPaymentMethod: {
      type: String,
      enum: ['CASH', 'CARD', 'UPI', 'WALLET', null],
      default: null
    },
    notificationPreferences: {
      bookings: { type: Boolean, default: true },
      tripUpdates: { type: Boolean, default: true },
      chat: { type: Boolean, default: true },
      payments: { type: Boolean, default: true }
    },
    passwordResetTokenHash: {
      type: String,
      select: false
    },
    passwordResetExpiresAt: {
      type: Date,
      select: false
    },
    isSeeded: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpiresAt;
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const User = mongoose.model('User', userSchema);
export default User;
