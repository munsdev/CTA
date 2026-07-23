// ============================================================================
// Know Your Rights — content Worker
//
// Legacy routes (beats[]-shaped, relational D1 tables) and graph routes
// (cards/answers/card_responses, still relational) stay exactly as deployed —
// nothing below this comment block changes their behavior. This file was
// previously out of sync with what's actually deployed (the repo only had the
// legacy /scenes endpoint); this commit reconciles the two, then adds the v2
// (single-object-per-scene, "backdrops") routes as a pure addition.
//
//   GET  /api/kyr/version                        -> { version }
//   GET  /api/kyr/scenes                         -> legacy beats[]-shaped payload
//   GET  /api/kyr/graph/scenes                   -> graph scene index
//   GET  /api/kyr/graph/scenes/{slug}             -> graph scene (cards/answers/...)
//   PUT/DELETE /api/kyr/graph/scenes/{slug}       -> builder v1 (X-KYR-Auth)
//   PUT  /api/kyr/graph/scenes/{slug}/cards/{id}  -> builder v1 (X-KYR-Auth)
//   ...  (layers/npcs/effects — builder v1, X-KYR-Auth)
//
//   GET  /api/kyr/v2/scenes                       -> v2 scene index (meta only)
//   GET  /api/kyr/v2/scenes/{slug}                -> v2 scene, whole object
//   PUT  /api/kyr/v2/scenes/{slug}                -> upsert whole object (X-KYR-Auth)
//   DELETE /api/kyr/v2/scenes/{slug}              -> delete (X-KYR-Auth)
//
// v2 is backed by its own table (scene_graphs: slug PK, scene_json, sort_order,
// active) — additive, does not touch the legacy relational tables.
// ============================================================================

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-KYR-Auth',
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, must-revalidate',
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

function requireAuth(request, env) {
  const got = request.headers.get('X-KYR-Auth') || '';
  const want = env.KYR_BUILDER_SECRET || '';
  if (!want) return 'not configured';
  if (got !== want) return 'unauthorized';
  return null;
}

async function bumpVersion(env) {
  await env.KYR_DB.prepare(
    "INSERT INTO content_meta (id, version, updated_at) VALUES (1, 2, datetime('now')) ON CONFLICT(id) DO UPDATE SET version = version + 1, updated_at = datetime('now')"
  ).run();
}

async function getVersion(env) {
  const row = await env.KYR_DB.prepare('SELECT version FROM content_meta WHERE id = 1').first();
  return json({ version: row ? row.version : 1 });
}

// ---------------------------------------------------------------------------
// Legacy (beats[]) — unchanged from what's deployed today.
// ---------------------------------------------------------------------------
async function getScenes(env) {
  const metaRow = await env.KYR_DB.prepare('SELECT version FROM content_meta WHERE id = 1').first();
  const version = metaRow ? metaRow.version : 1;

  const { results: endingRows } = await env.KYR_DB.prepare('SELECT key, stamp, truth FROM endings').all();
  const endings = {};
  for (const e of endingRows) endings[e.key] = { stamp: e.stamp, truth: e.truth };

  const { results: sceneRows } = await env.KYR_DB.prepare(
    'SELECT id, art, name, teaches, floor, exit_at, exit_deny, open_text, law_text, active FROM scenes ORDER BY sort_order ASC'
  ).all();
  const { results: checklistRows } = await env.KYR_DB.prepare(
    'SELECT scene_id, item_key, label FROM checklist_items ORDER BY scene_id, sort_order ASC'
  ).all();
  const { results: beatRows } = await env.KYR_DB.prepare(
    'SELECT id, scene_id, is_hatch, after_text FROM beats ORDER BY scene_id, sort_order ASC'
  ).all();
  const { results: roundRows } = await env.KYR_DB.prepare(
    'SELECT id, beat_id, is_narration, npc_lines FROM rounds ORDER BY beat_id, sort_order ASC'
  ).all();
  const { results: optionRows } = await env.KYR_DB.prepare(
    'SELECT round_id, grade, text, keys, damages, door_state, why_text FROM options ORDER BY round_id, sort_order ASC'
  ).all();

  const optionsByRound = new Map();
  for (const o of optionRows) {
    if (!optionsByRound.has(o.round_id)) optionsByRound.set(o.round_id, []);
    const opt = { g: o.grade, t: o.text };
    const keys = JSON.parse(o.keys || '[]');
    if (keys.length) opt.keys = keys;
    if (o.damages) opt.damages = true;
    if (o.door_state) opt.door = o.door_state;
    if (o.why_text) opt.why = o.why_text;
    optionsByRound.get(o.round_id).push(opt);
  }
  const roundsByBeat = new Map();
  for (const r of roundRows) {
    if (!roundsByBeat.has(r.beat_id)) roundsByBeat.set(r.beat_id, []);
    const round = { npc: JSON.parse(r.npc_lines || '[]'), box: optionsByRound.get(r.id) || [] };
    if (r.is_narration) round.narr = true;
    roundsByBeat.get(r.beat_id).push(round);
  }
  const beatsByScene = new Map();
  for (const b of beatRows) {
    if (!beatsByScene.has(b.scene_id)) beatsByScene.set(b.scene_id, []);
    const beat = { rounds: roundsByBeat.get(b.id) || [] };
    if (b.is_hatch) beat.hatch = true;
    if (b.after_text) beat.after = b.after_text;
    beatsByScene.get(b.scene_id).push(beat);
  }
  const checklistByScene = new Map();
  for (const c of checklistRows) {
    if (!checklistByScene.has(c.scene_id)) checklistByScene.set(c.scene_id, []);
    checklistByScene.get(c.scene_id).push([c.item_key, c.label]);
  }

  const scenes = sceneRows.map((s) => ({
    id: s.id, art: s.art, name: s.name, teaches: s.teaches, floor: s.floor,
    exitAt: s.exit_at === null ? null : s.exit_at, exitDeny: s.exit_deny || undefined,
    open: s.open_text, law: s.law_text, active: !!s.active,
    checklist: checklistByScene.get(s.id) || [], beats: beatsByScene.get(s.id) || [],
  }));
  return json({ version, scenes, endings });
}

