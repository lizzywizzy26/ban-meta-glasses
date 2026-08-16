// Tests for worker/src/index.js — specifically the rate-limit storage
// redesign (16 Aug 2026 pre-launch privacy fix): raw IPs are hashed before
// ever touching D1, and expired rows are swept automatically on every hit.
// Zero dependencies, Node's built-in test runner, consistent with
// geocode.test.mjs. Run with:
//   node --test worker/src/index.test.mjs
//
// D1 itself isn't available outside a Worker runtime, so these tests use a
// small in-memory fake that implements only the exact prepared statements
// index.js actually issues (see the FakeD1 class below) — this lets the
// real fetch() handler run unmodified, so what's tested is the real
// production logic, not a reimplementation of it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { hashRateLimitKey } from './index.js';

class FakeD1 {
  constructor() {
    this.counters = new Map([
      ['visit', 0],
      ['optician', 0],
      ['mp', 0],
      ['rayban', 0],
      ['retailer', 0],
      ['petition_click', 0],
      ['petition_share', 0],
      ['finder_search', 0],
      ['stockist_selected', 0],
      ['retailer_action_started', 0],
    ]);
    this.rateLimits = new Map(); // rl_key -> expires_at
  }

  _exec(sql, args) {
    if (sql.startsWith('DELETE FROM rate_limits WHERE expires_at < ?')) {
      const [now] = args;
      for (const [key, expires] of this.rateLimits.entries()) {
        if (expires < now) this.rateLimits.delete(key);
      }
      return { success: true };
    }
    if (sql.startsWith('UPDATE counters SET value = value + 1 WHERE name = ?')) {
      const [name] = args;
      this.counters.set(name, (this.counters.get(name) || 0) + 1);
      return { success: true };
    }
    if (sql.startsWith('INSERT INTO rate_limits')) {
      const [rlKey, expiresAt] = args;
      this.rateLimits.set(rlKey, expiresAt);
      return { success: true };
    }
    throw new Error('FakeD1: unsupported statement in _exec: ' + sql);
  }

  prepare(sql) {
    const db = this;
    // Real D1 statements support calling first()/run()/all() either
    // directly (no params) or after .bind(...) (with params) — index.js
    // uses both forms (e.g. plain .all() on the no-param counters query),
    // so this fake must support both too, not just the bound form.
    const withArgs = (args) => ({
      async first() {
        if (sql.startsWith('SELECT expires_at FROM rate_limits WHERE rl_key = ?')) {
          const [rlKey] = args;
          return db.rateLimits.has(rlKey) ? { expires_at: db.rateLimits.get(rlKey) } : null;
        }
        throw new Error('FakeD1: unsupported statement in first(): ' + sql);
      },
      async run() {
        return db._exec(sql, args);
      },
      async all() {
        if (sql === 'SELECT name, value FROM counters') {
          return { results: [...db.counters.entries()].map(([name, value]) => ({ name, value })) };
        }
        throw new Error('FakeD1: unsupported statement in all(): ' + sql);
      },
      _sql: sql,
      _args: args,
    });
    return {
      bind: (...args) => withArgs(args),
      first: (...args) => withArgs(args).first(),
      run: (...args) => withArgs(args).run(),
      all: (...args) => withArgs(args).all(),
    };
  }

  async batch(statements) {
    const out = [];
    for (const stmt of statements) out.push(await stmt.run());
    return out;
  }
}

function makeEnv() {
  return { DB: new FakeD1(), ALLOWED_ORIGINS: 'https://example.test' };
}

function hitRequest(type, ip) {
  return new Request('https://worker.test/api/hit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
      Origin: 'https://example.test',
    },
    body: JSON.stringify({ type }),
  });
}

test('hashRateLimitKey: deterministic, 64-char hex, and scoped by both type and IP', async () => {
  const a = await hashRateLimitKey('visit', '203.0.113.5');
  const b = await hashRateLimitKey('visit', '203.0.113.5');
  const c = await hashRateLimitKey('optician', '203.0.113.5');
  const d = await hashRateLimitKey('visit', '203.0.113.6');

  assert.equal(a, b, 'same type+ip must hash identically');
  assert.notEqual(a, c, 'different type must change the hash');
  assert.notEqual(a, d, 'different ip must change the hash');
  assert.match(a, /^[0-9a-f]{64}$/, 'must be a 64-char lowercase hex SHA-256 digest');
});

