# Bird Rebels: Storm Watch

A 1–4 player card game — US states-as-birds vs. "storm" event cards — served
as a Cloudflare Worker with a D1-backed game store. This doc is the single
entry point for picking the project back up from nothing.

## TL;DR

- **Live at**: worker `storm-watch`, deployed to Cloudflare
- **Source**: this directory (recovered from a local dev copy + verified
  against the live deployment — see [DEPLOYMENT.md](./DEPLOYMENT.md))
- **Stack**: vanilla JS client (no build framework, no bundler) + Cloudflare
  Worker API + D1. Single assembled HTML file served as a static asset.
- **To build**: `python3 src/client/build.py`
- **To deploy**: `wrangler deploy`

## How the game works

Players race to "beat" a sequence of storm cards by playing bird cards
(US states) from their hand that satisfy the storm's condition (e.g. "1
Cardinal AND 2 Migratory"). Storms resolve over up to 2–3 rounds; unresolved
storms can trigger extra effects (more draws, forced plays, etc.) defined
per-card in `fx`. Win condition: beat more than half the storms in the
game (configurable in Settings).

Each bird card carries three axes used for condition-matching:
- **Region** — geographic (Pacific, Mountain, Great Plains, South Central,
  Midwest, Southeast, Appalachia, Mid-Atlantic, New England, Caribbean)
- **Migration** — Resident / Migratory, assigned per-state
- **Habitat** — *currently live, but slated for replacement* — see
  "In-flight redesign" below

Some cards also carry a **power** (`et` field: Substitute / Substitute2 /
Substitute+ / Count / Draw / Modifier / Victory Points) that affects
condition-matching or triggers an effect when played. Not all powers are
wired into the engine yet — see Known gaps.

## Project structure

```
src/worker.js          Cloudflare Worker API — D1-backed, serves public/ via ASSETS binding
src/client/data.js     Card + storm data (BIRDS[], STORMS[])
src/client/engine.js   Card evaluation logic (evalStorm, parseCond, etc.)
src/client/sm.js       Game state machine (pure JS, no framework)
src/client/ui.js       React UI layer (no JSX — h() calls)
src/client/build.py    Assembles the above into public/index.html
public/index.html      Assembled single-file client — DO NOT edit directly
wrangler.toml          Cloudflare deploy config
schema.sql             D1 schema
reference/legacy-static-v5/   Older static multi-page prototype, not wired to the worker — reference only
```

## Build + deploy workflow

```bash
python3 src/client/build.py   # assembles public/index.html from src/client/*
wrangler deploy               # deploys worker + public/ to Cloudflare
```

**Rules:**
- Edit source files in `src/client/`, never `public/index.html` directly.
- After any `src/client/` edit, run `build.py` before deploying.
- D1 binding variable name must be exactly `DB`.

## Data model

Single D1 table:

```sql
CREATE TABLE games (
  id           TEXT PRIMARY KEY,      -- 6-digit game number
  player_count INTEGER NOT NULL,
  state        TEXT NOT NULL,         -- full game state as JSON
  rev          INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL       -- used for 7-day cleanup
);
```

`state` holds the entire game (deck, hands, flock, storms, phase, log, etc.)
as one JSON blob, versioned by `rev` for optimistic concurrency on writes.
A nightly cron (`scheduled()` in `src/worker.js`) deletes games untouched
for 7+ days.

## API

- `POST /api/games` — create a game (`{playerCount, state}` → `{id, playerCount, rev}`)
- `GET /api/games` — list recent games (id, playerCount, timestamps)
- `GET /api/games/:id` — fetch a game's full state
- `PUT /api/games/:id` — update state (`{state}` → bumps `rev`)
- `DELETE /api/games/:id` — delete a game

## Key engine functions

```
freshGame(playerCount, enabled[], names{}, stormCount) → G
evalStorm(flock[], storm) → bool
r1Resolve, r2Play, r3Play, r3Pass, retrieveCard, skipRetrieval
```

## In-flight redesign (decided, not yet built)

**Three-Axis Redesign** — replaces Habitat with a new **Resistance Style**
axis (Mobber / Sentinel / Evader / Defender), hand-authored per-card so
same-species cards (e.g. the 7 Cardinal states) differ on personality, not
just region. Region and Migration stay, with Migration re-audited per-state
against real biology instead of assigned by species. Full rationale,
implementation notes, and known storm-text fallout (e.g. Shifting Winds'
"Forest" condition needs rewriting) are in [BACKLOG.md](./BACKLOG.md).

## Known gaps (as of last backlog capture)

- Several bird "power" effects (Draw, Modifier/retrieval) are defined in
  data but never wired into the engine — only static substitute/count
  powers currently affect play.
- No richer per-storm resolution log (who won with what) — flagged for a
  popup + detail upgrade.
- No toasts for turn changes / storm outcomes.
- Site-admin (all-games list) and per-game table-master role are both
  currently gated the same way — flagged for a split.
- Full backlog, plus a "SHIPPED 2026-06-10" changelog entry, in
  [BACKLOG.md](./BACKLOG.md).

## Standing rule

**Never write or change code until Casey explicitly approves. Discuss
first, always.** (Carried over from the project's own CLAUDE.md — repeating
it here since this README is the more likely first-read.)

## Where things live

- [CLAUDE.md](./CLAUDE.md) — condensed dev-workflow notes (mirrors much of
  this doc, kept as-is since it's what the project's own tooling expects)
- [BACKLOG.md](./BACKLOG.md) — full backlog + redesign rationale + changelog
- [DEPLOYMENT.md](./DEPLOYMENT.md) — live Cloudflare resource IDs,
  provenance of this recovered source, and a note ruling out an unrelated
  "Bird Rebels"-branded merch pipeline found during discovery (don't
  confuse `bird-rebels-images` / `BIRD_REBELS_KV` / `bird_rebels_db` with
  this project — different system, same account, same brand name)
