import express from 'express';
import {
  getProfile, updateProfile, updatePaymentPreference,
  changePassword, createSupportRequest, getMySupportRequests, getMyReports
} from '../controllers/user.controller.js';
import authenticate from '../middleware/authenticate.js';
import validate from '../middleware/validate.js';
import rateLimit from 'express-rate-limit';
import {
  updateSettingsSchema, changePasswordSchema,
  createSupportSchema, reportQuerySchema
} from '../validators/phase7.validator.js';

const router = express.Router();

router.use(authenticate);

router.get('/me', getProfile);
router.patch('/me', validate(updateSettingsSchema), updateProfile);
router.patch('/me/payment-preference', updatePaymentPreference);
router.post('/me/password', validate(changePasswordSchema), changePassword);

// Support requests
const supportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, data: null, error: { code: 'RATE_LIMIT', message: 'Too many support requests' } }
});
router.post('/support', supportLimiter, validate(createSupportSchema), createSupportRequest);
router.get('/support/my', getMySupportRequests);

// Employee reports
router.get('/reports', validate(reportQuerySchema), getMyReports);

export default router;
