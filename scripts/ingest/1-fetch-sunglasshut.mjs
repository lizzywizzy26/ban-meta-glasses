#!/usr/bin/env node
// Fetches Sunglass Hut's official UK store locator and saves what it finds
// as ONE json file: scripts/ingest/output/sunglasshut.json
//
// HOW TO RUN: same as the other scripts, no arguments.
//   node scripts/ingest/1-fetch-sunglasshut.mjs
//
// CONFIRMED FROM THE FIRST REAL RUN (14 Aug 2026): a single plain fetch got
// HTTP 403 with this body —
//   <TITLE>Access Denied</TITLE> ... Reference #18.beec655f.1786749879.5fd65cf
//   https://errors.edgesuite.net/18.beec655f.1786749879.5fd65cf
// `errors.edgesuite.net` identifies this as an Akamai edge/bot-management
// block, not a missing-page or JavaScript-rendering problem — the request
// was actively rejected before reaching Sunglass Hut's actual application.
// Akamai Bot Manager typically fingerprints at the TLS/HTTP handshake level
// and via missing session-cookie state, not just User-Agent — so a single
// cold request with browser-like headers (what the previous version of this
// script did) is often not enough on its own.
//
// This version tries three things in order, all still plain `fetch()` (no
// new dependencies), and reports exactly what happened at each step so
// nothing is silently swallowed:
//   1. GET the UK homepage first, to pick up any session cookies Akamai's
//      challenge sets on a "normal" first visit, and to get a real Referer.
//   2. Re-request the store-locations page using those cookies + Referer +
//      a fuller set of browser-like headers (sec-fetch-*, sec-ch-ua, etc.)
//      — closer to what an actual browser sends, in case the block rule
//      keys on missing headers rather than (or in addition to) TLS/cookie
//      state.
//   3. Fetch /robots.txt and, if it references one, the sitemap — both are
//      standard, publicly-published URLs (not a guessed/hidden endpoint),
//      and Akamai bot rules are very often scoped to specific paths (the
//      store locator is a common scraping target; robots.txt/sitemap.xml
//      usually aren't, since blocking them would hurt SEO). If the sitemap
//      lists individual store-page URLs, this fetches ONE as a test case —
//      not all of them — to see whether that path is blocked the same way.
//
// If all three still come back blocked, the realistic fix is a real browser
// (Akamai's TLS/JS fingerprinting is specifically designed to be very hard
// to pass with a bare HTTP client, on any platform, not just Node). See
// 1b-fetch-sunglasshut-browser.mjs for a Playwright-based version of this
// same script — kept separate because it needs `npm install` once (not
// zero-dependency like every other script here), so it's opt-in, not the
// default path.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
export const HOMEPAGE_URL = 'https://www.sunglasshut.com/uk';
export const SOURCE_URL = 'https://www.sunglasshut.com/uk/sunglasses/store-locations';
const ROBOTS_URL = 'https://www.sunglasshut.com/robots.txt';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function fullBrowserHeaders(extra = {}) {
  return {
    'User-Agent': BROWSER_UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    ...extra,
  };
}

export function isAkamaiBlockPage(html) {
  return /edgesuite\.net|Access Denied/i.test(html) && html.length < 2000;
}

function extractSetCookies(res) {
  // getSetCookie() is the correct API for multiple Set-Cookie headers, but
  // guard for older runtimes just in case.
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

function cookieHeaderFrom(setCookieStrings) {
  return setCookieStrings.map((c) => c.split(';')[0]).join('; ');
}

const UK_POSTCODE_RE = /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2})\b/gi;
const UK_PHONE_RE = /\b(0\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4})\b/g;
const META_HINT_RE = /ray-?ban meta|smart glasses|ai glasses/i;

