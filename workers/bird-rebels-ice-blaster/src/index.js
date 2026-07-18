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
//   POST /api/purchases/verify  {device,itemType,itemCode,productId,purchaseToken}
//        -> real Play Billing path: verifies purchaseToken against Google's
//           Play Developer API before granting an entitlement. Requires
//           GOOGLE_SERVICE_ACCOUNT_JSON (a service account key with the
//           androidpublisher scope) set as a Worker secret.
//   POST /api/auth/google  {idToken} -> verifies a Google Sign-In ID token
//        server-side (signature, audience, issuer, expiry) and returns a
//        stable per-account identity ('goog_' + the token's sub claim).
//        Requires GOOGLE_SIGNIN_CLIENT_ID (the OAuth web client ID from
//        Google Cloud Console) set as a Worker secret/var. The returned ID
//        is meant to replace the client's local device_id going forward —
//        no schema change needed, since entitlements.device_id is a plain
//        TEXT column with no format requirement.
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
    ? `SELECT code, label, filename, sort_order, primary_color, secondary_color, accent_color, laser_origin_x, laser_origin_y, visible, auto_unlock, price_cents, is_purchasable FROM characters WHERE active = 1 AND (visible = 1 OR code IN (${placeholders})) ORDER BY sort_order ASC`
    : 'SELECT code, label, filename, sort_order, primary_color, secondary_color, accent_color, laser_origin_x, laser_origin_y, visible, auto_unlock, price_cents, is_purchasable FROM characters WHERE active = 1 AND visible = 1 ORDER BY sort_order ASC';
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
    // Only true once this bird's bird_<code> product has actually been
    // created and activated in Play Console — the shop uses this to decide
    // what to query getProducts() for. A bird can be fully playable/owned
    // without this ever being set (coupon/auto-unlock birds, for example).
    isPurchasable: !!r.is_purchasable,
  }));
  return json(chars);
}

// ---------- Google Sign-In verification ----------
// Same reasoning as the Play Billing verification below: a client can send
// any string it wants as a "user ID", so the ID token itself has to be
// checked against Google directly before trusting it for anything. Per
// Google's own documented checklist (only the 'sub' claim is safe to use
// as a stable identifier — never email, which can change).

var cachedGoogleJwks = null; // { keys, fetchedAt } — cached across requests within the same Worker isolate
async function getGoogleJwks() {
  const now = Date.now();
  if (cachedGoogleJwks && now - cachedGoogleJwks.fetchedAt < 3600000) return cachedGoogleJwks.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new Error('failed to fetch Google JWKS');
  const data = await res.json();
  cachedGoogleJwks = { keys: data.keys, fetchedAt: now };
  return data.keys;
}

function base64UrlDecodeBytes(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function base64UrlDecodeToString(str) {
  return new TextDecoder().decode(base64UrlDecodeBytes(str));
}

// Returns the verified 'sub' claim (Google's stable per-account user ID) on
// success, or null if the token fails any check — expired, wrong audience,
// wrong issuer, bad signature, or any other problem talking to Google.
async function verifyGoogleIdToken(env, idToken) {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(base64UrlDecodeToString(parts[0]));
    const payload = JSON.parse(base64UrlDecodeToString(parts[1]));
    const signature = base64UrlDecodeBytes(parts[2]);
    const signedData = new TextEncoder().encode(parts[0] + '.' + parts[1]);

    const keys = await getGoogleJwks();
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const validSignature = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signedData);
    if (!validSignature) return null;

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return null;
    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') return null;
    if (!env.GOOGLE_SIGNIN_CLIENT_ID || payload.aud !== env.GOOGLE_SIGNIN_CLIENT_ID) return null;
    if (!payload.sub) return null;

    return payload.sub;
  } catch (e) {
    return null;
  }
}

