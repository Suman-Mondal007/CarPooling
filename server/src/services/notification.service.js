import Notification from '../models/Notification.js';
import { emitToUser } from '../sockets/emitter.js';

export async function createNotification({
  userId,
  organizationId,
  type,
  title,
  message,
  referenceId = null,
  referenceModel = null,
  metadata = {}
}) {
  try {
    const notification = await Notification.create({
      user: userId,
      organization: organizationId,
      type,
      title,
      message,
      referenceId,
      referenceModel,
      metadata
    });

    // Real-time socket delivery to private user room
    emitToUser(userId, 'notification:new', notification);

    return notification;
  } catch (err) {
    console.error('Failed to create notification record:', err);
    return null;
  }
}

export async function notifyBookingCreated(booking, ride, passenger) {
  return createNotification({
    userId: ride.driver,
    organizationId: ride.organization,
    type: 'BOOKING_CREATED',
    title: 'New Seat Reservation',
    message: `${passenger.name || 'A colleague'} booked ${booking.seats} seat(s) on your ride departing ${new Date(ride.departureAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
    referenceId: booking._id,
    referenceModel: 'Booking'
  });
}

export async function notifyBookingCancelled(booking, ride, cancelledBy) {
  const isPassenger = cancelledBy.toString() === booking.passenger.toString();
  const targetUserId = isPassenger ? ride.driver : booking.passenger;
  const cancellerRole = isPassenger ? 'Passenger' : 'Driver';

  return createNotification({
    userId: targetUserId,
    organizationId: booking.organization,
    type: 'BOOKING_CANCELLED',
    title: 'Booking Cancelled',
    message: `${cancellerRole} cancelled booking for ${booking.seats} seat(s).`,
    referenceId: booking._id,
    referenceModel: 'Booking'
  });
}

export async function notifyRideCancelled(ride, confirmedBookings = []) {
  const promises = confirmedBookings.map((b) =>
    createNotification({
      userId: b.passenger,
      organizationId: ride.organization,
      type: 'RIDE_CANCELLED',
      title: 'Offered Ride Cancelled',
      message: `The ride scheduled for ${new Date(ride.departureAt).toLocaleString()} was cancelled by the driver.`,
      referenceId: ride._id,
      referenceModel: 'Ride'
    })
  );
  return Promise.all(promises);
}

export async function notifyTripStarted(trip, confirmedBookings = []) {
  const promises = confirmedBookings.map((b) =>
    createNotification({
      userId: b.passenger,
      organizationId: trip.organization,
      type: 'TRIP_STARTED',
      title: 'Trip Started',
      message: 'Your driver has started the trip. Please be ready at your pickup point.',
      referenceId: trip._id,
      referenceModel: 'Trip'
    })
  );
  return Promise.all(promises);
}

export async function notifyTripInProgress(trip, confirmedBookings = []) {
  const promises = confirmedBookings.map((b) =>
    createNotification({
      userId: b.passenger,
      organizationId: trip.organization,
      type: 'TRIP_IN_PROGRESS',
      title: 'Trip In Progress',
      message: 'The car is now on the move! Live tracking is active.',
      referenceId: trip._id,
      referenceModel: 'Trip'
    })
  );
  return Promise.all(promises);
}

export async function notifyTripCompleted(trip, confirmedBookings = []) {
  const promises = confirmedBookings.map((b) =>
    createNotification({
      userId: b.passenger,
      organizationId: trip.organization,
      type: 'TRIP_COMPLETED',
      title: 'Trip Completed',
      message: 'You have arrived at your destination. Please proceed with payment settlement.',
      referenceId: trip._id,
      referenceModel: 'Trip'
    })
  );
  return Promise.all(promises);
}

export async function notifyNewChatMessage(trip, message, senderUser, recipientIds = []) {
  const promises = recipientIds.map((userId) =>
    createNotification({
      userId,
      organizationId: trip.organization,
      type: 'NEW_CHAT_MESSAGE',
      title: `Message from ${senderUser.name || 'Carpool participant'}`,
      message: message.content.length > 80 ? `${message.content.substring(0, 80)}...` : message.content,
      referenceId: trip._id,
      referenceModel: 'Trip'
    })
  );
  return Promise.all(promises);
}

export default {
  createNotification,
  notifyBookingCreated,
  notifyBookingCancelled,
  notifyRideCancelled,
  notifyTripStarted,
  notifyTripInProgress,
  notifyTripCompleted,
  notifyNewChatMessage
};
