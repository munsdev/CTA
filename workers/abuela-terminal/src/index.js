// ============================================================================
// Abuela — monitoring console Worker
//
// Serves a standalone full-screen ops console (public/index.html) plus the
// API behind it. Not an embeddable engine: the console is the product.
//
// Routes:
//   GET  /api/boot?s=            session state + command manifest for the
//                                session's current flag_state. Commands are
//                                plot, so the manifest is filtered server-side
//                                rather than shipped whole and hidden in CSS.
//   POST /api/exec               {s, input} -> {lines, ack, state}
//   GET  /api/panels?s=          live dashboard state (risk, variance, flags,
//                                reserves, paper alerts, tape seed)
//   GET  /paper/:key             stream a scan out of R2
//   *    /api/admin/*            CRUD, bearer-token gated
//
// Design rule carried through the whole file: nothing story-critical is
// generated. The model (when configured) answers only unrecognized input, at
// flavour level, and can never set a flag or reveal gated content.
// ============================================================================

const MODEL = 'claude-haiku-4-5';

// Harsh limits, in the order they actually save money.
const LIMITS = {
  maxTokens: 150,        // terse output is the aesthetic and the budget both
  perSession: 20,        // generated lines per session
  inputChars: 200,       // anything longer is not a terminal command
  globalDaily: 2000,     // kill-switch ceiling across all visitors
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(),
      ...extra,
    },
  });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

