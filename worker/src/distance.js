// Great-circle distance in miles, via the Haversine formula — accurate
// across Great Britain, unlike a fixed longitude-degree-to-miles offset
// (a degree of longitude covers meaningfully less ground distance at
// Shetland's latitude than at the Isle of Wight's, since meridians converge
// toward the poles).
const EARTH_RADIUS_MILES = 3958.8;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineMiles(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

// A latitude-aware bounding box, used to cheaply shrink the D1 candidate set
// with an indexed range query before doing exact Haversine distance in JS —
// avoids a full table scan as the stockist count grows. One degree of
// longitude is worth fewer miles the further from the equator you are, so
// the box widens/narrows in longitude based on latitude; it deliberately
// over-includes slightly (candidates just outside the true radius) rather
// than risk excluding a real match — the exact Haversine filter afterwards
// removes any false positives.
export function boundingBox(latitude, longitude, radiusMiles) {
  const latDelta = radiusMiles / 69.0; // ~69 miles per degree of latitude, everywhere
  const milesPerDegreeLon = 69.0 * Math.cos(toRadians(latitude));
  const lonDelta = milesPerDegreeLon > 0 ? radiusMiles / milesPerDegreeLon : 180;

  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLon: longitude - lonDelta,
    maxLon: longitude + lonDelta,
  };
}
