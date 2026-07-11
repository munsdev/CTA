// ============================================================================
// Bird Rebels: Ice Blaster — Cloudflare Worker (technical name "rebel-loon" kept for the Worker/bucket/DB, only the on-screen title changed)
//
// Routes:
//   GET  /loader.js, /engine.js, /styles.css   -> served automatically from
//                                                  ./public via the [assets]
//                                                  binding (see wrangler.toml)
//   GET  /api/characters                       -> character roster from D1
//   GET  /characters/:filename                  -> proxies the PNG from R2
//   GET  /api/leaderboard?tier=easy|medium|hard -> top 10 for that tier
//   POST /api/leaderboard  {initials,tier,score} -> submit a score
//
// Adding a new state bird later is just: upload STATE.png to the R2 bucket,
// then INSERT a row into the `characters` table (code/label/filename/
// sort_order). No redeploy needed — the game reads the roster live.
// ============================================================================

const TIERS = ['easy', 'medium', 'hard'];
const MAX_SCORE = 100000; // sanity ceiling, not a real gameplay cap
const LB_MAX = 10;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

// ---------------------------------------------------------------------------
// Bad-word filter for 3-letter initials.
// Normalizes common leetspeak substitutions, then checks against a starter
// blocklist. This is intentionally a small, easy-to-extend seed list rather
// than an exhaustive dictionary — add to BAD_WORDS as you see real submissions
// you want to block, or swap in a fuller wordlist package if you want broader
// coverage later.
// ---------------------------------------------------------------------------
const LEET_MAP = { '4': 'A', '@': 'A', '3': 'E', '1': 'I', '!': 'I', '0': 'O', '5': 'S', '$': 'S', '7': 'T' };

function normalizeInitials(raw) {
  return String(raw || '')
    .split('')
    .map((ch) => LEET_MAP[ch] || ch)
    .join('')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

const BAD_WORDS = new Set([
  'ASS', 'FUK', 'FUC', 'FCK', 'SHT', 'CUM', 'CNT', 'DIC', 'DIK', 'PIS',
  'SOB', 'WOP', 'KKK', 'SUX', 'SEX', 'BUM', 'TWT', 'JIZ', 'COC', 'COK',
]);

function isBadInitials(normalized) {
  if (BAD_WORDS.has(normalized)) return true;
  // catch common 3-char slices of longer flagged roots, e.g. leet-mangled
  // strings that normalize down to a bad 3-letter core.
  for (const w of BAD_WORDS) {
    if (normalized.includes(w)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
async function getCharacters(env) {
  const { results } = await env.CHARACTERS_DB.prepare(
    'SELECT code, label, filename, sort_order, accent_color FROM characters WHERE active = 1 ORDER BY sort_order ASC'
  ).all();
  const chars = results.map((r) => ({
    code: r.code,
    label: r.label,
    src: `/characters/${r.filename}`,
    accentColor: r.accent_color || null,
  }));
  return json(chars);
}

async function getCharacterImage(pathname, env) {
  const filename = decodeURIComponent(pathname.replace('/characters/', ''));
  if (!/^[A-Za-z0-9_-]+\.(png|webp|jpg|jpeg)$/.test(filename)) {
    return new Response('Bad filename', { status: 400 });
  }
  const obj = await env.CHAR_ASSETS.get(filename);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=86400');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(obj.body, { headers });
}

async function getLeaderboard(url, env) {
  const tier = (url.searchParams.get('tier') || 'easy').toLowerCase();
  if (!TIERS.includes(tier)) return json({ error: 'tier must be easy, medium, or hard' }, 400);
  const raw = await env.LEADERBOARD.get('board:' + tier);
  const arr = raw ? JSON.parse(raw) : [];
  return json(arr);
}

async function postLeaderboard(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'malformed request body' }, 400);
  }

  const tier = String((body && body.tier) || '').toLowerCase();
  if (!TIERS.includes(tier)) return json({ error: 'tier must be easy, medium, or hard' }, 400);

  const normalized = normalizeInitials(body && body.initials);
  if (normalized.length !== 3) return json({ error: 'initials must be exactly 3 letters' }, 400);
  if (isBadInitials(normalized)) return json({ error: 'those initials are not allowed' }, 400);

  const character = String((body && body.character) || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (!character) return json({ error: 'missing character code' }, 400);

  const score = Math.floor(Number(body && body.score));
  if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
    return json({ error: 'invalid score' }, 400);
  }

  const key = 'board:' + tier;
  // Simple read-modify-write. KV is eventually consistent globally, but for a
  // low-traffic minigame leaderboard this is more than good enough — worst
  // case is a rare dropped entry under simultaneous submissions, not a
  // corrupted board.
  const raw = await env.LEADERBOARD.get(key);
  const arr = raw ? JSON.parse(raw) : [];
  arr.push({ initials: normalized, character, score, ts: Date.now() });
  arr.sort((a, b) => b.score - a.score);
  const top = arr.slice(0, LB_MAX);
  await env.LEADERBOARD.put(key, JSON.stringify(top));

  return json({ ok: true, board: top });
}

// ---------------------------------------------------------------------------
// Fetch handler
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (path === '/api/characters' && request.method === 'GET') {
      return getCharacters(env);
    }
    if (path.startsWith('/characters/') && request.method === 'GET') {
      return getCharacterImage(path, env);
    }
    if (path === '/api/leaderboard' && request.method === 'GET') {
      return getLeaderboard(url, env);
    }
    if (path === '/api/leaderboard' && request.method === 'POST') {
      return postLeaderboard(request, env);
    }

    // Everything else (loader.js, engine.js, styles.css, sounds/*, and
    // anything unmatched) falls through to static assets in ./public.
    // The sound loader pulls these via fetch() (needed to decode them for
    // the Web Audio API), and fetch() enforces CORS even though a plain
    // <script src> or <img src> load wouldn't — so these need an explicit
    // Access-Control-Allow-Origin header, unlike loader.js/engine.js which
    // load fine without one.
    const assetResponse = await env.ASSETS.fetch(request);
    const response = new Response(assetResponse.body, assetResponse);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  },
};