export function recordsFromPostcodeScan(html, sourceUrl) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const records = [];
  let match;
  const re = new RegExp(UK_POSTCODE_RE.source, 'gi');
  while ((match = re.exec(text)) !== null) {
    const postcode = match[1].toUpperCase();
    const start = Math.max(0, match.index - 200);
    const end = Math.min(text.length, match.index + 100);
    const context = text.slice(start, end).trim();
    const phoneMatch = context.match(UK_PHONE_RE);
    records.push({
      branchName: null,
      address: context,
      postcode,
      phone: phoneMatch ? phoneMatch[0] : null,
      sourceUrl,
      metaEvidenceText: META_HINT_RE.test(context) ? context.match(META_HINT_RE)[0] : null,
      extractionMethod: 'postcode_text_scan',
      needsReview: true,
    });
  }
  return records;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const diagnostics = { steps: [] };

  // Step 1: homepage, to collect cookies + establish a real Referer.
  console.log(`Step 1: fetching homepage ${HOMEPAGE_URL} ...`);
  let cookieHeader = '';
  try {
    const homeRes = await fetch(HOMEPAGE_URL, { headers: fullBrowserHeaders() });
    const homeHtml = await homeRes.text();
    const setCookies = extractSetCookies(homeRes);
    cookieHeader = cookieHeaderFrom(setCookies);
    const blocked = isAkamaiBlockPage(homeHtml);
    console.log(`  status ${homeRes.status}, cookies received: ${setCookies.length}, blocked page: ${blocked}`);
    diagnostics.steps.push({ step: 'homepage', url: HOMEPAGE_URL, httpStatus: homeRes.status, cookiesReceived: setCookies.length, blocked });
  } catch (err) {
    console.log(`  FAILED: ${err.message}`);
    diagnostics.steps.push({ step: 'homepage', url: HOMEPAGE_URL, error: err.message });
  }

  // Step 2: store-locations, with cookies + Referer + fuller headers.
  console.log(`\nStep 2: fetching ${SOURCE_URL} with cookies + Referer ...`);
  const res = await fetch(SOURCE_URL, {
    headers: fullBrowserHeaders({
      Referer: HOMEPAGE_URL,
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    }),
  });
  console.log(`Status: ${res.status} ${res.statusText}`);
  const html = await res.text();
  const blockedMain = isAkamaiBlockPage(html);
  diagnostics.steps.push({ step: 'store-locations-with-cookies', url: SOURCE_URL, httpStatus: res.status, blocked: blockedMain, bodyLength: html.length });

  const rawPath = join(OUTPUT_DIR, 'sunglasshut.raw.html');
  await writeFile(rawPath, html, 'utf-8');

  let records = [];
  let method = 'blocked';
  let usedUrl = SOURCE_URL;

  if (!blockedMain && res.status === 200) {
    records = recordsFromPostcodeScan(html, SOURCE_URL);
    method = records.length > 0 ? 'postcode_text_scan' : 'no_records_found_in_200_response';
  } else {
    // Step 3: robots.txt + sitemap, both standard published URLs, to look
    // for a differently-scoped path that might not carry the same block.
    console.log(`\nStep 3: store-locations still blocked (status ${res.status}). Checking ${ROBOTS_URL} ...`);
    try {
      const robotsRes = await fetch(ROBOTS_URL, { headers: fullBrowserHeaders() });
      const robotsText = await robotsRes.text();
      const robotsBlocked = isAkamaiBlockPage(robotsText);
      console.log(`  robots.txt status ${robotsRes.status}, blocked: ${robotsBlocked}`);
      diagnostics.steps.push({ step: 'robots.txt', url: ROBOTS_URL, httpStatus: robotsRes.status, blocked: robotsBlocked });

      const sitemapMatch = robotsText.match(/Sitemap:\s*(\S+)/i);
      if (!robotsBlocked && sitemapMatch) {
        const sitemapUrl = sitemapMatch[1].trim();
        console.log(`  Found sitemap reference: ${sitemapUrl} — fetching it ...`);
        const sitemapRes = await fetch(sitemapUrl, { headers: fullBrowserHeaders() });
        const sitemapText = await sitemapRes.text();
        const sitemapBlocked = isAkamaiBlockPage(sitemapText);
        console.log(`  sitemap status ${sitemapRes.status}, blocked: ${sitemapBlocked}, length: ${sitemapText.length}`);
        diagnostics.steps.push({ step: 'sitemap', url: sitemapUrl, httpStatus: sitemapRes.status, blocked: sitemapBlocked, bodyLength: sitemapText.length });

        if (!sitemapBlocked && sitemapRes.status === 200) {
          // Look for anything that looks like an individual store-page URL
          // (as opposed to a category/product page) to test as one sample.
          const storeUrlMatch = sitemapText.match(/https:\/\/www\.sunglasshut\.com\/uk\/[^<\s]*stores?[^<\s]*/i);
          if (storeUrlMatch) {
            const testStoreUrl = storeUrlMatch[0];
            console.log(`  Testing one candidate store-page URL from the sitemap: ${testStoreUrl}`);
            const storeRes = await fetch(testStoreUrl, {
              headers: fullBrowserHeaders({ Referer: HOMEPAGE_URL, ...(cookieHeader ? { Cookie: cookieHeader } : {}) }),
            });
            const storeHtml = await storeRes.text();
            const storeBlocked = isAkamaiBlockPage(storeHtml);
            console.log(`  store-page status ${storeRes.status}, blocked: ${storeBlocked}`);
            diagnostics.steps.push({ step: 'sample-store-page', url: testStoreUrl, httpStatus: storeRes.status, blocked: storeBlocked, bodyLength: storeHtml.length });
            if (!storeBlocked && storeRes.status === 200) {
              records = recordsFromPostcodeScan(storeHtml, testStoreUrl);
              method = records.length > 0 ? 'postcode_text_scan_via_sitemap_store_page' : 'sitemap_store_page_no_records';
              usedUrl = testStoreUrl;
              await writeFile(join(OUTPUT_DIR, 'sunglasshut.sample-store-page.raw.html'), storeHtml, 'utf-8');
            }
          } else {
            console.log('  No individual store-page URL pattern found in the sitemap (or sitemap is an index of other sitemaps — see the saved output for manual review).');
            diagnostics.sitemapExcerpt = sitemapText.slice(0, 3000);
          }
        }
      } else if (!sitemapMatch) {
        console.log('  No "Sitemap:" line found in robots.txt.');
      }
    } catch (err) {
      console.log(`  FAILED: ${err.message}`);
      diagnostics.steps.push({ step: 'robots.txt', url: ROBOTS_URL, error: err.message });
    }
  }

  const outputPath = join(OUTPUT_DIR, 'sunglasshut.json');
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        sourceUrl: usedUrl,
        fetchedAt: new Date().toISOString(),
        httpStatus: res.status,
        extractionMethod: method,
        recordCount: records.length,
        records,
        diagnostics,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`\nFound ${records.length} candidate record(s) via "${method}".`);
  console.log(`Saved: ${outputPath}`);
  console.log(`Also saved raw page HTML: ${rawPath}`);

  if (records.length === 0) {
    console.log(
      '\nAll plain-fetch strategies were blocked or unproductive. This looks like a genuine Akamai bot-management ' +
        'block on the store-locations path, not a fixable header/cookie issue — see 1b-fetch-sunglasshut-browser.mjs ' +
        'for a real-browser (Playwright) alternative, which is the realistic next step for this specific source.'
    );
  }

  console.log('\nPlease send back: scripts/ingest/output/sunglasshut.json and sunglasshut.raw.html (and sunglasshut.sample-store-page.raw.html if present).');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Fetch failed:', err.message);
    process.exit(1);
  });
}
