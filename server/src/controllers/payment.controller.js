import Payment from '../models/Payment.js';
import Booking from '../models/Booking.js';
import Trip from '../models/Trip.js';
import User from '../models/User.js';
import {
  createGatewayOrder,
  verifyGatewaySignature,
  verifyWebhookSignature,
  validateBookingPaymentEligibility
} from '../services/payment.service.js';
import {
  creditDriverEarning,
  executeWalletPayment
} from '../services/wallet.service.js';
import {
  notifyPaymentPending,
  notifyPaymentCompleted
} from '../services/notification.service.js';

/**
 * Helper to fetch and populate booking and trip
 */
async function getBookingWithTrip(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) return null;

  const trip = await Trip.findOne({ ride: booking.ride }).populate('driver');
  return { booking, trip };
}

/**
 * POST /api/payments/create-order
 * Initiate Razorpay or Simulated online order for card/UPI
 */
export async function createOrder(req, res, next) {
  try {
    const { bookingId, method = 'CARD' } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency-Key header is required' }
      });
    }

    if (!['CARD', 'UPI'].includes(method)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_METHOD', message: 'Method must be CARD or UPI' }
      });
    }

    const data = await getBookingWithTrip(bookingId);
    if (!data || !data.booking || !data.trip) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking or associated trip not found' }
      });
    }

    const { booking, trip } = data;
    validateBookingPaymentEligibility(booking, req.user._id, req.user.organization);

    // Check if an existing payment with this idempotency key already exists
    let payment = await Payment.findOne({ idempotencyKey });
    if (payment) {
      if (payment.status === 'PAID') {
        return res.status(200).json({
          success: true,
          data: {
            paymentId: payment._id,
            status: payment.status,
            amountMinor: payment.amountMinor,
            alreadyPaid: true
          }
        });
      }
      return res.status(200).json({
        success: true,
        data: {
          paymentId: payment._id,
          orderId: payment.razorpayOrderId,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          keyId: payment.simulated ? 'rzp_test_simulated' : process.env.RAZORPAY_KEY_ID,
          simulated: payment.simulated,
          method: payment.method
        }
      });
    }

    // Amount is determined strictly from booking on server
    const amountMinor = booking.fareTotalMinor;
    const receipt = `rcpt_${String(booking._id).slice(-8)}_${Date.now()}`.slice(0, 40);

    const gatewayOrder = await createGatewayOrder({
      amountMinor,
      currency: 'INR',
      receipt
    });

    payment = await Payment.create({
      booking: booking._id,
      trip: trip._id,
      passenger: req.user._id,
      payer: req.user._id,
      driver: trip.driver._id || trip.driver,
      organization: req.user.organization,
      amountMinor,
      currency: 'INR',
      method,
      status: 'CREATED',
      razorpayOrderId: gatewayOrder.orderId,
      idempotencyKey,
      simulated: gatewayOrder.simulated
    });

    await Booking.updateOne({ _id: booking._id }, { $set: { paymentStatus: 'PAYMENT_PENDING' } });

    res.status(201).json({
      success: true,
      data: {
        paymentId: payment._id,
        orderId: gatewayOrder.orderId,
        amountMinor,
        currency: 'INR',
        keyId: gatewayOrder.keyId,
        simulated: gatewayOrder.simulated,
        method
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/verify
 * Verify payment signature and credit driver wallet
 */
export async function verifyPayment(req, res, next) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYMENT_DETAILS',
          message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required'
        }
      });
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: { code: 'PAYMENT_NOT_FOUND', message: 'No payment record found matching this order' }
      });
    }

    if (payment.passenger.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { code: 'UNAUTHORIZED_PAYMENT', message: 'You are not authorized to verify this payment' }
      });
    }

    // Idempotent replay: if already paid, return success without double crediting
    if (payment.status === 'PAID') {
      return res.status(200).json({
        success: true,
        data: {
          paymentId: payment._id,
          status: 'PAID',
          amountMinor: payment.amountMinor,
          method: payment.method,
          paidAt: payment.paidAt,
          isReplay: true
        }
      });
    }

    // Verify cryptographic signature
    const isValid = verifyGatewaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Payment verification failed: invalid signature' }
      });
    }

    // Atomic update status
    const paidAt = new Date();
    const updatedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $ne: 'PAID' } },
      {
        $set: {
          status: 'PAID',
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          paidAt
        }
      },
      { new: true }
    );

    if (updatedPayment) {
      await Booking.updateOne({ _id: payment.booking }, { $set: { paymentStatus: 'PAID' } });

      // Credit driver wallet with full fare (no commission)
      await creditDriverEarning({
        bookingId: payment.booking,
        driverId: payment.driver,
        organizationId: payment.organization,
        amountMinor: payment.amountMinor,
        paymentId: payment._id
      });

      // Send real-time notifications
      const booking = await Booking.findById(payment.booking);
      const trip = await Trip.findById(payment.trip);
      const driver = await User.findById(payment.driver);
      notifyPaymentCompleted(updatedPayment, booking, trip, req.user, driver).catch(() => {});
    }

    res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        status: 'PAID',
        amountMinor: payment.amountMinor,
        method: payment.method,
        paidAt: updatedPayment?.paidAt || paidAt,
        simulated: payment.simulated
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/wallet-pay
 * Atomic internal wallet payment
 */
