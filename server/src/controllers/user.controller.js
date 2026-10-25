import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import RefreshSession from '../models/RefreshSession.js';
import SupportRequest from '../models/SupportRequest.js';
import { getEmployeeReport } from '../services/analytics.service.js';
import Organization from '../models/Organization.js';

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('organization');
    return res.status(200).json({
      success: true,
      data: { user },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const {
      name, phone, employeeId, licenceNumber, licenceExpiry,
      preferredPaymentMethod, notificationPreferences
    } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (employeeId !== undefined) updates.employeeId = employeeId;
    if (licenceNumber !== undefined) updates.licenceNumber = licenceNumber;
    if (licenceExpiry !== undefined) updates.licenceExpiry = licenceExpiry;
    if (preferredPaymentMethod !== undefined) updates.preferredPaymentMethod = preferredPaymentMethod;

    if (notificationPreferences) {
      for (const [key, val] of Object.entries(notificationPreferences)) {
        if (['bookings', 'tripUpdates', 'chat', 'payments'].includes(key)) {
          updates[`notificationPreferences.${key}`] = val;
        }
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('organization');

    return res.status(200).json({
      success: true,
      data: { user },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

export const updatePaymentPreference = async (req, res, next) => {
  try {
    const { preferredPaymentMethod } = req.body;
    if (preferredPaymentMethod !== null && !['CASH', 'CARD', 'UPI', 'WALLET'].includes(preferredPaymentMethod)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYMENT_METHOD', message: 'Payment method must be CASH, CARD, UPI, WALLET, or null' }
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { preferredPaymentMethod } },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      data: { preferredPaymentMethod: user.preferredPaymentMethod },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user) {
      return res.status(404).json({
        success: false, data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({
        success: false, data: null,
        error: { code: 'WRONG_PASSWORD', message: 'Current password is incorrect' }
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Revoke all OTHER refresh sessions (keep the current one if possible)
    const currentRefreshToken = req.cookies?.refreshToken;
    if (currentRefreshToken) {
      const crypto = await import('crypto');
      const currentHash = crypto.createHash('sha256').update(currentRefreshToken).digest('hex');
      await RefreshSession.updateMany(
        { user: user._id, revokedAt: null, tokenHash: { $ne: currentHash } },
        { revokedAt: new Date() }
      );
    } else {
      await RefreshSession.updateMany(
        { user: user._id, revokedAt: null },
        { revokedAt: new Date() }
      );
    }

    return res.status(200).json({
      success: true,
      data: { message: 'Password changed successfully. Other sessions have been revoked.' },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

// ─── Support Requests ─────────────────────────────────
export const createSupportRequest = async (req, res, next) => {
  try {
    const { subject, message, category } = req.body;
    const request = await SupportRequest.create({
      user: req.user._id,
      organization: req.organizationId,
      subject,
      message,
      category
    });

    return res.status(201).json({
      success: true,
      data: { request },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

export const getMySupportRequests = async (req, res, next) => {
  try {
    const requests = await SupportRequest.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { items: requests, total: requests.length },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

// ─── Employee Reports ────────────────────────────────
export const getMyReports = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const now = new Date();
    const toDate = to ? new Date(to) : now;
    const fromDate = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const daysDiff = (toDate - fromDate) / (1000 * 60 * 60 * 24);
    if (daysDiff > 366 || daysDiff < 0) {
      return res.status(400).json({
        success: false, data: null,
        error: { code: 'INVALID_DATE_RANGE', message: 'Date range must be between 0 and 366 days' }
      });
    }

    const org = await Organization.findById(req.organizationId);
    const report = await getEmployeeReport(
      req.user._id, req.organizationId, fromDate, toDate, org.settings
    );

    return res.status(200).json({
      success: true,
      data: report,
      error: null
    });
  } catch (error) {
    next(error);
  }
};
