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

- **One engine. Graph-only. Backdrop art. Repo = source of truth.**
- **Legacy scenes cut.** car/street/store/site removed from the engine. Their
  writing is preserved (D1 + old `engine.js` history) and each will be rebuilt as
  a proper graph scene, with its own backdrops, when its art is drawn and its
  legal claims verified. Door is the only ship-quality scene and ships alone, clean.
- **Content is one JSON object per scene** (`schema: 2`), stored as a single
  `scene_json` row in D1, served whole in one query, consumed directly by the
  engine, edited as one object by the builder. See `door.json` for the canonical
  shape and `#3`.
- **Engine is greenfield.** New `engine.js` written from scratch against schema
  v2 — no `beats[]`, no `pixelize`/LUT/palette/`officer()` canvas machinery, no
  `if (S.sc.art==='door')` special-casing.
- **Preserved from the old build (mechanic + plumbing, not architecture):**
  the four endings (`clean`/`lucky`/`intact`/`damaged`), risk floor + case-intact
  split, fatal-as-the-reasonable-choice, the escape hatch, RECORD/timer/hint HUD,
  the typewriter dialogue box, `fit()`, the boot-gate loader, the
  cache-then-refresh content load, the day/night title choice **as a palette axis
  only** (no gameplay effect).

## 2. Art model: backdrops, not layer compositing (revised after first pass)

The first pass of this rebuild generalized the door's layer/rules/flags system
(full-frame SVG layers, toggled by conditions evaluated against scene state)
into engine-generic primitives. That worked, but Casey's read on it was right:
composing a picture out of conditional logic is a programming task, not an
authoring one. **Replaced wholesale** with a flat model:

- A scene declares a **backdrop library** — a handful of complete, pre-made
  images (SVG or PNG), each with an id and a title.
- Every **card** names exactly **one backdrop**. That's the whole art story for
  that moment. No compositing, no conditions, no scene state driving what's
  on screen.
- The engine's entire art responsibility is: build one `<img>` per backdrop,
  show the one the current card names, hide the rest.

This removes `art.layers`/`art.base`/`art.rules`, per-card `layers`/`rules`
overrides, and **scene `flags` entirely** — nothing in schema v2 reads or
writes scene state to decide what's drawn anymore. `warrantShown` and
`doorState`, the two things flags existed for, are now just which backdrop a
card points at (`closed-warrant`, `cracked-two-agents`, etc.) — decided once,
by hand, when the card is authored.

**Consequence for the door specifically:** the two moments that used to be
*reactive* (the second agent appearing once risk climbs past 30, the warrant
swap) are now **fixed per card** — each door card was assigned the backdrop
that matches what actually happens on that path. Four backdrops cover the
whole scene: `closed-window`, `closed-warrant`, `cracked-two-agents`,
`open-two-agents`. The first three were composited from the original layered
SVGs (`rebuild/backdrops/*.png`) as a one-time bridge so the door keeps working
under the new model without new art; any *new* scene just uploads its own
backdrop images directly — no compositing step required.

**Nomenclature (binding — use these terms everywhere: code, UI, docs):**

| Term | Means |
|---|---|
| **Scene** | One whole situation (e.g. "At the door"). |
| **Backdrop** | One complete picture belonging to a scene, in its picture library. |
| **Card** | One moment in a scene — the line(s) + answer options. Names one backdrop. |
| **Answer** | A player choice on a card. |
| **Meter** | Hidden number, rolled at the end (e.g. `detain`). |
| **Credit** | A result-screen checklist item. |

## 3. Scene-graph schema v2 (the contract)

One object per scene. Full worked example: `door.json` (validated: 12 cards, all
reachable, all `goto`s resolve, all backdrop/credit/meter references resolve).

```
{
  slug, schema:2,
  meta:      { name, art, teaches, floor, exitAt, exitDeny, open, law, active, sortOrder,
               forcedEntry?: { chance, backdrop, text } },
  backdrops: [{ id, title, file }],
  npcs:      [{ id, label }],
  meters:    [{ key, label, max, fatalAt, primary }],
  credits:   [{ key, label }],             // = end-screen checklist keys
  start:     <cardId>,
  cards:     { <cardId>: Card }
}

Card = { type?:'end', fatal?:true,          // omit type for a normal card
         backdrop?: <backdropId>,           // the picture shown while this card plays
         responses:[{ speaker, mode, texts:[…] }],
         answers:[ Answer ] }

Answer = { text, goto,
           grade,                            // shield|steady|soft|harmful|severe|fatal (hint + semantics)
           meters:{ <key>:delta },           // applied, floored at scene floor, capped at meter max
           credits:[key…],                   // ticked on the end-screen checklist
           damaged?:true,                    // marks the case damaged
           why? }                            // narration line (required on fatal)
```

**Fatal flow:** an answer with `grade:'fatal'` sets the primary meter to its max,
jumps to its `goto` (an `end` card, `fatal:true`, usually with its own `backdrop`
— e.g. the door swinging open), prints `why` as narration, then finishes as
detained.

**Forced entry** (`meta.forcedEntry`): on a floor-0, undamaged, zero-risk clean
run, a `chance` roll can still detain the player — the scene's `backdrop` is
shown (typically the same "door open" look as the fatal end) and `text` replaces
the normal ending truth line.

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

1. **Contract + engine, offline. Done.** `door.json` (backdrop model) +
   greenfield `engine.js`, tested against the local fixture via Playwright
   (11/11: all four endings, both recovery loops, RECORD note, correct
   backdrop per card incl. the fatal door-swing). Prod untouched.
2. **Builder, offline. Done.** `builder.html` rebuilt around the backdrop
   model — a Backdrops panel (upload + title), a per-card backdrop picker with
   live thumbnail, "Check graph" validator. Proven by round-trip: `importV2`
   then `buildSceneV2()` deep-equals `door.json`. Prod untouched — still
   pointed at endpoints that don't exist yet.
3. **Backend (not started).** New Worker source in repo (fixes problem #2 —
   the deployed Worker's real routes aren't in git); `scene_graphs` table
   created; door migrated (live D1 graph → one `scene_json` row in the new
   backdrop shape); `/v2` endpoints built and verified against the builder.
4. **Wire + verify.** Engine and builder point at `/v2` for real; full
   Playwright pass against the live Worker.
5. **Cut over.** Push all three game files; repin the jsDelivr embed to the
   new commit SHA; bump `content_meta.version`. Confirm live.
6. **Reconcile & clean.** Delete stale `scenes.json`; retire the legacy
   `beats/rounds/options/cards/answers/card_responses/layers/checklist_items`
   tables and the `/graph`+legacy `/scenes` routes once nothing reads them.

Nothing in steps 1–2 touches what production serves; production only moves at
step 5, behind a deliberate SHA repin.

## 6. Unchanged commitments (from the Design Bible, still binding)

Art direction (old-cartridge, first-person, one officer, `IMMIGRATION` never a
real agency, amber = light only). The fifty-state rule on every `shield` line.
Legal accuracy is load-bearing. No reward code. `.pr-` namespace,
`window.KnowYourRights`, `[data-know-your-rights]` mount. About-page disclaimer
(educational, not legal advice; judicial-warrant and ~100-mile-border-zone
caveats; talk to a lawyer). Verify-before-ship on every legal claim.
