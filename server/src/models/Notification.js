import mongoose from 'mongoose';

const NOTIFICATION_TYPES = [
  'BOOKING_CREATED',
  'BOOKING_CANCELLED',
  'RIDE_CANCELLED',
  'TRIP_STARTED',
  'TRIP_COMPLETED',
  'PAYMENT_PENDING',
  'PAYMENT_COMPLETED',
  'RIDE_UPDATE',
  'EMPLOYEE_APPROVED',
  'EMPLOYEE_SUSPENDED',
  'VEHICLE_VERIFIED',
  'VEHICLE_REJECTED',
  'GENERAL'
];

const notificationSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: { values: NOTIFICATION_TYPES, message: 'Invalid notification type' },
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    isRead: {
      type: Boolean,
      default: false
    },
    // Reference to the related entity (ride, booking, trip, etc.)
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    referenceModel: {
      type: String,
      enum: ['Ride', 'Booking', 'Trip', 'Payment', 'Vehicle', null],
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Index for fetching user notifications, newest first
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });

export const Notification = mongoose.model('Notification', notificationSchema);
export { NOTIFICATION_TYPES };
export default Notification;
