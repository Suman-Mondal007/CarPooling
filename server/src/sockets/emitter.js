let ioInstance = null;

export function setIO(io) {
  ioInstance = io;
}

export function getIO() {
  return ioInstance;
}

export function emitToUser(userId, event, data) {
  if (!ioInstance) return;
  const uid = userId ? (userId._id || userId).toString() : null;
  if (uid) {
    ioInstance.to(`user:${uid}`).emit(event, data);
  }
}

export function emitToTrip(tripId, event, data) {
  if (!ioInstance) return;
  const tid = tripId ? (tripId._id || tripId).toString() : null;
  if (tid) {
    ioInstance.to(`trip:${tid}`).emit(event, data);
  }
}

export async function emitTripStatus(tripId, status, metadata = {}) {
  if (!ioInstance) return;
  const tid = tripId ? (tripId._id || tripId).toString() : null;
  if (!tid) return;

  const payload = {
    tripId: tid,
    status,
    timestamp: new Date().toISOString(),
    ...metadata
  };

  ioInstance.to(`trip:${tid}`).emit('trip:status', payload);

  // If trip ends (completed or cancelled), evict sockets from the trip room
  if (status === 'COMPLETED' || status === 'CANCELLED') {
    try {
      ioInstance.in(`trip:${tid}`).socketsLeave(`trip:${tid}`);
    } catch (err) {
      console.error('Error evicting sockets from ended trip room:', err);
    }
  }
}

export default {
  setIO,
  getIO,
  emitToUser,
  emitToTrip,
  emitTripStatus
};
