// ============================================================================
// Bird Rebels: Ice Blaster — Cloudflare Worker (technical name "rebel-loon" kept for the Worker/bucket/DB, only the on-screen title changed)
//
// Routes:
//   GET  /loader.js, /engine.js, /styles.css   -> served automatically from
//                                                  ./public via the [assets]
//                                                  binding (see wrangler.toml)
//   GET  /api/characters                       -> character roster from D1
//   GET  /api/scenes                           -> scene roster from D1 (Standard/Rainbow Blizzard, more later)
//   GET  /characters/:filename                  -> proxies the PNG from R2
//   GET  /api/leaderboard?tier=easy|medium|hard&limit=20 -> {rows, total} for that tier, up to 1000 stored
//   POST /api/leaderboard  {initials,tier,score} -> submit a score
//
// Adding a new state bird later is just: upload STATE.png to the R2 bucket,
// then INSERT a row into the `characters` table (code/label/filename/
// sort_order). No redeploy needed — the game reads the roster live.
// ============================================================================

const TIERS = ['easy', 'medium', 'hard', 'easy-blizzard', 'medium-blizzard', 'hard-blizzard'];
const MAX_SCORE = 100000; // sanity ceiling, not a real gameplay cap
const LB_MAX = 1000;

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
async function getCharacters(url, env) {
  const device = url.searchParams.get('device');
  let ownedCodes = [];
  if (device) {
    const { results } = await env.CHARACTERS_DB.prepare(
      "SELECT item_code FROM entitlements WHERE device_id = ? AND item_type = 'rebel'"
    ).bind(device).all();
    ownedCodes = results.map((r) => r.item_code);
  }
  // Normally only visible=1 rebels show up. A hidden/special rebel (visible=0,
  // only obtainable via its own coupon) still needs to appear once a device
  // actually owns it — otherwise there'd be no way to ever select it.
  const placeholders = ownedCodes.map(() => '?').join(',');
  const sql = ownedCodes.length
    ? `SELECT code, label, filename, sort_order, primary_color, secondary_color, accent_color, laser_origin_x, laser_origin_y, visible, auto_unlock, price_cents FROM characters WHERE active = 1 AND (visible = 1 OR code IN (${placeholders})) ORDER BY sort_order ASC`
    : 'SELECT code, label, filename, sort_order, primary_color, secondary_color, accent_color, laser_origin_x, laser_origin_y, visible, auto_unlock, price_cents FROM characters WHERE active = 1 AND visible = 1 ORDER BY sort_order ASC';
  const stmt = ownedCodes.length
    ? env.CHARACTERS_DB.prepare(sql).bind(...ownedCodes)
    : env.CHARACTERS_DB.prepare(sql);
  const { results } = await stmt.all();
  const chars = results.map((r) => ({
    code: r.code,
    label: r.label,
    src: `/characters/${r.filename}`,
    // accentColor stays as the field name the game currently reads for all
    // visual roles (laser/bg/glow/tile) — it's sourced from primary_color
    // for now. secondaryColor/trueAccentColor are exposed too so the game
    // can start using them for specific roles once that's designed.
    accentColor: r.primary_color || null,
    primaryColor: r.primary_color || null,
    secondaryColor: r.secondary_color || null,
    trueAccentColor: r.accent_color || null,
    autoUnlock: !!r.auto_unlock,
    priceCents: r.price_cents || 0,
    laserOriginX: r.laser_origin_x != null ? r.laser_origin_x : null,
    laserOriginY: r.laser_origin_y != null ? r.laser_origin_y : null,
    visible: !!r.visible,
  }));
  return json(chars);
}

