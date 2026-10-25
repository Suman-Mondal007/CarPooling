import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import env from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import organizationRoutes from './routes/organization.routes.js';
import adminRoutes from './routes/admin.routes.js';
import vehicleRoutes from './routes/vehicle.routes.js';
import savedPlaceRoutes from './routes/savedPlace.routes.js';
import geoRoutes from './routes/geo.routes.js';
import rideRoutes from './routes/ride.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import tripRoutes from './routes/trip.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import chatRoutes from './routes/chat.routes.js';
import devRoutes from './routes/dev.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import walletRoutes from './routes/wallet.routes.js';
import historyRoutes from './routes/history.routes.js';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import fs from 'fs';

const app = express();

// Security headers
app.use(helmet());

// CORS configuration (single exact origin, credentials true)
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key']
}));

// Raw body parser for webhook signature verification (mounted before express.json)
app.use('/api/payments/webhook', express.raw({ type: '*/*' }), (req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.rawBody = req.body.toString('utf8');
    try {
      req.body = JSON.parse(req.rawBody);
    } catch {
      // Keep as string if not valid JSON
    }
  }
  next();
});

// Request parsers
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
      details: null
    }
  }
});
app.use('/api', globalLimiter);

// Health check endpoint conforming to standard response envelope
app.get('/api/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  res.status(200).json({
    success: true,
    data: {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      database: isDbConnected ? 'connected' : 'disconnected'
    },
    error: null
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/saved-places', savedPlaceRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/history', historyRoutes);

// OpenAPI Documentation endpoint
try {
  const openapiPaths = [
    path.resolve(process.cwd(), 'openapi.yaml'),
    path.resolve(process.cwd(), '../openapi.yaml'),
    path.resolve(process.cwd(), 'server/openapi.yaml')
  ];
  const existingPath = openapiPaths.find((p) => fs.existsSync(p));
  if (existingPath) {
    const swaggerDocument = YAML.load(existingPath);
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }
} catch (err) {
  console.warn('⚠️ Could not load OpenAPI specification for /api/docs:', err.message);
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      details: null
    }
  });
});

// Centralized error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const isProduction = env.NODE_ENV === 'production';

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: isProduction && statusCode === 500 ? 'An unexpected internal error occurred.' : (err.message || 'Internal server error'),
      details: isProduction ? null : (err.details || err.stack || null)
    }
  });
});

export default app;
