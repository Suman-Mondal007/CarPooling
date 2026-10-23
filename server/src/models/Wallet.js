import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true
    },
    balanceMinor: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Balance must be an integer (paise)'
      }
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR']
    }
  },
  {
    timestamps: true
  }
);

export const Wallet = mongoose.model('Wallet', walletSchema);
export default Wallet;
