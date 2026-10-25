import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { organizationScope } from '../middleware/organizationScope.js';
import { paymentLimiter } from '../middleware/rateLimiters.js';
import {
  getWallet,
  getTransactions,
  createRechargeOrder,
  verifyRecharge,
  simulateRecharge
} from '../controllers/wallet.controller.js';

const router = express.Router();

router.use(authenticate);
router.use(organizationScope);
router.use(paymentLimiter);

router.get('/', getWallet);
router.get('/transactions', getTransactions);
router.post('/recharge', createRechargeOrder);
router.post('/recharge/verify', verifyRecharge);
router.post('/simulate-recharge', simulateRecharge);

export default router;
