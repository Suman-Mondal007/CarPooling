import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { organizationScope } from '../middleware/organizationScope.js';
import { paymentLimiter } from '../middleware/rateLimiters.js';
import {
  createOrder,
  verifyPayment,
  walletPay,
  cashPay,
  cancelCash,
  confirmCashPayment,
  handleWebhook,
  getMyPayments,
  getPaymentById
} from '../controllers/payment.controller.js';

const router = express.Router();

// Webhook endpoint (authenticated via HMAC signature over raw body)
router.post('/webhook', handleWebhook);

// Authenticated user payment routes
router.use(authenticate);
router.use(organizationScope);
router.use(paymentLimiter);

router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.post('/wallet-pay', walletPay);
router.post('/cash', cashPay);
router.post('/:id/cancel-cash', cancelCash);
router.post('/:id/cash-confirmation', confirmCashPayment);
router.get('/my', getMyPayments);
router.get('/:id', getPaymentById);

export default router;
