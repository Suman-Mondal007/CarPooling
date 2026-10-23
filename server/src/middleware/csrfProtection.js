import env from '../config/env.js';

export const csrfProtection = (req, res, next) => {
  // Allow test environment to bypass if needed, but still check if headers provided
  if (env.NODE_ENV === 'test' && !req.headers.origin && !req.headers['x-requested-with']) {
    return next();
  }

  const origin = req.headers.origin;
  const customHeader = req.headers['x-requested-with'];

  // Check Origin if present
  if (origin && origin !== env.CLIENT_URL && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
    return res.status(403).json({
      success: false,
      data: null,
      error: {
        code: 'CSRF_ORIGIN_INVALID',
        message: 'Invalid request origin',
        details: null
      }
    });
  }

  // Check custom header
  if (!customHeader && !req.headers['x-csrf-protection']) {
    return res.status(403).json({
      success: false,
      data: null,
      error: {
        code: 'CSRF_HEADER_MISSING',
        message: 'Missing required CSRF security header (X-Requested-With)',
        details: null
      }
    });
  }

  next();
};

export default csrfProtection;
