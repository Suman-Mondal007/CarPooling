/**
 * Geographic utility functions for distance calculation, polyline simplification,
 * and GeoJSON transformations.
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates Haversine distance between two coordinates in meters.
 * @param {[number, number] | { lat: number, lng: number }} coord1 - [lng, lat] or {lat, lng}
 * @param {[number, number] | { lat: number, lng: number }} coord2 - [lng, lat] or {lat, lng}
 * @returns {number} Distance in meters
 */
export function haversineDistance(coord1, coord2) {
  const lat1 = Array.isArray(coord1) ? coord1[1] : coord1.lat;
  const lon1 = Array.isArray(coord1) ? coord1[0] : coord1.lng;
  const lat2 = Array.isArray(coord2) ? coord2[1] : coord2.lat;
  const lon2 = Array.isArray(coord2) ? coord2[0] : coord2.lng;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Calculates perpendicular distance from a point to a line segment in degrees squared.
 */
function perpendicularDistanceSq(point, lineStart, lineEnd) {
  let x = lineStart[0];
  let y = lineStart[1];
  let dx = lineEnd[0] - x;
  let dy = lineEnd[1] - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = lineEnd[0];
      y = lineEnd[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = point[0] - x;
  dy = point[1] - y;

  return dx * dx + dy * dy;
}

/**
 * Ramer-Douglas-Peucker algorithm implementation to simplify a polyline.
 * Coordinates are [lng, lat].
 */
function rdp(points, sqTolerance) {
  if (points.length <= 2) return points;

  let maxSqDist = 0;
  let index = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const sqDist = perpendicularDistanceSq(points[i], points[0], points[points.length - 1]);
    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }

  if (maxSqDist > sqTolerance) {
    const left = rdp(points.slice(0, index + 1), sqTolerance);
    const right = rdp(points.slice(index), sqTolerance);
    return left.slice(0, left.length - 1).concat(right);
  }

  return [points[0], points[points.length - 1]];
}

/**
 * Simplifies a polyline to at most maxPoints (default 300).
 * Points format: [[lng, lat], ...]
 * @param {Array<[number, number]>} points
 * @param {number} maxPoints
 * @returns {Array<[number, number]>}
 */
export function simplifyPolyline(points, maxPoints = 300) {
  if (!points || points.length <= maxPoints) {
    return points || [];
  }

  // Iteratively adjust tolerance until point count <= maxPoints
  let tolerance = 0.00001; // initial degree tolerance
  let simplified = points;

  while (simplified.length > maxPoints && tolerance < 1.0) {
    simplified = rdp(points, tolerance * tolerance);
    tolerance *= 1.5;
  }

  // If still over maxPoints (rare edge case), uniform downsampling fallback
  if (simplified.length > maxPoints) {
    const step = (simplified.length - 1) / (maxPoints - 1);
    const sampled = [];
    for (let i = 0; i < maxPoints - 1; i++) {
      sampled.push(simplified[Math.floor(i * step)]);
    }
    sampled.push(simplified[simplified.length - 1]);
    return sampled;
  }

  return simplified;
}

/**
 * Projects a point onto a line segment and calculates distance in meters.
 * Coordinates are [lng, lat].
 */
export function projectPointToSegment(point, segStart, segEnd) {
  const pLng = point[0];
  const pLat = point[1];
  const sLng = segStart[0];
  const sLat = segStart[1];
  const eLng = segEnd[0];
  const eLat = segEnd[1];

  const dx = eLng - sLng;
  const dy = eLat - sLat;

  let t = 0;
  if (dx !== 0 || dy !== 0) {
    t = ((pLng - sLng) * dx + (pLat - sLat) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));
  }

  const projPoint = [sLng + t * dx, sLat + t * dy];
  const distanceMeters = haversineDistance(point, projPoint);

  return {
    projPoint,
    t,
    distanceMeters
  };
}

/**
 * Projects a point onto a polyline and calculates the minimum distance in meters
 * and the cumulative distance along the polyline up to the projection.
 * Coordinates are [lng, lat].
 * @param {[number, number] | { lat: number, lng: number }} point
 * @param {Array<[number, number]>} polylineCoords
 * @returns {{
 *   minDistanceMeters: number,
 *   cumulativeDistanceMeters: number,
 *   segmentIndex: number
 * }}
 */
export function projectPointToPolyline(point, polylineCoords) {
  const pt = Array.isArray(point) ? point : [point.lng, point.lat];

  if (!polylineCoords || polylineCoords.length === 0) {
    return { minDistanceMeters: Infinity, cumulativeDistanceMeters: 0, segmentIndex: -1 };
  }

  if (polylineCoords.length === 1) {
    return {
      minDistanceMeters: haversineDistance(pt, polylineCoords[0]),
      cumulativeDistanceMeters: 0,
      segmentIndex: 0
    };
  }

  let minDistanceMeters = Infinity;
  let bestSegmentIndex = 0;
  let bestFraction = 0;
  let distanceAlongPolyline = 0;
  let bestCumulativeDistance = 0;

  for (let i = 0; i < polylineCoords.length - 1; i++) {
    const segStart = polylineCoords[i];
    const segEnd = polylineCoords[i + 1];
    const segLength = haversineDistance(segStart, segEnd);

    const { distanceMeters, t } = projectPointToSegment(pt, segStart, segEnd);

    if (distanceMeters < minDistanceMeters) {
      minDistanceMeters = distanceMeters;
      bestSegmentIndex = i;
      bestFraction = t;
      bestCumulativeDistance = distanceAlongPolyline + t * segLength;
    }

    distanceAlongPolyline += segLength;
  }

  return {
    minDistanceMeters: Math.round(minDistanceMeters),
    cumulativeDistanceMeters: Math.round(bestCumulativeDistance),
    segmentIndex: bestSegmentIndex,
    fraction: bestFraction,
    totalPolylineDistanceMeters: Math.round(distanceAlongPolyline)
  };
}

/**
 * Converts API coordinates { lat, lng } to GeoJSON Point.
 */
export function toGeoJsonPoint({ lat, lng }) {
  return {
    type: 'Point',
    coordinates: [Number(lng), Number(lat)]
  };
}

/**
 * Converts GeoJSON Point to API format { lat, lng }.
 */
export function fromGeoJsonPoint(geoJsonPoint) {
  if (!geoJsonPoint || !geoJsonPoint.coordinates) return null;
  return {
    lat: geoJsonPoint.coordinates[1],
    lng: geoJsonPoint.coordinates[0]
  };
}
