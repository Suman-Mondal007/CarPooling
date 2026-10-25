import mongoose from 'mongoose';

const SUPPORT_CATEGORIES = ['ACCOUNT', 'RIDES', 'PAYMENTS', 'VEHICLES', 'TECHNICAL', 'OTHER'];
const SUPPORT_STATUSES = ['OPEN', 'RESOLVED'];

const supportRequestSchema = new mongoose.Schema(
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
      required: true,
      index: true
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: 200
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: 2000
    },
    category: {
      type: String,
      enum: { values: SUPPORT_CATEGORIES, message: 'Invalid category' },
      required: true
    },
    status: {
      type: String,
      enum: { values: SUPPORT_STATUSES, message: 'Invalid status' },
      default: 'OPEN'
    }
  },
  {
    timestamps: true
  }
);

supportRequestSchema.index({ user: 1, createdAt: -1 });

export const SupportRequest = mongoose.model('SupportRequest', supportRequestSchema);
export { SUPPORT_CATEGORIES, SUPPORT_STATUSES };
export default SupportRequest;
