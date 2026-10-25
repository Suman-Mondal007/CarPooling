import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Calendar, Users, IndianRupee, ArrowRight } from 'lucide-react';
import bookingsApi from '../../api/bookings.api.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import { Skeleton } from '../../components/common/Skeleton.jsx';

export function BookingConfirmationPage() {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    bookingsApi.getBookingById(bookingId)
      .then((data) => setBooking(data))
      .catch((err) => setError(err.response?.data?.error?.message || 'Failed to load booking'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto space-y-6 py-8">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton variant="card" className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <p className="text-sm text-slate-600">{error}</p>
        <Link to="/my-trips"><Button variant="outline">Go to My Trips</Button></Link>
      </div>
    );
  }

  if (!booking) return null;

  const departure = booking.ride?.departureAt ? new Date(booking.ride.departureAt) : null;

  return (
    <div className="max-w-xl mx-auto space-y-6 py-4">
      {/* Success Banner */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Booking Confirmed!</h1>
        <p className="text-sm text-slate-500">
          Your seat{booking.seats > 1 ? 's have' : ' has'} been reserved. The driver has been notified.
        </p>
      </div>

      {/* Booking Summary Card */}
      <Card className="border-2 border-emerald-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900">Booking Summary</h3>
          <Badge variant="emerald">{booking.status}</Badge>
        </div>

        <div className="space-y-3 text-xs">
          {/* Route */}
          {booking.ride && (
            <div className="p-3 bg-slate-50 rounded-xl space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Pickup</span>
                  <p className="text-slate-700 font-medium">{booking.pickupAddress || booking.ride.originAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-rose-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Drop-off</span>
                  <p className="text-slate-700 font-medium">{booking.dropAddress || booking.ride.destinationAddress}</p>
                </div>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Calendar className="w-3.5 h-3.5" /> Departure
              </div>
              <p className="font-semibold text-slate-800">
                {departure ? departure.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
              </p>
              <p className="text-slate-500 mt-0.5">
                {departure ? departure.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Users className="w-3.5 h-3.5" /> Seats Booked
              </div>
              <p className="font-semibold text-slate-800">{booking.seats} seat{booking.seats > 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Fare */}
          <div className="p-3 bg-teal-50 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-teal-700">
              <IndianRupee className="w-3.5 h-3.5" /> Total Fare
            </div>
            <span className="text-lg font-bold text-teal-800">
              ₹{booking.fareTotalRupees || (booking.fareTotalMinor / 100).toFixed(2)}
            </span>
          </div>

          {/* Lifecycle */}
          {booking.lifecycle && (
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Current Status</span>
              <p className="font-semibold text-slate-800 mt-0.5">{booking.lifecycle.stepLabel}</p>
            </div>
          )}

          {/* Driver info */}
          {booking.ride?.driver && (
            <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold uppercase">
                {booking.ride.driver.name?.charAt(0) || 'D'}
              </div>
              <div>
                <p className="font-semibold text-slate-800">{booking.ride.driver.name}</p>
                <p className="text-slate-500">Driver</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link to="/my-trips" className="w-full sm:w-auto">
          <Button className="w-full flex items-center justify-center gap-2" size="lg">
            <Calendar className="w-4 h-4" /> View in My Trips <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
        <Link to="/find-ride" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full" size="lg">
            Search Another Ride
          </Button>
        </Link>
      </div>

      <p className="text-[11px] text-center text-slate-400">
        Payment will be settled after the trip is completed. You can cancel your booking from My Trips.
      </p>
    </div>
  );
}

export default BookingConfirmationPage;
