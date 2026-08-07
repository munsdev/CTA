# Know Your Rights — Handoff / Status (schema v2 rebuild)

*Single source of truth for picking this up cold — a different session, a
different person, a different AI. Supersedes the original
`know-your-rights-start-prompt.md` build brief and the earlier
`kyr-bible.md` for anything about the v2 rebuild. Where this disagrees with
either, this wins. `rebuild/ARCHITECTURE.md` is the deeper technical
companion to this doc — read this first, that second if you need the
schema/migration reasoning in full.*

Last updated: 2026-07-24, mid-rebuild. **Nothing here has reached real
players yet** — see §7 for exactly what "done" does and doesn't mean right
now.

---

## 1. What this game is (unchanged intent)

A standalone browser minigame teaching people what to do when federal
agents show up — at the door, in a car stop, on the street, outside a
store, at a job site. Own visual identity, not the Nazi Games suite, not
Reflecting Pool. Legal accuracy is load-bearing, not flavor: a wrong answer
in this game maps to advice someone could act on with agents in front of
them.

Only **"At the door"** is ship-quality. The other four scenes
(car/street/store/site) are cut from this rebuild — see §8.

---

## 2. Why a rebuild happened

The pre-rebuild stack (still what's live to real players — see §7) had
three structural problems:

1. **Two engines in one file.** The old `engine.js` ran a legacy `beats[]`
   engine (car/street/store/site) and a `graph` engine (door) in parallel,
   every core function doubled, half of it serving content that couldn't
   ship (unverified legal claims, `active:0`).
2. **Repo lied about the backend.** The committed Worker source was stale —
   version + legacy `/scenes` only. The *deployed* Worker already had a
   full graph read/write API that was never committed. Fixed this session
   (§4).
3. **Content was over-normalized.** Seven relational D1 tables, six-query
   reassembly per scene read, identical layer-rules JSON duplicated onto
   every card, to serve a handful of hand-authored narrative scenes.

## 3. The decisions that shape everything (all made this session, all final)

- **One engine. Graph-only. Backdrop art. Repo = source of truth.**
- **Legacy scenes cut**, not ported. car/street/store/site stay exactly as
  they are in the old `engine.js`/D1 (frozen, not deleted) until each is
  rebuilt as a real graph+backdrop scene with new art and verified legal
  claims. Door ships alone.
- **Art is backdrops, not layer compositing.** First pass of this rebuild
  generalized the door's SVG-layer/rules/flags system into engine-generic
  primitives — it worked, but composing a picture out of conditional logic
  is a programming task, not an authoring one. **Replaced wholesale**: a
  scene has a library of complete, pre-made pictures (a **backdrop**
  library); every **card** just names the one backdrop it shows. No
  compositing, no conditions, no scene state driving what's on screen.
- **Content is one JSON object per scene** (`schema: 2`), one D1 row, one
  query to read, edited as one object by the builder.
- **Engine is greenfield.** Written from scratch against schema v2 — no
  `beats[]`, no `pixelize`/LUT/palette/`officer()` canvas art, no
  `if (scene==='door')` special-casing anywhere.

**Binding nomenclature** — use these terms everywhere, code and conversation:

| Term | Means |
|---|---|
| **Scene** | One whole situation (e.g. "At the door"). |
| **Backdrop** | One complete picture belonging to a scene, in its picture library. |
| **Card** | One moment in a scene — the line(s) + answer options. Names one backdrop. |
| **Answer** | A player choice on a card. |
| **Meter** | Hidden number, rolled at the end (e.g. `detain`). |
| **Credit** | A result-screen checklist item. |

## 4. Schema v2 — the contract

Full detail and the worked example (`door.json`) live in
`rebuild/ARCHITECTURE.md` §3. Shape, for reference:

```
{
  slug, schema:2,
  meta:      { name, art, teaches, floor, exitAt, exitDeny, open, law, active, sortOrder,
               forcedEntry?: { chance, backdrop, text } },
  backdrops: [{ id, title, file }],
  npcs:      [{ id, label }],
  meters:    [{ key, label, max, fatalAt, primary }],
  credits:   [{ key, label }],
  start:     <cardId>,
  cards:     { <cardId>: { type?:'end', fatal?:true, backdrop?, responses:[…], answers:[…] } }
}
```

`Answer = { text, goto, grade, meters:{key:delta}, credits:[key…], damaged?, why? }`.
`grade` is one of `shield|steady|soft|harmful|severe|fatal` — same six-tier
scale as the original brief (delta table: shield 0, steady −8, soft +12,
harmful +30, severe +45, fatal → meter max, ends the scene immediately).

## 5. The mechanic (unchanged from original design — still binding)

- **Two outcomes tracked separately**: will they take you (the primary
  meter, hidden, rolled once at the end, floored by law), and is your case
  intact (pure player choice — did any answer set `damaged`).
- **Four endings**: `clean` (walked away, gave nothing), `lucky` (walked
  away, gave something — luck, not a plan), `intact` (**detained anyway,
  case clean** — the most important screen in the game: "They took you
  anyway. You gave them nothing. That is what a lawyer will need."),
  `damaged` (detained, and they took what you gave them). Endings are
  global (an `endings` table server-side), not per-scene.
- **Fatal options must read as the reasonable, de-escalating choice**,
  never the obviously wrong one — that's the whole teaching mechanism.
- **The escape hatch** ("Am I free to go?") succeeds only at/below the
  scene's `exitAt`. The door has none — `exitAt: null` — you win by never
  opening it.
- **Forced entry**: on a floor-0, undamaged, zero-risk clean run, a
  `meta.forcedEntry.chance` roll can still detain the player (~20% for the
  door) — the point being even a perfect run isn't a guarantee, which is
  itself the lesson.
- **The fifty-state rule** (still binding for any future scene writing): no
  `shield`-grade line may depend on which state the player is in. "I am
  going to remain silent" passes everywhere; "I don't have to give you my
  name" does not (stop-and-identify laws vary). Filter applied before
  writing, not after.

## 6. Where everything lives

### Repo
`munsdev/CTA`, working branch **`claude/know-your-rights-8476gd`** — **not
merged to `main`**. Path: `games/know-your-rights/`.

### Three `engine.js`-shaped things — do not confuse them

| File | Status | Model |
|---|---|---|
| `games/know-your-rights/engine.js` | **Live in production today**, pinned via a jsDelivr commit SHA in the Webflow CMS embed | Old: two-engine (`beats[]` + graph), SVG-layer compositing |
| `games/know-your-rights/rebuild/engine.js` | v2 source of truth, not yet cut to production | New: single graph engine, backdrops |
| `workers/kyr-content/public/play.html` | v2 engine **inlined** and hosted as a static asset directly off the `kyr-content` Worker, for testing against the real backend without touching production | Same code as `rebuild/engine.js`, just bundled |

### Three `builder`-shaped things — also do not confuse them

| File | Status | Talks to |
|---|---|---|
| `builder/index.html` (repo root) | Old v1 builder, still technically functional (its backend routes are untouched) but superseded | `/api/kyr/graph/*` (relational, per-card writes) |
| `games/know-your-rights/rebuild/builder.html` | **v2 source of truth** — backdrop-native, verified round-trips `door.json` byte-for-byte | `/api/kyr/v2/*` |
| `workers/kyr-content/public/builder.html` | Copy of the above, hosted as a static asset for real testing | same |

### Rebuild-specific files (all under `games/know-your-rights/rebuild/`)

- `ARCHITECTURE.md` — the deep design record (why, schema, migration plan)
- `door.json` — the door scene, schema v2, canonical content
- `engine.js` — the greenfield v2 engine
- `builder.html` — the v2-native builder
- `backdrops/*.png` — the door's 4 backdrops (`closed-window`,
  `closed-warrant`, `cracked-two-agents`, `open-two-agents`), composited
  from the original SVG layers as a one-time bridge so the door works under
  the new model without new art. Any *new* scene just uploads its own
  images directly — no compositing step.
- `test.html` + `drive.mjs` — Playwright harness, drives the door against a
  local `door.json` fixture. **11/11 passing** as of last run (all four
  endings, both recovery loops, RECORD note, correct backdrop per card
  including the fatal door-swing).
- `gen-seed.js` — scratch helper that turns `door.json` into the INSERT SQL
  used to seed D1 (not committed — machine-specific `/tmp` output path,
  regenerate if needed).

### Worker (`workers/kyr-content/`)

- `src/index.js` — reconciled with what was actually deployed (the repo
  copy had drifted stale before this session), plus new v2 routes, plus
  everything legacy untouched. See §4 of `ARCHITECTURE.md` for the full
  route table.
- `wrangler.toml` — D1 binding (`KYR_DB` → `kyr-content-db`,
  `fa82b7ca-a3c3-4ce4-9739-d96345895395`) plus a new `[assets]` block
  (`directory = "./public"`) added this session.
- `public/` — static assets hosted directly off the Worker: `index.html`
  (landing, links both), `play.html` (the game), `builder.html` (the
  builder), `backdrops/*.png`.

### Live URLs

- Worker: `https://kyr-content.casey-945.workers.dev`
- Landing: `.../` — links to both of the below
- Game (v2, real backend): `.../play.html`
- Builder (v2, real backend): `.../builder.html`

### D1 (`kyr-content-db`, `fa82b7ca-a3c3-4ce4-9739-d96345895395`)

New table, additive, doesn't touch the seven legacy relational tables:

```
scene_graphs ( slug TEXT PRIMARY KEY, scene_json TEXT, sort_order INT, active INT, updated_at )
```

Currently holds one row: `door`. `content_meta` (id=1, version, updated_at)
and `endings` are unchanged, shared with the legacy content.

---

## 7. Exactly where things stand right now (don't assume more than this)

**Confirmed working, verified via live `curl`:**
- `GET /api/kyr/version` → `{"version":2}`
- `GET /api/kyr/v2/scenes` → lists `door` with full meta
- `GET /api/kyr/v2/scenes/door` → full scene object
- `GET /api/kyr/scenes` (legacy) → still `200`, untouched
- `PUT /api/kyr/v2/scenes/door` with no `X-KYR-Auth` → `401 unauthorized`
  (confirms `KYR_BUILDER_SECRET` survived the Worker code deploy intact)

**Deployed but unconfirmed:** the *second* deploy — the one adding
`[assets]`/`public/` (game + builder as static pages on the Worker) — was
pushed to Casey to run locally (`wrangler deploy` after downloading a zip).
**No success output was ever pasted back.** Don't assume `/play.html` or
`/builder.html` resolve until that's checked:
`curl -o /dev/null -w '%{http_code}\n' https://kyr-content.casey-945.workers.dev/play.html`
should be `200`.

**Not yet done — checked directly in D1, last checked 2026-07-24:**
- `scene_graphs.door.updated_at` is still the *original seed* timestamp —
  **no save has ever been made through the v2 builder against the live
  backend.** The full loop (builder → save → D1 write → game reflects it)
  has been proven **offline only** (the round-trip identity test, §4/§6),
  never live end-to-end.
- `content_meta.version` hasn't bumped since before this session either,
  consistent with the above.
- Whether Casey ever set/rotated `KYR_BUILDER_SECRET` and put the matching
  value into the builder's Keys modal is **unknown** — the last message in
  this thread was me explaining how to do that, no confirmation received.

**Not started:**
- **Production cutover.** The Webflow-embedded game people actually play is
  still 100% the *old* engine/loader, pinned to an old commit SHA. Nothing
  in this rebuild is live to real players. Cutover is: push
  `rebuild/engine.js` (+ styles.css + a matching loader.js) as the new
  `games/know-your-rights/{loader.js,engine.js,styles.css}` trio, repin the
  jsDelivr SHA in the Webflow CMS embed, bump `content_meta.version`,
  verify.
- Retiring anything legacy (old builder, old tables/routes, `scenes.json`)
  — deliberately deferred until v2 is proven live.

## 8. What's explicitly deferred (not forgotten, not blocking)

- **car/street/store/site** — frozen in the old `beats[]`/relational D1
  shape. Per-scene, someone needs to decide: port to schema v2 (needs new
  backdrop art per scene, plus the legal-claims verification below) or
  retire outright. Not started.
- **Legal claims never verified** (flagged in the *original* brief's Phase
  0, still true): the 100-mile CBP border-zone claim, stop-and-identify
  state variance, and the employer-consent-at-worksite claim (construction
  site scene). **Door's claims were verified in the original brief's Phase
  0 — that's still good.** Nothing about the other four scenes ships until
  their claims are checked against current sources.
- Old `builder/index.html` (v1) — still functional against untouched
  `/api/kyr/graph/*` routes, but superseded. Leave it or delete it once v2
  is proven; not urgent either way.

## 9. Operational notes worth knowing before you touch any of this again

- **Cloudflare deploys cannot happen from an agent sandbox session** — this
  session's outbound network policy blocks `api.cloudflare.com` and
  `*.workers.dev` outright (403 at the egress proxy, confirmed, and this is
  a deliberate org policy, not a bug — don't spend time routing around it).
  All Worker deploys this session went through Casey's own terminal via
  `wrangler deploy`, with the code prepared and handed over as files.
- **Cloudflare Workers Static Assets** (`[assets] directory = "./public"`
  in `wrangler.toml`): assets are served *before* the Worker's `fetch()`
  runs; anything with no matching static file falls through to the Worker
  code. This is why adding `public/` required zero changes to
  `src/index.js` — `/api/kyr/*` never matches a file, so it always reaches
  the handler.
- **Secrets survive `wrangler deploy`** as long as the script name doesn't
  change and you don't explicitly delete them — `KYR_BUILDER_SECRET`
  wasn't in `wrangler.toml` and wasn't touched by either deploy this
  session, confirmed empirically (still gated correctly after deploy #1).
- **This chat environment's file-download flow strips hyphens** from
  suggested filenames (`kyr-v2-worker-index.js` → `kyrv2workerindex.js`
  landed in Downloads). If handing off more files this way, expect it and
  tell the recipient to `ls ~/Downloads` and adjust `cp` targets rather
  than assume the name matches.
- D1 writes/reads work fine directly from an agent session (the
  `d1_database_query` tool is a distinct, unrestricted path) — only the
  Workers *deploy* surface is blocked. Use that tool freely to check
  `scene_graphs`/`content_meta` state without needing Casey's terminal.

## 10. How Casey works (carry into every session on this project)

- Phone-first. Build, test, deploy, then report — don't ask permission at
  each step for reversible/local work; do check in before anything that
  touches shared/live infrastructure (a Worker deploy, a D1 schema change,
  a Webflow publish).
- Verify before shipping: any statute, statistic, or quotation goes in only
  once checked; if it can't be verified, cut it and say so.
- Plain language: one idea per sentence, no assumed knowledge, digits not
  spelled-out numbers.
- Test with Playwright before calling something done; screenshot the
  states. `ElementHandle.click()` fails on moving elements — use bounding
  rects + `page.mouse.click()`.
- Flag decisions, then build immediately. Corrections apply broadly, not
  just to the flagged instance.
- Give unique, hyphen-tolerant filenames when handing off downloads (see
  §9) and exact copy-paste terminal blocks — Casey runs them verbatim.
