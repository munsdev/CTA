# Casey The American — Minigame Contract (v1)

The shared standard every minigame conforms to. Engines stay separate; this
document is what makes them look, read, and behave like one family. It defines
the theme tokens, the CMS-connection block, the reward logic, the shared result
screen, the one trivia-specific schema change, and the house voice.

Nothing here is built yet. This is the contract the rebuilds follow.

---

## 0. Principles (the non-negotiables)

- **Portable first.** Every embed is fully self-contained — no external files, no
  host, no build step. Paste it anywhere and it runs.
- **One lever, not twenty places.** Theme values are named once (tokens) and
  referenced everywhere. Change the definition, everything updates.
- **CMS drives, code defaults.** Every themeable value can be set from a Webflow
  CMS field. Leave the field empty and the baked-in default wins. Works out of
  the box; overrides cleanly.
- **The embed is the machine, not the frame.** Title, description, instructions,
  disclaimer, credit — all live on the Webflow page / CMS, outside the embed.
  The embed carries only the playable game and its result.
- **Mechanics are the argument.** In-world text (directives, prompts, card facts,
  scene dialogue) is gameplay and stays in code. Framing text is chrome and moves
  out.

---

## 1. The embed skeleton

Every game is one embed with the same block order, so any game is legible the
moment you open it:

```
<!-- 1. HEADER COMMENT — what you can change, in plain English -->

<style>
  /* 2a. @property DEFAULTS — every themeable token's fallback lives here */
  /* 2b. CMS THEME BLOCK — the slots Webflow fills; empty = default */
  /* 2c. SHELL — tokens, texture, buttons, result panel, reward, toast */
  /* 2d. ENGINE — this game's own styles (.sc- / .hh- / .pr-) */
</style>

<div class="gm-root">
  <!-- 3. MARKUP — the engine's mount point + shared result panel -->
</div>

<script>
  /* 4a. CONFIG — the JS levers, CMS-bound with || defaults */
  /* 4b. GUARD — double-init protection */
  /* 4c. ENGINE — this game's logic */
</script>
```

The two things a future-you edits most — **theme** (2b) and **CONFIG** (4a) —
sit at the very top of their blocks, clearly fenced.

---

## 2. Namespacing

- **Shell** owns `.gm-root` and every `--gm-*` token. Provides chrome, buttons,
  result panel, reward, toast, texture, guard.
- **Engines** keep their own prefix underneath and never redefine `--gm-*`:
  - `.sc-` — The Quota           (`window.TheQuota`,          `[data-the-quota]`)
  - `.hh-` — History or Headlines (`window.HistoryOrHeadlines`, `[data-history-or-headlines]`)
  - `.pr-` — Know Your Rights     (`window.KnowYourRights`,     `[data-know-your-rights]`)
  - `.dl-` — The DC Lagoon        (`window.DCLagoon`,           `[data-dc-lagoon]`)
- Everything is scoped to `.gm-root`, so an embed never touches the rest of the
  page. A new game = a new prefix; the shell is untouched.

---

## 3. The theme layer (tokens)

A **token** is a named value you set once and reuse by name. `--gm-primary` is a
token; everywhere the game needs that color it writes `var(--gm-primary)`, never
the raw hex. Change the one definition and every use follows.

### 3a. How "empty CMS = default" actually works

CSS custom properties have a real gotcha: a *bound-but-empty* field emits
`--x: ;`, which is empty-but-set, so a plain `var(--x, default)` substitutes
*empty*, not the default. The clean fix is to **register each themeable token
with `@property`** and a typed syntax. A registered property that receives an
empty or invalid value falls back to its declared `initial-value`. That is our
default mechanism — and it centralizes every default in one readable place.

```css
/* 2a. DEFAULTS — every themeable token registered with its fallback */
@property --cms-primary   { syntax:'<color>'; inherits:true; initial-value:#e8a33d; }
@property --cms-surface   { syntax:'<color>'; inherits:true; initial-value:#12161c; }
@property --cms-ink       { syntax:'<color>'; inherits:true; initial-value:#d7dde4; }
@property --cms-accent    { syntax:'<color>'; inherits:true; initial-value:#5b8c8c; }
/* semantic + geometry get @property too (see 3d, 3e) */
```

