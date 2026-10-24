import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Car, MapPin, Clock, Users, IndianRupee,
  ArrowRight, Search, PlusCircle, Loader2, Filter
} from 'lucide-react';
import tripsApi from '../../api/trips.api.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { Skeleton } from '../../components/common/Skeleton.jsx';

const TABS = [
  { key: 'upcoming', label: 'Upcoming', filter: { status: 'SCHEDULED' } },
  { key: 'booked', label: 'Booked by Me', filter: { as: 'passenger', status: 'SCHEDULED' } },
  { key: 'offered', label: 'Offered by Me', filter: { as: 'driver', status: 'SCHEDULED' } },
  { key: 'active', label: 'Active', filter: {} },
  { key: 'completed', label: 'Completed', filter: { status: 'COMPLETED' } },
  { key: 'cancelled', label: 'Cancelled', filter: { status: 'CANCELLED' } }
];

function getStatusBadge(status, isDriver) {
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

function TripCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200" />
          <div className="space-y-2"><div className="h-4 bg-slate-200 rounded w-32" /><div className="h-3 bg-slate-200 rounded w-20" /></div>
        </div>
        <div className="h-6 bg-slate-200 rounded-full w-20" />
      </div>
      <div className="h-12 bg-slate-100 rounded-lg" />
    </div>
  );
}

export function MyTripsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [trips, setTrips] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    const tab = TABS.find((t) => t.key === activeTab);
    const params = { ...tab.filter, page, limit: 20 };

    // For "active" tab, show STARTED and IN_PROGRESS trips
    if (activeTab === 'active') {
      // We'll fetch started then in_progress
      try {
        const [started, inProgress] = await Promise.all([
          tripsApi.getMyTrips({ ...params, status: 'STARTED' }),
          tripsApi.getMyTrips({ ...params, status: 'IN_PROGRESS' })
        ]);
        const combined = [...(started?.items || []), ...(inProgress?.items || [])];
        setTrips(combined);
        setTotal(combined.length);
      } catch {
        setTrips([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const data = await tripsApi.getMyTrips(params);
      setTrips(data?.items || []);
      setTotal(data?.total || 0);
    } catch {
      setTrips([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Trips</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your rides as driver and passenger</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/find-ride')}>
            <Search className="w-3.5 h-3.5" /> Find Ride
          </Button>
          <Button size="sm" onClick={() => navigate('/offer-ride')}>
            <PlusCircle className="w-3.5 h-3.5" /> Offer Ride
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <TripCardSkeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && trips.length === 0 && (
        <EmptyState
          icon={Calendar}
          title={`No ${activeTab} trips`}
          description={
            activeTab === 'upcoming'
              ? 'Book a ride or offer one to see your upcoming journeys here.'
              : `You don't have any ${activeTab} trips yet.`
          }
          actionLabel={activeTab === 'upcoming' ? 'Find a Ride' : undefined}
          onAction={activeTab === 'upcoming' ? () => navigate('/find-ride') : undefined}
        />
      )}

      {/* Trip Cards */}
      {!loading && trips.length > 0 && (
        <div className="space-y-3">
          {trips.map((trip) => {
            const ride = trip.ride;
            const departure = ride?.departureAt ? new Date(ride.departureAt) : null;
            const isPast = departure && departure < new Date();

            return (
              <Card
                key={trip._id}
                hover
                onClick={() => navigate(`/trips/${trip._id}`)}
                className="relative"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold uppercase ${
                      trip.isDriver
                        ? 'bg-slate-900 text-white'
                        : 'bg-teal-100 text-teal-800'
                    }`}>
                      {trip.isDriver ? <Car className="w-5 h-5" /> : (ride?.driver?.name?.charAt(0) || 'D')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {trip.isDriver ? 'You are driving' : (ride?.driver?.name || 'Driver')}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                        <Badge variant={trip.isDriver ? 'slate' : 'teal'} size="sm">
                          {trip.isDriver ? 'Driver' : 'Passenger'}
                        </Badge>
                        {ride?.vehicle && (
                          <span className="flex items-center gap-1">
                            <Car className="w-3 h-3" /> {ride.vehicle.model}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(trip.status, trip.isDriver)}
                  </div>
                </div>

                {/* Route */}
                {ride && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-slate-600">
                    <div className="flex flex-col items-center gap-0.5 pt-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <div className="w-px h-4 bg-slate-300" />
                      <div className="w-2 h-2 rounded-full bg-rose-500" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="truncate">{ride.originAddress}</p>
                      <p className="truncate">{ride.destinationAddress}</p>
                    </div>
                  </div>
                )}

                {/* Meta row */}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  {departure && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span className="font-medium">
                        {departure.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' at '}
                        {departure.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}

                  {trip.myBooking && (
                    <>
                      <span className="text-slate-300">•</span>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {trip.myBooking.seats} seat{trip.myBooking.seats > 1 ? 's' : ''}
                      </div>
                      <span className="text-slate-300">•</span>
                      <div className="flex items-center gap-1 text-teal-700 font-semibold">
                        <IndianRupee className="w-3 h-3" /> ₹{trip.myBooking.fareTotalRupees}
                      </div>
                    </>
                  )}

                  {trip.isDriver && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span>{trip.totalBookedSeats || 0} booked seat{(trip.totalBookedSeats || 0) !== 1 ? 's' : ''}</span>
                    </>
                  )}

                  <div className="ml-auto">
                    <span className="inline-flex items-center gap-1 text-teal-700 font-semibold hover:underline">
                      Details <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                {/* Lifecycle stepper */}
                {trip.lifecycle && !trip.lifecycle.isCancelled && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[11px] text-slate-400">
                      Status: <span className="font-semibold text-slate-700">{trip.lifecycle.stepLabel}</span>
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && total > 20 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-xs text-slate-500 self-center">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={trips.length < 20}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default MyTripsPage;
