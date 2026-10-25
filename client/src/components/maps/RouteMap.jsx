import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Clock, Navigation2 } from 'lucide-react';
import { originIcon, destinationIcon } from '../../utils/leafletIcons.js';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Sub-component to fit map bounds to the route polyline or markers
function BoundsFitter({ routeCoordinates, origin, destination }) {
  const map = useMap();

  useEffect(() => {
    const latLngs = [];

    if (routeCoordinates && routeCoordinates.length > 0) {
      // routeCoordinates are [lng, lat], convert to [lat, lng] for Leaflet
      routeCoordinates.forEach(([lng, lat]) => latLngs.push([lat, lng]));
    } else {
      if (origin?.lat && origin?.lng) latLngs.push([origin.lat, origin.lng]);
      if (destination?.lat && destination?.lng) latLngs.push([destination.lat, destination.lng]);
    }

    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [routeCoordinates, origin, destination, map]);

  return null;
}

export function RouteMap({
  origin, // { lat, lng, address }
  destination, // { lat, lng, address }
  routeGeometry, // GeoJSON { type: 'LineString', coordinates: [[lng, lat], ...] }
  distanceKm,
  durationMinutes,
  height = '360px',
  showMetricsOverlay = true,
  className = ''
}) {
  // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
  const polylineCoords = routeGeometry?.coordinates
    ? routeGeometry.coordinates.map(([lng, lat]) => [lat, lng])
    : [];

  const defaultCenter = origin?.lat && origin?.lng
    ? [origin.lat, origin.lng]
    : [12.9716, 77.5946];

  return (
    <div className={`relative w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm z-0 ${className}`} style={{ height }}>
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer attribution={TILE_ATTR} url={TILE_URL} />

        <BoundsFitter
          routeCoordinates={routeGeometry?.coordinates}
          origin={origin}
          destination={destination}
        />

        {/* Route Polyline */}
        {polylineCoords.length > 0 && (
          <Polyline
            positions={polylineCoords}
            pathOptions={{
              color: '#0d9488', // Teal-600
              weight: 5,
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round'
            }}
          />
        )}

        {/* Origin Marker (Green pin) */}
        {origin?.lat && origin?.lng && (
          <Marker position={[origin.lat, origin.lng]} icon={originIcon} />
        )}

        {/* Destination Marker (Red pin) */}
        {destination?.lat && destination?.lng && (
          <Marker position={[destination.lat, destination.lng]} icon={destinationIcon} />
        )}
      </MapContainer>

      {/* Floating Route Distance & Duration Overlay */}
      {showMetricsOverlay && (distanceKm !== undefined || durationMinutes !== undefined) && (
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-md border border-slate-200/80 flex items-center gap-4 text-xs font-semibold text-slate-800 z-1000 animate-slide-down">
          {distanceKm !== undefined && (
            <div className="flex items-center gap-1.5 text-slate-700">
              <Navigation2 className="w-3.5 h-3.5 text-teal-600" />
              <span>{distanceKm} km</span>
            </div>
          )}
          {durationMinutes !== undefined && (
            <div className="flex items-center gap-1.5 text-slate-700">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>~{durationMinutes} mins</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RouteMap;