export async function walletPay(req, res, next) {
  try {
    const { bookingId } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency-Key header is required' }
      });
    }

    // Idempotent retry check
    let existingPayment = await Payment.findOne({ idempotencyKey });
    if (existingPayment) {
      return res.status(200).json({
        success: true,
        data: {
          paymentId: existingPayment._id,
          status: existingPayment.status,
          amountMinor: existingPayment.amountMinor,
          method: 'WALLET',
          paidAt: existingPayment.paidAt,
          isReplay: true
        }
      });
    }

    const data = await getBookingWithTrip(bookingId);
    if (!data || !data.booking || !data.trip) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking or associated trip not found' }
      });
    }

    const { booking, trip } = data;

    // Check if another concurrent request with same idempotency key already paid
    if (booking.paymentStatus === 'PAID') {
      const match = await Payment.findOne({ booking: booking._id, status: 'PAID' });
      if (match && match.idempotencyKey === idempotencyKey) {
        return res.status(200).json({
          success: true,
          data: {
            paymentId: match._id,
            status: match.status,
            amountMinor: match.amountMinor,
            method: match.method,
            paidAt: match.paidAt,
            isReplay: true
          }
        });
      }
    }

    validateBookingPaymentEligibility(booking, req.user._id, req.user.organization);

    const driverId = trip.driver._id || trip.driver;

    // Lock payment attempt using unique idempotencyKey index
    let payment;
    try {
      payment = await Payment.create({
        booking: booking._id,
        trip: trip._id,
        passenger: req.user._id,
        payer: req.user._id,
        driver: driverId,
        organization: req.user.organization?._id || req.user.organization,
        amountMinor: booking.fareTotalMinor,
        currency: 'INR',
        method: 'WALLET',
        status: 'CREATED',
        idempotencyKey
      });
    } catch (err) {
      if (err.code === 11000) {
        // Another concurrent request secured the lock; wait for completion
        for (let i = 0; i < 30; i++) {
          await new Promise((resolve) => setTimeout(resolve, 80));
          const p = await Payment.findOne({ idempotencyKey });
          if (p && p.status === 'PAID') {
            return res.status(200).json({
              success: true,
              data: {
                paymentId: p._id,
                status: 'PAID',
                amountMinor: p.amountMinor,
                method: 'WALLET',
                paidAt: p.paidAt,
                isReplay: true
              }
            });
          }
        }
      }
      throw err;
    }

    // Execute atomic debit from passenger and credit to driver
    try {
      await executeWalletPayment({
        booking,
        passengerId: req.user._id,
        driverId,
        organizationId: req.user.organization?._id || req.user.organization,
        amountMinor: booking.fareTotalMinor
      });
    } catch (err) {
      await Payment.deleteOne({ _id: payment._id });
      throw err;
    }

    const paidAt = new Date();
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { status: 'PAID', paidAt } }
    );

    await Booking.updateOne({ _id: booking._id }, { $set: { paymentStatus: 'PAID' } });

    const driver = await User.findById(driverId);
    notifyPaymentCompleted(payment, booking, trip, req.user, driver).catch(() => {});

    res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        status: 'PAID',
        amountMinor: payment.amountMinor,
        method: 'WALLET',
        paidAt
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/cash
 * Passenger selects cash payment, awaiting driver confirmation
 */
export async function cashPay(req, res, next) {
  try {
    const { bookingId } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] || `cash:${bookingId}`;

    const data = await getBookingWithTrip(bookingId);
    if (!data || !data.booking || !data.trip) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking or associated trip not found' }
      });
    }

    const { booking, trip } = data;
    validateBookingPaymentEligibility(booking, req.user._id, req.user.organization);

    const driverId = trip.driver._id || trip.driver;

    // Check for existing pending cash payment
    let payment = await Payment.findOne({
      booking: booking._id,
      status: 'PENDING_CASH_CONFIRMATION'
    });

    if (!payment) {
      payment = await Payment.create({
        booking: booking._id,
        trip: trip._id,
        passenger: req.user._id,
        payer: req.user._id,
        driver: driverId,
        organization: req.user.organization,
        amountMinor: booking.fareTotalMinor,
        currency: 'INR',
        method: 'CASH',
        status: 'PENDING_CASH_CONFIRMATION',
        idempotencyKey
      });
    }

    await Booking.updateOne({ _id: booking._id }, { $set: { paymentStatus: 'PAYMENT_PENDING' } });

    const driver = await User.findById(driverId);
    notifyPaymentPending(booking, trip, req.user, driver).catch(() => {});

    res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        status: 'PENDING_CASH_CONFIRMATION',
        amountMinor: payment.amountMinor,
        method: 'CASH'
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/:id/cancel-cash
 * Passenger cancels pending cash confirmation request to switch methods
 */