async function getScenes(url, env) {
  const device = url.searchParams.get('device');
  let ownedCodes = [];
  if (device) {
    const { results } = await env.CHARACTERS_DB.prepare(
      "SELECT item_code FROM entitlements WHERE device_id = ? AND item_type = 'scene'"
    ).bind(device).all();
    ownedCodes = results.map((r) => r.item_code);
  }
  // Same visibility rule as characters: a hidden/special scene (visible=0,
  // only obtainable via its own coupon) still needs to appear once a
  // device actually owns it, or there'd be no way to ever select it.
  const placeholders = ownedCodes.map(() => '?').join(',');
  const sql = ownedCodes.length
    ? `SELECT code, label, sort_order, primary_color, secondary_color, accent_color, visible, auto_unlock, price_cents FROM scenes WHERE active = 1 AND (visible = 1 OR code IN (${placeholders})) ORDER BY sort_order ASC`
    : 'SELECT code, label, sort_order, primary_color, secondary_color, accent_color, visible, auto_unlock, price_cents FROM scenes WHERE active = 1 AND visible = 1 ORDER BY sort_order ASC';
  const stmt = ownedCodes.length
    ? env.CHARACTERS_DB.prepare(sql).bind(...ownedCodes)
    : env.CHARACTERS_DB.prepare(sql);
  const { results } = await stmt.all();
  const scenes = results.map((r) => ({
    code: r.code,
    label: r.label,
    primaryColor: r.primary_color || null,
    secondaryColor: r.secondary_color || null,
    accentColor: r.accent_color || null,
    autoUnlock: !!r.auto_unlock,
    priceCents: r.price_cents || 0,
    visible: !!r.visible,
    // A scene is selectable right now if it's free-by-default OR the
    // requesting device already owns it. The client still needs this
    // computed server-side (not just autoUnlock) so a purchased scene
    // unlocks correctly without trusting the client's own state.
    unlocked: !!r.auto_unlock || ownedCodes.indexOf(r.code) !== -1,
  }));
  return json(scenes);
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
  if (!TIERS.includes(tier)) return json({ error: 'tier must be easy, medium, hard, easy-blizzard, medium-blizzard, or hard-blizzard' }, 400);
  const raw = await env.LEADERBOARD.get('board:' + tier);
  const arr = raw ? JSON.parse(raw) : [];
  // Optional limit so the client can request just the page it's about to
  // show (e.g. 20 rows) instead of always shipping the full up-to-1000-row
  // blob over the network just to render a paginated list. Omitted, every
  // stored row is returned (existing behavior, unaffected).
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.max(1, Math.min(LB_MAX, parseInt(limitParam, 10) || 0)) : null;
  const page = limit ? arr.slice(0, limit) : arr;
  return json({ rows: page, total: arr.length });
}

async function postLeaderboard(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'malformed request body' }, 400);
  }

  const tier = String((body && body.tier) || '').toLowerCase();
  if (!TIERS.includes(tier)) return json({ error: 'tier must be easy, medium, hard, easy-blizzard, medium-blizzard, or hard-blizzard' }, 400);

  const normalized = normalizeInitials(body && body.initials);
  if (normalized.length !== 3) return json({ error: 'initials must be exactly 3 letters' }, 400);
  if (isBadInitials(normalized)) return json({ error: 'those initials are not allowed' }, 400);

  const character = String((body && body.character) || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (!character) return json({ error: 'missing character code' }, 400);

  const score = Math.floor(Number(body && body.score));
  if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
    return json({ error: 'invalid score' }, 400);
  }

  let accuracy = Number(body && body.accuracy);
  if (!Number.isFinite(accuracy)) accuracy = 0;
  accuracy = Math.max(0, Math.min(1, accuracy));

  const key = 'board:' + tier;
  // Simple read-modify-write. KV is eventually consistent globally, but for a
  // low-traffic minigame leaderboard this is more than good enough — worst
  // case is a rare dropped entry under simultaneous submissions, not a
  // corrupted board.
  const raw = await env.LEADERBOARD.get(key);
  const arr = raw ? JSON.parse(raw) : [];
  const submittedTs = Date.now();
  arr.push({ initials: normalized, character, score, accuracy, ts: submittedTs });
  arr.sort((a, b) => b.score - a.score);
  const top = arr.slice(0, LB_MAX);
  await env.LEADERBOARD.put(key, JSON.stringify(top));

  return json({ ok: true, board: top, submittedTs });
}

// ---------------------------------------------------------------------------
// Entitlements — what a device owns, and how it got it (purchase or coupon).
// "device" is a random ID the app generates and stores locally the first
// time it runs — a lightweight stand-in for a real account until Play
// Games Services (or similar) gets wired in later.
// ---------------------------------------------------------------------------
async function getEntitlements(url, env) {
  const device = url.searchParams.get('device');
  if (!device) return json({ error: 'missing device' }, 400);
  const { results } = await env.CHARACTERS_DB.prepare(
    'SELECT item_type, item_code FROM entitlements WHERE device_id = ?'
  ).bind(device).all();
  return json(results.map((r) => ({ itemType: r.item_type, itemCode: r.item_code })));
}

// Placeholder purchase — mimics a real IAP flow (there's a confirm step in
// the UI) but doesn't actually charge anything yet. Swap this for real Play
// Billing server-side receipt validation later; the entitlements table and
// everything reading from it stays the same either way.
async function grantEntitlement(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'malformed request body' }, 400); }
  const device = String((body && body.device) || '');
  const itemType = String((body && body.itemType) || '');
  const itemCode = String((body && body.itemCode) || '');
  if (!device || !itemType || !itemCode) return json({ error: 'missing device, itemType, or itemCode' }, 400);

  await env.CHARACTERS_DB.prepare(
    'INSERT OR IGNORE INTO entitlements (device_id, item_type, item_code, source, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(device, itemType, itemCode, 'purchase', Date.now()).run();

  return json({ ok: true });
}