test('/api/hit: only the hashed key is ever written to rate_limits, never the raw IP', async () => {
  const env = makeEnv();
  const res = await worker.fetch(hitRequest('visit', '198.51.100.9'), env);
  assert.equal(res.status, 200);

  assert.equal(env.DB.rateLimits.size, 1);
  const [storedKey] = [...env.DB.rateLimits.keys()];
  assert.notEqual(storedKey, '198.51.100.9');
  assert.ok(!storedKey.includes('198.51.100.9'), 'stored key must not embed the raw IP as a substring');
  assert.equal(storedKey, await hashRateLimitKey('visit', '198.51.100.9'));
});

test('/api/hit: second hit from the same IP+type within cooldown is rate-limited, not double-counted', async () => {
  const env = makeEnv();
  const first = await worker.fetch(hitRequest('finder_search', '192.0.2.1'), env);
  const firstBody = await first.json();
  assert.equal(firstBody.limited, false);
  assert.equal(firstBody.counts.finder_search, 1);

  const second = await worker.fetch(hitRequest('finder_search', '192.0.2.1'), env);
  const secondBody = await second.json();
  assert.equal(secondBody.limited, true);
  assert.equal(secondBody.counts.finder_search, 1, 'count must not increment while rate-limited');
});

test('/api/hit: different counter type from the same IP is independent (own cooldown)', async () => {
  const env = makeEnv();
  await worker.fetch(hitRequest('optician', '192.0.2.1'), env);
  const res = await worker.fetch(hitRequest('mp', '192.0.2.1'), env);
  const body = await res.json();
  assert.equal(body.limited, false);
  assert.equal(body.counts.mp, 1);
});

test('/api/hit: automatic cleanup removes rows whose cooldown has already passed', async () => {
  const env = makeEnv();
  const longExpiredKey = await hashRateLimitKey('visit', '10.0.0.1');
  const notYetExpiredKey = await hashRateLimitKey('visit', '10.0.0.2');
  const now = Math.floor(Date.now() / 1000);
  env.DB.rateLimits.set(longExpiredKey, now - 10000); // expired long ago
  env.DB.rateLimits.set(notYetExpiredKey, now + 10000); // still active

  // Any hit — including one for an unrelated type/IP — sweeps expired rows.
  await worker.fetch(hitRequest('petition_click', '203.0.113.99'), env);

  assert.ok(!env.DB.rateLimits.has(longExpiredKey), 'expired row must be swept');
  assert.ok(env.DB.rateLimits.has(notYetExpiredKey), 'non-expired row must survive the sweep');
});

test('/api/hit: cleanup also runs on the rate-limited branch, not only when recording a new hit', async () => {
  const env = makeEnv();
  // Prime an active rate-limit for one IP/type...
  await worker.fetch(hitRequest('rayban', '172.16.0.1'), env);
  // ...and plant an unrelated already-expired row.
  const expiredKey = await hashRateLimitKey('mp', '172.16.0.2');
  const now = Math.floor(Date.now() / 1000);
  env.DB.rateLimits.set(expiredKey, now - 1);

  // Re-hit the same IP/type immediately — this takes the `limited` branch.
  const res = await worker.fetch(hitRequest('rayban', '172.16.0.1'), env);
  const body = await res.json();
  assert.equal(body.limited, true);
  assert.ok(!env.DB.rateLimits.has(expiredKey), 'expired row must be swept even on the limited branch');
});

test('/api/hit: no analytics or tracking fields (user agent, referrer, path history, etc.) are stored', async () => {
  const env = makeEnv();
  await worker.fetch(hitRequest('visit', '198.51.100.42'), env);
  for (const expiresAt of env.DB.rateLimits.values()) {
    assert.equal(typeof expiresAt, 'number', 'rate_limits rows must contain only a numeric expiry, nothing else');
  }
  // The only other table touched is the aggregate counters table, which
  // stores nothing per-visitor at all — just a running total per type.
  for (const value of env.DB.counters.values()) {
    assert.equal(typeof value, 'number');
  }
});