// ---------------------------------------------------------------------------
// Graph (v1 builder) — unchanged from what's deployed today.
// ---------------------------------------------------------------------------
async function getSceneGraph(env, sceneId) {
  const scene = await env.KYR_DB.prepare(
    'SELECT id, art, name, teaches, floor, exit_at, exit_deny, open_text, law_text, active FROM scenes WHERE id = ?'
  ).bind(sceneId).first();
  if (!scene) return json({ error: 'scene not found' }, 404);
  const { results: layerRows } = await env.KYR_DB.prepare('SELECT id, label, file, sort_order FROM layers WHERE scene_id = ? ORDER BY sort_order').bind(sceneId).all();
  const { results: npcRows } = await env.KYR_DB.prepare('SELECT id, label, file, sort_order FROM npcs WHERE scene_id = ? ORDER BY sort_order').bind(sceneId).all();
  const { results: meterRows } = await env.KYR_DB.prepare('SELECT id, key, label, max, fatal_at, presets_json, sort_order FROM meters WHERE scene_id = ? ORDER BY sort_order').bind(sceneId).all();
  const { results: creditRows } = await env.KYR_DB.prepare('SELECT id, key, label, sort_order FROM credits WHERE scene_id = ? ORDER BY sort_order').bind(sceneId).all();
  const { results: cardRows } = await env.KYR_DB.prepare('SELECT id, type, layers_json, layer_rules_json, sort_order FROM cards WHERE scene_id = ? ORDER BY sort_order').bind(sceneId).all();
  const { results: responseRows } = await env.KYR_DB.prepare(
    `SELECT r.id, r.card_id, r.speaker_npc_id, r.texts_json, r.variant_mode, r.sort_order
     FROM card_responses r JOIN cards c ON r.card_id = c.id WHERE c.scene_id = ? ORDER BY r.card_id, r.sort_order`
  ).bind(sceneId).all();
  const { results: answerRows } = await env.KYR_DB.prepare(
    `SELECT a.id, a.card_id, a.text, a.goto, a.effects_json, a.sort_order
     FROM answers a JOIN cards c ON a.card_id = c.id WHERE c.scene_id = ? ORDER BY a.card_id, a.sort_order`
  ).bind(sceneId).all();

  const responsesByCard = new Map();
  for (const r of responseRows) {
    if (!responsesByCard.has(r.card_id)) responsesByCard.set(r.card_id, []);
    responsesByCard.get(r.card_id).push({ speaker: r.speaker_npc_id || null, texts: JSON.parse(r.texts_json || '[]'), variantMode: r.variant_mode });
  }
  const answersByCard = new Map();
  for (const a of answerRows) {
    if (!answersByCard.has(a.card_id)) answersByCard.set(a.card_id, []);
    answersByCard.get(a.card_id).push({ id: a.id, text: a.text, goto: a.goto, effects: JSON.parse(a.effects_json || '{"meters":{},"credits":{}}') });
  }
  const cards = cardRows.map((c) => ({
    id: c.id, type: c.type, layers: JSON.parse(c.layers_json || '[]'), layerRules: JSON.parse(c.layer_rules_json || '[]'),
    responses: responsesByCard.get(c.id) || [], answers: answersByCard.get(c.id) || [],
  }));
  return json({
    slug: scene.id, title: scene.name, active: !!scene.active, teaches: scene.teaches, floor: scene.floor,
    exitAt: scene.exit_at === null ? null : scene.exit_at, exitDeny: scene.exit_deny || undefined,
    open: scene.open_text, law: scene.law_text,
    layers: layerRows.map((l) => ({ id: l.id, label: l.label, file: l.file })),
    npcs: npcRows.map((n) => ({ id: n.id, label: n.label, file: n.file })),
    effects: {
      meters: meterRows.map((m) => ({ key: m.key, label: m.label, max: m.max, fatalAt: m.fatal_at, presets: JSON.parse(m.presets_json || '[]') })),
      credits: creditRows.map((c) => ({ key: c.key, label: c.label })),
    },
    cards,
  });
}
async function listScenesIndex(env) {
  const { results } = await env.KYR_DB.prepare('SELECT id, name, active, sort_order FROM scenes ORDER BY sort_order').all();
  return json({ scenes: results.map((s) => ({ id: s.id, title: s.name, active: !!s.active })) });
}
async function putScene(request, env, sceneId) {
  const body = await request.json();
  const exists = await env.KYR_DB.prepare('SELECT id FROM scenes WHERE id = ?').bind(sceneId).first();
  if (exists) {
    await env.KYR_DB.prepare(
      `UPDATE scenes SET name=?, teaches=?, floor=?, exit_at=?, exit_deny=?, open_text=?, law_text=?, active=? WHERE id=?`
    ).bind(body.title || '', body.teaches || '', body.floor ?? 0, body.exitAt ?? null, body.exitDeny ?? null, body.open || '', body.law || '', body.active ? 1 : 0, sceneId).run();
  } else {
    const { results } = await env.KYR_DB.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM scenes').all();
    const nextOrder = results[0]?.n ?? 0;
    await env.KYR_DB.prepare(
      `INSERT INTO scenes (id, art, name, teaches, floor, exit_at, exit_deny, open_text, law_text, sort_order, active) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(sceneId, sceneId, body.title || '', body.teaches || '', body.floor ?? 0, body.exitAt ?? null, body.exitDeny ?? null, body.open || '', body.law || '', nextOrder, body.active ? 1 : 0).run();
  }
  await bumpVersion(env);
  return json({ ok: true, sceneId });
}
async function deleteScene(env, sceneId) {
  await env.KYR_DB.prepare('DELETE FROM scenes WHERE id = ?').bind(sceneId).run();
  await bumpVersion(env);
  return json({ ok: true });
}
async function putCard(request, env, sceneId, cardId) {
  const body = await request.json();
  const stmts = [];
  const exists = await env.KYR_DB.prepare('SELECT id FROM cards WHERE id = ?').bind(cardId).first();
  const layersJson = JSON.stringify(body.layers || []);
  const rulesJson = JSON.stringify(body.layerRules || []);
  const type = body.type || 'normal';
  if (exists) {
    stmts.push(env.KYR_DB.prepare('UPDATE cards SET type=?, layers_json=?, layer_rules_json=? WHERE id=?').bind(type, layersJson, rulesJson, cardId));
  } else {
    const { results } = await env.KYR_DB.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM cards WHERE scene_id = ?').bind(sceneId).all();
    const nextOrder = body.sortOrder ?? results[0]?.n ?? 0;
    stmts.push(env.KYR_DB.prepare('INSERT INTO cards (id, scene_id, type, layers_json, layer_rules_json, sort_order) VALUES (?,?,?,?,?,?)').bind(cardId, sceneId, type, layersJson, rulesJson, nextOrder));
  }
  stmts.push(env.KYR_DB.prepare('DELETE FROM card_responses WHERE card_id = ?').bind(cardId));
  (body.responses || []).forEach((r, i) => {
    stmts.push(env.KYR_DB.prepare('INSERT INTO card_responses (card_id, speaker_npc_id, texts_json, variant_mode, sort_order) VALUES (?,?,?,?,?)').bind(cardId, r.speaker || null, JSON.stringify(r.texts || []), r.variantMode || 'sequence', i));
  });
  stmts.push(env.KYR_DB.prepare('DELETE FROM answers WHERE card_id = ?').bind(cardId));
  (body.answers || []).forEach((a, i) => {
    stmts.push(env.KYR_DB.prepare('INSERT INTO answers (id, card_id, text, goto, effects_json, sort_order) VALUES (?,?,?,?,?,?)').bind(a.id, cardId, a.text || '', a.goto || null, JSON.stringify(a.effects || { meters: {}, credits: {} }), i));
  });
  await env.KYR_DB.batch(stmts);
  await bumpVersion(env);
  return json({ ok: true, cardId });
}
async function deleteCard(env, cardId) {
  await env.KYR_DB.prepare('DELETE FROM cards WHERE id = ?').bind(cardId).run();
  await bumpVersion(env);
  return json({ ok: true });
}
async function putLayer(request, env, sceneId) {
  const body = await request.json();
  const id = body.id || `${sceneId}-${body.label}`;
  const exists = await env.KYR_DB.prepare('SELECT id FROM layers WHERE id = ?').bind(id).first();
  if (exists) {
    await env.KYR_DB.prepare('UPDATE layers SET label=?, file=? WHERE id=?').bind(body.label, body.file, id).run();
  } else {
    const { results } = await env.KYR_DB.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM layers WHERE scene_id=?').bind(sceneId).all();
    await env.KYR_DB.prepare('INSERT INTO layers (id, scene_id, label, file, sort_order) VALUES (?,?,?,?,?)').bind(id, sceneId, body.label, body.file, results[0]?.n ?? 0).run();
  }
  await bumpVersion(env);
  return json({ ok: true, id });
}
async function putNpc(request, env, sceneId) {
  const body = await request.json();
  const id = body.id || `${sceneId}-${body.label}`;
  const exists = await env.KYR_DB.prepare('SELECT id FROM npcs WHERE id = ?').bind(id).first();
  if (exists) {
    await env.KYR_DB.prepare('UPDATE npcs SET label=?, file=? WHERE id=?').bind(body.label, body.file || null, id).run();
  } else {
    const { results } = await env.KYR_DB.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM npcs WHERE scene_id=?').bind(sceneId).all();
    await env.KYR_DB.prepare('INSERT INTO npcs (id, scene_id, label, file, sort_order) VALUES (?,?,?,?,?)').bind(id, sceneId, body.label, body.file || null, results[0]?.n ?? 0).run();
  }
  await bumpVersion(env);
  return json({ ok: true, id });
}
async function putEffects(request, env, sceneId) {
  const body = await request.json();
  const stmts = [];
  stmts.push(env.KYR_DB.prepare('DELETE FROM meters WHERE scene_id = ?').bind(sceneId));
  (body.meters || []).forEach((m, i) => {
    stmts.push(env.KYR_DB.prepare('INSERT INTO meters (id, scene_id, key, label, max, fatal_at, presets_json, sort_order) VALUES (?,?,?,?,?,?,?,?)').bind(m.id || `${sceneId}-m-${m.key}`, sceneId, m.key, m.label, m.max ?? 100, m.fatalAt ?? null, JSON.stringify(m.presets || []), i));
  });
  stmts.push(env.KYR_DB.prepare('DELETE FROM credits WHERE scene_id = ?').bind(sceneId));
  (body.credits || []).forEach((c, i) => {
    stmts.push(env.KYR_DB.prepare('INSERT INTO credits (id, scene_id, key, label, sort_order) VALUES (?,?,?,?,?)').bind(c.id || `${sceneId}-cr-${c.key}`, sceneId, c.key, c.label, i));
  });
  await env.KYR_DB.batch(stmts);
  await bumpVersion(env);
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// v2 (backdrops, single JSON object per scene) — new, additive.
// Backed by scene_graphs(slug PK, scene_json, sort_order, active).
// ---------------------------------------------------------------------------
async function v2ListScenes(env) {
  const { results } = await env.KYR_DB.prepare(
    'SELECT slug, scene_json, sort_order, active FROM scene_graphs ORDER BY sort_order ASC'
  ).all();
  const metaRow = await env.KYR_DB.prepare('SELECT version FROM content_meta WHERE id = 1').first();
  const scenes = results.map((row) => {
    let meta = {};
    try { meta = JSON.parse(row.scene_json).meta || {}; } catch (e) { /* corrupt row — surface empty meta rather than 500 */ }
    return { slug: row.slug, meta: { ...meta, active: !!row.active, sortOrder: row.sort_order } };
  });
  return json({ version: metaRow ? metaRow.version : 1, scenes });
}
async function v2GetScene(env, slug) {
  const row = await env.KYR_DB.prepare('SELECT scene_json FROM scene_graphs WHERE slug = ?').bind(slug).first();
  if (!row) return json({ error: 'scene not found' }, 404);
  let scene;
  try { scene = JSON.parse(row.scene_json); } catch (e) { return json({ error: 'stored scene is corrupt JSON' }, 500); }
  return json(scene);
}
async function v2PutScene(request, env, slug) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'invalid JSON body' }, 400); }
  if (!body || typeof body !== 'object' || !body.cards) return json({ error: 'body must be a schema-v2 scene object (missing cards)' }, 400);
  body.slug = slug; body.schema = 2;
  const sortOrder = (body.meta && body.meta.sortOrder) ?? 0;
  const active = (body.meta && body.meta.active !== false) ? 1 : 0;
  await env.KYR_DB.prepare(
    `INSERT INTO scene_graphs (slug, scene_json, sort_order, active, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(slug) DO UPDATE SET scene_json=excluded.scene_json, sort_order=excluded.sort_order, active=excluded.active, updated_at=datetime('now')`
  ).bind(slug, JSON.stringify(body), sortOrder, active).run();
  await bumpVersion(env);
  return json({ ok: true, slug });
}
async function v2DeleteScene(env, slug) {
  await env.KYR_DB.prepare('DELETE FROM scene_graphs WHERE slug = ?').bind(slug).run();
  await bumpVersion(env);
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

    if (path === '/api/kyr/version' && method === 'GET') return getVersion(env);
    if (path === '/api/kyr/scenes' && method === 'GET') return getScenes(env);

    // v2 — read routes open, writes gated
    if (path === '/api/kyr/v2/scenes' && method === 'GET') return v2ListScenes(env);
    const v2Match = path.match(/^\/api\/kyr\/v2\/scenes\/([^/]+)$/);
    if (v2Match && method === 'GET') return v2GetScene(env, v2Match[1]);
    if (v2Match && (method === 'PUT' || method === 'DELETE')) {
      const authErr = requireAuth(request, env);
      if (authErr) return json({ error: authErr }, authErr === 'not configured' ? 500 : 401);
      if (method === 'PUT') return v2PutScene(request, env, v2Match[1]);
      return v2DeleteScene(env, v2Match[1]);
    }

    if (path === '/api/kyr/graph/scenes' && method === 'GET') return listScenesIndex(env);
    const graphMatch = path.match(/^\/api\/kyr\/graph\/scenes\/([^/]+)$/);
    if (graphMatch && method === 'GET') return getSceneGraph(env, graphMatch[1]);
    if (path.startsWith('/api/kyr/graph/') && method !== 'GET') {
      const authErr = requireAuth(request, env);
      if (authErr) return json({ error: authErr }, authErr === 'not configured' ? 500 : 401);
      const sceneMatch = path.match(/^\/api\/kyr\/graph\/scenes\/([^/]+)$/);
      if (sceneMatch && method === 'PUT') return putScene(request, env, sceneMatch[1]);
      if (sceneMatch && method === 'DELETE') return deleteScene(env, sceneMatch[1]);
      const cardMatch = path.match(/^\/api\/kyr\/graph\/scenes\/([^/]+)\/cards\/([^/]+)$/);
      if (cardMatch && method === 'PUT') return putCard(request, env, cardMatch[1], cardMatch[2]);
      if (cardMatch && method === 'DELETE') return deleteCard(env, cardMatch[2]);
      const layerMatch = path.match(/^\/api\/kyr\/graph\/scenes\/([^/]+)\/layers$/);
      if (layerMatch && method === 'POST') return putLayer(request, env, layerMatch[1]);
      const npcMatch = path.match(/^\/api\/kyr\/graph\/scenes\/([^/]+)\/npcs$/);
      if (npcMatch && method === 'POST') return putNpc(request, env, npcMatch[1]);
      const effectsMatch = path.match(/^\/api\/kyr\/graph\/scenes\/([^/]+)\/effects$/);
      if (effectsMatch && method === 'PUT') return putEffects(request, env, effectsMatch[1]);
      return json({ error: 'not found' }, 404);
    }

    return json({ error: 'not found' }, 404);
  },
};
