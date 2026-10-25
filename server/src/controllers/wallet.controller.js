import WalletTransaction from '../models/WalletTransaction.js';
import {
  getOrCreateWallet,
  rechargeWallet
} from '../services/wallet.service.js';
import {
  createGatewayOrder,
  verifyGatewaySignature,
  isSimulationActive
} from '../services/payment.service.js';

const MIN_RECHARGE_PAISE = 1000; // 10 INR
const MAX_RECHARGE_PAISE = 1000000; // 10,000 INR

/**
 * GET /api/wallet
 * Return current user wallet balance and currency
 */
export async function getWallet(req, res, next) {
  try {
    const wallet = await getOrCreateWallet(req.user._id, req.user.organization);

    res.status(200).json({
      success: true,
      data: {
        walletId: wallet._id,
        balanceMinor: wallet.balanceMinor,
        currency: wallet.currency,
        updatedAt: wallet.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/wallet/transactions
 * Paginated ledger transactions with type filter
 */
export async function getTransactions(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };
    if (req.query.type && ['RECHARGE', 'PAYMENT', 'EARNING'].includes(req.query.type.toUpperCase())) {
      filter.type = req.query.type.toUpperCase();
    }

    const [items, total] = await Promise.all([
      WalletTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      WalletTransaction.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        items,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/wallet/recharge
 * Create order for wallet recharge with limits check (10 to 10,000 INR)
 */
export async function createRechargeOrder(req, res, next) {
  try {
    const amountMinor = Number(req.body.amountMinor);

    if (!Number.isInteger(amountMinor) || amountMinor < MIN_RECHARGE_PAISE || amountMinor > MAX_RECHARGE_PAISE) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RECHARGE_AMOUNT',
          message: `Recharge amount must be between ₹${MIN_RECHARGE_PAISE / 100} and ₹${MAX_RECHARGE_PAISE / 100}`
        }
      });
    }

    const receipt = `rech_${String(req.user._id).slice(-6)}_${Date.now()}`.slice(0, 40);

    const order = await createGatewayOrder({
      amountMinor,
      currency: 'INR',
      receipt
    });

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/wallet/recharge/verify
 * Verify recharge signature and credit wallet ledger
 */
export async function verifyRecharge(req, res, next) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amountMinor } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !amountMinor) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYMENT_DETAILS',
          message: 'Missing order ID, payment ID, signature, or amount'
        }
      });
    }

    const isValid = verifyGatewaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Recharge signature verification failed' }
      });
    }

    const { wallet, transaction, isDuplicate } = await rechargeWallet({
      userId: req.user._id,
      organizationId: req.user.organization,
      amountMinor: Number(amountMinor),
      razorpayPaymentId: razorpay_payment_id,
      isSimulated: razorpay_order_id.startsWith('order_sim_')
    });

    res.status(200).json({
      success: true,
      data: {
        balanceMinor: wallet.balanceMinor,
        transactionId: transaction._id,
        isDuplicate
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/wallet/simulate-recharge
 * Development-only simulated wallet recharge
 */
export async function simulateRecharge(req, res, next) {
  try {
    if (!isSimulationActive()) {
      return res.status(403).json({
        success: false,
        error: { code: 'SIMULATOR_DISABLED', message: 'Simulation is disabled in production mode' }
      });
    }

    const amountMinor = Number(req.body.amountMinor);
    if (!Number.isInteger(amountMinor) || amountMinor < MIN_RECHARGE_PAISE || amountMinor > MAX_RECHARGE_PAISE) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RECHARGE_AMOUNT',
          message: `Recharge amount must be between ₹${MIN_RECHARGE_PAISE / 100} and ₹${MAX_RECHARGE_PAISE / 100}`
        }
      });
    }

    const simulatedPaymentId = `pay_sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const { wallet, transaction } = await rechargeWallet({
      userId: req.user._id,
      organizationId: req.user.organization,
      amountMinor,
      razorpayPaymentId: simulatedPaymentId,
      isSimulated: true
    });

    res.status(200).json({
      success: true,
      data: {
        balanceMinor: wallet.balanceMinor,
        transactionId: transaction._id,
        simulated: true
      }
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getWallet,
  getTransactions,
  createRechargeOrder,
  verifyRecharge,
  simulateRecharge
};
