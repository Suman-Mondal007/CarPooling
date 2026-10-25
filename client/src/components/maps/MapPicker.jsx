import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { Search, MapPin, Bookmark, Loader2, Navigation } from 'lucide-react';
import geoApi from '../../api/geo.api.js';
import placesApi from '../../api/places.api.js';
import { genericPinIcon, originIcon, destinationIcon } from '../../utils/leafletIcons.js';

// Default center: India (Bangalore)
const DEFAULT_CENTER = [12.9716, 77.5946];
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Sub-component to sync map center with coordinates
function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || 14);
    }
  }, [center, zoom, map]);
  return null;
}

// Sub-component to handle map click events
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

export function MapPicker({
  value = { address: '', lat: null, lng: null },
  onChange,
  label = 'Select Location',
  placeholder = 'Search address or landmark...',
  pinType = 'generic', // 'origin', 'destination', 'generic'
  height = '320px',
  allowSavedPlaces = true
}) {
  const [query, setQuery] = useState(value?.address || '');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const debounceTimerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Sync internal search input with value.address
  useEffect(() => {
    if (value?.address) {
      setQuery(value.address);
    }
  }, [value?.address]);

  // Load saved places
  useEffect(() => {
    if (allowSavedPlaces) {
      placesApi.getSavedPlaces()
        .then((res) => setSavedPlaces(res.items || []))
        .catch(() => setSavedPlaces([]));
    }
  }, [allowSavedPlaces]);

  // Debounced search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query || query.trim().length < 2 || query === value?.address) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await geoApi.search(query);
        setSearchResults(Array.isArray(results) ? results : []);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, value?.address]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLocation = async (lat, lng, addressOverride = null) => {
    setShowDropdown(false);
    if (addressOverride) {
      setQuery(addressOverride);
      onChange?.({ address: addressOverride, lat, lng });
      return;
    }

    setIsReverseGeocoding(true);
    try {
      const rev = await geoApi.reverse(lat, lng);
      const address = rev.displayName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setQuery(address);
      onChange?.({ address, lat, lng });
    } catch {
      const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setQuery(fallback);
      onChange?.({ address: fallback, lat, lng });
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleSelectLocation(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn('Geolocation failed:', err.message);
        }
      );
    }
  };

  const currentCenter = value?.lat && value?.lng ? [value.lat, value.lng] : DEFAULT_CENTER;

  let pinIcon = genericPinIcon;
  if (pinType === 'origin') pinIcon = originIcon;
  if (pinType === 'destination') pinIcon = destinationIcon;

  return (
    <div className="w-full space-y-2">
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}

      {/* Search Input Bar with Saved Places and GPS buttons */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative flex items-center">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {isSearching || isReverseGeocoding ? (
              <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-20 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => {
              if ((searchResults || []).length > 0) setShowDropdown(true);
            }}
          />
          <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center gap-1">
            <button
              type="button"
              onClick={handleCurrentLocation}
              title="Use Current Location"
              className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded-md transition"
            >
              <Navigation className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Autocomplete Dropdown - Google Maps style */}
        {showDropdown && (
          <>
            {isSearching && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                <span>Searching locations...</span>
              </div>
            )}
            {!isSearching && (searchResults || []).length > 0 && (
              <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100 text-sm">
                {searchResults.map((item) => (
                  <li key={item.placeId || `${item.lat}-${item.lng}`}>
                    <button
                      type="button"
                      className="w-full text-left px-3.5 py-2.5 hover:bg-teal-50 flex items-start gap-2.5 text-slate-700 transition"
                      onClick={() => handleSelectLocation(item.lat, item.lng, item.displayName)}
                    >
                      <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                      <span className="truncate">{item.displayName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Saved Places Quick Chips */}
      {allowSavedPlaces && savedPlaces.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Bookmark className="w-3 h-3 text-slate-400" /> Saved:
          </span>
          {savedPlaces.map((place) => (
            <button
              key={place._id}
              type="button"
              onClick={() => handleSelectLocation(place.lat, place.lng, `${place.label} (${place.address})`)}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-teal-100 hover:text-teal-800 transition"
            >
              {place.placeType === 'HOME' ? '🏠 ' : place.placeType === 'OFFICE' ? '🏢 ' : '📍 '}
              {place.label}
            </button>
          ))}
        </div>
      )}

      {/* Interactive Leaflet Map */}
      <div
        className="relative w-full rounded-lg overflow-hidden border border-slate-200 shadow-inner z-0"
        style={{ height }}
      >
        <MapContainer
          center={currentCenter}
          zoom={value?.lat && value?.lng ? 15 : 12}
          scrollWheelZoom={false}
          className="w-full h-full"
        >
          <ChangeView center={currentCenter} zoom={value?.lat && value?.lng ? 15 : 12} />
          <TileLayer attribution={TILE_ATTR} url={TILE_URL} />
          <MapClickHandler onLocationSelect={handleSelectLocation} />

          {value?.lat && value?.lng && (
            <Marker
              position={[value.lat, value.lng]}
              icon={pinIcon}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const pos = marker.getLatLng();
                  handleSelectLocation(pos.lat, pos.lng);
                }
              }}
            />
          )}
        </MapContainer>
        <div className="absolute bottom-1 right-1 bg-white/90 backdrop-blur-xs text-[10px] text-slate-500 px-2 py-0.5 rounded pointer-events-none z-1000">
          Click map or drag pin to position
        </div>
      </div>
    </div>
  );
}

export default MapPicker;
