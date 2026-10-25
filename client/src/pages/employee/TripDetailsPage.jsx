import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Clock, Users, IndianRupee, Car, User,
  Play, CheckCircle2, XCircle, MessageSquare, Navigation,
  AlertCircle, Phone, Banknote, Wallet, Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';
import tripsApi from '../../api/trips.api.js';
import ridesApi from '../../api/rides.api.js';
import bookingsApi from '../../api/bookings.api.js';
import paymentsApi from '../../api/payments.api.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import { ConfirmDialog } from '../../components/common/Modal.jsx';
import RouteMap from '../../components/maps/RouteMap.jsx';
import { Skeleton } from '../../components/common/Skeleton.jsx';
import ChatPanel from '../../components/chat/ChatPanel.jsx';

const LIFECYCLE_STEPS = [
  { code: 'RIDE_BOOKED', label: 'Ride Booked' },
  { code: 'TRIP_STARTED', label: 'Trip Started' },
  { code: 'TRIP_IN_PROGRESS', label: 'In Progress' },
  { code: 'TRIP_COMPLETED', label: 'Completed' },
  { code: 'PAYMENT_PENDING', label: 'Payment Pending' },
  { code: 'PAYMENT_COMPLETED', label: 'Payment Done' }
];

function LifecycleStepper({ lifecycle }) {
  if (!lifecycle || lifecycle.isCancelled) {
    return (
      <div className="p-3 bg-rose-50 rounded-xl text-xs text-rose-700 font-medium">
        {lifecycle?.stepLabel || 'Cancelled'}
      </div>
    );
  }

  const currentIndex = lifecycle.stepIndex || 1;

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {LIFECYCLE_STEPS.map((step, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentIndex;
        const isDone = stepNum < currentIndex;
        return (
          <React.Fragment key={step.code}>
            <div className="flex flex-col items-center min-w-[60px]">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {isDone ? '✓' : stepNum}
              </div>
              <span className={`text-[9px] mt-1 text-center leading-tight ${
                isActive ? 'font-semibold text-teal-700' : isDone ? 'text-emerald-600' : 'text-slate-400'
              }`}>
                {step.label}
              </span>
            </div>
            {i < LIFECYCLE_STEPS.length - 1 && (
              <div className={`flex-1 h-px min-w-[12px] ${isDone ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function TripDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Action states
  const [startingTrip, setStartingTrip] = useState(false);
  const [completingTrip, setCompletingTrip] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState(false);
  const [cancellingRide, setCancellingRide] = useState(false);
  const [confirmingCashId, setConfirmingCashId] = useState(null);
  const [pendingCashPayments, setPendingCashPayments] = useState([]);
  const [paidPaymentId, setPaidPaymentId] = useState(null);

  // Dialogs
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showCancelBookingDialog, setShowCancelBookingDialog] = useState(false);
  const [showCancelRideDialog, setShowCancelRideDialog] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const fetchTrip = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tripsApi.getTripById(id);
      setTrip(data);

      // Fetch payment info
      if (data.isDriver) {
        try {
          const paymentsRes = await paymentsApi.getMyPayments({ role: 'driver' });
          const pending = (paymentsRes.data?.items || []).filter(
            (p) => (p.trip?._id === id || p.trip === id) && p.status === 'PENDING_CASH_CONFIRMATION'
          );
          setPendingCashPayments(pending);
        } catch {
          // Ignore
        }
      } else {
        try {
          const paymentsRes = await paymentsApi.getMyPayments({ role: 'passenger' });
          const match = (paymentsRes.data?.items || []).find(
            (p) => (p.trip?._id === id || p.trip === id) && p.status === 'PAID'
          );
          if (match) {
            setPaidPaymentId(match._id);
          }
        } catch {
          // Ignore
        }
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  const handleStartTrip = async () => {
    setStartingTrip(true);
    try {
      await tripsApi.startTrip(id);
      toast.success('Trip started successfully!');
      setShowStartDialog(false);
      fetchTrip();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to start trip');
    } finally {
      setStartingTrip(false);
    }
  };

  const handleCompleteTrip = async () => {
    setCompletingTrip(true);
    try {
      await tripsApi.completeTrip(id);
      toast.success('Trip completed! Passengers have been notified.');
      setShowCompleteDialog(false);
      fetchTrip();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to complete trip');
    } finally {
      setCompletingTrip(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!trip?.passengers?.myBooking?._id) return;
    setCancellingBooking(true);
    try {
      await bookingsApi.cancelBooking(trip.passengers.myBooking._id);
      toast.success('Booking cancelled');
      setShowCancelBookingDialog(false);
      fetchTrip();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to cancel booking');
    } finally {
      setCancellingBooking(false);
    }
  };

  const handleCancelRide = async () => {
    if (!trip?.ride?._id) return;
    setCancellingRide(true);
    try {
      await ridesApi.cancelOfferedRide(trip.ride._id);
      toast.success('Ride cancelled. All passengers have been notified.');
      setShowCancelRideDialog(false);
      fetchTrip();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to cancel ride');
    } finally {
      setCancellingRide(false);
    }
  };

  const handleConfirmCashPayment = async (paymentId) => {
    try {
      setConfirmingCashId(paymentId);
      await paymentsApi.confirmCashPayment(paymentId);
      toast.success('Cash payment confirmed! Trip marked paid.');
      await fetchTrip();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to confirm cash payment');
    } finally {
      setConfirmingCashId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton variant="card" className="h-80" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Trip Not Found</h2>
        <p className="text-sm text-slate-500">{error || 'This trip could not be loaded.'}</p>
        <Link to="/my-trips"><Button variant="outline">Back to My Trips</Button></Link>
      </div>
    );
  }

  const { ride, isDriver, passengers, lifecycle, status } = trip;
  const departure = ride?.departureAt ? new Date(ride.departureAt) : null;
  const canStart = isDriver && status === 'SCHEDULED';
  const canComplete = isDriver && (status === 'STARTED' || status === 'IN_PROGRESS');
  const canCancelRide = isDriver && status === 'SCHEDULED';

  // Passenger perspective
  const myBooking = !isDriver ? passengers?.myBooking : null;
  const canCancelBooking = myBooking?.status === 'CONFIRMED' && status === 'SCHEDULED';

  // Check late cancellation
  const orgCutoffMinutes = 60; // Default
  const isLateCancellation = departure && (departure.getTime() - Date.now()) <= orgCutoffMinutes * 60 * 1000;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/my-trips"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to My Trips
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Trip Details</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={isDriver ? 'slate' : 'teal'} size="sm">
              {isDriver ? 'Driver View' : 'Passenger View'}
            </Badge>
            {getStatusBadge(status)}
          </div>
        </div>
      </div>

      {/* Lifecycle Stepper */}
      <Card>
        <h3 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Journey Progress</h3>
        <LifecycleStepper lifecycle={lifecycle} />
      </Card>

      {/* Route Map */}
      {ride && (
        <Card className="p-0 overflow-hidden">
          <RouteMap
            origin={ride.originCoords || (ride.origin ? { lat: ride.origin.coordinates[1], lng: ride.origin.coordinates[0] } : null)}
            destination={ride.destinationCoords || (ride.destination ? { lat: ride.destination.coordinates[1], lng: ride.destination.coordinates[0] } : null)}
            routeGeometry={ride.routeGeometry}
            distanceKm={ride.distanceMeters ? ride.distanceMeters / 1000 : null}
            durationMinutes={ride.durationSeconds ? Math.round(ride.durationSeconds / 60) : null}
            height="280px"
          />
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Route Info */}
          <Card>
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-600" /> Schedule & Route
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-slate-50 rounded-lg text-xs">
                <div className="flex items-center gap-1.5 text-slate-500 mb-1"><Clock className="w-3.5 h-3.5" /> Departure</div>
                <p className="font-semibold text-slate-800">
                  {departure ? departure.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' }) : '—'}
                </p>
                <p className="text-slate-500 mt-0.5">
                  {departure ? departure.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg text-xs">
                <div className="text-slate-500 mb-1">Distance & Duration</div>
                <p className="font-semibold text-slate-800">{ride?.distanceMeters ? (ride.distanceMeters / 1000).toFixed(1) + ' km' : '—'}</p>
                <p className="text-slate-500 mt-0.5">{ride?.durationSeconds ? Math.round(ride.durationSeconds / 60) + ' minutes' : ''}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">A</div>
                <p className="text-xs text-slate-700">{ride?.originAddress}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">B</div>
                <p className="text-xs text-slate-700">{ride?.destinationAddress}</p>
              </div>
            </div>
          </Card>

          {/* Driver Info (passenger view) or Vehicle Info (driver view) */}
          <Card>
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              {isDriver ? <Car className="w-4 h-4 text-teal-600" /> : <User className="w-4 h-4 text-teal-600" />}
              {isDriver ? 'Vehicle' : 'Driver & Vehicle'}
            </h3>

            {!isDriver && ride?.driver && (
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-lg uppercase">
                  {ride.driver.name?.charAt(0) || 'D'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{ride.driver.name}</p>
                  {ride.driver.phone && (
                    <a href={`tel:${ride.driver.phone}`} className="text-xs text-teal-600 flex items-center gap-1 mt-0.5 hover:underline">
                      <Phone className="w-3 h-3" /> {ride.driver.phone}
                    </a>
                  )}
                </div>
              </div>
            )}

            {ride?.vehicle && (
              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-800">{ride.vehicle.model}</span>
                  <span className="font-mono text-slate-500">{ride.vehicle.registrationNumber}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  {ride.vehicle.vehicleType && <Badge variant="slate" size="sm">{ride.vehicle.vehicleType}</Badge>}
                  {ride.vehicle.color && <span>{ride.vehicle.color}</span>}
                  {ride.vehicle.fuelType && <span>{ride.vehicle.fuelType}</span>}
                </div>
              </div>
            )}
          </Card>

          {/* Passengers (driver view) */}
          {isDriver && Array.isArray(passengers) && (
            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" /> Passengers ({passengers.length})
              </h3>
              {passengers.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No bookings yet</p>
              ) : (
                <div className="space-y-3">
                  {passengers.map((p) => (
                    <div key={p._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs uppercase">
                          {p.passenger?.name?.charAt(0) || 'P'}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">{p.passenger?.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {p.seats} seat{p.seats > 1 ? 's' : ''} · ₹{p.fareTotalRupees}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={p.status === 'CONFIRMED' ? 'emerald' : p.status === 'COMPLETED' ? 'teal' : 'rose'} size="sm">
                          {p.status}
                        </Badge>
                        {p.passenger?.phone && (
                          <a href={`tel:${p.passenger.phone}`} className="text-teal-600 hover:text-teal-800">
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* My Booking (passenger view) */}
          {!isDriver && myBooking && (
            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-teal-600" /> My Booking
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Seats</span>
                  <p className="font-semibold text-slate-800">{myBooking.seats}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Status</span>
                  <p className="font-semibold text-slate-800">{myBooking.status}</p>
                </div>
                <div className="p-3 bg-teal-50 rounded-lg">
                  <span className="text-teal-600">Total Fare</span>
                  <p className="font-bold text-teal-800">₹{myBooking.fareTotalRupees}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Payment</span>
                  <p className="font-semibold text-slate-800">{myBooking.paymentStatus}</p>
                </div>
              </div>

              {passengers?.otherConfirmedPassengersCount > 0 && (
                <p className="text-xs text-slate-500 mt-3">
                  {passengers.otherConfirmedPassengersCount} other passenger{passengers.otherConfirmedPassengersCount > 1 ? 's' : ''} on this ride
                </p>
              )}
            </Card>
          )}
        </div>

        {/* Action Panel */}
        <div className="space-y-4">
          {/* Fare info */}
          <Card>
            <h3 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">Fare Information</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Per Seat</span>
                <span className="font-semibold text-slate-800">₹{ride?.farePerSeatMinor ? (ride.farePerSeatMinor / 100).toFixed(0) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Seats</span>
                <span className="text-slate-800">{ride?.totalPassengerSeats || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Available</span>
                <span className="text-slate-800">{ride?.availableSeats ?? '—'}</span>
              </div>
            </div>
          </Card>

          {/* Driver Actions */}
          {isDriver && (
            <Card className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Driver Actions</h3>

              {canStart && (
                <Button onClick={() => setShowStartDialog(true)} className="w-full" size="md">
                  <Play className="w-4 h-4" /> Start Trip
                </Button>
              )}

              {canComplete && (
                <Button onClick={() => setShowCompleteDialog(true)} className="w-full" size="md" variant="secondary">
                  <CheckCircle2 className="w-4 h-4" /> Complete Trip
                </Button>
              )}

              {canCancelRide && (
                <Button onClick={() => setShowCancelRideDialog(true)} className="w-full" size="md" variant="danger">
                  <XCircle className="w-4 h-4" /> Cancel Ride
                </Button>
              )}

              {status === 'COMPLETED' && (
                <Badge variant="emerald" size="md" className="w-full justify-center">Trip Completed</Badge>
              )}
              {status === 'CANCELLED' && (
                <Badge variant="rose" size="md" className="w-full justify-center">Cancelled</Badge>
              )}
            </Card>
          )}

          {/* Passenger Actions */}
          {!isDriver && (
            <Card className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Passenger Actions</h3>

              {canCancelBooking && (
                <Button onClick={() => setShowCancelBookingDialog(true)} className="w-full" size="md" variant="danger">
                  <XCircle className="w-4 h-4" /> Cancel Booking
                </Button>
              )}

              <Button
                onClick={() => navigate(`/trips/${trip._id}/tracking`)}
                className="w-full flex items-center justify-center gap-2"
                size="md"
                variant="outline"
              >
                <Navigation className="w-4 h-4 text-teal-600" /> Live Tracking
              </Button>

              <Button
                onClick={() => setShowChat((prev) => !prev)}
                className="w-full flex items-center justify-center gap-2"
                size="md"
                variant="outline"
              >
                <MessageSquare className="w-4 h-4 text-blue-600" /> {showChat ? 'Hide Trip Chat' : 'Trip Chat'}
              </Button>

              {status === 'COMPLETED' && myBooking && (
                myBooking.paymentStatus === 'PAID' ? (
                  <Button
                    onClick={() => navigate(`/payments/${paidPaymentId || ''}/receipt`)}
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2 text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                    size="md"
                  >
                    <Receipt className="w-4 h-4" /> View Payment Receipt
                  </Button>
                ) : (
                  <Button
                    onClick={() => navigate(`/trips/${trip._id}/pay`)}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20"
                    size="md"
                  >
                    <IndianRupee className="w-4 h-4" /> Pay Fare (₹{myBooking.fareTotalRupees})
                  </Button>
                )
              )}
            </Card>
          )}

          {isDriver && (
            <>
              {pendingCashPayments.length > 0 && (
                <Card className="space-y-3 border-amber-300 bg-amber-50/50">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wider">
                    <Banknote className="w-4 h-4 text-amber-600" /> Pending Cash ({pendingCashPayments.length})
                  </div>
                  <div className="space-y-2">
                    {pendingCashPayments.map((p) => (
                      <div
                        key={p._id}
                        className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-800">
                            {p.passenger?.name || 'Passenger'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            ₹{((p.amountMinor || 0) / 100).toFixed(2)} cash on drop
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleConfirmCashPayment(p._id)}
                          disabled={confirmingCashId === p._id}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                        >
                          {confirmingCashId === p._id ? 'Confirming...' : 'Confirm Received'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card className="space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Driver Tools</h3>
                <Button
                  onClick={() => navigate(`/trips/${trip._id}/tracking`)}
                  className="w-full flex items-center justify-center gap-2"
                  size="md"
                  variant="outline"
                >
                  <Navigation className="w-4 h-4 text-teal-600" /> Live Tracking Map
                </Button>

                <Button
                  onClick={() => setShowChat((prev) => !prev)}
                  className="w-full flex items-center justify-center gap-2"
                  size="md"
                  variant="outline"
                >
                  <MessageSquare className="w-4 h-4 text-blue-600" /> {showChat ? 'Hide Trip Chat' : 'Trip Chat'}
                </Button>

                <Button
                  onClick={() => navigate('/wallet')}
                  className="w-full flex items-center justify-center gap-2"
                  size="md"
                  variant="outline"
                >
                  <Wallet className="w-4 h-4 text-purple-600" /> My Wallet & Earnings
                </Button>
              </Card>
            </>
          )}

          {/* Embedded Chat Drawer */}
          {showChat && (
            <div className="mt-4">
              <ChatPanel
                tripId={trip._id}
                isOpen={showChat}
                onClose={() => setShowChat(false)}
                isEmbedded={true}
                title="Trip Chat"
              />
            </div>
          )}
        </div>
      </div>


      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showStartDialog}
        onClose={() => setShowStartDialog(false)}
        onConfirm={handleStartTrip}
        title="Start Trip"
        message="Are you ready to begin this trip? Your passengers will be notified. The ride will be closed for new bookings."
        confirmText="Start Trip"
        loading={startingTrip}
      />

      <ConfirmDialog
        isOpen={showCompleteDialog}
        onClose={() => setShowCompleteDialog(false)}
        onConfirm={handleCompleteTrip}
        title="Complete Trip"
        message="Mark this trip as completed? All confirmed bookings will be finalized and passengers notified to settle payment."
        confirmText="Complete Trip"
        loading={completingTrip}
      />

      <ConfirmDialog
        isOpen={showCancelBookingDialog}
        onClose={() => setShowCancelBookingDialog(false)}
        onConfirm={handleCancelBooking}
        title="Cancel Booking"
        message={
          isLateCancellation
            ? '⚠️ Warning: This cancellation is within the cutoff window and will be marked as a late cancellation on your record. Are you sure?'
            : 'Are you sure you want to cancel this booking? Your reserved seats will be released.'
        }
        confirmText="Cancel Booking"
        danger
        loading={cancellingBooking}
      />

      <ConfirmDialog
        isOpen={showCancelRideDialog}
        onClose={() => setShowCancelRideDialog(false)}
        onConfirm={handleCancelRide}
        title="Cancel Ride"
        message="Are you sure you want to cancel this ride? All passenger bookings will be cancelled and passengers will be notified."
        confirmText="Cancel Ride"
        danger
        loading={cancellingRide}
      />
    </div>
  );
}

function getStatusBadge(status) {
  const map = {
    SCHEDULED: { variant: 'blue', label: 'Scheduled' },
    STARTED: { variant: 'amber', label: 'Started' },
    IN_PROGRESS: { variant: 'teal', label: 'In Progress' },
    COMPLETED: { variant: 'emerald', label: 'Completed' },
    CANCELLED: { variant: 'rose', label: 'Cancelled' }
  };
  const cfg = map[status] || { variant: 'slate', label: status };
  return <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>;
}

export default TripDetailsPage;
