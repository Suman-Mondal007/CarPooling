import Message from '../models/Message.js';
import Trip from '../models/Trip.js';
import Booking from '../models/Booking.js';
import { notifyNewChatMessage } from '../services/notification.service.js';

// In-memory rate limiting map: userId -> array of message send timestamps (ms)
const userMessageRateMap = new Map();
const RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds
const RATE_LIMIT_MAX_MESSAGES = 10; // max 10 messages per 10 seconds

/**
 * Sanitizes chat content to prevent basic XSS
 */
function sanitizeText(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates chat sender authorization:
 * - Company admins CANNOT read or send messages
 * - Only the trip driver and confirmed passengers in the same organization
 * - Validates chat availability window (until 24h after completion)
 */
export async function validateChatAccess(tripId, user, organizationId) {
  if (!user || user.role === 'COMPANY_ADMIN') {
    const error = new Error('Company admins are not permitted to access chat content');
    error.code = 'FORBIDDEN_ADMIN';
    error.status = 403;
    throw error;
  }

  const trip = await Trip.findOne({ _id: tripId, organization: organizationId });
  if (!trip) {
    const error = new Error('Trip not found');
    error.code = 'TRIP_NOT_FOUND';
    error.status = 404;
    throw error;
  }

  const uid = user._id.toString();
  const isDriver = trip.driver.toString() === uid;

  let isPassenger = false;
  if (!isDriver) {
    const booking = await Booking.findOne({
      ride: trip.ride,
      passenger: user._id,
      organization: organizationId,
      status: 'CONFIRMED'
    });
    if (booking) {
      isPassenger = true;
    }
  }

  if (!isDriver && !isPassenger) {
    const error = new Error('Only the trip driver and confirmed passengers can access this chat');
    error.code = 'NOT_A_PARTICIPANT';
    error.status = 403;
    throw error;
  }

  // Check 24-hour read-only window
  let isReadOnly = false;
  if (trip.status === 'COMPLETED' && trip.completedAt) {
    const hoursSinceCompletion = (Date.now() - new Date(trip.completedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCompletion > 24) {
      isReadOnly = true;
    }
  } else if (trip.status === 'CANCELLED') {
    isReadOnly = true;
  }

  return { trip, isDriver, isPassenger, isReadOnly };
}

export function registerChatHandlers(io, socket) {
  /**
   * chat:send - Send a chat message
   */
  socket.on('chat:send', async (payload, callback) => {
    try {
      if (!payload || typeof payload !== 'object') {
        const errRes = { success: false, error: { code: 'INVALID_PAYLOAD', message: 'Payload must be an object' } };
        if (typeof callback === 'function') callback(errRes);
        return;
      }

      const { tripId, text } = payload;
      if (!tripId) {
        const errRes = { success: false, error: { code: 'INVALID_TRIP_ID', message: 'tripId is required' } };
        if (typeof callback === 'function') callback(errRes);
        return;
      }

      // Check rate limit per user
      const now = Date.now();
      const userTimestamps = userMessageRateMap.get(socket.userId) || [];
      const recentTimestamps = userTimestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

      if (recentTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
        const errRes = {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many messages sent. Please slow down.'
          }
        };
        if (typeof callback === 'function') callback(errRes);
        socket.emit('chat:error', errRes);
        return;
      }

      recentTimestamps.push(now);
      userMessageRateMap.set(socket.userId, recentTimestamps);

      // Validate access
      const { trip, isReadOnly } = await validateChatAccess(
        tripId,
        socket.user,
        socket.organizationId
      );

      if (isReadOnly) {
        const errRes = {
          success: false,
          error: {
            code: 'CHAT_READ_ONLY',
            message: 'Chat is read-only after trip completion window or cancellation'
          }
        };
        if (typeof callback === 'function') callback(errRes);
        socket.emit('chat:error', errRes);
        return;
      }

      // Validate message text
      if (!text || typeof text !== 'string') {
        const errRes = { success: false, error: { code: 'EMPTY_MESSAGE', message: 'Message text cannot be empty' } };
        if (typeof callback === 'function') callback(errRes);
        return;
      }

      const trimmedText = text.trim();
      if (trimmedText.length === 0) {
        const errRes = { success: false, error: { code: 'EMPTY_MESSAGE', message: 'Message text cannot be empty' } };
        if (typeof callback === 'function') callback(errRes);
        return;
      }

      if (trimmedText.length > 1000) {
        const errRes = { success: false, error: { code: 'MESSAGE_TOO_LONG', message: 'Message text cannot exceed 1000 characters' } };
        if (typeof callback === 'function') callback(errRes);
        return;
      }

      const sanitizedText = sanitizeText(trimmedText);

      // Create message in MongoDB
      const message = await Message.create({
        trip: trip._id,
        sender: socket.userId,
        organization: socket.organizationId,
        content: sanitizedText,
        readBy: [socket.userId]
      });

      const messagePayload = {
        _id: message._id,
        trip: trip._id,
        sender: {
          _id: socket.user._id,
          name: socket.user.name,
          role: socket.user.role
        },
        content: message.content,
        createdAt: message.createdAt,
        readBy: message.readBy
      };

      // Broadcast to all participants in the trip room
      io.to(`trip:${tripId}`).emit('chat:message', messagePayload);

      // Find other trip participants to notify if not viewing the chat
      const confirmedBookings = await Booking.find({
        ride: trip.ride,
        status: 'CONFIRMED'
      }).select('passenger');

      const allParticipantIds = [
        trip.driver.toString(),
        ...confirmedBookings.map((b) => b.passenger.toString())
      ];

      // Identify recipients who are not the sender
      const recipientIds = allParticipantIds.filter((id) => id !== socket.userId);

      // Check which users currently have an active socket in this trip room
      const roomSocketIds = io.sockets.adapter.rooms.get(`trip:${tripId}`) || new Set();
      const activeUserIdsInRoom = new Set();
      for (const sid of roomSocketIds) {
        const s = io.sockets.sockets.get(sid);
        if (s && s.userId) {
          activeUserIdsInRoom.add(s.userId);
        }
      }

      // Notify recipients who are NOT in the trip room
      const recipientsToNotify = recipientIds.filter((id) => !activeUserIdsInRoom.has(id));
      if (recipientsToNotify.length > 0) {
        notifyNewChatMessage(trip, message, socket.user, recipientsToNotify).catch(() => {});
      }

      const successRes = {
        success: true,
        data: messagePayload
      };

      if (typeof callback === 'function') {
        callback(successRes);
      }
    } catch (err) {
      console.error('Error in chat:send socket event:', err);
      const errRes = {
        success: false,
        error: {
          code: err.code || 'CHAT_SEND_FAILED',
          message: err.message
        }
      };
      if (typeof callback === 'function') callback(errRes);
      socket.emit('chat:error', errRes);
    }
  });

  /**
   * chat:read - Mark messages as read by this user
   */
  socket.on('chat:read', async (payload, callback) => {
    try {
      const tripId = typeof payload === 'object' ? payload?.tripId : payload;
      if (!tripId) return;

      await Message.updateMany(
        {
          trip: tripId,
          readBy: { $ne: socket.userId }
        },
        {
          $addToSet: { readBy: socket.userId }
        }
      );

      // Inform room of read status
      io.to(`trip:${tripId}`).emit('chat:read', {
        tripId,
        userId: socket.userId,
        readAt: new Date().toISOString()
      });

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (err) {
      console.error('Error in chat:read socket event:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });
}

export default registerChatHandlers;
