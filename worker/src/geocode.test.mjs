// Tests for worker/src/geocode.js — zero dependencies, uses Node's built-in
// test runner (node:test), consistent with this project's plain-Node
// ethos elsewhere (see scripts/ingest/README.md). Run with:
//   node --test worker/src/geocode.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePostcode, geocodeQuery, geocodeIrishTown, IRELAND_TOWN_COORDS } from './geocode.js';

const MOCK_ENV = { MOCK_GEOCODER: '1' };

test('normalizePostcode: real UK postcodes normalise correctly', () => {
  assert.equal(normalizePostcode('sw1a1aa'), 'SW1A 1AA');
  assert.equal(normalizePostcode('SW1A 1AA'), 'SW1A 1AA');
  assert.equal(normalizePostcode('m1 1ae'), 'M1 1AE');
  assert.equal(normalizePostcode('not a postcode'), null);
});

test('geocodeQuery: UK postcode without a space resolves as UK, not misread as an Eircode', async () => {
  // Regression test for the bug found during the 16 Aug 2026 deployment
  // audit: EIRCODE_SHAPE_RE's routing-key slot allows "W" (for the real
  // Dublin routing key D6W), which also matches the second letter of
  // ordinary UK outward codes like "SW"/"NW" — so a compact (no-space)
  // input like "SW1A1AA" was being misidentified as looking like an
  // Eircode and rejected before the UK postcode check ever ran.
  const r = await geocodeQuery('SW1A1AA', MOCK_ENV);
  assert.equal(r.country, 'UK');
  assert.equal(r.error, null);
  assert.equal(r.normalized, 'SW1A 1AA');
});

test('geocodeQuery: the same postcode WITH a space also resolves as UK (no regression)', async () => {
  const r = await geocodeQuery('SW1A 1AA', MOCK_ENV);
  assert.equal(r.country, 'UK');
  assert.equal(r.error, null);
});

test('geocodeQuery: other UK postcodes with a "W" in the outward code, no space', async () => {
  // Broader coverage than just the one reported case — anything starting
  // NW/SW without a space is the risk class this bug affected.
  for (const pc of ['NW31QX', 'SW195EE', 'W111PY']) {
    const r = await geocodeQuery(pc, MOCK_ENV);
    assert.equal(r.country, 'UK', `${pc} should resolve as UK`);
    assert.equal(r.error, null, `${pc} should not error`);
  }
});

test('geocodeQuery: a real Eircode is still correctly detected and rejected with its specific message', async () => {
  for (const code of ['D02 AF30', 'D02AF30', 'T12 X2VF']) {
    const r = await geocodeQuery(code, MOCK_ENV);
    assert.equal(r.error, 'eircode_not_supported', `${code} should still be detected as an Eircode`);
    assert.equal(r.country, 'IE');
  }
});

test('geocodeQuery: Irish town names resolve, case- and whitespace-insensitively', async () => {
  const r1 = await geocodeQuery('Dublin', MOCK_ENV);
  assert.equal(r1.country, 'IE');
  assert.equal(r1.error, null);

  const r2 = await geocodeQuery('  cork  ', MOCK_ENV);
  assert.equal(r2.country, 'IE');
  assert.equal(r2.error, null);
});

test('geocodeQuery: unrecognised input returns not_found with no country', async () => {
  const r = await geocodeQuery('Nowheresville', MOCK_ENV);
  assert.equal(r.error, 'not_found');
  assert.equal(r.country, null);
});

test('geocodeQuery: empty/whitespace-only input is invalid_format', async () => {
  for (const input of ['', '   ']) {
    const r = await geocodeQuery(input, MOCK_ENV);
    assert.equal(r.error, 'invalid_format');
  }
});

test('geocodeIrishTown: unknown town returns not_found, never an invented coordinate', () => {
  const r = geocodeIrishTown('Not A Real Place');
  assert.equal(r.error, 'not_found');
  assert.equal(r.coords, null);
});

test('IRELAND_TOWN_COORDS: every entry has finite lat/long', () => {
  for (const [town, coords] of Object.entries(IRELAND_TOWN_COORDS)) {
    assert.ok(Number.isFinite(coords.latitude), `${town} latitude should be finite`);
    assert.ok(Number.isFinite(coords.longitude), `${town} longitude should be finite`);
  }
});
