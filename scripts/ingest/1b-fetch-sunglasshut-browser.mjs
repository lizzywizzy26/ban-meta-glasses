#!/usr/bin/env node
// OPTIONAL fallback for Sunglass Hut, used only if 1-fetch-sunglasshut.mjs's
// plain-fetch strategies are still blocked (see that script's comments for
// the confirmed Akamai edgesuite.net block found on 14 Aug 2026).
//
// Unlike every other script in this folder, this one needs a real
// dependency: Playwright, which drives an actual Chromium browser. That's
// the realistic way past Akamai Bot Manager, which is specifically built to
// fingerprint TLS/HTTP handshakes and require JS-challenge cookies that a
// bare `fetch()` call can never produce, regardless of which headers it
// sends — this isn't a "try harder with headers" problem.
//
// SETUP (one-time):
//   cd scripts/ingest
//   npm install
// This downloads a real Chromium build (~300MB) the first time — normal for
// Playwright, not a sign anything went wrong. After that, running this
// script doesn't need npm install again.
//
// HOW TO RUN:
//   node scripts/ingest/1b-fetch-sunglasshut-browser.mjs
//
// If Sunglass Hut still blocks even a real browser (possible — Akamai can
// also fingerprint headless Chromium specifically), try:
//   HEADFUL=1 node scripts/ingest/1b-fetch-sunglasshut-browser.mjs
// which opens a real visible browser window instead of running headless —
// slower, but a strictly harder-to-detect real browser session, and lets
// you watch the page and manually solve a challenge/cookie banner if one
// appears.
//
// WHAT THIS SAVES, besides the usual output/sunglasshut.json:
//   output/sunglasshut.rendered.raw.html  — the page's HTML AFTER Sunglass
//     Hut's own JavaScript has run (this is what 1-fetch-sunglasshut.mjs's
//     plain fetch can never see).
//   output/sunglasshut.network-capture.json — every JSON response the page
//     loaded while rendering. Store-locator pages very often load their
//     actual store list from a separate API call, not embedded in the HTML
//     at all — if so, that response shows up here, and it may be a far
//     better long-term source than scraping rendered HTML (a stable JSON
//     endpoint vs. markup that can change any time Sunglass Hut redesigns
//     the page). Send this file back even if the main extraction fails —
//     it might contain the real answer on its own.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordsFromPostcodeScan, isAkamaiBlockPage, SOURCE_URL, HOMEPAGE_URL } from './1-fetch-sunglasshut.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');

async function main() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error(
      'Could not load "playwright". Run this first, from inside scripts/ingest/:\n  npm install\n' +
        '(This installs Playwright and downloads a Chromium build — only needed once.)'
    );
    process.exit(1);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  const headless = !process.env.HEADFUL;
  console.log(`Launching Chromium (headless: ${headless}) ...`);
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    locale: 'en-GB',
    viewport: { width: 1366, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  // Basic, well-known automation-fingerprint reduction — Playwright's
  // default `navigator.webdriver === true` is one of the simplest signals
  // bot-detection checks for.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  const capturedResponses = [];
  page.on('response', async (res) => {
    const contentType = res.headers()['content-type'] || '';
    if (!contentType.includes('json')) return;
    const url = res.url();
    // Only keep responses whose URL or body plausibly relates to stores —
    // skip analytics/ads/etc noise, but keep anything ambiguous rather than
    // risk missing the real endpoint under an unexpected name.
    if (!/store|location|branch|find/i.test(url)) return;
    try {
      const body = await res.text();
      if (body.length > 100) {
        capturedResponses.push({ url, status: res.status(), bodyLength: body.length, bodyPreview: body.slice(0, 4000) });
      }
    } catch {
      // response body not readable (e.g. already consumed) — skip
    }
  });

  console.log(`Visiting homepage ${HOMEPAGE_URL} first ...`);
  try {
    await page.goto(HOMEPAGE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000); // let any challenge/cookie-consent JS settle
  } catch (err) {
    console.log(`  homepage navigation issue (continuing anyway): ${err.message}`);
  }

  // Best-effort cookie-consent dismissal — selectors are guesses at common
  // patterns (OneTrust, generic "Accept" buttons), wrapped so a miss here
  // never breaks the run.
  for (const selector of ['#onetrust-accept-btn-handler', 'button:has-text("Accept")', 'button:has-text("Accept All")']) {
    try {
      const btn = page.locator(selector).first();
      await btn.waitFor({ state: 'visible', timeout: 1500 });
      await btn.click({ timeout: 1500 });
      console.log(`  dismissed a cookie/consent banner via "${selector}"`);
      break;
    } catch {
      // not present within the wait window — try the next selector
    }
  }

  console.log(`Visiting ${SOURCE_URL} ...`);
  let blocked = true;
  let html = '';
  try {
    await page.goto(SOURCE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch {
      // fine — some pages never go fully idle (polling widgets etc.), we
      // still have whatever rendered by now
    }
    html = await page.content();
    blocked = isAkamaiBlockPage(html);
    console.log(`  loaded, blocked page: ${blocked}, HTML length: ${html.length}`);
  } catch (err) {
    console.log(`  navigation FAILED: ${err.message}`);
  }

  const renderedPath = join(OUTPUT_DIR, 'sunglasshut.rendered.raw.html');
  await writeFile(renderedPath, html, 'utf-8');

  const networkCapturePath = join(OUTPUT_DIR, 'sunglasshut.network-capture.json');
  await writeFile(networkCapturePath, JSON.stringify(capturedResponses, null, 2), 'utf-8');

  let records = [];
  let method = blocked ? 'blocked_even_with_real_browser' : 'no_records_found_in_rendered_html';
  if (!blocked && html) {
    records = recordsFromPostcodeScan(html, SOURCE_URL);
    if (records.length > 0) method = 'postcode_text_scan_rendered_dom';
  }

  await browser.close();

  const outputPath = join(OUTPUT_DIR, 'sunglasshut.json');
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        sourceUrl: SOURCE_URL,
        fetchedAt: new Date().toISOString(),
        extractionMethod: method,
        recordCount: records.length,
        records,
        networkResponsesCaptured: capturedResponses.length,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`\nFound ${records.length} candidate record(s) via "${method}".`);
  console.log(`Captured ${capturedResponses.length} store-related JSON network response(s).`);
  console.log(`Saved: ${outputPath}`);
  console.log(`Also saved: ${renderedPath}`);
  console.log(`Also saved: ${networkCapturePath}`);

  if (blocked) {
    console.log(
      '\nStill blocked even with a real browser. Try: HEADFUL=1 node scripts/ingest/1b-fetch-sunglasshut-browser.mjs ' +
        'to watch it happen and manually clear any challenge/CAPTCHA, or treat Sunglass Hut as blocked for now and ' +
        'move on to another retailer — this would be a genuine dead end worth recording as such, not something to force.'
    );
  }

  console.log('\nPlease send back: sunglasshut.json, sunglasshut.rendered.raw.html, and sunglasshut.network-capture.json.');
}

main().catch((err) => {
  console.error('Fetch failed:', err.message);
  process.exit(1);
});