// Coupon redemption. A code can grant more than one item (bundle codes) —
// coupon_items holds one row per (coupon, item) pair. All granted items
// share the same coupon_code in entitlements, so it's traceable later.
async function loadValidCoupon(code, device, env) {
  const coupon = await env.CHARACTERS_DB.prepare(
    'SELECT code, grant_type, item_type, max_redemptions, max_redemptions_per_user, redemptions_used, expires_at, active FROM coupons WHERE code = ?'
  ).bind(code).first();
  if (!coupon) return { error: json({ error: 'That code isn\'t valid.' }, 404) };
  if (!coupon.active) return { error: json({ error: 'That code is no longer active.' }, 410) };
  if (coupon.expires_at && Date.now() > coupon.expires_at) return { error: json({ error: 'That code has expired.' }, 410) };
  // NULL max_redemptions / max_redemptions_per_user means unlimited on that axis.
  if (coupon.max_redemptions != null && coupon.redemptions_used >= coupon.max_redemptions) {
    return { error: json({ error: 'That code has already been fully redeemed.' }, 410) };
  }
  if (coupon.max_redemptions_per_user != null) {
    const row = await env.CHARACTERS_DB.prepare(
      'SELECT COUNT(*) as c FROM coupon_redemptions WHERE device_id = ? AND coupon_code = ?'
    ).bind(device, code).first();
    if ((row && row.c) >= coupon.max_redemptions_per_user) {
      return { error: json({ error: 'You\'ve already used this code the maximum number of times.' }, 410) };
    }
  }
  return { coupon };
}

async function recordRedemption(device, code, env) {
  await env.CHARACTERS_DB.prepare(
    'INSERT INTO coupon_redemptions (device_id, coupon_code, redeemed_at) VALUES (?, ?, ?)'
  ).bind(device, code, Date.now()).run();
  await env.CHARACTERS_DB.prepare(
    'UPDATE coupons SET redemptions_used = redemptions_used + 1 WHERE code = ?'
  ).bind(code).run();
}

// Rebels not already owned by this device — the eligible pool for an
// 'any_one' rebel coupon when it doesn't specify its own restricted pool.
async function unownedRebels(device, env) {
  const { results: owned } = await env.CHARACTERS_DB.prepare(
    "SELECT item_code FROM entitlements WHERE device_id = ? AND item_type = 'rebel'"
  ).bind(device).all();
  const ownedCodes = new Set(owned.map((r) => r.item_code));
  const { results: autoUnlocked } = await env.CHARACTERS_DB.prepare(
    'SELECT code FROM characters WHERE auto_unlock = 1'
  ).all();
  autoUnlocked.forEach((c) => ownedCodes.add(c.code)); // free-and-automatic birds are never offered as a "choice"
  const { results: chars } = await env.CHARACTERS_DB.prepare(
    'SELECT code, label FROM characters WHERE active = 1 AND visible = 1'
  ).all();
  return chars.filter((c) => !ownedCodes.has(c.code)).map((c) => ({ itemCode: c.code, label: c.label }));
}

async function redeemCoupon(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'malformed request body' }, 400); }
  const device = String((body && body.device) || '');
  const code = String((body && body.code) || '').trim().toUpperCase();
  if (!device || !code) return json({ error: 'missing device or code' }, 400);

  const { coupon, error } = await loadValidCoupon(code, device, env);
  if (error) return error;

  if (coupon.grant_type === 'any_one') {
    // Don't grant or consume a redemption yet — the client still needs to
    // show a picker and call /redeem-choice with what was picked.
    const { results: pool } = await env.CHARACTERS_DB.prepare(
      'SELECT item_code FROM coupon_items WHERE coupon_code = ?'
    ).bind(code).all();
    let options;
    if (pool.length && coupon.item_type === 'rebel') {
      const codes = pool.map((r) => r.item_code);
      const placeholders = codes.map(() => '?').join(',');
      const { results: chars } = await env.CHARACTERS_DB.prepare(
        `SELECT code, label FROM characters WHERE code IN (${placeholders})`
      ).bind(...codes).all();
      options = chars.map((c) => ({ itemCode: c.code, label: c.label }));
    } else if (coupon.item_type === 'rebel') {
      options = await unownedRebels(device, env);
    } else {
      options = []; // scenes/weapons: no content exists yet to choose from
    }
    return json({ ok: true, pick: true, itemType: coupon.item_type, options });
  }

  // 'exact' — one specific item, or a fixed bundle if there are several rows.
  const { results: items } = await env.CHARACTERS_DB.prepare(
    'SELECT item_type, item_code FROM coupon_items WHERE coupon_code = ?'
  ).bind(code).all();
  if (!items.length) return json({ error: 'That code has nothing attached to it.' }, 500);

  const now = Date.now();
  for (const item of items) {
    await env.CHARACTERS_DB.prepare(
      'INSERT OR IGNORE INTO entitlements (device_id, item_type, item_code, source, coupon_code, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(device, item.item_type, item.item_code, 'coupon', code, now).run();
  }
  await recordRedemption(device, code, env);

  return json({ ok: true, granted: items.map((i) => ({ itemType: i.item_type, itemCode: i.item_code })) });
}

