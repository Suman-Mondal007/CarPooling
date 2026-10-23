import mongoose from 'mongoose';

const PAYMENT_STATUSES = ['CREATED', 'PAYMENT_PENDING', 'PAID', 'FAILED', 'PENDING_CASH_CONFIRMATION'];
const PAYMENT_METHODS = ['CASH', 'CARD', 'UPI', 'WALLET'];

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true
    },
    payer: {
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
    amountMinor: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be an integer (paise)'
      }
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR']
    },
    method: {
      type: String,
      enum: { values: PAYMENT_METHODS, message: 'Invalid payment method' },
      required: true
    },
    status: {
      type: String,
      enum: { values: PAYMENT_STATUSES, message: 'Invalid payment status' },
      default: 'CREATED'
    },
    razorpayOrderId: {
      type: String,
      default: null
    },
    razorpayPaymentId: {
      type: String,
      default: null
    },
    razorpaySignature: {
      type: String,
      default: null
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true
    },
    paidAt: {
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

// Only one PAID payment per booking
paymentSchema.index(
  { booking: 1 },
  { unique: true, partialFilterExpression: { status: 'PAID' } }
);

export const Payment = mongoose.model('Payment', paymentSchema);
export { PAYMENT_STATUSES, PAYMENT_METHODS };
export default Payment;
