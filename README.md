# CTA

Code, engines, and assets supporting Casey The American (caseytheamerican.com).

The live site is served via Cloudflare reverse proxy in front of Webflow
(cta2026.webflow.io), which handles CMS and page structure. This repo holds
things too large or too custom to live inline in Webflow — starting with
game engines, loaded as hosted scripts.

## Games

Each game's engine lives in `games/{slug}/engine.js`, loaded into a Webflow
CMS item via a small markup+style shell and a `<script src>` pointing here
via jsDelivr:

https://cdn.jsdelivr.net/gh/{user}/CTA@main/games/{slug}/engine.js

- `dc-lagoon` — The DC Lagoon (Reflecting Pool project)
- `the-quota` — The Quota (Casey The American)
- `history-or-headlines` — History or Headlines (Casey The American)
- `know-your-rights` — (planned)

See `casey-minigame-contract-v1.md` for the shared shell/token architecture.