```css
/* 2b. CMS THEME BLOCK — drop the Webflow field binding into each slot.     */
/*     Empty field → @property initial-value wins. No slot needs filling.   */
.gm-root{
  --cms-primary: /*CMS:primary*/ ;
  --cms-surface: /*CMS:surface*/ ;
  --cms-ink:     /*CMS:ink*/     ;
  --cms-accent:  /*CMS:accent*/  ;
}
```

Then the shell reads the resolved values into its working tokens:

```css
.gm-root{
  --gm-primary: var(--cms-primary);
  --gm-surface: var(--cms-surface);
  --gm-ink:     var(--cms-ink);
  --gm-accent:  var(--cms-accent);
}
```

*(Fallback for any context without `@property` support: skip the `@property`
lines and write the default straight into the working token —
`--gm-primary: var(--cms-primary, #e8a33d);` — and simply don't bind a field
you want left at default. `@property` is the preferred path.)*

### 3b. Base colors (you set these; 3–4 values)

| Token | Role | Default |
|---|---|---|
| `--gm-primary` | brand / action / the amber | `#e8a33d` |
| `--gm-surface` | base dark background | `#12161c` |
| `--gm-ink` | primary text | `#d7dde4` |
| `--gm-accent` | occasional second highlight | `#5b8c8c` |

### 3c. Derived colors (auto — you never set these)

Computed from the bases with `color-mix()`, so 3–4 inputs produce the full ramp.
Percentages are tunable in one place.

```css
.gm-root{
  --gm-primary-hi:   color-mix(in srgb, var(--gm-primary) 82%, white);  /* hover  */
  --gm-primary-deep: color-mix(in srgb, var(--gm-primary) 68%, black);  /* border */
  --gm-surface-2:    color-mix(in srgb, var(--gm-surface) 92%, white);  /* raised */
  --gm-panel:        color-mix(in srgb, var(--gm-surface) 86%, white);  /* panel  */
  --gm-line:         color-mix(in srgb, var(--gm-surface) 78%, white);  /* hairline */
  --gm-dim:          color-mix(in srgb, var(--gm-ink) 55%, var(--gm-surface)); /* muted */
}
```

### 3d. Semantic colors (defaults; overridable, not required in CMS)

Pass/valid/fail read the same across every game.

| Token | Role | Default |
|---|---|---|
| `--gm-ok` | pass / correct | `#4a9d6a` |
| `--gm-warn` | valid-but-not-best | `#e0b23e` |
| `--gm-bad` | fail / wrong | `#d0492f` |

### 3e. Fonts

Inherit from the Webflow page typography tokens (as the current games do), with
named fallbacks. Optional per-game CMS override field if you ever want it.

```css
--gm-font-display: var(--_typography---font-styles--heading, 'Special Elite', 'Archivo Narrow', system-ui, sans-serif);
--gm-font-body:    var(--_typography---font-styles--body,    'Spline Sans Mono', ui-monospace, monospace);
```

### 3f. Geometry & texture

| Token | Role | House default |
|---|---|---|
| `--gm-radius` | corner rounding | `2px` — see decision D1 |
| `--gm-border` | hairline width | `1px` |
| `--gm-scan-opacity` | CRT scanline strength | `.35` |
| `--gm-pad` | base content padding | `16px` |

---

## 4. The CONFIG block (JS levers)

JS doesn't have the CSS empty-value gotcha — `CMS_VALUE || DEFAULT` works
cleanly. So JS levers use `||` fallbacks. The reward fields default to empty
strings on purpose (empty = no reward; see §5).

```js
var CONFIG = {
  /* ── CMS-bound: Webflow fills the ''; empty → default after || ── */
  rewardCode: '' /*CMS:reward-code*/ || '',   // '' = no code
  rewardLink: '' /*CMS:reward-link*/ || '',   // '' = no shop button
  rewardDesc: '' /*CMS:reward-desc*/ || '',   // label for whatever shows
  copiedMsg:  '' /*CMS:copied-msg*/  || 'Code copied',

  /* ── Engine levers (per game) ── */
  // e.g. Checking Papers:
  // timerSeconds: 10,
  // lowAtSeconds: 5,
};
```

---

## 5. Reward logic (graceful, opt-in)

