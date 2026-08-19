# Beta testing log — known fixes

Running record of bugs found during public beta and how they were resolved,
so the same issue doesn't get re-investigated from scratch later. Newest
entries first.

---

## RESOLVED — Stockist finder failing for all live users ("Search is temporarily unavailable")

**Reported:** 19 Aug 2026, via beta testers on `bansmartglasses.com`.
**Symptom:** The postcode/town finder on the homepage always failed with
"Search is temporarily unavailable — please try again shortly, or use the
actions below in the meantime," for every query, on the live custom domain.

**Root cause:** CORS. The deployed Cloudflare Worker
(`stop-meta-glasses-counters`) restricts which origins may call its API via
an `ALLOWED_ORIGINS` environment variable. That variable was still set to:

```
https://lizzywizzy26.github.io,http://localhost:8000
```

`bansmartglasses.com` was connected as a custom domain after the Worker was
first deployed, and `ALLOWED_ORIGINS` was never updated to include it. Every
request from the live site therefore had its response blocked by the
browser's CORS policy, which the frontend's generic error handling
surfaced as a plain "temporarily unavailable" message — not a database or
backend outage.

**Fix:** Campaign owner updated the live Worker's `ALLOWED_ORIGINS`
variable via the Cloudflare dashboard (Workers & Pages →
`stop-meta-glasses-counters` → Settings → Variables) to add:

```
https://bansmartglasses.com
https://www.bansmartglasses.com
```

alongside the existing entries. No redeploy was needed — dashboard-edited
variables take effect immediately.

**Repo-side change:** `worker/wrangler.toml`'s `ALLOWED_ORIGINS` default was
also updated to match (commit `a052dd9`, extended for the `www` subdomain
in a follow-up commit), so a future `wrangler deploy` from this file
wouldn't silently regress the fix. This file alone does not affect the
already-running Worker — only the Cloudflare dashboard variable (or an
actual `wrangler deploy`) does.

**Verified:** Campaign owner tested live in a fresh incognito window with
postcode `CT2 7EP` — results returned correctly.

**Status: closed.** No further finder/search/database/error-handling/UI
changes are needed for this issue. If a *different* finder problem shows up
during beta testing, treat it as a new bug — don't assume it's this one
recurring.
