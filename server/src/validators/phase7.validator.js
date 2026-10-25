import { z } from 'zod';

// ─── History ─────────────────────────────────────────
export const historyQuerySchema = {
  query: z.object({
    search: z.string().optional(),
    role: z.enum(['all', 'driver', 'passenger']).optional().default('all'),
    status: z.enum(['all', 'COMPLETED', 'CANCELLED']).optional().default('all'),
    paymentStatus: z.enum(['all', 'UNPAID', 'PAYMENT_PENDING', 'PAID']).optional().default('all'),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortBy: z.enum(['date', 'fare', 'distance']).optional().default('date'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10)
  })
};

// ─── Profile / Settings ────────────────────────────────
export const updateSettingsSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().regex(/^(?:\+91)?[6-9]\d{9}$/, 'Invalid phone').optional(),
    employeeId: z.string().trim().max(20).optional(),
    licenceNumber: z.string().trim().optional(),
    licenceExpiry: z.string().datetime().or(z.date()).optional().nullable(),
    preferredPaymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'WALLET']).or(z.null()).optional(),
    notificationPreferences: z.object({
      bookings: z.boolean().optional(),
      tripUpdates: z.boolean().optional(),
      chat: z.boolean().optional(),
      payments: z.boolean().optional()
    }).optional()
  })
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string()
  }).refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword']
  })
};

// ─── Support ────────────────────────────────────────
export const createSupportSchema = {
  body: z.object({
    subject: z.string().trim().min(3).max(200),
    message: z.string().trim().min(10).max(2000),
    category: z.enum(['ACCOUNT', 'RIDES', 'PAYMENTS', 'VEHICLES', 'TECHNICAL', 'OTHER'])
  })
};

// ─── Admin Employees ────────────────────────────────
export const updateEmployeeStatusSchema = {
  body: z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
    reason: z.string().trim().min(3).max(500).optional()
  })
};

export const verifyVehicleSchema = {
  body: z.object({
    decision: z.enum(['VERIFIED', 'REJECTED']).optional(),
    status: z.enum(['VERIFIED', 'REJECTED']).optional(),
    reason: z.string().trim().min(3).max(500).optional(),
    rejectionReason: z.string().trim().min(3).max(500).optional()
  }).transform((d) => ({
    decision: d.decision || d.status,
    reason: d.reason || d.rejectionReason
  })).refine((d) => !!d.decision, {
    message: 'Verification decision is required',
    path: ['decision']
  }).refine((d) => d.decision !== 'REJECTED' || (d.reason && d.reason.length >= 3), {
    message: 'Reason is required when rejecting a vehicle',
    path: ['reason']
  })
};

// ─── Admin Settings ─────────────────────────────────
export const updateOrgSettingsSchema = {
  body: z.object({
    fuelPricePerLitre: z.number().min(1).max(500).optional(),
    operationalCostPerKm: z.number().min(0).max(100).optional(),
    cancellationCutoffMinutes: z.number().int().min(0).max(1440).optional(),
    autoApproveEmployees: z.boolean().optional(),
    requireVehicleVerification: z.boolean().optional(),
    requireEmployeeId: z.boolean().optional(),
    allowStartWithoutPassengers: z.boolean().optional(),
    timezone: z.string().min(1).max(50).optional()
  })
};

// ─── Reports date range ──────────────────────────────
export const reportQuerySchema = {
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    format: z.enum(['json', 'csv']).optional().default('json')
  })
};

// ─── Admin Rides (monitoring) ────────────────────────
export const adminRidesQuerySchema = {
  query: z.object({
    status: z.enum(['all', 'OPEN', 'CANCELLED', 'CLOSED']).optional().default('all'),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    driverId: z.string().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10)
  })
};

// ─── Admin Employees Query ──────────────────────────
export const adminEmployeesQuerySchema = {
  query: z.object({
    search: z.string().optional(),
    status: z.enum(['all', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional().default('all'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10)
  })
};

// ─── Admin Vehicles Query ────────────────────────────
export const adminVehiclesQuerySchema = {
  query: z.object({
    search: z.string().optional(),
    status: z.enum(['all', 'PENDING', 'VERIFIED', 'REJECTED']).optional(),
    verificationStatus: z.enum(['all', 'PENDING', 'VERIFIED', 'REJECTED']).optional().default('all'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10)
  }).transform((d) => ({
    ...d,
    verificationStatus: d.status && d.status !== 'all' ? d.status : (d.verificationStatus || 'all')
  }))
};