The reward module reads three values: **code**, **link**, **description**. It
renders only what exists, and when nothing exists it doesn't render at all — the
player never learns a slot was there. This honors the merch-outside-the-games
rule: the game stays clean unless a CMS item deliberately turns reward on.

| code | link | Renders |
|---|---|---|
| ✓ | ✓ | code + copy button + "shop with it applied" button |
| ✓ | — | code + copy button |
| — | ✓ | shop button only |
| — | — | nothing — clean win, no reward block |

`description` labels whatever is shown (e.g. "20% off the shirt"). Empty
description just omits the label.

---

## 6. The shared result screen

The three games diverge most visibly at the end, yet this is exactly where they
should rhyme. Every result — win or lose — is the same four-to-five part shape,
themed per game but structurally identical:

1. **Stamp** — one display-font word, the verdict. Themed.
   *(Passed / Failed · Acquitted / Indicted · Released / Detained …)*
2. **Truth line** — one sentence, the literal outcome.
   *("You detained no one." / "You placed 6 of 8 files.")*
3. **Plain** — 1–2 sentences naming the mechanic's point, no sermon.
4. **Reward** — optional, per §5.
5. **Replay** — a themed verb phrase, present tense.
   *("Run it again" / "Stand trial again".)*

The shell provides this scaffold (stamp slot, body slots, reward slot, replay
button) plus the pass/fail color states. Engines fill the words.

---

## 7. Trivia-only schema change (per-card links) — *History or Headlines*

The global "Sources & receipts" block leaves the embed. Instead, **each card
carries its own link**, rendered in that card's reveal footer — the receipt sits
beside the claim it backs. Editing/adding cards stays code-level (accepted: it's
a single bespoke game).

Each `BANK` entry gains:

```js
{
  tag: "Camps",
  fact: "…",
  /* …existing fields… */
  link:      "https://…",          // the receipt for THIS card
  linkLabel: "American Immigration Council — Jan 2026"  // shown text
}
```

The reveal face grows a footer slot that renders `linkLabel` as a link to `link`
when both exist, and renders nothing when they don't (same graceful pattern as
reward).

---

## 8. Naming system

Names come from the **situation or the mechanic**, not the historical subject —
cold, procedural register, matching the terminal/directive aesthetic. This keeps
names subject-neutral so a game can travel to a future project even if it wasn't
Nazi-themed to start. Prefer one or two flat words; let the player discover the
point through play rather than naming the lesson.

**Locked names:**

| Working title | Locked name | Names the… |
|---|---|---|
| Checking Papers | **The Quota** | fabricated number at the center of the mechanic |
| Nuremberg Trivia | **History or Headlines** | the question the player is actually being asked |
| Prepared | **Know Your Rights** | deliberate exception — see below |

*Renamed from the interim "History or Headlines" (Jul 2026): drops "Reich" from the
player-facing surface entirely, and states the question rather than the act.*

**The deliberate exception.** *Know Your Rights* names the lesson up front
instead of the situation — more legible, more public-service, less cold than the
other two. Chosen anyway because for a rights-education drill, clarity of intent
outweighs the house preference for obliqueness. Future games default to the
situation/mechanic rule; only break it with the same reasoning this one used.

**Scope.** This naming system governs the Casey The American / Nazi Games
project. Other projects (e.g. Reflecting Pool) are free to name in their own
register — *The DC Lagoon* stays as-is and isn't retrofitted to this pattern.

---

## 9. House voice

The prose should feel written by one hand. These rules unify register without
flattening each game's flavor.

1. **Second person, present tense, active voice.** "You detained no one," never
   "No one was detained."
2. **Sentence case for real sentences.** Reserve ALL-CAPS for the display-font
   stamps and eyebrows only — it's a texture, not a shout.
3. **An action keeps its name through the flow.** The button that starts a shift
   and the verb that replays it come from the same family. A label a player
   learns in one screen means the same thing in the next.
4. **Fragments are beats, not accidents.** Intentional fragments earn their line.
   Accidental ones get fixed.
5. **No exclamation marks.** The material is grim; the tone is flat and certain.
   The flatness is the argument.
6. **Failure states give the lesson, not a mood.** State the mechanic-truth
   plainly ("There were never three to find; the number was a trick"). No
   apology, no melodrama.
