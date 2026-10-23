import env from '../config/env.js';

// In-memory cache for geocoding queries with 1-hour TTL
const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

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
  // Prune cache if oversized (> 1000 items)
  if (cache.size > 1000) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Throttle queue to respect Nominatim 1 req/sec policy
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1000;

async function throttle() {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLast));
  }
  lastRequestTime = Date.now();
}

/**
 * Searches locations matching query string.
 * @param {string} query
 * @param {string} [countryCodes='in']
 */
export async function searchLocations(query, countryCodes = 'in') {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return [];
  }

  const cacheKey = `search:${countryCodes}:${trimmed.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  await throttle();

  const url = new URL(`${env.GEOCODING_URL}/search`);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '8');
  if (countryCodes) {
    url.searchParams.set('countrycodes', countryCodes);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': env.GEO_USER_AGENT,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Geocoding service error (${response.status}): ${errorText.substring(0, 100)}`);
  }

  const results = await response.json();

  const formatted = results.map((item) => ({
    placeId: item.place_id,
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    type: item.type,
    address: item.address || {}
  }));

  setCached(cacheKey, formatted);
  return formatted;
}

/**
 * Reverse geocodes coordinates to an address.
 * @param {number} lat
 * @param {number} lng
 */
export async function reverseGeocode(lat, lng) {
  const cacheKey = `reverse:${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  await throttle();

  const url = new URL(`${env.GEOCODING_URL}/reverse`);
  url.searchParams.set('lat', lat.toString());
  url.searchParams.set('lon', lng.toString());
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': env.GEO_USER_AGENT,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Reverse geocoding error (${response.status}): ${errorText.substring(0, 100)}`);
  }

  const item = await response.json();

  const formatted = {
    placeId: item.place_id,
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    address: item.address || {}
  };

  setCached(cacheKey, formatted);
  return formatted;
}
