import env from '../config/env.js';
import { simplifyPolyline } from '../utils/geo.js';

// In-memory cache for route calculations
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data) {
  if (cache.size > 1000) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Calculates a driving route between origin and destination using OSRM.
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} destination
 * @returns {Promise<{
 *   geometry: { type: 'LineString', coordinates: Array<[number, number]> },
 *   distanceMeters: number,
 *   durationSeconds: number,
 *   distanceKm: number,
 *   durationMinutes: number
 * }>}
 */
export async function calculateRoute(origin, destination) {
  const origLng = Number(origin.lng);
  const origLat = Number(origin.lat);
  const destLng = Number(destination.lng);
  const destLat = Number(destination.lat);

  // Validate coordinates
  if (
    isNaN(origLat) || isNaN(origLng) || isNaN(destLat) || isNaN(destLng) ||
    origLat < -90 || origLat > 90 || origLng < -180 || origLng > 180 ||
    destLat < -90 || destLat > 90 || destLng < -180 || destLng > 180
  ) {
    const err = new Error('Invalid coordinates for routing');
    err.status = 400;
    throw err;
  }

  const cacheKey = `route:${origLng.toFixed(4)},${origLat.toFixed(4)};${destLng.toFixed(4)},${destLat.toFixed(4)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // OSRM coordinates format: {lon},{lat};{lon},{lat}
  const osrmUrl = `${env.MAP_ROUTING_URL}/route/v1/driving/${origLng},${origLat};${destLng},${destLat}?overview=full&geometries=geojson`;

  let response;
  try {
    response = await fetch(osrmUrl, {
      headers: {
        'User-Agent': env.GEO_USER_AGENT,
        Accept: 'application/json'
      }
    });
  } catch (err) {
    const error = new Error(`Routing provider connection failed: ${err.message}`);
    error.status = 502;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`Routing provider returned HTTP ${response.status}`);
    error.status = 502;
    throw error;
  }

  const data = await response.json();

  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    const error = new Error(data.message || 'No driving route found between specified points');
    error.status = 422;
    throw error;
  }

  const primaryRoute = data.routes[0];
  const rawCoordinates = primaryRoute.geometry.coordinates; // [[lng, lat], ...]

  // Simplify polyline to maximum 300 points as mandated by requirements
  const simplifiedCoordinates = simplifyPolyline(rawCoordinates, 300);

  const result = {
    geometry: {
      type: 'LineString',
      coordinates: simplifiedCoordinates
    },
    distanceMeters: Math.round(primaryRoute.distance),
    durationSeconds: Math.round(primaryRoute.duration),
    distanceKm: parseFloat((primaryRoute.distance / 1000).toFixed(1)),
    durationMinutes: Math.round(primaryRoute.duration / 60)
  };

  setCached(cacheKey, result);
  return result;
}
