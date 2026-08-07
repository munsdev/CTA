// Bird Rebels: Storm Watch — multiplayer worker
// Serves the static client (via the ASSETS binding) and a small JSON API
// backed by D1. Games are full-state JSON blobs; last write wins. A nightly
// cron deletes any game untouched for 7+ days.

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const J = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (url.pathname.startsWith('/api/')) {
      try {
        return await api(request, env, url);
      } catch (err) {
        return J({ error: String(err && err.message || err) }, 500);
      }
    }

    // Everything else: static assets (the game client).
    return env.ASSETS.fetch(request);
  },

  // Nightly cleanup of stale games.
  async scheduled(event, env) {
    const cutoff = Date.now() - SEVEN_DAYS;
    await env.DB.prepare('DELETE FROM games WHERE updated_at < ?').bind(cutoff).run();
  },
};

async function api(request, env, url) {
  const parts = url.pathname.replace(/^\/api\//, '').split('/').filter(Boolean);
  const now = Date.now();

  // ── /api/games ─────────────────────────────────────────────
  if (parts[0] === 'games' && parts.length === 1) {
    // Create a new game.
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const pc = Math.min(4, Math.max(1, parseInt(body.playerCount, 10) || 2));
      const state = body.state || {};

      let id = null;
      for (let i = 0; i < 10; i++) {
        const candidate = String(Math.floor(100000 + Math.random() * 900000));
        const exists = await env.DB.prepare('SELECT id FROM games WHERE id = ?').bind(candidate).first();
        if (!exists) { id = candidate; break; }
      }
      if (!id) return J({ error: 'could not allocate game id' }, 500);

      await env.DB.prepare(
        'INSERT INTO games (id, player_count, state, rev, created_at, updated_at) VALUES (?,?,?,?,?,?)'
      ).bind(id, pc, JSON.stringify(state), 1, now, now).run();

      return J({ id, playerCount: pc, rev: 1 });
    }

    // List games (admin directory).
    if (request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT id, player_count, created_at, updated_at FROM games ORDER BY updated_at DESC LIMIT 200'
      ).all();
      return J({
        games: (results || []).map(r => ({
          id: r.id,
          playerCount: r.player_count,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      });
    }
  }

  // ── /api/games/:id ─────────────────────────────────────────
  if (parts[0] === 'games' && parts.length === 2) {
    const id = parts[1];

    if (request.method === 'GET') {
      const row = await env.DB.prepare(
        'SELECT id, player_count, state, rev, updated_at FROM games WHERE id = ?'
      ).bind(id).first();
      if (!row) return J({ error: 'not found' }, 404);
      return J({
        id: row.id,
        playerCount: row.player_count,
        state: JSON.parse(row.state),
        rev: row.rev,
        updatedAt: row.updated_at,
      });
    }

    if (request.method === 'PUT') {
      const body = await request.json().catch(() => ({}));
      if (!body.state) return J({ error: 'missing state' }, 400);
      const row = await env.DB.prepare('SELECT rev FROM games WHERE id = ?').bind(id).first();
      if (!row) return J({ error: 'not found' }, 404);
      const rev = (row.rev || 0) + 1;
      await env.DB.prepare('UPDATE games SET state = ?, rev = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(body.state), rev, now, id).run();
      return J({ rev, updatedAt: now });
    }

    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM games WHERE id = ?').bind(id).run();
      return J({ deleted: true });
    }
  }

  return J({ error: 'bad request' }, 400);
}
