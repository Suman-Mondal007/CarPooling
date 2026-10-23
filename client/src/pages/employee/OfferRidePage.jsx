import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Car, Calendar, MapPin, IndianRupee, Repeat, ArrowRight, AlertCircle, Plus, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import vehiclesApi from '../../api/vehicles.api.js';
import geoApi from '../../api/geo.api.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Skeleton from '../../components/common/Skeleton.jsx';
import MapPicker from '../../components/maps/MapPicker.jsx';
import RouteMap from '../../components/maps/RouteMap.jsx';
import { useRideDraft } from '../../context/RideDraftContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const DAYS_OF_WEEK = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 0, label: 'Sun' }
];

export function OfferRidePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { draft, setDraft } = useRideDraft();

  const [vehicles, setVehicles] = useState([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);

  // Form states initialized with draft if available
  const [origin, setOrigin] = useState(draft?.origin || { address: '', lat: null, lng: null });
  const [destination, setDestination] = useState(draft?.destination || { address: '', lat: null, lng: null });

  // Default departure: tomorrow at 08:30
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDateStr = tomorrow.toISOString().split('T')[0];

  const [departureDate, setDepartureDate] = useState(draft?.departureDate || defaultDateStr);
  const [departureTime, setDepartureTime] = useState(draft?.departureTime || '08:30');

  const [selectedVehicleId, setSelectedVehicleId] = useState(draft?.vehicleId || '');
  const [passengerSeats, setPassengerSeats] = useState(draft?.passengerSeats || 1);
  const [farePerSeatRupees, setFarePerSeatRupees] = useState(draft?.farePerSeatRupees || 80);
  const [notes, setNotes] = useState(draft?.notes || '');

  // Recurring options
  const [isRecurring, setIsRecurring] = useState(draft?.recurring?.enabled || false);
  const [selectedDays, setSelectedDays] = useState(draft?.recurring?.daysOfWeek || [1, 2, 3, 4, 5]);
  const [recurringWeeks, setRecurringWeeks] = useState(draft?.recurring?.weeks || 1);

  // Route preview calculation state
  const [routeData, setRouteData] = useState(draft?.routeData || null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState(null);

  // Load vehicles
  useEffect(() => {
    vehiclesApi.getVehicles()
      .then((res) => {
        const items = res.items || [];
        setVehicles(items);
        if (items.length > 0 && !selectedVehicleId) {
          // Select first verified or available vehicle
          const defaultV = items.find((v) => v.verificationStatus === 'VERIFIED') || items[0];
          setSelectedVehicleId(defaultV._id);
          setPassengerSeats(Math.min(3, Math.max(1, defaultV.seatingCapacity - 1)));
        }
      })
      .catch(() => {
        toast.error('Failed to load registered vehicles');
      })
      .finally(() => {
        setIsLoadingVehicles(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedVehicle = vehicles.find((v) => v._id === selectedVehicleId);
  const maxSeatsAllowed = selectedVehicle ? Math.max(1, selectedVehicle.seatingCapacity - 1) : 4;

  // Whenever vehicle changes, clamp passenger seats
  useEffect(() => {
    if (selectedVehicle) {
      const max = Math.max(1, selectedVehicle.seatingCapacity - 1);
      if (passengerSeats > max) {
        setPassengerSeats(max);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicleId, selectedVehicle]);

  // Whenever origin and destination change, calculate route
  useEffect(() => {
    if (origin.lat && origin.lng && destination.lat && destination.lng) {
      setIsCalculatingRoute(true);
      setRouteError(null);

      geoApi.route(origin, destination)
        .then((data) => {
          setRouteData(data);
          // Suggest fair fare if fare is still default
          // Cost formula: (distanceKm / efficiency) * fuelPrice / occupancy
          const fuelPrice = user?.organization?.settings?.fuelPricePerLitre || 100;
          const eff = selectedVehicle?.fuelEfficiencyKmpl || 15;
          if (eff > 0) {
            const fuelLitres = data.distanceKm / eff;
            const estimatedTotalFuelCost = fuelLitres * fuelPrice;
            const suggestedFare = Math.max(30, Math.round((estimatedTotalFuelCost / 2) / 10) * 10);
            if (!draft?.farePerSeatRupees) {
              setFarePerSeatRupees(suggestedFare);
            }
          }
        })
        .catch((err) => {
          setRouteError(err.response?.data?.error?.message || 'Could not calculate road route between selected locations');
          setRouteData(null);
        })
        .finally(() => {
          setIsCalculatingRoute(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin.lat, origin.lng, destination.lat, destination.lng]);

  const toggleDay = (dayId) => {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort()
    );
  };

  const handleProceedToConfirmation = (e) => {
    e.preventDefault();

    if (!selectedVehicle) {
      toast.error('Please select a vehicle');
      return;
    }

    if (user?.organization?.settings?.requireVehicleVerification && selectedVehicle.verificationStatus !== 'VERIFIED') {
      toast.error('The selected vehicle has not been verified by company admin yet');
      return;
    }

    if (!origin.lat || !origin.lng || !origin.address) {
      toast.error('Please select a valid origin pickup location');
      return;
    }

    if (!destination.lat || !destination.lng || !destination.address) {
      toast.error('Please select a valid destination location');
      return;
    }

    if (!routeData) {
      toast.error('Route calculation is required before offering a ride');
      return;
    }

    const departureDateTime = new Date(`${departureDate}T${departureTime}:00`);
    if (departureDateTime <= new Date()) {
      toast.error('Departure time must be in the future');
      return;
    }

    if (isRecurring && selectedDays.length === 0) {
      toast.error('Please select at least one day for recurring rides');
      return;
    }

    // Save full draft to context and navigate to confirmation screen
    const draftData = {
      vehicle: selectedVehicle,
      vehicleId: selectedVehicle._id,
      origin,
      destination,
      departureDate,
      departureTime,
      departureAt: departureDateTime.toISOString(),
      passengerSeats: Number(passengerSeats),
      farePerSeatRupees: Number(farePerSeatRupees),
      notes,
      recurring: {
        enabled: isRecurring,
        daysOfWeek: selectedDays,
        weeks: Number(recurringWeeks)
      },
      routeData
    };

    setDraft(draftData);
    navigate('/offer-ride/confirm-route');
  };

  if (isLoadingVehicles) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Car className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Register a Vehicle First</h2>
        <p className="text-slate-600 mt-2 max-w-md mx-auto">
          To offer a carpool ride, you need at least one registered vehicle associated with your profile.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/vehicles">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Go to My Vehicles
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Offer a Ride</h1>
          <p className="text-sm text-slate-500 mt-1">
            Publish your empty seats, share commute costs, and reduce campus congestion.
          </p>
        </div>
      </div>

      <form onSubmit={handleProceedToConfirmation} className="space-y-6">
        {/* Step 1: Vehicle & Seats */}
        <Card>
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 font-semibold text-slate-900 text-base">
            <Car className="w-5 h-5 text-teal-600" />
            <span>1. Select Vehicle & Passenger Capacity</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Vehicle
              </label>
              <select
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
              >
                {vehicles.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.model} ({v.registrationNumber}) — {v.vehicleType}
                    {v.verificationStatus === 'VERIFIED' ? ' (Verified)' : ' (Pending Verification)'}
                  </option>
                ))}
              </select>

              {user?.organization?.settings?.requireVehicleVerification && selectedVehicle?.verificationStatus !== 'VERIFIED' && (
                <p className="text-xs text-amber-600 flex items-center gap-1 mt-1.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  This vehicle is awaiting verification from company admin.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Available Passenger Seats
              </label>
              <input
                type="number"
                min="1"
                max={maxSeatsAllowed}
                value={passengerSeats}
                onChange={(e) => setPassengerSeats(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Max {maxSeatsAllowed} seats (vehicle capacity {selectedVehicle?.seatingCapacity} minus driver).
              </p>
            </div>
          </div>
        </Card>

        {/* Step 2: Route Origin & Destination */}
        <Card>
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 font-semibold text-slate-900 text-base">
            <MapPin className="w-5 h-5 text-teal-600" />
            <span>2. Route: Origin & Destination</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <MapPicker
                label="Pickup / Origin"
                placeholder="Search pickup area, tech park, or home..."
                pinType="origin"
                value={origin}
                onChange={setOrigin}
                height="220px"
              />

              <MapPicker
                label="Drop-off / Destination"
                placeholder="Search company office, campus, or station..."
                pinType="destination"
                value={destination}
                onChange={setDestination}
                height="220px"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Live Route Preview
              </label>
              {isCalculatingRoute ? (
                <div className="h-[470px] rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Calculating driving path...</span>
                </div>
              ) : routeError ? (
                <div className="h-[470px] rounded-xl border border-rose-200 bg-rose-50 flex flex-col items-center justify-center text-rose-600 p-6 text-center gap-2">
                  <AlertCircle className="w-8 h-8" />
                  <p className="font-semibold text-sm">Route Error</p>
                  <p className="text-xs">{routeError}</p>
                </div>
              ) : (
                <RouteMap
                  origin={origin}
                  destination={destination}
                  routeGeometry={routeData?.geometry}
                  distanceKm={routeData?.distanceKm}
                  durationMinutes={routeData?.durationMinutes}
                  height="470px"
                />
              )}
            </div>
          </div>
        </Card>

        {/* Step 3: Departure Schedule & Pricing */}
        <Card>
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 font-semibold text-slate-900 text-base">
            <Calendar className="w-5 h-5 text-teal-600" />
            <span>3. Departure Time & Fare</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Departure Date"
              type="date"
              value={departureDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDepartureDate(e.target.value)}
              required
            />

            <Input
              label="Departure Time"
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              required
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Fare Per Seat (₹)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  min="0"
                  step="5"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={farePerSeatRupees}
                  onChange={(e) => setFarePerSeatRupees(Number(e.target.value))}
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-teal-600" /> Flat fare per passenger for journey
              </p>
            </div>
          </div>

          {/* Recurring Schedule Option */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              <span className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                <Repeat className="w-4 h-4 text-teal-600" /> Repeat this commute on multiple days (Recurring)
              </span>
            </label>

            {isRecurring && (
              <div className="mt-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-3">
                <div>
                  <span className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Repeat on Days:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDay(d.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          selectedDays.includes(d.id)
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-700">Duration:</span>
                  <select
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={recurringWeeks}
                    onChange={(e) => setRecurringWeeks(Number(e.target.value))}
                  >
                    <option value={1}>1 Week</option>
                    <option value={2}>2 Weeks</option>
                    <option value={3}>3 Weeks</option>
                    <option value={4}>4 Weeks</option>
                  </select>
                  <span className="text-xs text-slate-500">
                    Creates dated ride instances sharing a recurring group ID.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Notes for passengers */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Instructions / Notes for Passengers (Optional)
            </label>
            <textarea
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows={2}
              placeholder="e.g. Please be at Gate 2 pickup point by 8:25 AM. AC will be on."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
            />
          </div>
        </Card>

        {/* Action Button */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="submit"
            size="lg"
            className="flex items-center gap-2 px-8"
          >
            Review & Confirm Route <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

export default OfferRidePage;