export async function cancelCash(req, res, next) {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment record not found' }
      });
    }

    if (payment.passenger.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Only the passenger can cancel cash confirmation' }
      });
    }

    if (payment.status !== 'PENDING_CASH_CONFIRMATION') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Only pending cash requests can be cancelled' }
      });
    }

    await Payment.findByIdAndDelete(payment._id);
    await Booking.updateOne({ _id: payment.booking }, { $set: { paymentStatus: 'UNPAID' } });

    res.status(200).json({
      success: true,
      data: { message: 'Pending cash payment cancelled. You may select another payment method.' }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/:id/cash-confirmation
 * Trip driver confirms physical cash received (DRIVER ONLY, idempotent)
 */
export async function confirmCashPayment(req, res, next) {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment record not found' }
      });
    }

    // Driver verification
    if (payment.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { code: 'UNAUTHORIZED_DRIVER', message: 'Only the trip driver can confirm cash payments' }
      });
    }

    // Idempotent
    if (payment.status === 'PAID') {
      return res.status(200).json({
        success: true,
        data: {
          paymentId: payment._id,
          status: 'PAID',
          amountMinor: payment.amountMinor,
          method: 'CASH',
          paidAt: payment.paidAt,
          isReplay: true
        }
      });
    }

    if (payment.status !== 'PENDING_CASH_CONFIRMATION') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Cannot confirm payment with status ${payment.status}` }
      });
    }

    const paidAt = new Date();
    const updatedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: 'PENDING_CASH_CONFIRMATION' },
      { $set: { status: 'PAID', paidAt } },
      { new: true }
    );

    // Update booking status
    await Booking.updateOne({ _id: payment.booking }, { $set: { paymentStatus: 'PAID' } });

    // Cash makes NO wallet movement
    const booking = await Booking.findById(payment.booking);
    const trip = await Trip.findById(payment.trip);
    const passenger = await User.findById(payment.passenger);
    notifyPaymentCompleted(updatedPayment, booking, trip, passenger, req.user).catch(() => {});

    res.status(200).json({
      success: true,
      data: {
        paymentId: updatedPayment._id,
        status: 'PAID',
        amountMinor: updatedPayment.amountMinor,
        method: 'CASH',
        paidAt
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/webhook
 * Razorpay webhook handler over raw request body
 */
export async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (event?.event === 'order.paid' || event?.event === 'payment.captured') {
      const orderId = event.payload?.order?.entity?.id || event.payload?.payment?.entity?.order_id;
      const paymentId = event.payload?.payment?.entity?.id;

      if (orderId) {
        const payment = await Payment.findOne({ razorpayOrderId: orderId });
        if (payment && payment.status !== 'PAID') {
          const paidAt = new Date();
          await Payment.updateOne(
            { _id: payment._id },
            { $set: { status: 'PAID', razorpayPaymentId: paymentId, paidAt } }
          );

          await Booking.updateOne({ _id: payment.booking }, { $set: { paymentStatus: 'PAID' } });

          await creditDriverEarning({
            bookingId: payment.booking,
            driverId: payment.driver,
            organizationId: payment.organization,
            amountMinor: payment.amountMinor,
            paymentId: payment._id
          });
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/payments/my
 * User payment history
 */
export async function getMyPayments(req, res, next) {
  try {
    const role = req.query.role === 'driver' ? 'driver' : 'passenger';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {
      organization: req.user.organization,
      [role]: req.user._id
    };

    const [items, total] = await Promise.all([
      Payment.find(filter)
        .populate({
          path: 'trip',
          populate: [
            { path: 'driver', select: 'name phone' },
            { path: 'ride', select: 'originAddress destinationAddress departureAt' }
          ]
        })
        .populate('passenger', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(filter)
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
 * GET /api/payments/:id
 * Payment receipt visible only to passenger or driver
 */
export async function getPaymentById(req, res, next) {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id)
      .populate({
        path: 'trip',
        populate: [
          { path: 'driver', select: 'name phone' },
          { path: 'ride', select: 'originAddress destinationAddress departureAt farePerSeatMinor' }
        ]
      })
      .populate('passenger', 'name phone')
      .populate('driver', 'name phone')
      .populate('booking', 'seats pickupAddress dropAddress fareTotalMinor');

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment record not found' }
      });
    }

    const uid = req.user._id.toString();
    const isPassenger = payment.passenger._id?.toString() === uid || payment.passenger.toString() === uid;
    const isDriver = payment.driver._id?.toString() === uid || payment.driver.toString() === uid;

    if (!isPassenger && !isDriver) {
      return res.status(403).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to view this payment receipt' }
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (err) {
    next(err);
  }
}

export default {
  createOrder,
  verifyPayment,
  walletPay,
  cashPay,
  cancelCash,
  confirmCashPayment,
  handleWebhook,
  getMyPayments,
  getPaymentById
};
