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
  // Lerwick, Shetland — a real, valid postcode used deliberately to trigger
  // the genuine zero-results state in local testing (16 Aug 2026 QA
  // follow-up). Checked against the full 534-record committed dataset: the
  // nearest real verified stockist (Vision Express, Inverurie) is ~203
  // miles away, well beyond the widest search radius the API tries (50
  // miles — see RADIUS_STEPS_MILES in stockists.js), so this reliably
  // exercises "valid postcode, nothing found nearby" rather than an error
  // path. Not a comment on Shetland retail availability — just a
  // convenient, honest, genuinely-far coordinate for the test suite.
  'ZE1 0AA': { latitude: 60.1541, longitude: -1.1489 }, // Lerwick, Shetland
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

// ---------------------------------------------------------------------------
// Ireland support (added 16 Aug 2026).
//
// Deliberately NOT using postcodes.io (UK-only, confirmed earlier not to
// cover Ireland) or a live Eircode/Nominatim lookup for Ireland at all —
// community reports found Eircode coverage on free OSM-based geocoders to be
// patchy, and this campaign's data principle is "verified or don't show it,"
// not "best guess." So for the Monday MVP, Ireland is supported at
// town/city precision only, via this small fixed table of real town/city
// centroids, not a live geocoding API call. This is a genuine accuracy
// trade-off, not a shortcut hiding a bug — it must be reflected honestly in
// both the finder's copy (see js/finder.js) and in the notes field on any
// stockist record whose coordinate comes from this table rather than a
// retailer's own source data (see 2-normalize-and-geocode.mjs).
//
// Coordinates below are approximate town/city centroids (rounded to ~2
// decimal places, i.e. accurate to a few km) — adequate for "which stockist
// is roughly nearest," not for turn-by-turn navigation. Extend this list as
// real stockist branches turn up in towns not yet covered; don't invent a
// coordinate for a town not on this list, return not_found instead.
export const IRELAND_TOWN_COORDS = {
  dublin: { latitude: 53.3498, longitude: -6.2603 },
  cork: { latitude: 51.8985, longitude: -8.4756 },
  galway: { latitude: 53.2707, longitude: -9.0568 },
  limerick: { latitude: 52.6638, longitude: -8.6267 },
  waterford: { latitude: 52.2593, longitude: -7.1101 },
  kilkenny: { latitude: 52.6541, longitude: -7.2448 },
  wexford: { latitude: 52.3369, longitude: -6.4633 },
  sligo: { latitude: 54.2766, longitude: -8.4761 },
  athlone: { latitude: 53.4239, longitude: -7.9407 },
  drogheda: { latitude: 53.7189, longitude: -6.3478 },
  dundalk: { latitude: 54.0007, longitude: -6.4058 },
  bray: { latitude: 53.2028, longitude: -6.0987 },
  navan: { latitude: 53.6528, longitude: -6.6772 },
  naas: { latitude: 53.2185, longitude: -6.6672 },
  tralee: { latitude: 52.2707, longitude: -9.7018 },
  ennis: { latitude: 52.8433, longitude: -8.9864 },
  letterkenny: { latitude: 54.9503, longitude: -7.7346 },
  mullingar: { latitude: 53.5258, longitude: -7.3462 },
  portlaoise: { latitude: 53.0328, longitude: -7.2988 },
  carlow: { latitude: 52.8365, longitude: -6.9341 },
  cavan: { latitude: 53.9908, longitude: -7.3606 },
  monaghan: { latitude: 54.2492, longitude: -6.9683 },
  longford: { latitude: 53.7276, longitude: -7.7933 },
  roscommon: { latitude: 53.6274, longitude: -8.1874 },
  tullamore: { latitude: 53.2739, longitude: -7.4931 },
  clonmel: { latitude: 52.3557, longitude: -7.7042 },
  thurles: { latitude: 52.6811, longitude: -7.8103 },
  nenagh: { latitude: 52.8632, longitude: -8.1975 },
  wicklow: { latitude: 52.9808, longitude: -6.0446 },
  arklow: { latitude: 52.7936, longitude: -6.1531 },
  newbridge: { latitude: 53.1836, longitude: -6.8073 },
  kildare: { latitude: 53.159, longitude: -6.9111 },
  killarney: { latitude: 52.0599, longitude: -9.5044 },
  cobh: { latitude: 51.8508, longitude: -8.2944 },
};

// Eircode shape: routing key (1 letter + 2 more chars, digits or "W") + 4
// alphanumeric unique identifier, e.g. "D02 AF30", "T12 X2VF". Detection-only
// — used to catch "someone typed an Eircode" and give a specific, honest
// message (see geocodeQuery below), NOT to validate or geocode it, since
// this project doesn't have a trustworthy Eircode geocoder for Monday.
const EIRCODE_SHAPE_RE = /^[A-Z][0-9AW][0-9]\s?[A-Z0-9]{4}$/i;

export function normalizeTownQuery(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > 60) return null;
  return trimmed;
}

export function geocodeIrishTown(rawQuery) {
  const normalized = normalizeTownQuery(rawQuery);
  if (!normalized) return { error: 'invalid_format', normalized: null, coords: null };
  const key = normalized.toLowerCase();
  const hit = IRELAND_TOWN_COORDS[key];
  if (!hit) return { error: 'not_found', normalized, coords: null };
  return { error: null, normalized, coords: { ...hit, source: 'ie_town_lookup' } };
}

// Single entry point the Worker uses for the finder's search box, which now
// accepts either a UK postcode or an Ireland town/city name in the same
// field (see js/finder.js copy). Detects which kind of input this looks
// like and routes accordingly — never mixes UK and Ireland results in one
// response. Returns the same { error, normalized, coords } shape as
// geocodePostcode/geocodeIrishTown, plus a `country` field ('UK' | 'IE' |
// null) so the caller can scope its D1 query correctly.
export async function geocodeQuery(rawQuery, env = {}) {
  if (typeof rawQuery !== 'string' || !rawQuery.trim()) {
    return { error: 'invalid_format', normalized: null, coords: null, country: null };
  }
  const compact = rawQuery.trim();

  // UK postcode shape is checked FIRST, and wins outright if it matches.
  // Regression fixed 16 Aug 2026: EIRCODE_SHAPE_RE's second character slot
  // allows "W" (for the real Dublin routing key D6W), which also matches
  // the second letter of ordinary UK outward codes like "SW" or "NW" —
  // e.g. "SW1A1AA" (no space) was being misidentified and rejected as an
  // Eircode before ever reaching the UK postcode check. POSTCODE_RE is a
  // precise, well-established format we actually have a real geocoder
  // for, so an unambiguous match there must take priority over the
  // Eircode shape heuristic, which only exists to produce a friendlier
  // error message for input that isn't a valid UK postcode at all. See
  // geocode.test.mjs for the regression test.
  if (normalizePostcode(compact)) {
    const ukAttempt = await geocodePostcode(compact, env);
    return { ...ukAttempt, country: 'UK' };
  }

  if (EIRCODE_SHAPE_RE.test(compact.replace(/\s+/g, ' '))) {
    // Looks like an Eircode specifically — give a precise, honest message
    // rather than the generic "not recognised" (see stockists.js), since
    // this is a real, common input shape we deliberately don't support yet.
    return { error: 'eircode_not_supported', normalized: null, coords: null, country: 'IE' };
  }

  const ieAttempt = geocodeIrishTown(compact);
  if (ieAttempt.error === null) return { ...ieAttempt, country: 'IE' };

  // Didn't match either shape/table — genuinely unrecognised input.
  return { error: 'not_found', normalized: null, coords: null, country: null };
}
