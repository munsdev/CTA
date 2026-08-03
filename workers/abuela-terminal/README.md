# Abuela — monitoring console

A browser ops console for *Abuela | A story by Casey Muns*. Not a chat toy: it's
the Hacker's private monitoring interface, rendered as a 2002-era dashboard with
a terminal at the center.

## What it is

Canon is explicit that Abuela is never conversational and nobody ever talks to
it — its only interface moments in the manuscript are terse internal log lines.
So the player isn't talking *to* the system, they're **operating** it. Free-text
input that isn't a command gets a flat rejection, and that refusal is the
characterization rather than a gap in coverage.

The console answers two questions at all times: what is the machine doing, and
how close are they to finding it.

## Layout

```
┌ strip: proceso · actividad · ops/s · mem ──────────────────────────┐
│ BANDERAS      │                                │ PAPEL             │
│ RIESGO +      │          CONSOLA               │ INVESTIGADORES    │
│  VARIANZA     │        (the terminal)          │ GLOSARIO          │
│ MODO/RESERVAS │                                │                   │
├ CINTA — endless tape of micro-edits ───────────────────────────────┤
```

## The variance mechanic

The one real mechanic, and it runs backwards on purpose. Canon: the system
deliberately does *not* balance its books precisely, because perfect
conservation is mathematically fingerprintable. Slop is camouflage.

So the danger zone on the variance gauge is at **zero**, not at the extremes.
Operating the console drifts variance downward — standing still is not safe —
and the player has to reintroduce slop (`varianza 0.4`) or detection risk
climbs. `computeRisk()` in `src/index.js` is the whole formula.

## Progression

Four states, transcribed from the manuscript rather than invented:

| State | Trigger |
|---|---|
| 0 | Nominal. Monitoring only. |
| 1 | A federal report gets logged as an official record. |
| 2 | Independent pattern recognition begins. Not yet reported. |
| 3 | Privately funded investigation. Objective is control, not exposure. |
| 4 | Full disclosure, on the operator's terms. |

Flag 3 and the ending are **sealed** until a code from the printed edition is
redeemed (`codigo GARDENER` — placeholder, replace before the edition ships).
The console still renders the sealed slot; a visibly locked flag reads better
than a hidden one. Paper is the one thing Abuela can't rewrite, so gating the
ending behind a physical page is the theme and the joke at once.

## Content model

Everything player-visible carries `body_en` **and** `body_es`. The novel's
intent is Spanish log entries with an English back-matter glossary, but the
drafted scene text is still English placeholder — so both columns exist from
day one and the switch is a render decision, not a migration.

Matching is one table with a `match_mode` column: a command is just an
exact-match trigger, so there's one matcher rather than two code paths.

Ledger data is a **hybrid** — story-critical vendors are authored rows,
everything else generates deterministically around them from a seed, so the
world reads as bottomless while only the anomalies are authored. Marcus's five
flagged deltas sum to exactly **$262,144** (2^18). Per canon that number appears
once, unexplained, and nothing else references it.

## Setup

```sh
cd workers/abuela-terminal
wrangler d1 execute abuela-terminal-db --remote --file=schema.sql   # already applied
wrangler d1 execute abuela-terminal-db --remote --file=seed.sql     # already applied

wrangler kv namespace create LIMITS      # then uncomment the binding in wrangler.toml
wrangler secret put ADMIN_TOKEN
wrangler secret put ANTHROPIC_API_KEY    # optional — see below

wrangler deploy
```

Resources already provisioned:

- D1 `abuela-terminal-db` — `05addd84-8527-4533-b8ac-08444e370ecc`
- R2 `abuela-terminal-assets`

Paper scans go in the bucket under the `r2_key` recorded on each `assets` row
(`paper/fl-registered-agent.jpg`, etc.). A row with no object behind it reports
as *"indexed, not digitized"* rather than erroring, so the console is fully
playable before any scan exists.

## Admin

`/admin.html`, token in localStorage sent as a bearer header — same pattern as
the KYR scene builder. Tabs cover every content table, but the one that matters
is **Misses**: what people actually typed that nothing answered, most frequent
first, with a one-click "Author →" that drops the phrase into the response
editor. A terminal lives or dies on coverage, and this is the only honest way to
find the gaps rather than guessing at them.

Bump the content version after editing so clients re-pull the command manifest.

## Long-tail generation

Optional. With `ANTHROPIC_API_KEY` set, unrecognized input that survives the
prefilter gets one terse generated line from `claude-haiku-4-5` ($1/$5 per
MTok). Without the key the console runs fine — unmatched input just gets the
authored rejection.

Limits, in the order they actually save money:

1. **Permanent D1 cache** keyed by normalized input. Everyone types the same
   things, so the first visitor pays and everyone after reads the cache. Good
   generations get promoted to authored rows through the admin, so cost trends
   toward zero as coverage grows.
2. **`max_tokens: 150`** — terse machine output is the aesthetic *and* the
   budget, which is a rare case of the two agreeing.
3. **Per-session cap and a global daily kill-switch** in KV. Without the last
   one, a single motivated visitor is the whole month.
4. **Regex prefilter** so it can't be used as a free general chatbot — off-topic
   input never reaches the API.
5. **System prompt hard limits**: flavour only. The model can't set a flag,
   can't reveal sealed content, can't invent plot. Anything story-critical is an
   authored row.

Worth knowing: **Haiku 4.5's minimum cacheable prompt is 4096 tokens**, so the
current canon system prompt is too short to prompt-cache. It fails silently —
no error, just zero cache reads. Either pad the canon bible past 4K (more canon
in the prompt is good anyway) or accept uncached pricing.

## Aesthetic notes

Hard 1px borders, Win2k bevels via border colors, no rounded corners, no
shadows, no blur. All animation is `steps()` — easing curves read as 2015.
Subpixel smoothing is disabled because 2002 monitors didn't antialias.

The deliberate imperfections in `styles.css` are marked inline and are not bugs.
A console one self-taught person built over years is not uniform, and that
unevenness is most of what separates this from a template.

## Files

| Path | |
|---|---|
| `src/index.js` | Worker: API, matcher, handlers, generation, admin CRUD |
| `schema.sql` / `seed.sql` | D1 schema and authored content |
| `public/index.html` | Console layout |
| `public/styles.css` | The 2002 look |
| `public/app.js` | Terminal, panels, tape generator |
| `public/admin.html` | Content CRUD + miss-promotion queue |
