import mongoose from 'mongoose';

const TRANSACTION_TYPES = ['RECHARGE', 'PAYMENT', 'EARNING'];

const walletTransactionSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: { values: TRANSACTION_TYPES, message: 'Invalid transaction type' },
      required: true
    },
    amountMinor: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be an integer (paise)'
      }
    },
    balanceAfterMinor: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'Balance must be an integer (paise)'
      }
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    reference: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    referenceModel: {
      type: String,
      default: null
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true
    }
  },
  {
    timestamps: true
  }
);

// Append-only ledger — no updates allowed via application code
walletTransactionSchema.index({ wallet: 1, createdAt: -1 });
walletTransactionSchema.index({ user: 1, createdAt: -1 });

export const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);
export { TRANSACTION_TYPES };
export default WalletTransaction;
