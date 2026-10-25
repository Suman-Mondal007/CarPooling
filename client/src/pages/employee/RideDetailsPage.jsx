import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Clock, Car, User,
  Minus, Plus, ShieldCheck, AlertCircle, CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import ridesApi from '../../api/rides.api.js';
import bookingsApi from '../../api/bookings.api.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import RouteMap from '../../components/maps/RouteMap.jsx';
import { Skeleton } from '../../components/common/Skeleton.jsx';
import { useRideDraft } from '../../context/RideDraftContext.jsx';

export function RideDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { draft } = useRideDraft();

  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seats, setSeats] = useState(1);
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    ridesApi.getRideById(id)
      .then((data) => setRide(data))
      .catch((err) => setError(err.response?.data?.error?.message || 'Failed to load ride details'))
      .finally(() => setLoading(false));
  }, [id]);

  const maxBookableSeats = Math.min(ride?.availableSeats || 0, 4);

  const handleBook = async () => {
    if (!ride) return;
    setBooking(true);
    setBookError(null);

    const pickup = draft?.findPickup || { address: ride.originAddress, lat: ride.originCoords?.lat, lng: ride.originCoords?.lng };
    const drop = draft?.findDrop || { address: ride.destinationAddress, lat: ride.destinationCoords?.lat, lng: ride.destinationCoords?.lng };

    try {
      const result = await bookingsApi.createBooking({
        rideId: ride._id,
        seats,
        pickup: { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
        drop: { address: drop.address, lat: drop.lat, lng: drop.lng }
      });
      toast.success(`Successfully booked ${seats} seat${seats > 1 ? 's' : ''}!`);
      navigate(`/booking-confirmation/${result._id}`);
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Booking failed. Please try again.';
      const code = err.response?.data?.error?.code;
      setBookError(msg);

      if (code === 'SEATS_UNAVAILABLE') {
        toast.error('These seats were just taken. Please try fewer seats or a different ride.');
      } else if (code === 'DUPLICATE_BOOKING') {
        toast.error('You already have an active booking on this ride.');
      } else {
        toast.error(msg);
      }
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton variant="card" className="h-80" />
        <Skeleton variant="card" className="h-40" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Ride Not Available</h2>
        <p className="text-sm text-slate-500">{error}</p>
        <Link to="/find-ride">
          <Button variant="outline" className="mt-2">Back to Search</Button>
        </Link>
      </div>
    );
  }

  if (!ride) return null;

  const departure = new Date(ride.departureAt);
  const isBookable = ride.status === 'OPEN' && ride.availableSeats > 0 && ride.tripStatus === 'SCHEDULED' && departure > new Date();
  const fareTotal = (seats * (ride.farePerSeatMinor || 0)) / 100;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/rides"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Results
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ride Details</h1>
        <p className="text-sm text-slate-500 mt-1">Review route, timing, and fare before booking.</p>
      </div>

      {/* Route Map */}
      <Card className="p-0 overflow-hidden">
        <RouteMap
          origin={ride.originCoords}
          destination={ride.destinationCoords}
          routeGeometry={ride.routeGeometry}
          distanceKm={ride.distanceMeters ? ride.distanceMeters / 1000 : null}
          durationMinutes={ride.durationSeconds ? Math.round(ride.durationSeconds / 60) : null}
          height="320px"
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Route */}
          <Card>
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-600" /> Route Details
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">A</div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Origin</span>
                  <p className="text-sm font-medium text-slate-800">{ride.originAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">B</div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Destination</span>
                  <p className="text-sm font-medium text-slate-800">{ride.destinationAddress}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Distance</span>
                <p className="font-semibold text-slate-800 mt-0.5">{(ride.distanceMeters / 1000).toFixed(1)} km</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Duration</span>
                <p className="font-semibold text-slate-800 mt-0.5">{Math.round(ride.durationSeconds / 60)} minutes</p>
              </div>
            </div>
          </Card>

          {/* Driver & Vehicle */}
          <Card>
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-teal-600" /> Driver & Vehicle
            </h3>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-lg uppercase">
                {ride.driver?.name?.charAt(0) || 'D'}
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">{ride.driver?.name || 'Driver'}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                  <span className="text-xs text-teal-700 font-medium">Verified Employee</span>
                </div>
              </div>
            </div>

            {ride.vehicle && (
              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 text-sm">
                  <Car className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-800">{ride.vehicle.model}</span>
                  <span className="font-mono text-xs text-slate-500">{ride.vehicle.registrationNumber}</span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  {ride.vehicle.vehicleType && <Badge variant="slate" size="sm">{ride.vehicle.vehicleType}</Badge>}
                  {ride.vehicle.color && <span>Color: {ride.vehicle.color}</span>}
                  {ride.vehicle.fuelType && <span>{ride.vehicle.fuelType}</span>}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Booking Panel */}
        <div className="space-y-4">
          <Card className={`border-2 ${isBookable ? 'border-teal-200' : 'border-slate-200'}`}>
            <h3 className="text-sm font-bold text-slate-900 mb-4">
              {isBookable ? 'Book This Ride' : 'Ride Status'}
            </h3>

            {/* Schedule */}
            <div className="flex items-center gap-2 text-sm mb-3">
              <Clock className="w-4 h-4 text-slate-400" />
              <div>
                <p className="font-semibold text-slate-800">
                  {departure.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-xs text-slate-500">
                  Departs at {departure.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="mb-4">
              {isBookable ? (
                <Badge variant="emerald" size="md">
                  {ride.availableSeats} seat{ride.availableSeats !== 1 ? 's' : ''} available
                </Badge>
              ) : (
                <Badge variant="rose" size="md">
                  {ride.status === 'CANCELLED' ? 'Cancelled' : ride.status === 'CLOSED' ? 'Closed' : ride.availableSeats === 0 ? 'Full' : 'Not available'}
                </Badge>
              )}
            </div>

            {isBookable && (
              <>
                {/* Seat selector */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-slate-700 mb-2 block">Select Seats</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSeats((s) => Math.max(1, s - 1))}
                      disabled={seats <= 1}
                      className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-2xl font-bold text-slate-900 w-8 text-center">{seats}</span>
                    <button
                      onClick={() => setSeats((s) => Math.min(maxBookableSeats, s + 1))}
                      disabled={seats >= maxBookableSeats}
                      className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Fare summary */}
                <div className="p-3 bg-teal-50 rounded-xl mb-4 space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Fare per seat</span>
                    <span>₹{(ride.farePerSeatMinor / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Seats</span>
                    <span>× {seats}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-teal-800 pt-1.5 border-t border-teal-200">
                    <span>Total Fare</span>
                    <span>₹{fareTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Book button */}
                <Button
                  id="book-ride-btn"
                  onClick={handleBook}
                  loading={booking}
                  disabled={booking}
                  className="w-full"
                  size="lg"
                >
                  {booking ? (
                    'Booking...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Book {seats} Seat{seats > 1 ? 's' : ''} — ₹{fareTotal.toFixed(0)}
                    </>
                  )}
                </Button>

                {/* Error display */}
                {bookError && (
                  <div id="book-error-msg" className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{bookError}</span>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 mt-3 text-center">
                  Payment is settled after trip completion. No upfront charge.
                </p>
              </>
            )}
          </Card>

          {ride.notes && (
            <Card>
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Driver Notes</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{ride.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default RideDetailsPage;
