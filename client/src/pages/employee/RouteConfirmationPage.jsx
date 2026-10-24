import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Search, Car, Calendar, Users, IndianRupee, Repeat, Sparkles, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import ridesApi from '../../api/rides.api.js';
import geoApi from '../../api/geo.api.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import RouteMap from '../../components/maps/RouteMap.jsx';
import { useRideDraft } from '../../context/RideDraftContext.jsx';

export function RouteConfirmationPage({ mode = 'offer' }) {
  const navigate = useNavigate();
  const { draft, clearDraft } = useRideDraft();
  const [isPublishing, setIsPublishing] = useState(false);
  const [findRouteData, setFindRouteData] = useState(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // If in find mode, calculate route between findPickup and findDrop
  useEffect(() => {
    if (mode === 'find' && draft?.findPickup?.lat && draft?.findDrop?.lat) {
      setIsLoadingRoute(true);
      geoApi.route(draft.findPickup, draft.findDrop)
        .then((res) => setFindRouteData(res))
        .catch(() => setFindRouteData(null))
        .finally(() => setIsLoadingRoute(false));
    }
  }, [mode, draft?.findPickup, draft?.findDrop]);

  const isFindMode = mode === 'find';

  if (!draft || (isFindMode ? !draft.findPickup : !draft.routeData)) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">No Active Route Draft</h2>
        <p className="text-sm text-slate-500">
          Please configure your route locations before visiting this confirmation screen.
        </p>
        <Link to={isFindMode ? '/find-ride' : '/offer-ride'}>
          <Button variant="outline" className="mt-2">
            Return to {isFindMode ? 'Find a Ride' : 'Offer a Ride'}
          </Button>
        </Link>
      </div>
    );
  }

  // Find mode properties
  const findPickup = draft.findPickup;
  const findDrop = draft.findDrop;
  const findDate = draft.findDate;
  const findTime = draft.findTime;
  const findWindowMinutes = draft.findWindowMinutes || 30;
  const findSeats = draft.findSeats || 1;
  const findRecurring = draft.findRecurring;

  // Offer mode properties
  const {
    vehicle,
    vehicleId,
    origin,
    destination,
    departureAt,
    passengerSeats,
    farePerSeatRupees,
    notes,
    recurring,
    routeData
  } = draft;

  const handlePublishRide = async () => {
    setIsPublishing(true);
    try {
      const payload = {
        vehicleId,
        originAddress: origin.address,
        origin: { lat: origin.lat, lng: origin.lng },
        destinationAddress: destination.address,
        destination: { lat: destination.lat, lng: destination.lng },
        routeGeometry: routeData.geometry,
        distanceMeters: routeData.distanceMeters,
        durationSeconds: routeData.durationSeconds,
        departureAt,
        totalPassengerSeats: Number(passengerSeats),
        farePerSeatRupees: Number(farePerSeatRupees),
        notes: notes || '',
        recurring: recurring?.enabled ? recurring : undefined
      };

      const res = await ridesApi.publishRide(payload);
      clearDraft();

      const count = res.count || 1;
      toast.success(
        count > 1
          ? `Successfully published ${count} recurring rides!`
          : 'Ride published successfully! Colleagues can now book seats.'
      );

      navigate('/my-trips');
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to publish ride';
      toast.error(msg);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSearchAvailableRides = () => {
    const params = new URLSearchParams({
      pickupLat: findPickup.lat,
      pickupLng: findPickup.lng,
      dropLat: findDrop.lat,
      dropLng: findDrop.lng,
      date: findDate,
      time: findTime,
      windowMinutes: findWindowMinutes,
      seats: findSeats
    });

    if (findRecurring?.enabled && findRecurring.daysOfWeek?.length > 0) {
      params.set('recurringDays', findRecurring.daysOfWeek.join(','));
    }

    navigate(`/rides?${params.toString()}`);
  };

  const currentOrigin = isFindMode ? findPickup : origin;
  const currentDestination = isFindMode ? findDrop : destination;
  const currentRouteData = isFindMode ? findRouteData : routeData;

  const formattedDeparture = isFindMode
    ? `${findDate} at ${findTime} (±${findWindowMinutes}m)`
    : new Date(departureAt).toLocaleString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top back navigation and header */}
      <div className="flex items-center justify-between">
        <Link
          to={isFindMode ? '/find-ride' : '/offer-ride'}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Edit Form
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isFindMode ? 'Confirm Search Route' : 'Confirm Your Commute Route'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isFindMode
            ? 'Verify pickup and drop points along the route corridor before searching matching rides.'
            : 'Review trip itinerary, route path, and pricing details before publishing to your organization.'}
        </p>
      </div>

      {/* Main Map Preview Card */}
      <Card className="p-0 overflow-hidden">
        {isLoadingRoute ? (
          <div className="h-[340px] bg-slate-100 flex items-center justify-center text-slate-400">
            Calculating route geometry...
          </div>
        ) : (
          <RouteMap
            origin={currentOrigin}
            destination={currentDestination}
            routeGeometry={currentRouteData?.geometry}
            distanceKm={currentRouteData?.distanceKm}
            durationMinutes={currentRouteData?.durationMinutes}
            height="340px"
          />
        )}

        <div className="p-6 space-y-6">
          {/* Waypoints */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                A
              </div>
              <div>
                <span className="text-xs uppercase font-semibold text-slate-400 block tracking-wider">
                  Pickup Location
                </span>
                <p className="text-sm font-medium text-slate-800">{currentOrigin?.address}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                B
              </div>
              <div>
                <span className="text-xs uppercase font-semibold text-slate-400 block tracking-wider">
                  Drop-off Location
                </span>
                <p className="text-sm font-medium text-slate-800">{currentDestination?.address}</p>
              </div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Departure
              </span>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {formattedDeparture}
              </p>
            </div>

            <div>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-400" /> Seats {isFindMode ? 'Requested' : 'Offered'}
              </span>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {isFindMode ? findSeats : passengerSeats} Seats
              </p>
            </div>

            {!isFindMode && (
              <>
                <div>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Car className="w-3.5 h-3.5 text-slate-400" /> Vehicle
                  </span>
                  <p className="text-sm font-semibold text-slate-800 mt-1 truncate">
                    {vehicle?.model}
                  </p>
                  <span className="text-xs font-mono text-slate-500">{vehicle?.registrationNumber}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <IndianRupee className="w-3.5 h-3.5 text-slate-400" /> Fare / Seat
                  </span>
                  <p className="text-sm font-bold text-teal-700 mt-1">
                    ₹{farePerSeatRupees}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Recurring Schedule summary if applicable */}
          {((isFindMode && findRecurring?.enabled) || (!isFindMode && recurring?.enabled)) && (
            <div className="p-3.5 bg-teal-50 border border-teal-200/80 rounded-lg flex items-start gap-3 text-xs text-teal-800">
              <Repeat className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Recurring Commute Mode Active</span>
                <p className="mt-0.5">
                  Matches rides operating on chosen recurring weekdays across the commute corridor.
                </p>
              </div>
            </div>
          )}

          {!isFindMode && notes && (
            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="font-semibold text-slate-700">Driver Notes: </span>
              {notes}
            </div>
          )}

          {/* Confirmation actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              {isFindMode
                ? 'Only verified colleagues within your enterprise organization can match.'
                : 'Scheduled trips are instantly bookable by verified company coworkers.'}
            </span>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Link to={isFindMode ? '/find-ride' : '/offer-ride'} className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">
                  Edit Details
                </Button>
              </Link>

              {isFindMode ? (
                <Button
                  onClick={handleSearchAvailableRides}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8"
                >
                  <Search className="w-4 h-4" /> Search Available Rides
                </Button>
              ) : (
                <Button
                  onClick={handlePublishRide}
                  disabled={isPublishing}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8"
                >
                  {isPublishing ? (
                    'Publishing...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Publish Ride Offer
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default RouteConfirmationPage;
