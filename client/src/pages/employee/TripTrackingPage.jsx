import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Navigation,
  Phone,
  MessageSquare,
  Clock,
  Car,
  AlertTriangle,
  WifiOff,
  CheckCircle2,
  XCircle,
  Play,
  Square,
  ArrowLeft,
  Loader2,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocket } from '../../hooks/useSocket.js';
import tripsApi from '../../api/trips.api.js';
import ChatPanel from '../../components/chat/ChatPanel.jsx';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';


// Custom Leaflet Markers
const pickupIcon = new L.DivIcon({
  className: 'custom-pin-pickup',
  html: `<div style="background-color: #10b981; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 11px;">P</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const destIcon = new L.DivIcon({
  className: 'custom-pin-dest',
  html: `<div style="background-color: #f43f5e; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 11px;">D</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const carIcon = new L.DivIcon({
  className: 'custom-pin-car',
  html: `<div style="position: relative; display: flex; align-items: center; justify-content: center;">
    <div class="marker-pulse-ring" style="position: absolute; width: 34px; height: 34px; border-radius: 50%;"></div>
    <div style="background-color: #0ea5e9; width: 34px; height: 34px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(14, 165, 233, 0.5); display: flex; align-items: center; justify-content: center; color: white; position: relative; z-index: 2;">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
    </div>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17]
});

// Auto-fit map bounds
function AutoFitBounds({ bounds, center }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length >= 2) {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } catch {
        // ignore
      }
    } else if (center) {
      map.setView(center, 15);
    }
  }, [map, bounds, center]);
  return null;
}

export function TripTrackingPage() {
  const { id: tripId } = useParams();
  const navigate = useNavigate();
  const { socket, status: socketStatus, isConnected } = useSocket();

  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState(null);
  const [lastLocationAt, setLastLocationAt] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [eta, setEta] = useState(null);
  const [tripStatus, setTripStatus] = useState('SCHEDULED');
  const [isSimulated, setIsSimulated] = useState(false);

  // Driver GPS Sharing state
  const [isSharingGps, setIsSharingGps] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const watchIdRef = useRef(null);

  // Simulator state
  const [isSimulating, setIsSimulating] = useState(false);
  const simulatorTimerRef = useRef(null);
  const simStepRef = useRef(0);


  // Check staleness timer
  useEffect(() => {
    const checkStaleness = () => {
      if (lastLocationAt) {
        const diff = Date.now() - new Date(lastLocationAt).getTime();
        setIsStale(diff > 30000);
      }
    };

    checkStaleness();
    const interval = setInterval(checkStaleness, 5000);
    return () => clearInterval(interval);
  }, [lastLocationAt]);

  // Load initial tracking state via REST
  const loadTracking = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tripsApi.getTripTracking(tripId);
      setTrackingData(data);
      setTripStatus(data.status);
      setEta(data.eta);
      if (data.lastKnownLocation) {
        setDriverLocation(data.lastKnownLocation);
      }
      if (data.lastLocationAt) {
        setLastLocationAt(data.lastLocationAt);
        const diff = Date.now() - new Date(data.lastLocationAt).getTime();
        setIsStale(diff > 30000);
      }
    } catch (err) {
      console.error('Failed to load tracking data:', err);
      toast.error(err?.response?.data?.error?.message || 'Failed to load tracking');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadTracking();
  }, [loadTracking]);

  // Clean up watchers on unmount
  const stopGpsWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsSharingGps(false);
  }, []);

  const stopSimulation = useCallback(() => {
    if (simulatorTimerRef.current !== null) {
      clearInterval(simulatorTimerRef.current);
      simulatorTimerRef.current = null;
    }
    setIsSimulating(false);
  }, []);

  // Socket room join & live event listeners
  useEffect(() => {
    if (!socket || !tripId) return;

    socket.emit('trip:join', { tripId }, (ack) => {
      if (ack?.success && ack?.data) {
        const d = ack.data;
        if (d.status) setTripStatus(d.status);
        if (d.lastKnownLocation) setDriverLocation(d.lastKnownLocation);
        if (d.lastLocationAt) setLastLocationAt(d.lastLocationAt);
        if (d.eta) setEta(d.eta);
        setIsStale(Boolean(d.isStale));
      }
    });

    const handleLocationUpdate = (payload) => {
      if (payload.tripId?.toString() === tripId?.toString()) {
        if (payload.location) {
          setDriverLocation(payload.location);
          setLastLocationAt(payload.recordedAt || new Date().toISOString());
          setIsStale(false);
        }
        if (payload.eta) {
          setEta(payload.eta);
        }
        if (payload.simulated) {
          setIsSimulated(true);
        }
      }
    };

    const handleStatusUpdate = (payload) => {
      if (payload.tripId?.toString() === tripId?.toString()) {
        setTripStatus(payload.status);
        if (payload.status === 'STARTED') {
          toast.success('🚗 Driver has started the trip!');
        } else if (payload.status === 'IN_PROGRESS') {
          toast.success('🛣️ Trip is now in progress!');
        } else if (payload.status === 'COMPLETED') {
          toast.success('🏁 Trip completed! Thank you for carpooling.');
          stopGpsWatch();
          stopSimulation();
        } else if (payload.status === 'CANCELLED') {
          toast.error('❌ This trip has been cancelled.');
          stopGpsWatch();
          stopSimulation();
        }
      }
    };

    socket.on('trip:location', handleLocationUpdate);
    socket.on('trip:status', handleStatusUpdate);

    return () => {
      socket.off('trip:location', handleLocationUpdate);
      socket.off('trip:status', handleStatusUpdate);
      socket.emit('trip:leave', { tripId });
    };
  }, [socket, tripId, stopGpsWatch, stopSimulation]);

  useEffect(() => {
    return () => {
      stopGpsWatch();
      stopSimulation();
    };
  }, [stopGpsWatch, stopSimulation]);

  // Start Driver GPS watcher
  const startGpsWatch = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsError(null);
    setIsSharingGps(true);

    let lastSentTime = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        // Frontend throttle to every 3 seconds
        if (now - lastSentTime < 3000) return;
        lastSentTime = now;

        const { latitude: lat, longitude: lng, heading, speed } = pos.coords;
        if (socket && isConnected) {
          socket.emit('driver:location', {
            tripId,
            lat,
            lng,
            heading,
            speed
          });
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        let errorMsg = 'Failed to acquire GPS location.';
        if (err.code === 1) {
          errorMsg = 'Location permission was denied. Please allow location access in your browser address bar.';
        } else if (err.code === 2) {
          errorMsg = 'GPS position unavailable. Please ensure location services are enabled on your device.';
        } else if (err.code === 3) {
          errorMsg = 'Location acquisition timed out.';
        }
        setGpsError(errorMsg);
        setIsSharingGps(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Development location simulator walk
  const toggleSimulator = () => {
    if (isSimulating) {
      stopSimulation();
      toast('Simulator stopped', { icon: '⏹️' });
      return;
    }

    setIsSimulating(true);
    toast.success('Simulation started (development only)');

    const step = async () => {
      try {
        const res = await tripsApi.simulateLocation(tripId, { stepIndex: simStepRef.current });
        if (res?.nextStepIndex !== undefined) {
          simStepRef.current = res.nextStepIndex;
        }
        if (res?.isCompleted) {
          stopSimulation();
          toast('Simulator reached destination', { icon: '🏁' });
        }
      } catch (err) {
        console.error('Simulator error:', err);
        stopSimulation();
      }
    };

    step();
    simulatorTimerRef.current = setInterval(step, 3500);
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        <p className="text-sm text-slate-400">Loading live tracking map...</p>
      </div>
    );
  }

  const isDriver = trackingData?.isDriver;
  const isTripActive = tripStatus === 'STARTED' || tripStatus === 'IN_PROGRESS';
  const isTripEnded = tripStatus === 'COMPLETED' || tripStatus === 'CANCELLED';

  // Map coordinates
  const pickupCoords = trackingData?.pickup?.coords;
  const destCoords = trackingData?.destination?.coords;
  const routePoints = trackingData?.routeGeometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || [];

  const mapBounds = [];
  if (pickupCoords) mapBounds.push([pickupCoords.lat, pickupCoords.lng]);
  if (destCoords) mapBounds.push([destCoords.lat, destCoords.lng]);
  if (driverLocation) mapBounds.push([driverLocation.lat, driverLocation.lng]);

  const defaultCenter = driverLocation
    ? [driverLocation.lat, driverLocation.lng]
    : pickupCoords
    ? [pickupCoords.lat, pickupCoords.lng]
    : [12.9716, 77.5946];

  const driverPhone = trackingData?.driver?.phone;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Top Navigation & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/trips/${tripId}`)}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Navigation className="w-6 h-6 text-teal-400" />
              Live Ride Tracking
              {isSimulated && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Simulated
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">
              {trackingData?.pickup?.address?.split(',')[0]} → {trackingData?.destination?.address?.split(',')[0]}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/chat?tripId=${tripId}`)}
            className="flex items-center gap-2 border-teal-500/30 text-teal-300 hover:bg-teal-500/10"
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </Button>


          {/* Real Phone Call link */}
          {driverPhone && !isDriver && (
            <a
              href={`tel:${driverPhone}`}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition"
            >
              <Phone className="w-4 h-4" />
              Call Driver
            </a>
          )}
        </div>
      </div>

      {/* System Warning Banners */}
      <div className="space-y-2 mb-4">
        {/* Reconnecting Banner */}
        {socketStatus !== 'connected' && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium">
            <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
            <span>Connection interrupted. Reconnecting in real-time...</span>
          </div>
        )}

        {/* Stale Location Warning */}
        {isStale && isTripActive && (
          <div
            data-testid="stale-location-warning"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Driver location has not updated for over 30 seconds. The vehicle may be in a low-signal area.
            </span>
          </div>
        )}

        {/* Trip Not Started Banner */}
        {tripStatus === 'SCHEDULED' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              This trip is scheduled and has not started yet. Real-time GPS movement begins once the driver starts the journey.
            </span>
          </div>
        )}

        {/* Trip Completed Banner */}
        {tripStatus === 'COMPLETED' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>This trip has arrived at its destination and is completed!</span>
          </div>
        )}

        {/* Trip Cancelled Banner */}
        {tripStatus === 'CANCELLED' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>This trip was cancelled. No location updates are active.</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Map */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 h-[520px] shadow-2xl bg-slate-900">
            {/* ETA Floating Card */}
            {isTripActive && eta && (
              <div className="absolute top-4 left-4 z-[1000] bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-2xl p-3.5 shadow-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold text-sm">
                  {eta.durationMinutes || Math.round((eta.durationSeconds || 0) / 60)}m
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    Estimated Arrival
                  </p>
                  <p className="text-sm font-bold text-white flex items-center gap-2">
                    {eta.distanceKm || (eta.distanceMeters ? (eta.distanceMeters / 1000).toFixed(1) : 0)} km remaining
                    {eta.isStale && <span className="text-[10px] text-amber-400 font-normal">(adjusting)</span>}
                  </p>
                </div>
              </div>
            )}

            {/* Live Leaflet Map */}
            <MapContainer
              center={defaultCenter}
              zoom={13}
              style={{ width: '100%', height: '100%' }}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <AutoFitBounds bounds={mapBounds.length >= 2 ? mapBounds : null} center={defaultCenter} />

              {/* Route Polyline */}
              {routePoints.length > 0 && (
                <Polyline
                  positions={routePoints}
                  color="#0ea5e9"
                  weight={5}
                  opacity={0.8}
                  lineJoin="round"
                />
              )}

              {/* Pickup Marker */}
              {pickupCoords && (
                <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={pickupIcon}>
                  <Popup>
                    <div className="text-xs">
                      <strong>Pickup Point</strong>
                      <p>{trackingData?.pickup?.address}</p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Destination Marker */}
              {destCoords && (
                <Marker position={[destCoords.lat, destCoords.lng]} icon={destIcon}>
                  <Popup>
                    <div className="text-xs">
                      <strong>Destination</strong>
                      <p>{trackingData?.destination?.address}</p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Driver Live Marker */}
              {driverLocation && !isTripEnded && (
                <Marker position={[driverLocation.lat, driverLocation.lng]} icon={carIcon}>
                  <Popup>
                    <div className="text-xs">
                      <strong>{trackingData?.driver?.name || 'Driver'}</strong>
                      <p>{trackingData?.vehicle?.model} ({trackingData?.vehicle?.registrationNumber})</p>
                      {lastLocationAt && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          Last ping: {new Date(lastLocationAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>

          {/* Driver Controls Panel (Visible to driver only) */}
          {isDriver && (
            <Card className="p-4 bg-slate-900 border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-teal-400" />
                    Driver Location Sharing
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Broadcast high-accuracy GPS coordinates to co-passengers. Requires HTTPS outside localhost.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isTripActive && (
                    <>
                      {isSharingGps ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={stopGpsWatch}
                          className="flex items-center gap-1.5"
                        >
                          <Square className="w-3.5 h-3.5" /> Stop Sharing
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={startGpsWatch}
                          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500"
                        >
                          <Play className="w-3.5 h-3.5" /> Start Sharing
                        </Button>
                      )}

                      {/* Development simulator button */}
                      <button
                        onClick={toggleSimulator}
                        className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition ${
                          isSimulating
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                        title="Walks along route geometry for development testing"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        {isSimulating ? 'Stop Simulator' : 'Simulated tracking (development only)'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* GPS status feedback */}
              {isSharingGps && (
                <div className="mt-3 flex items-center gap-2 text-xs text-teal-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
                  <span>Sharing live GPS coordinates with passengers...</span>
                </div>
              )}

              {gpsError && (
                <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                  {gpsError}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right Column: Driver & Trip Details */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Status Stepper Card */}
          <Card className="p-4 bg-slate-900 border-slate-800">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Journey Status
            </h4>
            <div className="space-y-3">
              {[
                { key: 'SCHEDULED', label: 'Ride Booked / Scheduled' },
                { key: 'STARTED', label: 'Driver Started Journey' },
                { key: 'IN_PROGRESS', label: 'Trip In Progress' },
                { key: 'COMPLETED', label: 'Trip Completed' }
              ].map((step, idx) => {
                const statuses = ['SCHEDULED', 'STARTED', 'IN_PROGRESS', 'COMPLETED'];
                const currentIdx = statuses.indexOf(tripStatus);
                const stepIdx = statuses.indexOf(step.key);
                const isPassed = currentIdx >= stepIdx && tripStatus !== 'CANCELLED';
                const isCurrent = currentIdx === stepIdx && tripStatus !== 'CANCELLED';

                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        isCurrent
                          ? 'animate-badge-pop bg-teal-500 text-slate-950 ring-4 ring-teal-500/25 shadow-sm'
                          : isPassed
                          ? 'bg-teal-500 text-slate-950'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                    >
                      {isPassed ? '✓' : idx + 1}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        isCurrent
                          ? 'text-teal-400 font-bold'
                          : isPassed
                          ? 'text-slate-200'
                          : 'text-slate-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Driver & Vehicle Profile */}
          <Card className="p-4 bg-slate-900 border-slate-800">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Driver & Vehicle Details
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 font-bold">
                  {trackingData?.driver?.name ? trackingData.driver.name[0] : 'D'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {trackingData?.driver?.name || 'Assigned Driver'}
                  </p>
                  <p className="text-xs text-slate-400">Verified Corporate Colleague</p>
                </div>
              </div>

              {trackingData?.vehicle && (
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Car className="w-4 h-4 text-slate-500" />
                    <span>{trackingData.vehicle.model}</span>
                  </div>
                  <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                    {trackingData.vehicle.registrationNumber}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Quick Chat Box preview */}
          <div className="flex-1">
            <ChatPanel
              tripId={tripId}
              isOpen={true}
              isEmbedded={true}
              title="Trip Chat"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default TripTrackingPage;