// Second step for 'any_one' coupons — grants whichever single item the
// player picked from the options /redeem returned.
async function redeemCouponChoice(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'malformed request body' }, 400); }
  const device = String((body && body.device) || '');
  const code = String((body && body.code) || '').trim().toUpperCase();
  const itemCode = String((body && body.itemCode) || '');
  if (!device || !code || !itemCode) return json({ error: 'missing device, code, or itemCode' }, 400);

  const { coupon, error } = await loadValidCoupon(code, device, env);
  if (error) return error;
  if (coupon.grant_type !== 'any_one') return json({ error: 'That code doesn\'t work that way.' }, 400);

  // Re-validate the choice is actually eligible — don't just trust the client.
  const { results: pool } = await env.CHARACTERS_DB.prepare(
    'SELECT item_code FROM coupon_items WHERE coupon_code = ?'
  ).bind(code).all();
  if (pool.length) {
    if (!pool.some((r) => r.item_code === itemCode)) return json({ error: 'That item isn\'t part of this code.' }, 400);
  } else if (coupon.item_type === 'rebel') {
    const options = await unownedRebels(device, env);
    if (!options.some((o) => o.itemCode === itemCode)) return json({ error: 'That item isn\'t eligible.' }, 400);
  }

  await env.CHARACTERS_DB.prepare(
    'INSERT OR IGNORE INTO entitlements (device_id, item_type, item_code, source, coupon_code, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(device, coupon.item_type, itemCode, 'coupon', code, Date.now()).run();
  await recordRedemption(device, code, env);

  return json({ ok: true, granted: [{ itemType: coupon.item_type, itemCode: itemCode }] });
}


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (path === '/api/characters' && request.method === 'GET') {
      return getCharacters(url, env);
    }
    if (path === '/api/scenes' && request.method === 'GET') {
      return getScenes(url, env);
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
    if (path === '/api/entitlements' && request.method === 'GET') {
      return getEntitlements(url, env);
    }
    if (path === '/api/entitlements/grant' && request.method === 'POST') {
      return grantEntitlement(request, env);
    }
    if (path === '/api/entitlements/redeem' && request.method === 'POST') {
      return redeemCoupon(request, env);
    }
    if (path === '/api/entitlements/redeem-choice' && request.method === 'POST') {
      return redeemCouponChoice(request, env);
    }

    // Everything else (loader.js, engine.js, styles.css, fonts/*, sounds/*,
    // and anything unmatched) falls through to static assets in ./public.
    // The sound/font loaders pull these via fetch() (needed to decode audio
    // for the Web Audio API, and @font-face cross-origin loads enforce CORS
    // the same way), and fetch() enforces CORS even though a plain
    // <script src> or <img src> load wouldn't — so these need an explicit
    // Access-Control-Allow-Origin header, unlike loader.js/engine.js which
    // load fine without one.
    const assetResponse = await env.ASSETS.fetch(request);
    const response = new Response(assetResponse.body, assetResponse);
    response.headers.set('Access-Control-Allow-Origin', '*');
    // loader.js/engine.js/styles.css/fonts are the files most likely to be
    // requested from a fixed, unversioned URL while still changing — without
    // this, Cloudflare's edge cache (and browsers/WebViews) can keep serving
    // a stale cached copy for a while after a push. This bit us for real:
    // font files cached at the edge *before* the CORS header above existed
    // kept being served as cf-cache-status:HIT with no
    // Access-Control-Allow-Origin at all, breaking @font-face loads in the
    // Capacitor WebView even though the Worker code was already fixed.
    // Force revalidation on every load for these; everything else (sounds,
    // logo, character art via R2) keeps its normal caching since those
    // change far less often.
    if (path === '/loader.js' || path === '/engine.js' || path === '/styles.css' || path.startsWith('/fonts/')) {
      response.headers.set('Cache-Control', 'no-cache, must-revalidate');
    }
    return response;
  },
};