7. **German sparingly, always glossed on first use.** Only where it carries in
   English or serves the theme (*Reich*, *Befehl ist Befehl*, *Das Urteil*).
8. **In-world vs. meta stays separate.** Mechanic text is terse and in-character
   and lives in code. Meta text (disclaimer, credit, description) lives in CMS
   and follows the project's set framing formula.
9. **Result screens rhyme.** Every ending follows §6's stamp → truth → plain →
   (reward) → replay shape, so the three games feel like chapters, not strangers.

---

## 10. What lives where (the boundary)

**Outside the embed — Webflow page / CMS fields:**
game title · description/blurb · instructions/help · disclaimer · credit line ·
project multi-ref · theme values (primary/surface/ink/accent, fonts) ·
reward code / link / description.

**Inside the embed — code:**
the mechanic and all its in-world text (directives, prompts, scene dialogue,
card facts) · the result screen + its verdict/truth/plain copy · trivia per-card
links (gameplay data) · CONFIG (JS levers, CMS-bound).

---

## 11. Decisions I made on your behalf — overrule freely

- **D1 · Corner radius.** The Quota used ~3px; the trivia game used 0. For a
  single house standard I set `--gm-radius: 2px`, with any game free to override
  to `0` for the hard-stamp look. If you'd rather the whole family go sharp-cornered,
  set the default to `0`.
- **D2 · `@property` for defaults.** Chosen over plain `var()` fallbacks because
  it's the only approach where a bound-but-empty CMS field reliably falls back to
  the default. Broadly supported now. If a target context lacks it, §3a gives the
  fallback path.
- **D3 · Know Your Rights prefix `.pr-`.** New namespace for the third engine.
- **D4 · Accent as a fourth base color.** Added `--gm-accent` beyond
  primary/surface/ink because the games already use incidental second highlights;
  cheap to keep, easy to ignore.
- **D5 · Palette diverges per game, on purpose.** The token *mechanism* (base
  colors → derived ramps → CMS override) is shared; the actual default palette
  values are not. Each game gets its own colors so the suite reads as one studio
  in different games, not four skins of one game. Retro-style toggle (pixelated
  rendering + display font pairing) is a separate axis from palette — see build
  order §13.
- **D6 · The DC Lagoon's shell relationship is unresolved.** It's canvas-based,
  the other three are DOM-based. It can still adopt `--gm-*` tokens for its HUD/
  overlay chrome (those are DOM elements) while the canvas rendering itself reads
  the same token values directly in JS. Full resolution happens when it's built
  in §13 step 2 — flagging now so it isn't assumed to be a drop-in `.gm-root`
  citizen without checking.

---

## 12. Per-game punch list (captured pre-rebuild)

Small, specific fixes identified through use, to fold into each fresh build
alongside general style variance (each game's own palette/type, not one unified
scheme — see §3, §10 D5).

- **History or Headlines.** No scrollable list of cards. Single-card stage with explicit
  Next/Previous; the current card slides off, the next slides in. Stay on one
  interface — same principle as Know Your Rights' scene picker.
- **Know Your Rights.** The Door scene reads as a flat line, not an object. Give
  it a slight angle/foreshortening (a simple parallelogram, not a straight
  vertical) so it visually reads as a door.
- **The DC Lagoon.** Decided: **true top-down**, flat rectangle, proportions
  adjusted for screen legibility. Worker entry, resolved:
  - Workers enter **only from the two long sides** — never the short ends. This
    is what fixes the old "walking down from the sky" bug (no top-edge spawn
    exists at all).
  - Each worker's entry point is offset along the side to line up near their
    target cell's position along the pool's length — so a worker headed toward
    a spot near either end simply enters further up/down the side, closer to
    that target, rather than walking the long way from a fixed spawn. They walk
    straight in, then turn ~90° to face the pool and dump. No pathfinding
    needed — entry position is just the target's position along that axis,
    clamped to the side.

## 13. Build order (when you're ready)

