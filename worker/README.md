# Worker + D1 backend

Powers two things on the site — both optional, both degrade gracefully if
this isn't deployed:

1. **The postcode finder** (`/api/stockists`) — the campaign-impact
   counters' database was extended with a `stockists` table (see
   `schema.sql`) holding verified sellers. See `../scripts/ingest/README.md`
   for how data gets into it. Without this deployed, the finder shows a
   "search is being set up" message; the rest of the site works normally.
2. **The "campaign impact" counters** (`/api/stats`, `/api/hit`) — site
   visits, and per-module counts for optician/MP/Ray-Ban/retailer messages,
   finder searches, and petition clicks/shares.

Runs on Cloudflare's free tier — no cost to deploy or run at this site's
expected traffic.

Why a real backend instead of a free public counter API: this data may get
cited by journalists, and open/unauthenticated counter APIs can be trivially
inflated by anyone hitting the increment endpoint. This Worker rate-limits
each counter by IP (see `COOLDOWN_SECONDS` in `src/index.js`) so a single
visitor or basic script can't casually pad the numbers. It's not bulletproof
(shared or rotating IPs exist), but it's a meaningfully higher bar, and the
method is fully visible in this code if anyone asks how the numbers are
produced.

### What's stored, and for how long (privacy)

The rate-limiter needs *some* way to recognise "this same visitor already
hit this counter recently," but it's built to keep the minimum possible
data to do that, for the minimum possible time:

- **No raw IP address is ever written to the database.** `src/index.js`
  reads the visitor's IP from `CF-Connecting-IP`, then immediately hashes
  it (SHA-256, `hashRateLimitKey()`) together with the counter `type` and a
  fixed app-level string. The `rate_limits` table only ever stores that
  64-character hex digest — a one-way pseudonym scoped to one action type,
  not a reusable fingerprint, and not reversible back to the IP. Nothing
  else about the request (user agent, path, referrer, etc.) is stored at
  all.
- **Retention is short and bounded by the row's own purpose**, not
  indefinite: each row's `expires_at` is set to the same cooldown already
  used to decide the rate limit for that counter `type` — 5 minutes
  (`finder_search`, `stockist_selected`) up to 6 hours (`optician`, `mp`,
  `rayban`, `retailer`, `retailer_action_started`); see
  `COOLDOWN_SECONDS` in `src/index.js` for the exact figure per type. Once
  a row's cooldown has passed it no longer serves the purpose it was
  created for.
- **Automatic cleanup, no cron needed:** every single `/api/hit` request —
  whether it's the one being rate-limited or a fresh one being recorded —
  runs `DELETE FROM rate_limits WHERE expires_at < ?` first. So expired
  rows get swept as an ordinary side effect of real traffic, and the table
  can't silently grow without bound between deploys. This is tested in
  `src/index.test.mjs`.
- **No analytics or behavioural tracking** is built on top of this table —
  it exists solely to answer "is this IP+type combination still within its
  cooldown," and is never queried for anything else (no per-visitor
  history, no session reconstruction, no cross-counter linking).

## One-time setup

You'll need a free Cloudflare account (no credit card required for this).

