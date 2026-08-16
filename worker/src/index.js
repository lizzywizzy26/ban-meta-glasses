import { handleStockistsRequest } from './stockists.js';

const COUNTER_TYPES = new Set([
  'visit',
  'optician',
  'mp',
  'rayban',
  'retailer',
  'petition_click',
  'petition_share',
  'finder_search',
  'stockist_selected',
  'retailer_action_started',
]);

// How long (seconds) a single IP is locked out from re-incrementing a given
// counter. This is the main anti-inflation safeguard — it's not bulletproof
// (shared/rotating IPs exist), but it stops naive repeat-clicking or a basic
// script loop from trivially padding the numbers.
const COOLDOWN_SECONDS = {
  visit: 1800,           // 30 min — refreshing the page doesn't re-count as a new visitor
  optician: 21600,       // 6 hours — allows emailing a couple of different opticians in one sitting
  mp: 21600,
  rayban: 21600,
  retailer: 21600,       // 6 hours — allows messaging a couple of different retailers in one sitting
  petition_click: 3600,  // 1 hour — clicking through to the petition
  petition_share: 3600,  // 1 hour — copying the share text
  finder_search: 300,    // 5 min — a supporter may reasonably search a couple of postcodes
  stockist_selected: 300,
  retailer_action_started: 21600, // same as the other "started a message" actions — this is NOT "email sent"
};

function corsHeaders(origin, allowedOrigins) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
  if (allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

async function getAllCounts(db) {
  const { results } = await db.prepare('SELECT name, value FROM counters').all();
  const out = {};
  for (const row of results) out[row.name] = row.value;
  return out;
}

function json(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

// Data minimisation for rate-limiting (added 16 Aug 2026, pre-launch privacy
// fix): the raw visitor IP is never written to D1. It's hashed (SHA-256,
// with a fixed app-level string mixed in — not a true secret in an
// open-source repo, but enough that the stored value isn't a bare
// SHA256(ip) a casual reader could rainbow-table against a precomputed
// IPv4 hash list) together with the counter `type`, so the stored key is a
// one-way pseudonym scoped to that one action type, not a reusable
// fingerprint across the whole rate_limits table. Exported so the test
// file can verify its properties directly.
const RATE_LIMIT_PEPPER = 'stop-meta-glasses-rate-limit-v1';

export async function hashRateLimitKey(type, ip) {
  const data = new TextEncoder().encode(`${RATE_LIMIT_PEPPER}:${type}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedOrigins = (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, allowedOrigins);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/api/stats' && request.method === 'GET') {
      const counts = await getAllCounts(env.DB);
      return json(counts, 200, cors);
    }

    if (url.pathname === '/api/stockists' && request.method === 'GET') {
      const { status, body } = await handleStockistsRequest(url, env);
      return json(body, status, cors);
    }

    if (url.pathname === '/api/hit' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid json' }, 400, cors);
      }

      const type = body && body.type;
      if (!COUNTER_TYPES.has(type)) {
        return json({ error: 'invalid type' }, 400, cors);
      }

      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const rlKey = await hashRateLimitKey(type, ip);
      const now = Math.floor(Date.now() / 1000);

      // Automatic cleanup: every hit (limited or not) sweeps out rows whose
      // cooldown has already passed, so the table can never accumulate
      // indefinitely — a row's real-world lifetime is bounded by its own
      // cooldown (5 min–6 hours depending on type, see COOLDOWN_SECONDS),
      // not "until someone remembers to clear it." No separate cron/
      // scheduled trigger needed: as long as the site gets any traffic at
      // all, expired rows get swept promptly; the accumulation risk is
      // otherwise bounded by real traffic volume, which is what's actually
      // driving new rows to exist in the first place.
      const cleanup = env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now);

      const existing = await env.DB.prepare('SELECT expires_at FROM rate_limits WHERE rl_key = ?')
        .bind(rlKey)
        .first();

      let limited = false;
      if (existing && existing.expires_at > now) {
        limited = true;
        await cleanup.run();
      } else {
        const cooldown = COOLDOWN_SECONDS[type] || 3600;
        await env.DB.batch([
          cleanup,
          env.DB.prepare('UPDATE counters SET value = value + 1 WHERE name = ?').bind(type),
          env.DB.prepare(
            'INSERT INTO rate_limits (rl_key, expires_at) VALUES (?, ?) ON CONFLICT(rl_key) DO UPDATE SET expires_at = excluded.expires_at'
          ).bind(rlKey, now + cooldown),
        ]);
      }

      const counts = await getAllCounts(env.DB);
      return json({ ok: true, limited, counts }, 200, cors);
    }

    return new Response('Not found', { status: 404, headers: cors });
  },
};
