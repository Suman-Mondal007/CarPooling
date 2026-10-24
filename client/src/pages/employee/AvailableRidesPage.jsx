import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  MapPin, Clock, Users, IndianRupee, Car, ArrowRight,
  SortAsc, Search, Loader2, AlertCircle, ChevronDown, Star
} from 'lucide-react';
import ridesApi from '../../api/rides.api.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { Skeleton } from '../../components/common/Skeleton.jsx';

function getScoreVariant(score) {
  if (score >= 80) return 'emerald';
  if (score >= 60) return 'teal';
  if (score >= 40) return 'amber';
  return 'rose';
}

function getScoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Moderate';
}

function RideCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-3 bg-slate-200 rounded w-1/4" />
        </div>
        <div className="h-6 bg-slate-200 rounded-full w-16" />
      </div>
      <div className="h-16 bg-slate-100 rounded-xl" />
      <div className="flex justify-between">
        <div className="h-4 bg-slate-200 rounded w-20" />
        <div className="h-8 bg-slate-200 rounded-xl w-24" />
      </div>
    </div>
  );
}

export function AvailableRidesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [rides, setRides] = useState([]);
  const [groupedByDay, setGroupedByDay] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('score');
  const [showSort, setShowSort] = useState(false);

  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries());
    if (!params.pickupLat || !params.pickupLng || !params.dropLat || !params.dropLng) {
      setError('Missing search coordinates. Please start from Find a Ride.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    ridesApi.searchRides(params)
      .then((data) => {
        setRides(data.items || []);
        setGroupedByDay(data.groupedByDay || {});
        setTotal(data.total || 0);
      })
      .catch((err) => {
        setError(err.response?.data?.error?.message || 'Failed to search for rides');
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  const sortedRides = [...rides].sort((a, b) => {
    if (sortBy === 'score') return (b.match?.score || 0) - (a.match?.score || 0);
    if (sortBy === 'fare') return (a.farePerSeatMinor || 0) - (b.farePerSeatMinor || 0);
    if (sortBy === 'time') return new Date(a.departureAt) - new Date(b.departureAt);
    if (sortBy === 'seats') return (b.availableSeats || 0) - (a.availableSeats || 0);
    return 0;
  });

  const hasRecurring = Object.keys(groupedByDay).length > 1;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Available Rides</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? 'Searching...' : `${total} matching ride${total !== 1 ? 's' : ''} found`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setShowSort(!showSort)}>
              <SortAsc className="w-3.5 h-3.5" /> Sort <ChevronDown className="w-3 h-3" />
            </Button>
            {showSort && (
              <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30">
                {[
                  { key: 'score', label: 'Best Match' },
                  { key: 'fare', label: 'Lowest Fare' },
                  { key: 'time', label: 'Earliest Departure' },
                  { key: 'seats', label: 'Most Seats' }
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setSortBy(opt.key); setShowSort(false); }}
                    className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 ${sortBy === opt.key ? 'font-semibold text-teal-700 bg-teal-50' : 'text-slate-700'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/find-ride')}>
            <Search className="w-3.5 h-3.5" /> New Search
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <RideCardSkeleton key={i} />)}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <Card className="text-center py-8">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-800 mb-1">Search Error</p>
          <p className="text-xs text-slate-500">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/find-ride')}>
            Try Again
          </Button>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && sortedRides.length === 0 && (
        <EmptyState
          icon={Search}
          title="No rides found"
          description="No rides match your search criteria. Try a wider time window, adjust your pickup or drop-off points, or offer a ride yourself."
          actionLabel="Offer a Ride"
          onAction={() => navigate('/offer-ride')}
        />
      )}

      {/* Results */}
      {!loading && !error && sortedRides.length > 0 && (
        <div className="space-y-4">
          {sortedRides.map((ride) => {
            const departure = new Date(ride.departureAt);
            const score = ride.match?.score || 0;

            return (
              <Card
                key={ride._id}
                hover
                onClick={() => navigate(`/rides/${ride._id}?${searchParams.toString()}`)}
                className="relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Driver info */}
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm uppercase shrink-0">
                      {ride.driver?.name?.charAt(0) || 'D'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{ride.driver?.name || 'Driver'}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                        <Car className="w-3 h-3" />
                        <span>{ride.vehicle?.model}</span>
                        <span className="font-mono text-[10px] text-slate-400">• {ride.vehicle?.registrationNumber}</span>
                      </div>
                    </div>
                  </div>

                  {/* Match score badge */}
                  <Badge variant={getScoreVariant(score)} size="sm">
                    {score}% {getScoreLabel(score)}
                  </Badge>
                </div>

                {/* Route summary */}
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-start gap-2.5">
                    <div className="flex flex-col items-center gap-0.5 pt-0.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <div className="w-px h-6 bg-slate-300" />
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-xs text-slate-700 truncate">{ride.originAddress}</p>
                      <p className="text-xs text-slate-700 truncate">{ride.destinationAddress}</p>
                    </div>
                  </div>
                </div>

                {/* Metrics row */}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium">{departure.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span className="text-slate-400">at</span>
                    <span className="font-semibold text-slate-800">{departure.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <span className="text-slate-300">•</span>

                  <div className="flex items-center gap-1 text-slate-600">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-800">{ride.availableSeats}</span> seat{ride.availableSeats !== 1 ? 's' : ''}
                  </div>

                  <span className="text-slate-300">•</span>

                  <div className="flex items-center gap-1">
                    <IndianRupee className="w-3.5 h-3.5 text-teal-600" />
                    <span className="font-bold text-teal-700">₹{ride.farePerSeatRupees}</span>
                    <span className="text-slate-400">/seat</span>
                  </div>

                  <span className="text-slate-300">•</span>

                  <span className="text-slate-500">
                    {(ride.distanceMeters / 1000).toFixed(1)} km · {Math.round(ride.durationSeconds / 60)} min
                  </span>

                  <div className="ml-auto">
                    <span className="inline-flex items-center gap-1 text-teal-700 font-semibold hover:underline">
                      View Details <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                {/* Match details tooltip */}
                {ride.match && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-3 text-[11px] text-slate-500">
                    <span>Pickup: {Math.round(ride.match.pickupDistanceMeters)}m from route</span>
                    <span>Drop: {Math.round(ride.match.dropDistanceMeters)}m from route</span>
                    {ride.match.timeDiffMinutes > 0 && (
                      <span>Time diff: ±{ride.match.timeDiffMinutes} min</span>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AvailableRidesPage;