Each game is rebuilt **fresh, from scratch** against this contract — not
refactored in place. The old files stay as reference for what to carry forward
(working fiction text, tuning values, visual bits that landed) and what to fix
(see §12's punch list, plus general style variance). Fresh build avoids
inheriting old DOM structure, CSS specificity, or architecture decisions made
before the shell existed.

1. Lock this contract (react to §10).
2. **The DC Lagoon** — first up, per current plan. Perspective and worker-entry
   are decided (§12). Also serves as the proving ground for the retro-style
   toggle and per-game palette approach, since it's the most visually distinct
   of the four.
3. **The Quota** — reference implementation for the `.gm-root` shell + CMS
   theme/CONFIG pattern for the DOM-based games.
4. **History or Headlines** — proves the shell against a deck engine + the per-card link
   schema + the new single-card Next/Previous navigation (§12).
5. **Know Your Rights** — proves the shell against a scripted-scene engine;
   resolves the door perspective (§12) and the scene-picker centering bug.
6. The shell block from step 3 becomes the canonical copy pasted into 4 and 5.
   (The DC Lagoon in step 2 is canvas-based and doesn't share the DOM shell the
   same way — see open question in §10 D6.)
```


---

## 13. Shipped architecture (added after the DC Lagoon build)

The "fully self-contained embed" of §1 held at runtime but not at authoring time:
a 34KB engine doesn't fit through the Webflow CMS API. The shipped shape is a
**three-file split per game**, served from GitHub via jsDelivr:

```
games/{slug}/
  loader.js   — the ONLY file the CMS loads. Injects fonts + styles.css,
                finds the mount, loads engine.js, writes markup, calls init().
                Self-resolves its base URL from its own script src.
  engine.js   — window.{GameName}.init(root, base). Holds CONFIG inline.
                Finds elements via [data-el="…"]. Guards on root.dataset.booted.
  styles.css  — @property defaults → CMS slots → --gm-* tokens → color-mix()
                ramp → shared gm-* shell → this game's engine styles.
```

The CMS item holds two lines and never changes for routine updates:

```html
<div data-{slug}></div>
<script src="https://cdn.jsdelivr.net/gh/munsdev/CTA@{sha}/games/{slug}/loader.js"></script>
```

**Pin to a commit SHA, not `@main`.** Moving a tag or branch does not reliably
bust jsDelivr's cache; a fresh SHA is a URL that has never been served. Every
deploy rewrites the SHA in the CMS embed.

**Sizing.** Games use container queries (`container-type: inline-size`, `cqw`),
so they size to their Webflow column rather than the viewport. `.gm-root` and the
game's outer frame are `height:100%`, and `engine.js` walks up the wrapper chain
turning each ancestor into a full-height flex column — the RichText embed nests
the game several levels deep. **The Webflow column itself must have a real
height**; 100% of nothing is nothing. A fallback sizes to 80vh rather than
collapsing to a sliver.

**Page controls.** Any Webflow element on the page can drive the game:

| Attribute | Effect |
|---|---|
| `data-{game}-reset` / `gm-reset-button` | return the game to its start screen |
| `data-{game}-pause` | pause/resume — **only for games with a running clock** |

Step-by-step games (History or Headlines, Know Your Rights) expose reset only.
A pause button on a game where nothing runs is a lie; don't wire one.

## 14. House voice — writing the cards

Learned the hard way on History or Headlines. The player is a regular person
reading a trivia card on a phone, not a historian.

- **One idea per sentence.** Average a card's fact around 25 words.
- **No meta-constructions.** "A judge attaches to his order a list of the orders
  the agency broke" is unreadable. "In a single month, immigration agents ignore
  96 court orders. A judge counts every one and publishes the list." is the same
  fact.
- **Assume no background.** Say "Nazi Germany," not "the Reich." Say "the
  government's official gazette," not "the Reichsanzeiger."
- **Digits, not words.** 96, not ninety-six.
- **Broad scope only.** Laws, decrees, numbers, systems. Never one person's
  story — a card built on an anecdote breaks the game's claim to be about
  machinery.
- **Every fact carries a pin** — one detail fixing it to a single era. If a fact
  is true of both eras as written, the answer is *Both*, not a coin flip. If the
  only thing distinguishing the eras is a technicality, the card is broken.
- **Name the real differences.** Where the modern system is meaningfully unlike
  the historical one, the reveal says so plainly. That is the argument working,
  not a softening of it.
- **Verify before shipping.** Any statistic, statute or quotation goes in only
  once it has been checked against a primary or reputable secondary source. An
  unverifiable claim is cut, however good it would have been.
