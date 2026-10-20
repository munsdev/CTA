# Know Your Rights — web app

A standalone rebuild of the Know Your Rights game: practise what to say, and
what not to do, when immigration agents come to your door. It replaces the
jsDelivr-embedded `games/know-your-rights/` engine, the `kyr-content` D1 API and
both builders.

Stack: Vite 8, React 19, TypeScript 6, Tailwind v4, zustand + immer, Vitest,
Playwright + axe. It deploys as a static-assets-only Cloudflare Worker named
`know-your-rights`.

## Run it

```sh
npm ci
npm run dev        # http://localhost:5173
npm run verify     # typecheck, lint, format check, unit tests, build
npm run e2e        # build, then Playwright on phone + desktop with axe
```

If Chromium is already installed (e.g. `/opt/pw-browsers`), point
`PW_CHROMIUM` at it instead of running `npx playwright install`.

## How it fits together

| Path                     | What                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `src/content/door.json`  | The door scene. **This file is the content source of truth.**                            |
| `src/content/index.ts`   | Scene list and the four endings                                                          |
| `src/domain/types.ts`    | Content model (scene → cards → answers)                                                  |
| `src/domain/engine.ts`   | The game as pure functions with an injected `rng`                                        |
| `src/domain/validate.ts` | Content checks; `validate.test.ts` runs them on every scene                              |
| `src/data/store.ts`      | zustand store wrapping the engine                                                        |
| `src/features/*`         | Title, play and result screens                                                           |
| `public/backdrops/`      | One complete picture per backdrop (1600×1440, 10:9)                                      |
| `public/_headers`        | Security headers, immutable caching for hashed assets, and which sites may frame the app |

## Editing a scene

Edit the JSON and run `npm test`. The validator fails the build if any of these
hold:

- a `goto` or backdrop doesn't exist;
- a card is unreachable, or can't reach an ending;
- a fatal answer doesn't end on a fatal card;
- a bad answer ends the scene without marking the case damaged;
- a credit can't be earned by playing well;
- the law line reads like an internal note.

Grades set the hidden risk (`GRADE_RISK` in `types.ts`):

| Grade   | Risk change             |
| ------- | ----------------------- |
| shield  | 0                       |
| steady  | −8                      |
| soft    | +12                     |
| harmful | +30                     |
| severe  | +45                     |
| fatal   | ends the scene detained |

**Legal content.** `review.status` in each scene is `draft` until an attorney
has reviewed it. `review.notes` lists what changed and what still needs
checking. Never shown to players.

## Embedding

The app is its own page. To show it on caseytheamerican.com, link to it or
iframe it. `public/_headers` allows framing from caseytheamerican.com and
cta2026.webflow.io only.