1. Install Wrangler (Cloudflare's CLI), if you don't have it:
   ```
   npm install -g wrangler
   ```
2. Log in:
   ```
   wrangler login
   ```
   This opens a browser to authorize the CLI against your Cloudflare account.
3. From this `worker/` directory, create the D1 database:
   ```
   wrangler d1 create stop-meta-glasses-db
   ```
   This prints a `database_id`. Copy it into `wrangler.toml`, replacing
   `REPLACE_WITH_YOUR_DATABASE_ID`.
4. Apply the schema (creates the counters, rate_limits, and stockists
   tables — the stockists table starts empty, see
   `../scripts/ingest/README.md` to populate it):
   ```
   wrangler d1 execute stop-meta-glasses-db --remote --file=./schema.sql
   ```
5. Deploy the Worker:
   ```
   wrangler deploy
   ```
   Wrangler prints the live URL, something like:
   `https://stop-meta-glasses-counters.<your-subdomain>.workers.dev`
6. Open `../js/config.js` in the main site and set `window.API_BASE_URL` to
   that URL — this single value drives both the finder and the counters.
7. Check `ALLOWED_ORIGINS` in `wrangler.toml` matches where the site is
   actually hosted (your GitHub Pages URL, and any custom domain you add
   later), then redeploy (`wrangler deploy`) if you change it.

## API

- `GET /api/stockists?postcode=SW1A1AA` → nearest verified sellers, sorted
  by distance, progressively expanding the search radius (10 → 25 → 50
  miles) until something is found or all three are exhausted. Only
  `verification_status = 'verified_branch'` rows are ever returned — see
  `src/stockists.js` and `schema.sql`'s verification model. Response shape
  is documented in `src/stockists.js`'s `shapeResult()`. On an
  unrecognisable postcode or a temporarily-unreachable postcode lookup, it
  still returns HTTP 200 with `results: []` and a `reason` +
  human-readable `message` field, rather than erroring — the frontend
  fails gracefully either way (see `../js/finder.js`).
  - Despite the param name (`postcode`, kept for backward compatibility),
    this now also accepts an **Ireland town/city name** in the same field
    (e.g. `?postcode=Cork`) — see "Ireland support" below. `geocodeQuery()`
    in `src/geocode.js` auto-detects which kind of input it's looking at
    and scopes the D1 query to the matching `country` so UK and Ireland
    results never mix in one response.

### Ireland support (added 16 Aug 2026)

Ireland is supported at **town/city precision only**, not exact Eircode —
see `src/geocode.js`'s "Ireland support" section for the full reasoning.
In short: free Eircode-capable geocoders (Nominatim/OSM) were found to have
unreliable coverage, and this campaign's principle is "verified or don't
show it," not "best guess." A real Eircode-shaped input gets a specific
`reason: "eircode_not_supported"` response (message: try your town/city
instead) rather than being silently mishandled. `IRELAND_TOWN_COORDS` in
`src/geocode.js` is a small fixed table of real town/city centroids —
extend it as real stockist branches turn up in towns not yet on the list.

The `stockists` table gained a `country` column (`UK` | `IE`, default
`UK`). **If your D1 database was created before this change**, run the
one-off migration once:
```
wrangler d1 execute stop-meta-glasses-db --remote --file=./migrate-add-country.sql
```
A brand-new database doesn't need this — `schema.sql` already creates the
column from the start.
- `GET /api/stats` → `{ "visit": 12, "optician": 3, "mp": 1, "rayban": 2, "retailer": 4, "petition_click": 5, "petition_share": 0, "finder_search": 0, "stockist_selected": 0, "retailer_action_started": 0 }`
- `POST /api/hit` with JSON body `{ "type": "optician" }` (type is one of
  `visit`, `optician`, `mp`, `rayban`, `retailer`, `petition_click`,
  `petition_share`, `finder_search`, `stockist_selected`,
  `retailer_action_started`) → increments that counter unless the calling
  IP is still within its cooldown window for that type, then returns the
  current counts either way. Note `retailer_action_started` means exactly
  that — a supporter started a message (copied it, or opened a contact
  channel) — never conflate this with a confirmed email actually sent.

## Local development without live network access

`src/geocode.js` (shared with the ingestion scripts in `../scripts/ingest/`)
calls the real `postcodes.io` API by default. Passing the Worker var
`MOCK_GEOCODER=1` — e.g. `wrangler dev --local --var MOCK_GEOCODER:1` —
swaps in a small fixed lookup table instead, for testing in environments
without outbound network access. **Never set `MOCK_GEOCODER` in the real
deployed Worker's vars** — it must only ever be used for local dev/testing.

## Tests

`src/geocode.test.mjs` covers the postcode/Eircode/Irish-town detection
logic in `geocode.js` — zero dependencies, uses Node's built-in test
runner (Node 18+):
```
node --test src/geocode.test.mjs
```
Includes a regression test for a real bug found during the 16 Aug 2026
deployment audit: a UK postcode typed without a space (e.g. `SW1A1AA`)
could be misidentified as an Irish Eircode and rejected, because the
Eircode shape check ran before the UK postcode check. Fixed by checking
the UK postcode shape first — an unambiguous match there now always wins.

`src/index.test.mjs` covers the rate-limit storage redesign described
above — IP hashing, cooldown-scoped expiry, and automatic cleanup —
against a small in-memory fake D1 (real D1 only runs inside a Worker, so
the fake implements just the specific prepared statements `index.js`
issues, letting the real `fetch()` handler run unmodified):
```
node --test src/index.test.mjs
```

## Limits to know about

- Cloudflare D1 free tier: 5M rows read/day, 100k rows written/day, 5GB
  storage. Each hit is roughly 2-3 row operations, so this comfortably
  supports tens of thousands of genuine interactions per day — if the
  campaign goes properly viral, upgrade to the $5/mo Workers Paid plan for
  much higher D1 limits.
- Workers free tier: 100,000 requests/day. Same headroom note applies.
- The rate-limiting is per-IP. It undercounts distinct visitors behind a
  shared IP (e.g. an office or a school), and it's not proof against a
  motivated attacker rotating IPs — treat the numbers as "engaged
  interactions, lightly abuse-resisted," not cryptographically verified
  totals, if asked how they were produced.
