# Know Your Rights — Rebuild Architecture (schema v2)

*The ground-up rebuild. Supersedes the two-engine `engine.js` and the 7-table
relational content model. Where this disagrees with the old build brief or the
Design Bible, this wins for anything under `rebuild/`.*

Repo: `munsdev/CTA` · Path: `games/know-your-rights/`
Content Worker: `kyr-content` → D1 `kyr-content-db` (`fa82b7ca-a3c3-4ce4-9739-d96345895395`)

---

## 0. Why rebuild

The old stack carried three structural problems, none of them in the *mechanic*
(the mechanic is good and is preserved wholesale):

1. **Two engines in one file.** `engine.js` (985 lines) ran a legacy `beats[]`
   engine and a `graph` engine in parallel, forked on `S.sc.mode==='graph'`.
   Every core function was doubled. ~250 lines of that served procedural-canvas
   art for four scenes that are all `active:0`, carry unverified legal claims,
   and cannot ship in their current form. Half the engine served content that
   could not ship.
2. **Repo lied about the backend.** The committed Worker was version + legacy
   `/scenes` only. The *deployed* Worker had the entire graph read endpoint
   **and a full builder write-API** — none of it in git. A redeploy from repo
   would have destroyed the builder and the live door scene's backend.
3. **Content was over-normalized.** Seven D1 tables
   (`cards`/`answers`/`card_responses`/`layers`/`meters`/`credits`/`npcs`), every
   read a 6-query reassembly, the identical layer-rules block copied onto all 13
   cards — to serve a handful of hand-authored narrative scenes nobody queries
   across.

## 1. The frame (decided)

- **One engine. Graph-only. SVG-only. Repo = source of truth.**
- **Legacy scenes cut.** car/street/store/site removed from the engine. Their
  writing is preserved (D1 + old `engine.js` history) and each will be rebuilt as
  a proper graph+SVG scene when its art is drawn and its legal claims verified.
  Door is the only ship-quality scene and ships alone, clean.
- **Content is one JSON object per scene** (`schema: 2`), stored as a single
  `scene_json` row in D1, served whole in one query, consumed directly by the
  engine, edited as one object by the builder. See `door.json` for the canonical
  shape and `#3`.
- **Engine is greenfield.** New `engine.js` written from scratch against schema
  v2 — no `beats[]`, no `pixelize`/LUT/palette/`officer()` canvas machinery, no
  `if (S.sc.art==='door')` special-casing. Meters and scene-flags are generic so
  scene #2 needs zero engine edits.
- **Preserved from the old build (mechanic + plumbing, not architecture):**
  the four endings (`clean`/`lucky`/`intact`/`damaged`), risk floor + case-intact
  split, fatal-as-the-reasonable-choice, the escape hatch, RECORD/timer/hint HUD,
  the typewriter dialogue box, `fit()`, the boot-gate loader, the
  cache-then-refresh content load, the day/night title choice **as a palette axis
  only** (no gameplay effect).

## 2. What generalized (the door-specific hacks that are now engine-generic)

| Old (door-hardcoded) | New (generic) |
|---|---|
| `S.doorState`, `S.warrantShown` baked into the loop | scene-declared `flags` map with initial values; answers set `flags`; rules read `flags` |
| `S.risk` aliased to a fake `detain` meter | first-class `meters[]`; the one marked `primary:true` is the end-of-scene roll |
| layer rules duplicated on every card | `art.base` + `art.rules` at scene level; a card may override with its own `layers`/`rules` but the door needs none |
| `paintGraphLayers` gated on `art==='door'` | any scene with an `art.layers` set renders through the same SVG compositor |
| `door:'warrant'` pseudo-state | just `flags:{ warrantShown:true }` |
| no-op `start` "Begin" bridge card | scene declares `start` card id directly |

## 3. Scene-graph schema v2 (the contract)

One object per scene. Full worked example: `door.json` (validated: 12 cards, all
reachable, all `goto`s resolve, all keys declared).

