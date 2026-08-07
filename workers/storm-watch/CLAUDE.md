# Bird Rebels: Storm Watch — Dev Notes for Claude Code

## Project structure
src/worker.js          — Cloudflare Worker API (D1-backed, serves public/ via ASSETS binding)
src/client/data.js     — Card + storm data (BIRDS[], STORMS[])
src/client/engine.js   — Card evaluation logic (evalStorm, parseCond, etc.)
src/client/sm.js       — Game state machine (pure JS, no framework)
src/client/ui.js       — React UI layer (no JSX, h() calls)
src/client/build.py    — Assembles the above into public/index.html
public/index.html      — Assembled single-file client (DO NOT edit directly)
wrangler.toml          — Cloudflare deploy config (fill in database_id)
schema.sql             — D1 schema

## Build + deploy workflow
python3 src/client/build.py   # assembles public/index.html
wrangler deploy               # deploys worker + public/ to Cloudflare

## Rules
- Edit source files in src/client/, never public/index.html directly
- After any src/client/ edit, run build.py before deploying
- D1 binding: variable name must be exactly "DB"
- Three card axes: Region, Role (Mobber/Sentinel/Evader/Defender), Migration
- Win condition: beat more than half the storms (configurable in Settings)

## Key engine functions
freshGame(playerCount, enabled[], names{}, stormCount) → G
evalStorm(flock[], storm) → bool
r1Resolve, r2Play, r3Play, r3Pass, retrieveCard, skipRetrieval

## Backlog
See BACKLOG.md
