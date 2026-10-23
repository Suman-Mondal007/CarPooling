import { z } from 'zod';

// Indian phone number validation (+91 or 10 digits)
const phoneRegex = /^(?:\+91)?[6-9]\d{9}$/;

export const registerSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    phone: z.string().trim().regex(phoneRegex, 'Please enter a valid 10-digit Indian phone number (e.g. 9876543210 or +919876543210)'),
    password: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
    registrationCode: z.string().trim().min(3, 'Organization registration code is required').toUpperCase(),
    employeeId: z.string().trim().optional().default(''),
    agreeToTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must agree to the Terms and Conditions' })
    })
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword']
  })
};

export const loginSchema = {
  body: z.object({
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    password: z.string().min(1, 'Password is required')
  })
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z.string().trim().email('Invalid email address').toLowerCase()
  })
};

export const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string()
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword']
  })
};

export const updateProfileSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().regex(phoneRegex, 'Invalid phone number format').optional(),
    licenceNumber: z.string().trim().optional(),
    licenceExpiry: z.string().datetime().or(z.date()).optional()
  })
};
