import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';

/**
 * Lazily get or create a user's wallet via atomic upsert
 */
export async function getOrCreateWallet(userId, organizationId) {
  return await Wallet.findOneAndUpdate(
    { user: userId },
    {
      $setOnInsert: {
        user: userId,
        organization: organizationId,
        balanceMinor: 0,
        currency: 'INR'
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * Verify ledger invariant: Sum of transactions must equal wallet balance
 */
export async function checkLedgerConsistency(userId) {
  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) return { consistent: true, balanceMinor: 0, ledgerSumMinor: 0 };

  const transactions = await WalletTransaction.find({ user: userId });
  let ledgerSumMinor = 0;
  for (const tx of transactions) {
    if (tx.type === 'RECHARGE' || tx.type === 'EARNING') {
      ledgerSumMinor += tx.amountMinor;
    } else if (tx.type === 'PAYMENT') {
      ledgerSumMinor -= tx.amountMinor;
    }
  }

  return {
    consistent: wallet.balanceMinor === ledgerSumMinor,
    balanceMinor: wallet.balanceMinor,
    ledgerSumMinor,
    difference: wallet.balanceMinor - ledgerSumMinor
  };
}

/**
 * Credit driver wallet with EARNING ledger entry (no commission)
 * Deterministic idempotencyKey: pay:<bookingId>:earning
 */
export async function creditDriverEarning({
  bookingId,
  driverId,
  organizationId,
  amountMinor,
  paymentId = null
}) {
  const earningKey = `pay:${bookingId}:earning`;

  // Check if earning transaction was already recorded
  const existingTx = await WalletTransaction.findOne({ idempotencyKey: earningKey });
  if (existingTx) {
    const wallet = await getOrCreateWallet(driverId, organizationId);
    return { wallet, transaction: existingTx, isDuplicate: true };
  }

  // Atomically increment driver wallet balance
  const wallet = await Wallet.findOneAndUpdate(
    { user: driverId },
    {
      $inc: { balanceMinor: amountMinor },
      $setOnInsert: { organization: organizationId, currency: 'INR' }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Write immutable ledger entry
  try {
    const transaction = await WalletTransaction.create({
      wallet: wallet._id,
      user: driverId,
      type: 'EARNING',
      amountMinor,
      balanceAfterMinor: wallet.balanceMinor,
      description: `Earning for trip booking #${String(bookingId).slice(-6)}`,
      reference: paymentId || bookingId,
      referenceModel: paymentId ? 'Payment' : 'Booking',
      idempotencyKey: earningKey
    });

    return { wallet, transaction, isDuplicate: false };
  } catch (err) {
    // If duplicate key error, fetch existing and roll back increment
    if (err.code === 11000) {
      await Wallet.updateOne({ user: driverId }, { $inc: { balanceMinor: -amountMinor } });
      const duplicateTx = await WalletTransaction.findOne({ idempotencyKey: earningKey });
      return { wallet, transaction: duplicateTx, isDuplicate: true };
    }
    throw err;
  }
}

/**
 * Execute atomic wallet payment from passenger to driver
 * Deterministic keys: pay:<bookingId>:debit and pay:<bookingId>:earning
 */
export async function executeWalletPayment({
  booking,
  passengerId,
  driverId,
  organizationId,
  amountMinor
}) {
  const bookingId = booking._id.toString();
  const debitKey = `pay:${bookingId}:debit`;

  // 1. Ensure wallets exist
  const passengerWallet = await getOrCreateWallet(passengerId, organizationId);
  await getOrCreateWallet(driverId, organizationId);

  // Check if debit transaction already exists
  let debitTx = await WalletTransaction.findOne({ idempotencyKey: debitKey });

  if (!debitTx) {
    // Atomically debit passenger balance with minimum balance guard
    const updatedPassengerWallet = await Wallet.findOneAndUpdate(
      {
        user: passengerId,
        balanceMinor: { $gte: amountMinor }
      },
      {
        $inc: { balanceMinor: -amountMinor }
      },
      { new: true }
    );

    if (!updatedPassengerWallet) {
      const error = new Error('Insufficient wallet balance');
      error.status = 400;
      error.code = 'INSUFFICIENT_WALLET_BALANCE';
      error.currentBalanceMinor = passengerWallet.balanceMinor;
      error.requiredAmountMinor = amountMinor;
      throw error;
    }

    try {
      debitTx = await WalletTransaction.create({
        wallet: updatedPassengerWallet._id,
        user: passengerId,
        type: 'PAYMENT',
        amountMinor,
        balanceAfterMinor: updatedPassengerWallet.balanceMinor,
        description: `Payment for trip booking #${bookingId.slice(-6)}`,
        reference: booking._id,
        referenceModel: 'Booking',
        idempotencyKey: debitKey
      });
    } catch (err) {
      if (err.code === 11000) {
        // Compensate balance if another concurrent request already wrote it
        await Wallet.updateOne({ user: passengerId }, { $inc: { balanceMinor: amountMinor } });
        debitTx = await WalletTransaction.findOne({ idempotencyKey: debitKey });
      } else {
        // Rollback debit on unexpected error
        await Wallet.updateOne({ user: passengerId }, { $inc: { balanceMinor: amountMinor } });
        throw err;
      }
    }
  }

  // 2. Credit driver wallet
  const { wallet: driverWallet, transaction: earningTx } = await creditDriverEarning({
    bookingId,
    driverId,
    organizationId,
    amountMinor
  });

  return {
    passengerWallet,
    driverWallet,
    debitTransaction: debitTx,
    earningTransaction: earningTx
  };
}

/**
 * Recharge user wallet atomically with unique key
 * Deterministic key: recharge:<razorpayPaymentId>
 */
export async function rechargeWallet({
  userId,
  organizationId,
  amountMinor,
  razorpayPaymentId,
  isSimulated = false
}) {
  const rechargeKey = `recharge:${razorpayPaymentId}`;

  // Check if already processed
  const existingTx = await WalletTransaction.findOne({ idempotencyKey: rechargeKey });
  if (existingTx) {
    const wallet = await getOrCreateWallet(userId, organizationId);
    return { wallet, transaction: existingTx, isDuplicate: true };
  }

  // Atomically increment wallet balance
  const wallet = await Wallet.findOneAndUpdate(
    { user: userId },
    {
      $inc: { balanceMinor: amountMinor },
      $setOnInsert: { organization: organizationId, currency: 'INR' }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  try {
    const transaction = await WalletTransaction.create({
      wallet: wallet._id,
      user: userId,
      type: 'RECHARGE',
      amountMinor,
      balanceAfterMinor: wallet.balanceMinor,
      description: isSimulated ? 'Simulated Wallet Recharge' : 'Wallet Recharge via Razorpay',
      reference: razorpayPaymentId,
      referenceModel: 'Recharge',
      idempotencyKey: rechargeKey
    });

    return { wallet, transaction, isDuplicate: false };
  } catch (err) {
    if (err.code === 11000) {
      // Replay race condition: rollback increment
      await Wallet.updateOne({ user: userId }, { $inc: { balanceMinor: -amountMinor } });
      const duplicateTx = await WalletTransaction.findOne({ idempotencyKey: rechargeKey });
      return { wallet, transaction: duplicateTx, isDuplicate: true };
    }
    throw err;
  }
}

export default {
  getOrCreateWallet,
  checkLedgerConsistency,
  creditDriverEarning,
  executeWalletPayment,
  rechargeWallet
};
