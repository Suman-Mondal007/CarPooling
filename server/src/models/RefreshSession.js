import mongoose from 'mongoose';

const refreshSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
      select: false
    },
    familyId: {
      type: String,
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: '14d' } // Automatically clean up old sessions after 14 days
    },
    revokedAt: {
      type: Date,
      default: null
    },
    replacedBy: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.tokenHash;
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const RefreshSession = mongoose.model('RefreshSession', refreshSessionSchema);
export default RefreshSession;