async function signInWithGoogle(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'malformed request body' }, 400); }
  const idToken = String((body && body.idToken) || '');
  if (!idToken) return json({ error: 'missing idToken' }, 400);

  const sub = await verifyGoogleIdToken(env, idToken);
  if (!sub) return json({ ok: false, error: 'token_not_verified' }, 401);

  // The verified 'sub' becomes this account's identity going forward — the
  // client swaps its local device_id for this value, and everything
  // downstream (entitlements, leaderboard, etc.) keeps working unchanged
  // since device_id is just a TEXT key with no format requirement.
  return json({ ok: true, userId: 'goog_' + sub });
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

  const device = String((body && body.device) || '');
  const signInError = requireSignedIn(device);
  if (signInError) return signInError;

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

// ---------- Google Play purchase verification ----------
// Runs entirely on Web Crypto (crypto.subtle) — no npm dependency needed,
// since Cloudflare Workers don't support Node's built-in `crypto` module.
// This signs a service-account JWT, trades it for a short-lived OAuth
// access token, then calls the Google Play Developer API to confirm a
// purchase token is real. A purchaseToken handed up by the client can't be
// trusted on its own (it's just a string — a modified client could send a
// fabricated one), so this server-side round trip to Google is the actual
// security boundary before any entitlement gets granted for a real charge.

function base64UrlEncode(bytes) {
  let binary = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64UrlEncodeString(str) {
  return base64UrlEncode(new TextEncoder().encode(str));
}
// Google's service-account JSON stores the private key as PEM (base64,
// wrapped in -----BEGIN/END PRIVATE KEY-----). crypto.subtle.importKey
// wants the raw DER bytes, not the PEM text — strip the header/footer and
// whitespace, then base64-decode what's left.
function pemToDer(pem) {
  const stripped = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const binary = atob(stripped);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

var cachedGoogleToken = null; // { accessToken, expiresAt } — module-scoped so it can survive across requests within the same Worker isolate
async function getGoogleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > now + 60) return cachedGoogleToken.accessToken;

  const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = base64UrlEncodeString(JSON.stringify(header)) + '.' + base64UrlEncodeString(JSON.stringify(claims));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(credentials.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = unsigned + '.' + base64UrlEncode(signature);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + encodeURIComponent(jwt),
  });
  if (!tokenRes.ok) throw new Error('Google OAuth token exchange failed: ' + (await tokenRes.text()));
  const tokenData = await tokenRes.json();
  cachedGoogleToken = { accessToken: tokenData.access_token, expiresAt: now + (tokenData.expires_in || 3600) };
  return cachedGoogleToken.accessToken;
}

// Returns true only if Google confirms this exact purchase token is real,
// paid for the expected product, and in the PURCHASED state (0). Anything
// else — wrong product, pending payment, cancelled/refunded (1), or any
// network/auth failure — returns false, since the only safe default here
// is to NOT grant the entitlement.
// Returns the purchase's raw verification data (or null if it doesn't
// check out) — separated from acknowledgement so the caller can decide
// what to do with each.
async function fetchGooglePlayPurchase(env, productId, purchaseToken) {
  const packageName = env.ANDROID_PACKAGE_NAME || 'com.caseytheamerican.iceblaster';
  const accessToken = await getGoogleAccessToken(env);
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
  if (!res.ok) {
    let errBody = '';
    try { errBody = await res.text(); } catch (e) {}
    return { __httpError: res.status, __body: errBody.slice(0, 300) };
  }
  return res.json();
}

// Google auto-refunds and revokes any purchase that isn't explicitly
// acknowledged within a short window — normally 3 days, but only 5
// MINUTES for license testers specifically (Google's own documented
// behavior). Checking purchaseState alone was never enough; this is the
// step that was actually missing, and it's why every test purchase was
// showing as successful in the app but then silently reversing itself a
// few minutes later.
async function acknowledgeGooglePlayPurchase(env, productId, purchaseToken) {
  const packageName = env.ANDROID_PACKAGE_NAME || 'com.caseytheamerican.iceblaster';
  const accessToken = await getGoogleAccessToken(env);
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  // A successful acknowledge returns an empty body — res.ok is the only
  // signal here. Not throwing on failure: acknowledgement failing shouldn't
  // block granting the entitlement if the purchase itself already verified
  // as genuine — worst case Google's own 5-minute window catches it, but
  // we don't want a flaky acknowledge call to be the reason a real,
  // already-verified purchase doesn't get granted.
  return res.ok;
}

