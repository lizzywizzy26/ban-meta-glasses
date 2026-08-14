# Counters API (Cloudflare Worker + D1)

Backs the "campaign impact" counters on the site (site visits, and per-module
counts for optician emails, MP emails, Ray-Ban messages, petition shares).
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
4. Apply the schema (creates the tables and seeds the five counters at 0):
   ```
   wrangler d1 execute stop-meta-glasses-db --remote --file=./schema.sql
   ```
5. Deploy the Worker:
   ```
   wrangler deploy
   ```
   Wrangler prints the live URL, something like:
   `https://stop-meta-glasses-counters.<your-subdomain>.workers.dev`
6. Open `../js/stats.js` in the main site and set `API_BASE_URL` to that URL
   (see the constant at the top of the file).
7. Check `ALLOWED_ORIGINS` in `wrangler.toml` matches where the site is
   actually hosted (your GitHub Pages URL, and any custom domain you add
   later), then redeploy (`wrangler deploy`) if you change it.

## API

- `GET /api/stats` → `{ "visit": 12, "optician": 3, "mp": 1, "rayban": 2, "retailer": 4, "petition_click": 5, "petition_share": 0 }`
- `POST /api/hit` with JSON body `{ "type": "optician" }` (type is one of
  `visit`, `optician`, `mp`, `rayban`, `retailer`, `petition_click`, `petition_share`) → increments that
  counter unless the calling IP is still within its cooldown window for that
  type, then returns the current counts either way.

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
