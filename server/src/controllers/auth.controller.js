import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import RefreshSession from '../models/RefreshSession.js';
import env from '../config/env.js';
import {
  hashToken,
  generateRandomToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from '../utils/token.js';
import { sendPasswordResetEmail } from '../services/mail.service.js';

const getCookieOptions = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
  sameSite: env.COOKIE_SAME_SITE,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

export const register = async (req, res, next) => {
  try {
    const { name, email, phone, password, registrationCode, employeeId } = req.body;

    // Find organization by registration code (case-insensitive)
    const org = await Organization.findOne({
      registrationCode: registrationCode.toUpperCase()
    });

    if (!org) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_REGISTRATION_CODE',
          message: 'Invalid organization registration code. Please check with your company administrator.',
          details: null
        }
      });
    }

    // Check if employeeId is required by organization
    if (org.settings?.requireEmployeeId && (!employeeId || employeeId.trim() === '')) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'EMPLOYEE_ID_REQUIRED',
          message: 'Employee ID is required for this organization.',
          details: null
        }
      });
    }

    // Check if email already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        data: null,
        error: {
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'An account with this work email already exists.',
          details: null
        }
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const initialStatus = org.settings?.autoApproveEmployees ? 'ACTIVE' : 'PENDING_APPROVAL';

    const user = await User.create({
      name,
      email,
      phone,
      passwordHash,
      role: 'EMPLOYEE',
      organization: org._id,
      employeeId: employeeId || '',
      status: initialStatus
    });

    const populatedUser = await User.findById(user._id).populate('organization');

    return res.status(201).json({
      success: true,
      data: {
        user: populatedUser,
        status: initialStatus,
        message: initialStatus === 'ACTIVE'
          ? 'Registration successful! You may now log in.'
          : 'Registration submitted successfully. Your account is pending administrator approval before you can log in.'
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash').populate('organization');
    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          details: null
        }
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          details: null
        }
      });
    }

    // Check account status
    if (user.status !== 'ACTIVE') {
      const statusMessages = {
        PENDING_APPROVAL: 'Your account is pending administrator approval. Please wait for an administrator to activate your account.',
        SUSPENDED: 'Your account has been suspended. Please contact your company administrator.',
        DEACTIVATED: 'Your account has been deactivated. Please contact your company administrator.'
      };

      return res.status(403).json({
        success: false,
        data: null,
        error: {
          code: `ACCOUNT_${user.status}`,
          message: statusMessages[user.status] || `Account is ${user.status.toLowerCase()}`,
          details: { status: user.status }
        }
      });
    }

    // Issue tokens
    const familyId = generateRandomToken(16);
    const rawRefreshToken = signRefreshToken({ userId: user._id.toString(), familyId });
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await RefreshSession.create({
      user: user._id,
      tokenHash,
      familyId,
      expiresAt
    });

    res.cookie('refreshToken', rawRefreshToken, getCookieOptions());

    const accessToken = signAccessToken({
      userId: user._id.toString(),
      organizationId: user.organization._id.toString(),
      role: user.role
    });

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: user.toJSON()
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    if (!rawRefreshToken) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'REFRESH_TOKEN_REQUIRED',
          message: 'Refresh token cookie missing',
          details: null
        }
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(rawRefreshToken);
    } catch {
      res.clearCookie('refreshToken', { path: '/api/auth' });
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is expired or invalid',
          details: null
        }
      });
    }

    const tokenHash = hashToken(rawRefreshToken);
    const session = await RefreshSession.findOne({ tokenHash }).select('+tokenHash');

    // Token reuse detection: if token is known but already revoked, revoke whole family
    if (!session || session.revokedAt) {
      if (session?.familyId || decoded?.familyId) {
        const familyId = session?.familyId || decoded?.familyId;
        await RefreshSession.updateMany(
          { familyId, revokedAt: null },
          { $set: { revokedAt: new Date() } }
        );
      }
      res.clearCookie('refreshToken', { path: '/api/auth' });
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'TOKEN_REUSE_DETECTED',
          message: 'Session has been invalidated due to token reuse detection. Please log in again.',
          details: null
        }
      });
    }

    // Check expiration
    if (session.expiresAt < new Date()) {
      res.clearCookie('refreshToken', { path: '/api/auth' });
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'REFRESH_TOKEN_EXPIRED',
          message: 'Session expired. Please log in again.',
          details: null
        }
      });
    }

    const user = await User.findById(session.user).populate('organization');
    if (!user || user.status !== 'ACTIVE') {
      res.clearCookie('refreshToken', { path: '/api/auth' });
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          code: 'ACCOUNT_NOT_ACTIVE',
          message: 'Account is not active',
          details: null
        }
      });
    }

    // Token rotation: revoke current session, issue new session in the same family
    const newRawRefreshToken = signRefreshToken({
      userId: user._id.toString(),
      familyId: session.familyId
    });
    const newTokenHash = hashToken(newRawRefreshToken);

    session.revokedAt = new Date();
    session.replacedBy = newTokenHash;
    await session.save();

    await RefreshSession.create({
      user: user._id,
      tokenHash: newTokenHash,
      familyId: session.familyId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    res.cookie('refreshToken', newRawRefreshToken, getCookieOptions());

    const accessToken = signAccessToken({
      userId: user._id.toString(),
      organizationId: user.organization._id.toString(),
      role: user.role
    });

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: user.toJSON()
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await RefreshSession.findOneAndUpdate(
        { tokenHash, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }

    res.clearCookie('refreshToken', { path: '/api/auth' });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Logged out successfully'
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always return success message to prevent user enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        data: {
          message: 'If an account exists with that work email, a password reset link has been sent.'
        },
        error: null
      });
    }

    const resetToken = generateRandomToken(32);
    user.passwordResetTokenHash = hashToken(resetToken);
    user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    await sendPasswordResetEmail({
      to: user.email,
      resetToken,
      userName: user.name
    });

    return res.status(200).json({
      success: true,
      data: {
        message: 'If an account exists with that work email, a password reset link has been sent.'
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const tokenHash = hashToken(token);

    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() }
    }).select('+passwordResetTokenHash +passwordResetExpiresAt');

    if (!user) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_OR_EXPIRED_TOKEN',
          message: 'Password reset link is invalid or has expired. Please request a new one.',
          details: null
        }
      });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    // Invalidate all refresh sessions for this user on password reset
    await RefreshSession.updateMany(
      { user: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      data: {
        message: 'Password has been successfully reset. You may now log in with your new credentials.'
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        user: req.user
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};
