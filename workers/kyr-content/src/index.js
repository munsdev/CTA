// ============================================================================
// Know Your Rights — content Worker
//
// Routes:
//   GET /api/kyr/version   -> { version } — cheap check, client compares
//                              against its cached value before pulling the
//                              full payload
//   GET /api/kyr/scenes    -> { version, scenes: [...], endings: {...} }
//                              full content payload, reassembled from D1's
//                              relational rows (scenes/beats/rounds/options)
//                              back into the nested shape engine.js expects
//                              (scene.beats[].rounds[].box[]), so the client
//                              engine's data-consumption code doesn't need
//                              to change shape, only its source.
//
// Read-only. No player state, no auth, no leaderboard — this Worker only
// serves content. Editing a scene means editing rows in kyr-content-db and
// bumping content_meta.version; no redeploy required for content changes.
// ============================================================================

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Content changes on Casey's schedule, not the client's — no-cache
      // means every check hits the Worker, but the payload is small (a few
      // dozen KB) and this endpoint is low-traffic, so freshness wins over
      // shaving a round trip.
      'Cache-Control': 'no-cache, must-revalidate',
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

async function getVersion(env) {
  const row = await env.KYR_DB.prepare(
    'SELECT version FROM content_meta WHERE id = 1'
  ).first();
  return json({ version: row ? row.version : 1 });
}

async function getScenes(env) {
  const metaRow = await env.KYR_DB.prepare(
    'SELECT version FROM content_meta WHERE id = 1'
  ).first();
  const version = metaRow ? metaRow.version : 1;

  const { results: endingRows } = await env.KYR_DB.prepare(
    'SELECT key, stamp, truth FROM endings'
  ).all();
  const endings = {};
  for (const e of endingRows) {
    endings[e.key] = { stamp: e.stamp, truth: e.truth };
  }

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

  // Group options by round_id
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

  // Group rounds by beat_id, attach their options (box)
  const roundsByBeat = new Map();
  for (const r of roundRows) {
    if (!roundsByBeat.has(r.beat_id)) roundsByBeat.set(r.beat_id, []);
    const round = {
      npc: JSON.parse(r.npc_lines || '[]'),
      box: optionsByRound.get(r.id) || [],
    };
    if (r.is_narration) round.narr = true;
    roundsByBeat.get(r.beat_id).push(round);
  }

  // Group beats by scene_id, attach their rounds
  const beatsByScene = new Map();
  for (const b of beatRows) {
    if (!beatsByScene.has(b.scene_id)) beatsByScene.set(b.scene_id, []);
    const beat = { rounds: roundsByBeat.get(b.id) || [] };
    if (b.is_hatch) beat.hatch = true;
    if (b.after_text) beat.after = b.after_text;
    beatsByScene.get(b.scene_id).push(beat);
  }

  // Group checklist rows by scene_id, as [key, label] pairs
  const checklistByScene = new Map();
  for (const c of checklistRows) {
    if (!checklistByScene.has(c.scene_id)) checklistByScene.set(c.scene_id, []);
    checklistByScene.get(c.scene_id).push([c.item_key, c.label]);
  }

  const scenes = sceneRows.map((s) => ({
    id: s.id,
    art: s.art,
    name: s.name,
    teaches: s.teaches,
    floor: s.floor,
    exitAt: s.exit_at === null ? null : s.exit_at,
    exitDeny: s.exit_deny || undefined,
    open: s.open_text,
    law: s.law_text,
    active: !!s.active,
    checklist: checklistByScene.get(s.id) || [],
    beats: beatsByScene.get(s.id) || [],
  }));

  return json({ version, scenes, endings });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (path === '/api/kyr/version' && request.method === 'GET') {
      return getVersion(env);
    }
    if (path === '/api/kyr/scenes' && request.method === 'GET') {
      return getScenes(env);
    }

    return json({ error: 'not found' }, 404);
  },
};