```
{
  slug, schema:2,
  meta:   { name, art, teaches, floor, exitAt, exitDeny, open, law, active, sortOrder },
  art:    { layers:[{key,file}], base:[key…], rules:[{ if, show }] },
  npcs:   [{ id, label, file }],
  meters: [{ key, label, max, fatalAt, primary }],
  flags:  { <name>: <initialValue> },
  credits:[{ key, label }],                // = end-screen checklist keys
  start:  <cardId>,
  cards:  { <cardId>: Card }
}

Card = { type?:'end', fatal?:true,          // omit type for a normal card
         responses:[{ speaker, mode, texts:[…] }],
         answers:[ Answer ] }

Answer = { text, goto,
           grade,                            // shield|steady|soft|harmful|severe|fatal (hint + semantics)
           meters:{ <key>:delta },           // applied, floored at scene floor, capped at meter max
           credits:[key…],                   // ticked on the end-screen checklist
           flags:{ <name>:value },           // mutate scene state
           damaged?:true,                    // marks the case damaged
           why? }                            // narration line (required on fatal)
```

**Rule predicate** (`art.rules[].if`): `{ flags:{ name:value | {not:value} }, meters:{ key:{gte,lte} } }`.
All clauses AND together; a rule with a matching `if` adds its `show` layer on
top of `base`. Same predicate grammar the door already used, generalized off the
hardcoded `door`/`door_not`/`warrantShown` keys.

**Fatal flow:** an answer with `grade:'fatal'` sets the primary meter to its max,
applies any `flags`, jumps to its `goto` (an `end` card with `fatal:true`), prints
`why` as narration, then finishes as detained.

## 4. Backend (schema v2)

Single table, single-object rows:

```
scene_graphs   ( slug TEXT PRIMARY KEY, scene_json TEXT, sort_order INT, active INT, updated_at )
content_meta   ( id=1, version, updated_at )        -- unchanged; still drives cache-bust
endings        ( key, stamp, truth )                -- unchanged; global, not per-scene
```

Worker routes:

- `GET  /api/kyr/v2/scenes`            → `{ version, endings, scenes:[{slug,meta}…] }` (menu index; no card bodies)
- `GET  /api/kyr/v2/scenes/{slug}`     → the full scene object (one row, one query)
- `PUT  /api/kyr/v2/scenes/{slug}`     → upsert whole object (builder), bumps `content_meta.version`  *(X-KYR-Auth)*
- `DELETE /api/kyr/v2/scenes/{slug}`   → delete + bump  *(X-KYR-Auth)*

The old `/api/kyr/scenes` and `/api/kyr/graph/*` routes stay live until cutover so
the currently-pinned production loader keeps working, then are removed. The
deployed Worker's real source is committed to the repo **as part of this rebuild**
(fixing problem #2) before any redeploy.

## 5. Migration & cutover (safe order — live game never breaks mid-flight)

1. **Contract + engine, offline.** `door.json` (done) + greenfield `engine.js`
   tested against the local fixture via a Playwright harness. Prod untouched.
2. **Backend.** New Worker source in repo; `scene_graphs` table created; door
   migrated (its live D1 graph → one `scene_json` row); `/v2` endpoints verified.
3. **Wire + verify.** Engine points at `/v2`; full Playwright pass (all four
   endings, recovery loops, hatch N/A for door, RECORD note, timer, hint).
4. **Cut over.** Push all three files; repin the jsDelivr embed to the new commit
   SHA; bump `content_meta.version`. Confirm live.
5. **Reconcile & clean.** Delete stale `scenes.json`; retire the legacy
   `beats/rounds/options/checklist_items` tables and `/graph`+`/scenes` routes
   once nothing reads them. Rework the builder to the single-object `/v2` shape.

Nothing in steps 1–3 touches what production serves; production only moves at
step 4, behind a deliberate SHA repin.

## 6. Unchanged commitments (from the Design Bible, still binding)

Art direction (old-cartridge, first-person, one officer, `IMMIGRATION` never a
real agency, amber = light only). The fifty-state rule on every `shield` line.
Legal accuracy is load-bearing. No reward code. `.pr-` namespace,
`window.KnowYourRights`, `[data-know-your-rights]` mount. About-page disclaimer
(educational, not legal advice; judicial-warrant and ~100-mile-border-zone
caveats; talk to a lawyer). Verify-before-ship on every legal claim.