// Entitlements (purchases, coupons, any grant) now require a real, signed-in
// Google identity — a random local device ID is no longer sufficient on its
// own. Every identity that's ever gone through real verification (see
// signInWithGoogle above) is prefixed 'goog_', so checking for that prefix
// is a simple, reliable way to enforce "must be signed in" here. This is a
// policy gate, not where the actual security check happens — that already
// happened once, server-side, at the moment the 'goog_' ID was first
// issued by /api/auth/google.
function requireSignedIn(device) {
  if (!device || device.indexOf('goog_') !== 0) {
    return json({ ok: false, error: 'sign_in_required' }, 401);
  }
  return null;
}

async function verifyAndGrantPurchase(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'malformed request body' }, 400); }
  const device = String((body && body.device) || '');
  const itemType = String((body && body.itemType) || '');
  const itemCode = String((body && body.itemCode) || '');
  const productId = String((body && body.productId) || '');
  const purchaseToken = String((body && body.purchaseToken) || '');
  if (!device || !itemType || !itemCode || !productId || !purchaseToken) {
    return json({ error: 'missing device, itemType, itemCode, productId, or purchaseToken' }, 400);
  }
  const signInError = requireSignedIn(device);
  if (signInError) return signInError;

  let purchase = null;
  try {
    purchase = await fetchGooglePlayPurchase(env, productId, purchaseToken);
  } catch (e) {
    return json({ ok: false, error: 'verification_unavailable', detail: String(e && e.message || e).slice(0, 200) }, 502);
  }

  // If Google's API returned a non-OK HTTP status, surface it verbatim.
  if (purchase && purchase.__httpError) {
    return json({ ok: false, error: 'google_api_error', googleStatus: purchase.__httpError, googleBody: purchase.__body }, 402);
  }

  // purchaseState: 0 = purchased, 1 = cancelled, 2 = pending
  if (!purchase || purchase.purchaseState !== 0) {
    return json({
      ok: false,
      error: 'purchase_not_verified',
      purchaseState: purchase ? purchase.purchaseState : 'null',
      purchaseType: purchase ? purchase.purchaseType : 'null',
      acknowledgementState: purchase ? purchase.acknowledgementState : 'null',
      orderId: purchase ? (purchase.orderId || 'none') : 'null'
    }, 402);
  }

  // acknowledgementState: 0 = not yet acknowledged, 1 = already
  // acknowledged. Only acknowledge once — a redundant call isn't harmful,
  // but there's no reason to make it.
  if (purchase.acknowledgementState === 0) {
    try { await acknowledgeGooglePlayPurchase(env, productId, purchaseToken); } catch (e) { /* see comment above — don't block granting on this */ }
  }

  await env.CHARACTERS_DB.prepare(
    'INSERT OR IGNORE INTO entitlements (device_id, item_type, item_code, source, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(device, itemType, itemCode, 'play_purchase', Date.now()).run();

  return json({ ok: true });
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
  const signInError = requireSignedIn(device);
  if (signInError) return signInError;

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
  const signInError = requireSignedIn(device);
  if (signInError) return signInError;

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
  const signInError = requireSignedIn(device);
  if (signInError) return signInError;

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
    if (path === '/api/purchases/verify' && request.method === 'POST') {
      return verifyAndGrantPurchase(request, env);
    }
    if (path === '/api/auth/google' && request.method === 'POST') {
      return signInWithGoogle(request, env);
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
