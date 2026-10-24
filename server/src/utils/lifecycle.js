/**
 * Derives passenger-facing lifecycle state from Trip status and Booking payment status.
 * Never persisted in the database; calculated on-the-fly.
 */

export const LIFECYCLE_STEPS = [
  { index: 1, code: 'RIDE_BOOKED', label: 'Ride Booked' },
  { index: 2, code: 'TRIP_STARTED', label: 'Trip Started' },
  { index: 3, code: 'TRIP_IN_PROGRESS', label: 'Trip In Progress' },
  { index: 4, code: 'TRIP_COMPLETED', label: 'Trip Completed' },
  { index: 5, code: 'PAYMENT_PENDING', label: 'Payment Pending' },
  { index: 6, code: 'PAYMENT_COMPLETED', label: 'Payment Completed' }
];

export function getPassengerLifecycle({ tripStatus = 'SCHEDULED', bookingStatus = 'CONFIRMED', paymentStatus = 'UNPAID' } = {}) {
  if (bookingStatus === 'CANCELLED_BY_PASSENGER' || bookingStatus === 'CANCELLED_BY_DRIVER') {
    return {
      stepIndex: 0,
      stepCode: bookingStatus,
      stepLabel: bookingStatus === 'CANCELLED_BY_PASSENGER' ? 'Cancelled by You' : 'Cancelled by Driver',
      isCancelled: true,
      isCompleted: false
    };
  }

  if (tripStatus === 'CANCELLED') {
    return {
      stepIndex: 0,
      stepCode: 'RIDE_CANCELLED',
      stepLabel: 'Ride Cancelled',
      isCancelled: true,
      isCompleted: false
    };
  }

  // Completed payments
  if (paymentStatus === 'PAID') {
    return {
      stepIndex: 6,
      stepCode: 'PAYMENT_COMPLETED',
      stepLabel: 'Payment Completed',
      isCancelled: false,
      isCompleted: true
    };
  }

  // Trip execution lifecycle
  if (tripStatus === 'COMPLETED') {
    return {
      stepIndex: 5,
      stepCode: 'PAYMENT_PENDING',
      stepLabel: 'Payment Pending',
      isCancelled: false,
      isCompleted: false
    };
  }

  if (tripStatus === 'IN_PROGRESS') {
    return {
      stepIndex: 3,
      stepCode: 'TRIP_IN_PROGRESS',
      stepLabel: 'Trip In Progress',
      isCancelled: false,
      isCompleted: false
    };
  }

  if (tripStatus === 'STARTED') {
    return {
      stepIndex: 2,
      stepCode: 'TRIP_STARTED',
      stepLabel: 'Trip Started',
      isCancelled: false,
      isCompleted: false
    };
  }

  return {
    stepIndex: 1,
    stepCode: 'RIDE_BOOKED',
    stepLabel: 'Ride Booked',
    isCancelled: false,
    isCompleted: false
  };
}
