import express from 'express';
import {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  getMe
} from '../controllers/auth.controller.js';
import validate from '../middleware/validate.js';
import authenticate from '../middleware/authenticate.js';
import csrfProtection from '../middleware/csrfProtection.js';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiters.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from '../validators/auth.validator.js';

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', csrfProtection, refresh);
router.post('/logout', csrfProtection, logout);
router.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', passwordResetLimiter, validate(resetPasswordSchema), resetPassword);
router.get('/me', authenticate, getMe);

export default router;
