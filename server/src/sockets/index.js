import { Server as SocketIOServer } from 'socket.io';
import env from '../config/env.js';
import { verifyAccessToken } from '../utils/token.js';
import User from '../models/User.js';
import { setIO } from './emitter.js';
import { registerTrackingHandlers } from './tracking.socket.js';
import { registerChatHandlers } from './chat.socket.js';

export function initializeSockets(httpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  // Share io instance for service-level emits
  setIO(io);

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        const error = new Error('Authentication token missing in handshake');
        error.data = { code: 'UNAUTHORIZED', message: 'Token missing' };
        return next(error);
      }

      let decoded;
      try {
        decoded = verifyAccessToken(token);
      } catch (jwtErr) {
        const isExpired = jwtErr.name === 'TokenExpiredError';
        const error = new Error(isExpired ? 'Access token has expired' : 'Access token is invalid');
        error.data = {
          code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
          message: error.message
        };
        return next(error);
      }

      const user = await User.findById(decoded.userId).populate('organization');
      if (!user) {
        const error = new Error('User not found');
        error.data = { code: 'USER_NOT_FOUND', message: 'Account does not exist' };
        return next(error);
      }

      if (user.status !== 'ACTIVE') {
        const error = new Error(`Account is ${user.status}`);
        error.data = { code: 'ACCOUNT_NOT_ACTIVE', status: user.status };
        return next(error);
      }

      // Attach user information to socket instance
      socket.user = user;
      socket.userId = user._id.toString();
      socket.organizationId = (user.organization?._id || user.organization).toString();

      next();
    } catch (err) {
      console.error('Socket authentication error:', err);
      const error = new Error('Internal authentication error');
      error.data = { code: 'AUTH_FAILED', message: err.message };
      next(error);
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    if (env.NODE_ENV !== 'test') {
      console.log(`🔌 Socket connected: ${socket.id} (user: ${socket.userId})`);
    }

    // Join user to their private notification room
    socket.join(`user:${socket.userId}`);

    // Register tracking and chat handlers
    registerTrackingHandlers(io, socket);
    registerChatHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      if (env.NODE_ENV !== 'test') {
        console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
      }
    });
  });

  return io;
}

export default initializeSockets;
