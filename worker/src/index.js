const COUNTER_TYPES = new Set(['visit', 'optician', 'mp', 'rayban', 'petition_click', 'petition_share']);

// How long (seconds) a single IP is locked out from re-incrementing a given
// counter. This is the main anti-inflation safeguard — it's not bulletproof
// (shared/rotating IPs exist), but it stops naive repeat-clicking or a basic
// script loop from trivially padding the numbers.
const COOLDOWN_SECONDS = {
  visit: 1800,           // 30 min — refreshing the page doesn't re-count as a new visitor
  optician: 21600,       // 6 hours — allows emailing a couple of different opticians in one sitting
  mp: 21600,
  rayban: 21600,
  petition_click: 3600,  // 1 hour — clicking through to the petition
  petition_share: 3600,  // 1 hour — copying the share text
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
      const rlKey = `${type}:${ip}`;
      const now = Math.floor(Date.now() / 1000);

      const existing = await env.DB.prepare('SELECT expires_at FROM rate_limits WHERE rl_key = ?')
        .bind(rlKey)
        .first();

      let limited = false;
      if (existing && existing.expires_at > now) {
        limited = true;
      } else {
        const cooldown = COOLDOWN_SECONDS[type] || 3600;
        await env.DB.batch([
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
