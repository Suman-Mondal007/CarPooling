import express from 'express';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import organizationScope from '../middleware/organizationScope.js';
import validate from '../middleware/validate.js';
import {
  getSummary, getEmployees, updateEmployeeStatus,
  getVehicles, verifyVehicle,
  getSettings, updateSettings, regenerateCode,
  getRides, getReports
} from '../controllers/admin.controller.js';
import {
  updateEmployeeStatusSchema, verifyVehicleSchema,
  updateOrgSettingsSchema, adminRidesQuerySchema,
  adminEmployeesQuerySchema, adminVehiclesQuerySchema,
  reportQuerySchema
} from '../validators/phase7.validator.js';

const router = express.Router();

// Admin-only middleware
router.use(authenticate, authorize('COMPANY_ADMIN'), organizationScope);

// Summary
router.get('/summary', getSummary);

// Employees
router.get('/employees', validate(adminEmployeesQuerySchema), getEmployees);
router.patch('/employees/:id/status', validate(updateEmployeeStatusSchema), updateEmployeeStatus);

// Vehicles
router.get('/vehicles', validate(adminVehiclesQuerySchema), getVehicles);
router.post('/vehicles/:id/verify', validate(verifyVehicleSchema), verifyVehicle);

// Settings
router.get('/settings', getSettings);
router.patch('/settings', validate(updateOrgSettingsSchema), updateSettings);
router.post('/settings/regenerate-code', regenerateCode);

// Ride monitoring (READ-ONLY)
router.get('/rides', validate(adminRidesQuerySchema), getRides);

// Reports
router.get('/reports', validate(reportQuerySchema), getReports);

export default router;
