import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required').default(
    process.env.NODE_ENV === 'test' ? 'mongodb://127.0.0.1:27017/carpooling-test' : 'mongodb://127.0.0.1:27017/carpooling'
  ),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters').default(
    process.env.NODE_ENV === 'production' ? '' : 'dev_jwt_access_secret_min_16_chars_sample'
  ),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters').default(
    process.env.NODE_ENV === 'production' ? '' : 'dev_jwt_refresh_secret_min_16_chars_sample'
  ),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  GEOCODING_URL: z.string().url().default('https://nominatim.openstreetmap.org'),
  MAP_ROUTING_URL: z.string().url().default('https://router.project-osrm.org'),
  GEO_USER_AGENT: z.string().min(1).default('CarpoolingPlatform/1.0 (contact@carpooling.local)'),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  ALLOW_SIMULATED_PAYMENTS: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(true),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default('noreply@carpooling.local'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@gmail.com'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('admin@007'),
  SEED_AUTO_APPROVE: z.preprocess((val) => typeof val === 'string' ? val.trim().toLowerCase() === 'true' : Boolean(val), z.boolean()).default(false),
  ENABLE_TRACKING_SIMULATOR: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false)
});

let parsedEnv;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const errorMessages = error.errors.map(err => `  - ${err.path.join('.')}: ${err.message}`).join('\n');
    console.error('\n❌ Environment Configuration Validation Failed:\n' + errorMessages + '\n\nPlease check your .env file against .env.example.\n');
    process.exit(1);
  }
  throw error;
}

if ((!parsedEnv.RAZORPAY_KEY_ID || !parsedEnv.RAZORPAY_KEY_SECRET) && !parsedEnv.ALLOW_SIMULATED_PAYMENTS && parsedEnv.NODE_ENV !== 'test') {
  console.warn('⚠️ [Payment Gateway Warning]: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing and ALLOW_SIMULATED_PAYMENTS is disabled. Online payments will return 503.');
}

export const env = parsedEnv;
export default env;
