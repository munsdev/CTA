# storm-watch — Cloudflare deployment notes

Recovered/verified 2026-08-07. `CLAUDE.md` covers the dev/build workflow;
this covers what's actually live on Cloudflare and what's still missing.

## Live resources
- **Worker**: `storm-watch` (id `a8018406f05a4b86b05ad9aa1ecead0e`)
- **D1 database**: `storm-watch` (uuid `e7204f5e-5a6e-4fa8-b5a8-4dcd00b568f2`),
  single `games` table (schema matches `schema.sql` in this dir)
- **Assets binding**: `ASSETS` → `./public` (native Workers Assets, not
  Workers Sites — no separate KV namespace to inspect)
- **Cron**: nightly cleanup of games untouched 7+ days (`scheduled()` in
  `src/worker.js`). Deployed schedule not directly confirmed via API;
  `wrangler.toml` here says `0 4 * * *`.

As of the pull, D1 held 2 live game rows (ids `408782`, `479802`,
2-player games). Not archived here — pull fresh with:
```
wrangler d1 execute storm-watch --remote --command "SELECT * FROM games" --json
```

## Not recoverable via API
- No env vars/secrets exposed by the Workers API (none appear required by
  this worker's code — no `env.*_API_TOKEN` or similar in `src/worker.js`).

## Ruled out — NOT part of this project
While tracing "Bird Rebels" resources on the account, also found an R2
bucket `bird-rebels-images`, KV namespace `BIRD_REBELS_KV`, and D1
database `bird_rebels_db` (all created 2026-07-13). These belong to an
unrelated Printify/Printful merch pipeline (`merch-engine-api` /
`-create` / `-publish` workers — the admin UI is literally titled
"Merch Engine — Bird Rebels Edition"). Same brand name, different system;
don't confuse them with this game if working on the wider Bird Rebels
account.

## Provenance
- `src/worker.js`, `wrangler.toml`, `schema.sql` were confirmed to match
  the live deployed worker byte-for-byte (via Cloudflare's Workers API)
  before this repo copy was made.
- Full source (`src/client/*`, `public/index.html`, build tooling) came
  from a local dev copy (`stormwatchdev.zip`), not the API — Cloudflare
  doesn't expose a Worker's Assets bundle via any available tool.
- `reference/legacy-static-v5/` is a separate, older static prototype
  found alongside the dev copy — not wired to the worker, kept for
  reference only.
