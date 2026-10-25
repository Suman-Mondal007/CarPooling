import crypto from 'crypto';
import Razorpay from 'razorpay';
import env from '../config/env.js';

let razorpayClient = null;

function getRazorpayClient() {
  if (razorpayClient) return razorpayClient;
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    razorpayClient = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET
    });
    return razorpayClient;
  }
  return null;
}

/**
 * Check if real Razorpay gateway is configured
 */
export function isRazorpayConfigured() {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

/**
 * Check if simulated payments gateway is active
 */
export function isSimulationActive() {
  return env.NODE_ENV !== 'production' && Boolean(env.ALLOW_SIMULATED_PAYMENTS);
}

/**
 * Get active payment gateway mode: 'RAZORPAY', 'SIMULATED', or null
 */
export function getActiveGatewayMode() {
  if (isRazorpayConfigured()) return 'RAZORPAY';
  if (isSimulationActive()) return 'SIMULATED';
  return null;
}

/**
 * Timing-safe string comparison
 */
function safeEqual(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Create order on active gateway
 */
export async function createGatewayOrder({ amountMinor, currency = 'INR', receipt }) {
  const mode = getActiveGatewayMode();

  if (!mode) {
    const error = new Error('Payments are not configured. Please contact the administrator.');
    error.status = 503;
    error.code = 'PAYMENTS_NOT_CONFIGURED';
    throw error;
  }

  // 1. Real Razorpay Mode
  if (mode === 'RAZORPAY') {
    const rzp = getRazorpayClient();
    const order = await rzp.orders.create({
      amount: amountMinor,
      currency,
      receipt: String(receipt).slice(0, 40)
    });

    return {
      orderId: order.id,
      amountMinor: order.amount,
      currency: order.currency,
      keyId: env.RAZORPAY_KEY_ID,
      simulated: false
    };
  }

  // 2. Simulated Gateway Mode
  const randomSuffix = crypto.randomBytes(6).toString('hex');
  const simulatedOrderId = `order_sim_${Date.now()}_${randomSuffix}`.slice(0, 40);

  return {
    orderId: simulatedOrderId,
    amountMinor,
    currency,
    keyId: 'rzp_test_simulated_key',
    simulated: true
  };
}

/**
 * Verify Razorpay payment signature
 */
export function verifyGatewaySignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  // Check if simulated payment
  if (orderId.startsWith('order_sim_')) {
    if (!isSimulationActive()) return false;
    const expectedSimSignature = `sig_sim_${orderId}_${paymentId}`;
    return safeEqual(signature, expectedSimSignature) || signature === 'simulated_valid_signature';
  }

  // Real Razorpay verification
  if (!env.RAZORPAY_KEY_SECRET) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return safeEqual(signature, expectedSignature);
}

/**
 * Verify Razorpay webhook signature over raw request body
 */
export function verifyWebhookSignature(rawBody, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    const error = new Error('Webhook secret is not configured');
    error.status = 404;
    error.code = 'WEBHOOK_NOT_CONFIGURED';
    throw error;
  }

  if (!signature || !rawBody) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  return safeEqual(signature, expectedSignature);
}

/**
 * Validate payment eligibility for a booking
 */
export function validateBookingPaymentEligibility(booking, userId, organizationId) {
  if (!booking) {
    const error = new Error('Booking not found');
    error.status = 404;
    error.code = 'BOOKING_NOT_FOUND';
    throw error;
  }

  const orgId = (organizationId?._id || organizationId)?.toString();
  const bOrgId = (booking.organization?._id || booking.organization)?.toString();

  // Tenant isolation
  if (bOrgId !== orgId) {
    const error = new Error('Unauthorized organization access');
    error.status = 403;
    error.code = 'ORGANIZATION_MISMATCH';
    throw error;
  }

  const passengerId = (booking.passenger?._id || booking.passenger)?.toString();
  const uId = (userId?._id || userId)?.toString();

  // Passenger check
  if (passengerId !== uId) {
    const error = new Error('Only the passenger who booked this ride can pay for it');
    error.status = 403;
    error.code = 'NOT_BOOKING_PASSENGER';
    throw error;
  }

  // Booking completion check
  if (booking.status !== 'COMPLETED') {
    const error = new Error(`Cannot pay for a booking with status ${booking.status}. Trip must be completed.`);
    error.status = 400;
    error.code = 'BOOKING_NOT_COMPLETED';
    throw error;
  }

  // Already paid check
  if (booking.paymentStatus === 'PAID') {
    const error = new Error('This booking has already been paid for.');
    error.status = 400;
    error.code = 'ALREADY_PAID';
    throw error;
  }

  return true;
}

export default {
  isRazorpayConfigured,
  isSimulationActive,
  getActiveGatewayMode,
  createGatewayOrder,
  verifyGatewaySignature,
  verifyWebhookSignature,
  validateBookingPaymentEligibility
};