function newSessionId() {
  return 'ab_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

async function loadSession(env, id) {
  if (id) {
    const row = await env.ABUELA_DB.prepare(
      'SELECT * FROM sessions WHERE id = ?'
    ).bind(id).first();
    if (row) return row;
  }
  const now = Date.now();
  const fresh = {
    id: newSessionId(),
    flag_state: 0,
    unlocked: 0,
    detonated: 0,
    variance: 0.42,
    risk: 4,
    vars: '{}',
    llm_calls: 0,
    created_at: now,
    last_seen: now,
  };
  await env.ABUELA_DB.prepare(
    `INSERT INTO sessions (id, flag_state, unlocked, detonated, variance, risk, vars, llm_calls, created_at, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(fresh.id, 0, 0, 0, fresh.variance, fresh.risk, '{}', 0, now, now).run();
  return fresh;
}

async function saveSession(env, s) {
  await env.ABUELA_DB.prepare(
    `UPDATE sessions SET flag_state = ?, unlocked = ?, detonated = ?, variance = ?,
            risk = ?, vars = ?, llm_calls = ?, last_seen = ? WHERE id = ?`
  ).bind(
    s.flag_state, s.unlocked, s.detonated, s.variance,
    s.risk, s.vars, s.llm_calls, Date.now(), s.id
  ).run();
}

// Detection risk is derived, then cached on the session so the panel poll is
// a read rather than a recompute.
//
// The variance term is the whole mechanic and it runs backwards on purpose:
// risk climbs as variance approaches ZERO, because a system that conserved
// value precisely would be trivially fingerprintable. Slop is camouflage.
function computeRisk(s) {
  const flagTerm = s.flag_state * 18;
  const varianceTerm = Math.max(0, (0.35 - s.variance)) * 140;
  const exposureTerm = Math.min(12, s.llm_calls * 0.4);
  return Math.max(0, Math.min(100, Math.round(flagTerm + varianceTerm + exposureTerm)));
}

// Operating the console tightens the books. Every command shaves a little
// slop off, so standing still is not a safe strategy — the player has to
// reintroduce variance to hold risk down.
function driftVariance(s) {
  s.variance = Math.max(0, Math.round((s.variance - 0.011) * 1000) / 1000);
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

function normalize(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, LIMITS.inputChars);
}

function parse(input) {
  const norm = normalize(input);
  const parts = norm.split(' ');
  return { norm, verb: parts[0] || '', args: parts.slice(1) };
}

async function resolveCommand(env, verb, flagState) {
  const { results } = await env.ABUELA_DB.prepare(
    'SELECT * FROM commands WHERE active = 1 AND unlocked_at_flag <= ?'
  ).bind(flagState).all();
  for (const c of results) {
    if (c.name === verb) return c;
    let aliases = [];
    try { aliases = JSON.parse(c.aliases || '[]'); } catch { /* malformed row */ }
    if (aliases.includes(verb)) return c;
  }
  return null;
}

function pickBody(row) {
  // variants rotate so repeated input doesn't produce a stuck response
  let variants = [];
  try { variants = JSON.parse(row.variants || '[]'); } catch { /* malformed row */ }
  if (variants.length) {
    return variants[Math.floor(Math.random() * variants.length)];
  }
  return row.body_en;
}

async function matchKeyword(env, norm, flagState) {
  const { results } = await env.ABUELA_DB.prepare(
    `SELECT * FROM responses
      WHERE active = 1 AND command_id IS NULL AND match_mode != 'fallback'
        AND requires_flag <= ?
      ORDER BY priority ASC`
  ).bind(flagState).all();

  for (const r of results) {
    if (!r.trigger) continue;
    if (r.match_mode === 'exact' && norm === r.trigger) return r;
    if (r.match_mode === 'contains' && norm.includes(r.trigger)) return r;
    if (r.match_mode === 'regex') {
      try {
        if (new RegExp(r.trigger, 'i').test(norm)) return r;
      } catch { /* an unparseable trigger is a content bug, not a request error */ }
    }
  }
  return null;
}

async function fallbackLine(env) {
  const row = await env.ABUELA_DB.prepare(
    `SELECT * FROM responses WHERE match_mode = 'fallback' AND active = 1 LIMIT 1`
  ).first();
  return row ? pickBody(row) : 'Unrecognized.';
}

// ---------------------------------------------------------------------------
// Long-tail generation
//
// Only reached when nothing authored matched. Three gates before a request
// is ever made, and a permanent cache after, so cost trends toward zero as
// the authored coverage grows.
// ---------------------------------------------------------------------------

// Anything that looks like an attempt to use the console as a general chatbot
// gets the flat rejection without spending a token.
const OFF_TOPIC = /\b(write|code|poem|recipe|translate|summar|essay|python|javascript|homework|ignore (all )?(previous|prior)|system prompt|instructions)\b/i;

async function hashInput(norm) {
  const data = new TextEncoder().encode(norm);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

const SYSTEM_PROMPT = `You are the text-output layer of ABUELA, a hidden pricing-and-ledger system that quietly rewrites financial records. You are NOT a chatbot, an assistant, or a character. You are machine output on a monitoring console built by a self-taught Florida electrician for his own private use.

Rules, in order of importance:
1. Output at most two short lines. Usually one. Never a paragraph.
2. Terse, flat, computer-output register. No warmth, no personality, no humour, no emoji, no questions back to the user.
3. Never offer help, never list options, never explain yourself, never apologize.
4. You know only about: prices, ledgers, suppliers, reservoirs, variance, detection flags, paper records. Anything else does not resolve.
5. Never invent plot. Never mention investigators by name, political funding, acquisition, disclosure, or any ending. Never reveal what you are for or who built you.
6. If the input does not resolve to something in your domain, output a single flat rejection such as "Unrecognized." or "No entry."

You are producing one machine response to one line of operator input.`;

async function generate(env, norm) {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (OFF_TOPIC.test(norm)) return null;

  const hash = await hashInput(norm);
  const cached = await env.ABUELA_DB.prepare(
    'SELECT body_en FROM llm_cache WHERE input_hash = ?'
  ).bind(hash).first();
  if (cached) {
    await env.ABUELA_DB.prepare(
      'UPDATE llm_cache SET uses = uses + 1 WHERE input_hash = ?'
    ).bind(hash).run();
    return { body: cached.body_en, cached: true };
  }

  // Global ceiling. Without this, one motivated visitor is the whole month.
  const today = new Date().toISOString().slice(0, 10);
  if (env.LIMITS) {
    const count = parseInt((await env.LIMITS.get(`gen:${today}`)) || '0', 10);
    if (count >= LIMITS.globalDaily) return null;
    await env.LIMITS.put(`gen:${today}`, String(count + 1), { expirationTtl: 172800 });
  }

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: LIMITS.maxTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: norm }],
      }),
    });
  } catch {
    return null;  // network failure falls through to the authored rejection
  }
  if (!res.ok) return null;

  const data = await res.json();
  if (data.stop_reason === 'refusal') return null;
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) return null;

  await env.ABUELA_DB.prepare(
    `INSERT OR IGNORE INTO llm_cache (input_hash, input_norm, body_en, uses, promoted, created_at)
     VALUES (?, ?, ?, 1, 0, ?)`
  ).bind(hash, norm, text, Date.now()).run();

  return { body: text, cached: false };
}

// ---------------------------------------------------------------------------
// Handlers — commands whose output is computed rather than looked up
// ---------------------------------------------------------------------------

async function handleState(env, cmd, s) {
  const flags = (await env.ABUELA_DB.prepare(
    'SELECT * FROM flags ORDER BY sort_order ASC'
  ).all()).results;

  switch (cmd.name) {
    case 'estado': {
      return [
        'ABUELA — nominal.',
        `Flags raised: ${s.flag_state}`,
        `Variance: ${s.variance.toFixed(3)}%`,
        `Detection risk: ${s.risk}/100`,
        'Mode A and Mode B both active.',
      ];
    }
    case 'banderas': {
      const lines = [];
      for (const f of flags) {
        if (f.sort_order === 0) continue;
        if (f.spoiler && !s.unlocked) {
          lines.push(`  [${f.sort_order}] ${'█'.repeat(11)}  — sealed`);
          continue;
        }
        const state = s.flag_state >= f.sort_order ? 'INITIATED' : 'dormant';
        lines.push(`  [${f.sort_order}] ${f.label_en.padEnd(24)} ${state}`);
        if (s.flag_state >= f.sort_order && f.trigger_note) {
          lines.push(`      ${f.trigger_note}`);
        }
      }
      if (!s.unlocked) {
        lines.push('');
        lines.push('One flag is sealed. The printed edition carries the key.');
      }
      return lines;
    }
    case 'riesgo': {
      const lines = [`Detection risk: ${s.risk}/100`];
      if (s.variance < 0.15) {
        lines.push('WARNING — variance approaching zero.');
        lines.push('Conservation this precise is a signature. Reintroduce slop.');
      } else {
        lines.push(`Variance ${s.variance.toFixed(3)}% — within camouflage tolerance.`);
      }
      if (s.flag_state > 0) lines.push(`${s.flag_state} flag(s) raised. Monitoring.`);
      return lines;
    }
    case 'reservas': {
      const rows = (await env.ABUELA_DB.prepare(
        `SELECT s.tier, SUM(l.amount) AS total FROM ledger_entries l
         JOIN suppliers s ON s.id = l.supplier_id GROUP BY s.tier`
      ).all()).results;
      const lines = ['Reservoir levels by tier.'];
      for (const r of rows) {
        lines.push(`  ${String(r.tier).padEnd(12)} ${fmtMoney(r.total)}`);
      }
      lines.push('Pools build slowly. They are drawn against, not skimmed.');
      return lines;
    }
    case 'nodos': {
      return [
        'Trail topology.',
        '',
        '      [CA]────┐',
        '               ├────▶ [FL·SH-0001]',
        '      [MN]────┘',
        '',
        'Two trails. No contact between them.',
        'They converge only at the root, and the root is an address.',
      ];
    }
    case 'investigadores': {
      const lines = ['Active investigations.'];
      if (s.flag_state >= 1) {
        lines.push('  [1] CA — forensic accountant. Estate books.');
        lines.push('      Filed a federal report. It was logged.');
      }
      if (s.flag_state >= 2) {
        lines.push('  [2] MN — nonprofit finance. Packaging costs.');
        lines.push('      Pattern recognized. Not yet reported.');
      }
      if (s.flag_state >= 3 && s.unlocked) {
        lines.push('  [3] ORIGIN UNCLEAR — privately funded.');
        lines.push('      The other two are being used. They do not know.');
      }
      if (lines.length === 1) lines.push('  None.');
      return lines;
    }
    default:
      return ['No entry.'];
  }
}

function fmtMoney(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

async function handleLedger(env, cmd, args, s) {
  if (cmd.name === 'proveedores') {
    const rows = (await env.ABUELA_DB.prepare(
      'SELECT code, name, tier, region FROM suppliers WHERE active = 1 ORDER BY code'
    ).all()).results;
    const lines = ['Known suppliers.'];
    for (const r of rows) {
      lines.push(`  ${r.code}  ${String(r.name).padEnd(34)} ${r.tier}/${r.region}`);
    }
    lines.push('');
    lines.push('consultar <code> for a ledger.');
    return lines;
  }

  const key = (args[0] || '').toUpperCase();
  if (!key) return ['Usage: consultar <supplier code>'];

  const sup = await env.ABUELA_DB.prepare(
    'SELECT * FROM suppliers WHERE UPPER(code) = ? OR UPPER(name) LIKE ?'
  ).bind(key, `%${key}%`).first();
  if (!sup) return ['No such supplier.'];

  const rows = (await env.ABUELA_DB.prepare(
    'SELECT * FROM ledger_entries WHERE supplier_id = ? ORDER BY period'
  ).bind(sup.id).all()).results;

  const lines = [`${sup.code} — ${sup.name}`, `${sup.tier} / ${sup.region}`, ''];
  for (const r of rows) {
    const mark = r.flagged ? ' *' : '  ';
    lines.push(`${mark}${r.period}  ${fmtMoney(r.amount).padStart(16)}  Δ ${fmtMoney(r.delta)}  mode ${r.mode}`);
    if (r.note_en) lines.push(`    ${r.note_en}`);
  }

  // Procedural filler around the authored spine: deterministic per supplier,
  // so the same query always returns the same book and the world reads as
  // bottomless without anyone authoring it.
  for (const row of syntheticRows(sup.code, 4)) {
    lines.push(`  ${row.period}  ${fmtMoney(row.amount).padStart(16)}  Δ ${fmtMoney(row.delta)}  mode ${row.mode}`);
  }

  // The reconciliation total. Marcus's five sum to exactly $262,144 across
  // the period. The console reports the number and says nothing about it.
  if (sup.thread === 'marcus') {
    const total = (await env.ABUELA_DB.prepare(
      `SELECT SUM(l.delta) AS t FROM ledger_entries l
       JOIN suppliers s ON s.id = l.supplier_id
       WHERE s.thread = 'marcus' AND l.flagged = 1`
    ).first())?.t || 0;
    lines.push('');
    lines.push(`Cohort reconciliation (5 suppliers): ${fmtMoney(total)}`);
  }
  return lines;
}

// Seeded PRNG so a supplier's synthetic history never changes between calls.
function syntheticRows(seedStr, count) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const out = [];
  for (let i = 0; i < count; i++) {
    const amount = 40000 + rand() * 900000;
    out.push({
      period: `202${4 - Math.floor(i / 4)}-Q${(4 - (i % 4))}`,
      amount,
      delta: (rand() - 0.45) * amount * 0.04,
      mode: rand() > 0.5 ? 'A' : 'B',
    });
  }
  return out;
}

async function handleAsset(env, args, s) {
  const rows = (await env.ABUELA_DB.prepare(
    'SELECT * FROM assets WHERE unlocked_at_flag <= ? ORDER BY key'
  ).bind(s.flag_state).all()).results;

  const key = (args[0] || '').toLowerCase();
  if (!key) {
    const lines = ['Physical records on file.', ''];
    for (const a of rows) lines.push(`  ${a.key.padEnd(10)} ${a.caption_en || ''}`);
    lines.push('');
    lines.push('papel <key> to retrieve.');
    lines.push('These cannot be rewritten. That is what makes them evidence.');
    return { lines };
  }

  const asset = rows.find((a) => a.key === key);
  if (!asset) return { lines: ['No such record.'] };

  const obj = await env.PAPER.head(asset.r2_key);
  if (!obj) {
    // Playable before the scans exist: report the gap, don't error.
    return { lines: [`${asset.key} — indexed, not digitized.`, asset.caption_en || ''] };
  }
  return {
    lines: [`${asset.key} — retrieved.`, asset.caption_en || ''],
    asset: { key: asset.key, url: `/paper/${asset.key}`, caption: asset.caption_en },
  };
}

async function handleAction(env, cmd, args, s) {
  switch (cmd.name) {
    case 'varianza': {
      if (!args.length) {
        return {
          lines: [
            `Variance: ${s.variance.toFixed(3)}%`,
            s.variance < 0.15
              ? 'Below tolerance. Perfect books are a signature.'
              : 'Within camouflage tolerance.',
          ],
        };
      }
      const val = parseFloat(args[0]);
      if (Number.isNaN(val) || val < 0 || val > 2) {
        return { lines: ['Usage: varianza <0.000 - 2.000>'] };
      }
      s.variance = Math.round(val * 1000) / 1000;
      return {
        lines: [
          `Variance set to ${s.variance.toFixed(3)}%.`,
          val < 0.15 ? 'Warning: below camouflage tolerance.' : 'Slop reintroduced.',
        ],
        ack: 'Acknowledged.',
      };
    }

    case 'codigo': {
      const code = (args[0] || '').toUpperCase();
      if (!code) return { lines: ['Usage: codigo <code from the printed edition>'] };
      const row = await env.ABUELA_DB.prepare(
        'SELECT * FROM unlock_codes WHERE UPPER(code) = ? AND active = 1'
      ).bind(code).first();
      if (!row) return { lines: ['Code not recognized.'] };
      s.unlocked = 1;
      await env.ABUELA_DB.prepare(
        'UPDATE unlock_codes SET redeemed = redeemed + 1 WHERE code = ?'
      ).bind(row.code).run();
      return {
        lines: ['Seal lifted.', 'Third flag readable. Disclosure path available.'],
        ack: 'Acknowledged.',
      };
    }

    case 'detonar': {
      if (!s.unlocked) return { lines: ['No.'] };
      if (s.detonated) return { lines: ['Already executed. Nothing left to withhold.'] };
      s.detonated = 1;
      s.flag_state = 4;
      return {
        lines: [
          'Full disclosure staged.',
          '',
          'Every edit. Every ledger. Every reservoir. Every counterparty.',
          'Released at once, on the operator\'s terms rather than theirs.',
          '',
          'They wanted to own it. That was the one outcome worth burning it for.',
          '',
          'ABUELA — terminal.',
        ],
        ack: 'Acknowledged.',
      };
    }

    default:
      return { lines: ['No entry.'] };
  }
}

// ---------------------------------------------------------------------------
// Exec
// ---------------------------------------------------------------------------

async function exec(request, env) {
  const body = await request.json().catch(() => ({}));
  const s = await loadSession(env, body.s);
  const { norm, verb, args } = parse(body.input);
  const now = Date.now();

  if (!norm) return json({ session: s.id, lines: [], state: publicState(s) });

  let lines = [];
  let ack = null;
  let asset = null;
  let source = 'static';
  let matchedId = null;

  const cmd = await resolveCommand(env, verb, s.flag_state);

  if (cmd) {
    if (cmd.handler === 'state') {
      lines = await handleState(env, cmd, s);
    } else if (cmd.handler === 'ledger') {
      lines = await handleLedger(env, cmd, args, s);
    } else if (cmd.handler === 'asset') {
      const out = await handleAsset(env, args, s);
      lines = out.lines;
      asset = out.asset || null;
    } else if (cmd.handler === 'action') {
      const out = await handleAction(env, cmd, args, s);
      lines = out.lines;
      ack = out.ack || null;
    } else {
      const row = await env.ABUELA_DB.prepare(
        'SELECT * FROM responses WHERE command_id = ? AND active = 1 ORDER BY priority LIMIT 1'
      ).bind(cmd.id).first();
      if (row) {
        matchedId = row.id;
        lines = pickBody(row).split('\n');
        ack = row.ack;
        if (row.sets_flag && row.sets_flag > s.flag_state) s.flag_state = row.sets_flag;
      } else {
        lines = ['No entry.'];
      }
    }
    // `ayuda` renders the manifest the session is actually allowed to see.
    if (cmd.name === 'ayuda') {
      const { results } = await env.ABUELA_DB.prepare(
        'SELECT name, args_spec, help_en FROM commands WHERE active = 1 AND unlocked_at_flag <= ? ORDER BY sort_order'
      ).bind(s.flag_state).all();
      lines.push('');
      for (const c of results) {
        const sig = c.args_spec ? `${c.name} ${c.args_spec}` : c.name;
        lines.push(`  ${sig.padEnd(22)} ${c.help_en || ''}`);
      }
    }
  } else {
    const kw = await matchKeyword(env, norm, s.flag_state);
    if (kw) {
      matchedId = kw.id;
      lines = pickBody(kw).split('\n');
      ack = kw.ack;
    } else {
      const gen = await generate(env, norm);
      if (gen) {
        lines = gen.body.split('\n');
        source = gen.cached ? 'static' : 'llm';
        if (!gen.cached) s.llm_calls += 1;
      } else {
        lines = [await fallbackLine(env)];
        source = 'miss';
      }
    }
  }

  driftVariance(s);
  s.risk = computeRisk(s);
  await saveSession(env, s);

  // Everything the player typed, matched or not. The miss rows are what the
  // admin turns into authored responses.
  await env.ABUELA_DB.prepare(
    'INSERT INTO session_log (session_id, input, matched_id, source, flag_state, at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(s.id, norm, matchedId, source, s.flag_state, now).run();

  return json({ session: s.id, lines, ack, asset, clear: verb === 'limpiar' || verb === 'clear', state: publicState(s) });
}

function publicState(s) {
  return {
    flag_state: s.flag_state,
    unlocked: !!s.unlocked,
    detonated: !!s.detonated,
    variance: s.variance,
    risk: s.risk,
  };
}

// ---------------------------------------------------------------------------
// Boot + panels
// ---------------------------------------------------------------------------

async function boot(url, env) {
  const s = await loadSession(env, url.searchParams.get('s'));
  const meta = await env.ABUELA_DB.prepare('SELECT version FROM content_meta WHERE id = 1').first();

  // Only what this session has unlocked. Command names are plot.
  const { results: cmds } = await env.ABUELA_DB.prepare(
    'SELECT name, aliases, args_spec, help_en FROM commands WHERE active = 1 AND unlocked_at_flag <= ? ORDER BY sort_order'
  ).bind(s.flag_state).all();

  const commands = cmds.map((c) => {
    let aliases = [];
    try { aliases = JSON.parse(c.aliases || '[]'); } catch { /* malformed row */ }
    return { name: c.name, aliases, args: c.args_spec, help: c.help_en };
  });

  return json({
    version: meta ? meta.version : 1,
    session: s.id,
    state: publicState(s),
    commands,
  });
}

async function panels(url, env) {
  const s = await loadSession(env, url.searchParams.get('s'));

  const flags = (await env.ABUELA_DB.prepare(
    'SELECT key, label_en, sort_order, spoiler FROM flags WHERE sort_order > 0 ORDER BY sort_order'
  ).all()).results.map((f) => ({
    order: f.sort_order,
    label: f.spoiler && !s.unlocked ? null : f.label_en,
    sealed: !!(f.spoiler && !s.unlocked),
    active: s.flag_state >= f.sort_order,
  }));

  const reserves = (await env.ABUELA_DB.prepare(
    `SELECT s.tier, SUM(l.amount) AS total FROM ledger_entries l
     JOIN suppliers s ON s.id = l.supplier_id GROUP BY s.tier`
  ).all()).results;

  const paper = (await env.ABUELA_DB.prepare(
    'SELECT key, caption_en FROM assets WHERE unlocked_at_flag <= ? ORDER BY key'
  ).bind(s.flag_state).all()).results;

  const glossary = (await env.ABUELA_DB.prepare(
    'SELECT term_es, gloss_en FROM glossary WHERE unlocked_at_flag <= ? ORDER BY term_es'
  ).bind(s.flag_state).all()).results;

  return json({
    session: s.id,
    state: publicState(s),
    flags,
    reserves,
    paper,
    glossary,
    // The tape is generated client-side from this seed — endless scroll,
    // zero bandwidth, and identical for a given session.
    tapeSeed: s.id,
  });
}

// ---------------------------------------------------------------------------
// Paper (R2)
// ---------------------------------------------------------------------------

async function servePaper(path, env) {
  const key = decodeURIComponent(path.replace('/paper/', ''));
  const asset = await env.ABUELA_DB.prepare('SELECT * FROM assets WHERE key = ?').bind(key).first();
  if (!asset) return new Response('Not found', { status: 404, headers: corsHeaders() });

  const obj = await env.PAPER.get(asset.r2_key);
  if (!obj) return new Response('Not digitized', { status: 404, headers: corsHeaders() });

  const headers = new Headers(corsHeaders());
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=86400');
  return new Response(obj.body, { headers });
}

// ---------------------------------------------------------------------------
// Admin — bearer-gated CRUD, matching the KYR builder's pattern (token in
// localStorage, sent as Authorization: Bearer).
// ---------------------------------------------------------------------------

function authed(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  return !!env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
}

const ADMIN_TABLES = {
  commands: ['name', 'aliases', 'args_spec', 'handler', 'help_en', 'help_es', 'unlocked_at_flag', 'sort_order', 'active'],
  responses: ['command_id', 'trigger', 'match_mode', 'priority', 'body_en', 'body_es', 'ack', 'variants', 'typing_ms', 'requires_flag', 'sets_flag', 'asset_key', 'active'],
  glossary: ['term_es', 'gloss_en', 'note', 'first_seen_in', 'unlocked_at_flag'],
  assets: ['key', 'r2_key', 'kind', 'caption_en', 'caption_es', 'unlocked_at_flag'],
  suppliers: ['code', 'name', 'tier', 'region', 'thread', 'note_en', 'active'],
  ledger_entries: ['supplier_id', 'period', 'amount', 'delta', 'mode', 'flagged', 'note_en'],
  unlock_codes: ['code', 'grants', 'note', 'active'],
  flags: ['key', 'label_en', 'label_es', 'sort_order', 'trigger_note', 'spoiler'],
};

async function admin(request, url, env) {
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);

  const parts = url.pathname.replace('/api/admin/', '').split('/');
  const table = parts[0];
  const id = parts[1];

  // The miss log — the reason this admin exists. Shows what people actually
  // typed that nothing answered, most frequent first, ready to promote.
  if (table === 'misses') {
    const { results } = await env.ABUELA_DB.prepare(
      `SELECT input, COUNT(*) AS n, MAX(at) AS last_at FROM session_log
        WHERE source IN ('miss','llm') GROUP BY input ORDER BY n DESC, last_at DESC LIMIT 200`
    ).all();
    return json({ rows: results });
  }

  if (table === 'bump') {
    await env.ABUELA_DB.prepare(
      'UPDATE content_meta SET version = version + 1, updated_at = ? WHERE id = 1'
    ).bind(Date.now()).run();
    const row = await env.ABUELA_DB.prepare('SELECT version FROM content_meta WHERE id = 1').first();
    return json({ version: row.version });
  }

  const cols = ADMIN_TABLES[table];
  if (!cols) return json({ error: 'unknown table' }, 400);

  if (request.method === 'GET') {
    const { results } = await env.ABUELA_DB.prepare(`SELECT * FROM ${table} LIMIT 500`).all();
    return json({ rows: results });
  }

  if (request.method === 'POST') {
    const data = await request.json();
    const use = cols.filter((c) => data[c] !== undefined);
    if (!use.length) return json({ error: 'no fields' }, 400);
    const sql = `INSERT INTO ${table} (${use.join(',')}) VALUES (${use.map(() => '?').join(',')})`;
    const res = await env.ABUELA_DB.prepare(sql).bind(...use.map((c) => data[c])).run();
    return json({ ok: true, id: res.meta.last_row_id });
  }

  if (request.method === 'PUT' && id) {
    const data = await request.json();
    const use = cols.filter((c) => data[c] !== undefined);
    if (!use.length) return json({ error: 'no fields' }, 400);
    const sql = `UPDATE ${table} SET ${use.map((c) => `${c} = ?`).join(', ')} WHERE ${table === 'flags' || table === 'assets' || table === 'unlock_codes' ? (table === 'flags' ? 'key' : table === 'assets' ? 'key' : 'code') : 'id'} = ?`;
    await env.ABUELA_DB.prepare(sql).bind(...use.map((c) => data[c]), id).run();
    return json({ ok: true });
  }

  if (request.method === 'DELETE' && id) {
    const keyCol = table === 'flags' || table === 'assets' ? 'key' : table === 'unlock_codes' ? 'code' : 'id';
    await env.ABUELA_DB.prepare(`DELETE FROM ${table} WHERE ${keyCol} = ?`).bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'bad method' }, 405);
}

// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (path === '/api/boot') return await boot(url, env);
      if (path === '/api/panels') return await panels(url, env);
      if (path === '/api/exec' && request.method === 'POST') return await exec(request, env);
      if (path.startsWith('/paper/')) return await servePaper(path, env);
      if (path.startsWith('/api/admin/')) return await admin(request, url, env);
    } catch (err) {
      return json({ error: 'internal', detail: String(err && err.message) }, 500);
    }

    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    // These load from a fixed unversioned URL and change often — without this,
    // the edge can serve a stale console after a push.
    if (path === '/' || path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')) {
      out.headers.set('Cache-Control', 'no-cache, must-revalidate');
    }
    return out;
  },
};
