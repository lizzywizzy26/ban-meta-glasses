// Postcode normalization/validation + geocoding, shared between the Worker
// (production, real network) and the local Node ingestion scripts (which
// import this same file — see scripts/ingest/2-normalize-and-geocode.mjs).
//
// Production always calls the real postcodes.io API. The only exception is
// local/offline development, where outbound network access may not exist
// (e.g. this project was partly built in a sandboxed session with a strict
// network egress allowlist that blocked postcodes.io entirely) — in that
// one case, passing `env.MOCK_GEOCODER` (a dev-only flag that must never be
// set in the real deployed Worker's vars) switches to a small fixed lookup
// table so the rest of the pipeline can still be built, run, and tested
// without live network access. Nothing about this mock is used to make real
// claims about any stockist — it exists purely to unblock local development
// of the distance/sorting/response-shaping logic.

// UK postcodes: outward code (1-2 letters, 1-2 digits, optional letter) +
// space + inward code (1 digit + 2 letters). Case-insensitive, tolerant of
// missing/extra whitespace.
const POSTCODE_RE = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}$/i;

export function normalizePostcode(raw) {
  if (typeof raw !== 'string') return null;
  const compact = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (compact.length < 5 || compact.length > 7) return null;
  // Re-insert the canonical single space before the 3-character inward code.
  const inward = compact.slice(-3);
  const outward = compact.slice(0, -3);
  const normalized = `${outward} ${inward}`;
  return POSTCODE_RE.test(normalized) ? normalized : null;
}

// Small fixed set of real, well-known UK postcode centroids, for
// MOCK_GEOCODER mode only. Coordinates are approximate (rounded, public
// landmark postcodes) — adequate for exercising distance/sort logic in
// local dev, not a source of truth for anything shipped to real users.
const MOCK_COORDS = {
  'SW1A 1AA': { latitude: 51.5010, longitude: -0.1416 }, // Westminster, London
  'M1 1AE': { latitude: 53.4794, longitude: -2.2453 }, // Manchester city centre
  'EH1 1BB': { latitude: 55.9522, longitude: -3.1888 }, // Edinburgh city centre
  'B1 1AA': { latitude: 52.4814, longitude: -1.8998 }, // Birmingham city centre
  'BS1 1AA': { latitude: 51.4536, longitude: -2.5911 }, // Bristol city centre
  'LS1 1AA': { latitude: 53.7975, longitude: -1.5453 }, // Leeds city centre
};

async function mockGeocode(normalizedPostcode) {
  const hit = MOCK_COORDS[normalizedPostcode];
  if (hit) return { ...hit, postcode: normalizedPostcode, source: 'mock' };
  // Deterministic pseudo-coordinate for any other postcode so pipeline
  // tests with arbitrary input postcodes still produce *some* result,
  // clearly not a real location.
  return { latitude: 52.0, longitude: -1.5, postcode: normalizedPostcode, source: 'mock-fallback' };
}

async function liveGeocode(normalizedPostcode) {
  const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(normalizedPostcode.replace(/\s+/g, ''))}`;
  const res = await fetch(url);
  if (res.status === 404) return null; // valid shape, not a real postcode
  if (!res.ok) throw new Error(`postcodes.io returned ${res.status}`);
  const data = await res.json();
  if (!data || !data.result) return null;
  const { latitude, longitude } = data.result;
  // postcodes.io can return a result row for a postcode without real
  // coordinates in it — confirmed for Channel Islands postcodes (e.g.
  // Jersey's JE postcodes), which aren't part of the UK for ONS geocoding
  // purposes despite existing as valid postcode strings. Treat this the
  // same as "not found" rather than silently storing null coordinates,
  // which would violate the stockists table's NOT NULL constraint and,
  // worse, could silently succeed with corrupt data if that constraint
  // were ever relaxed.
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  }
  return {
    latitude,
    longitude,
    postcode: data.result.postcode,
    source: 'postcodes.io',
  };
}

// env is optional so this also works when called from plain Node scripts
// (which pass process.env-shaped objects or nothing at all).
export async function geocodePostcode(rawPostcode, env = {}) {
  const normalized = normalizePostcode(rawPostcode);
  if (!normalized) return { error: 'invalid_format', normalized: null, coords: null };

  const useMock = env.MOCK_GEOCODER === '1' || env.MOCK_GEOCODER === true;
  try {
    const coords = useMock ? await mockGeocode(normalized) : await liveGeocode(normalized);
    if (!coords) return { error: 'not_found', normalized, coords: null };
    return { error: null, normalized, coords };
  } catch (err) {
    return { error: 'geocoder_unavailable', normalized, coords: null, detail: err.message };
  }
}
