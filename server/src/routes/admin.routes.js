import express from 'express';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import organizationScope from '../middleware/organizationScope.js';
import Organization from '../models/Organization.js';

const router = express.Router();

// Admin-only middleware
router.use(authenticate, authorize('COMPANY_ADMIN'), organizationScope);

// GET /api/admin/settings
router.get('/settings', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.organizationId);
    return res.status(200).json({
      success: true,
      data: { settings: org?.settings || {} },
      error: null
    });
  } catch (error) {
    next(error);
  }
});

export default router;
