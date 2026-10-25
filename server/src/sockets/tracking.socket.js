import {
  verifyTripParticipant,
  processDriverLocation,
  getTripTrackingState
} from '../services/tracking.service.js';

export function registerTrackingHandlers(io, socket) {
  /**
   * trip:join - Participant joins trip room
   */
  socket.on('trip:join', async (payload, callback) => {
    try {
      const tripId = typeof payload === 'object' ? payload?.tripId : payload;
      if (!tripId) {
        const errorRes = { success: false, error: { code: 'INVALID_TRIP_ID', message: 'Trip ID is required' } };
        if (typeof callback === 'function') return callback(errorRes);
        return socket.emit('trip:join:error', errorRes);
      }

      const check = await verifyTripParticipant(tripId, socket.userId, socket.organizationId);
      if (!check.authorized) {
        const errorRes = {
          success: false,
          error: {
            code: check.reason || 'UNAUTHORIZED',
            message: check.reason === 'NOT_A_PARTICIPANT'
              ? 'Only driver and confirmed passengers of this trip can join'
              : 'Trip not found or organization mismatch'
          }
        };
        if (typeof callback === 'function') return callback(errorRes);
        return socket.emit('trip:join:error', errorRes);
      }

      // Join the private trip room
      const roomName = `trip:${tripId}`;
      socket.join(roomName);

      // Fetch tracking snapshot for immediate sync
      const trackingData = await getTripTrackingState(tripId, socket.userId, socket.organizationId);

      const successRes = {
        success: true,
        data: trackingData
      };

      if (typeof callback === 'function') {
        callback(successRes);
      } else {
        socket.emit('trip:joined', successRes);
      }
    } catch (err) {
      console.error('Error in trip:join socket event:', err);
      const errorRes = { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } };
      if (typeof callback === 'function') callback(errorRes);
    }
  });

  /**
   * driver:location - Driver broadcasts GPS location update
   */
  socket.on('driver:location', async (payload, callback) => {
    try {
      if (!payload || typeof payload !== 'object') {
        const errRes = { success: false, error: { code: 'INVALID_PAYLOAD', message: 'Payload must be an object' } };
        if (typeof callback === 'function') callback(errRes);
        return;
      }

      const { tripId, lat, lng, heading, speed } = payload;
      if (!tripId) {
        const errRes = { success: false, error: { code: 'INVALID_TRIP_ID', message: 'tripId is required' } };
        if (typeof callback === 'function') callback(errRes);
        return;
      }

      const result = await processDriverLocation({
        tripId,
        driverId: socket.userId,
        lat,
        lng,
        heading,
        speed,
        isSimulated: false
      });

      if (typeof callback === 'function') {
        callback(result);
      }
    } catch (err) {
      const errRes = {
        success: false,
        error: {
          code: err.code || 'LOCATION_UPDATE_FAILED',
          message: err.message
        }
      };
      if (typeof callback === 'function') {
        callback(errRes);
      } else {
        socket.emit('driver:location:error', errRes);
      }
    }
  });

  /**
   * trip:leave - Sockets can explicitly leave trip room
   */
  socket.on('trip:leave', (payload) => {
    const tripId = typeof payload === 'object' ? payload?.tripId : payload;
    if (tripId) {
      socket.leave(`trip:${tripId}`);
    }
  });
}

export default registerTrackingHandlers;
