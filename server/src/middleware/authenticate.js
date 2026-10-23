import { verifyAccessToken } from '../utils/token.js';
import User from '../models/User.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token missing or malformed',
          details: null
        }
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      const isExpired = err.name === 'TokenExpiredError';
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
          message: isExpired ? 'Access token has expired' : 'Access token is invalid',
          details: null
        }
      });
    }

    const user = await User.findById(decoded.userId).populate('organization');
    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Account no longer exists',
          details: null
        }
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          code: 'ACCOUNT_NOT_ACTIVE',
          message: `Account is ${user.status.toLowerCase().replace('_', ' ')}`,
          details: { status: user.status }
        }
      });
    }

    req.user = user;
    req.organizationId = user.organization?._id || user.organization;
    next();
  } catch (error) {
    next(error);
  }
};

export default authenticate;
