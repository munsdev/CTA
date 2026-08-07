# Bird Rebels: Storm Watch — Backlog (logged, not yet built)

Captured for later.

## ✅ DECIDED — Three-Axis Redesign (lock in for upcoming update)

The three card axes become:

1. **Region** — keep as-is. Per-state, geographic. (Pacific, Mountain, Great Plains, South Central, Midwest, Southeast, Appalachia, Mid-Atlantic, New England, Caribbean.)

2. **Migration** — keep, but assign **per-state by real biology**, NOT automatically by species. Where a species' range makes it migratory in the north and resident in the south (robins, bluebirds, etc.), those state cards may legitimately differ. This adds differentiation and stays true to the field guide.

3. **Resistance Style** — NEW. **Replaces Habitat entirely.** Assigned **per-rebel (per-card), not locked to species.** Grounded in real behavioral repertoire, but each rebel foregrounds ONE facet for personality, so same-species cards differ (e.g. the 7 Cardinal states each get their own style).
   - Candidate buckets (TBD final set): **Mobber** (collective action), **Sentinel** (alarm-callers, spread warnings), **Evader** (elusive, go underground), **Defender** (hold ground, confront).
   - Per-card assignment is hand-authored by Casey (the soul of the project). Worksheet/template can be scaffolded when we build.

### Why this is good
- Region & Habitat overlapped (both "where"); Habitat goes away, so axes are now orthogonal.
- The **"Mountain" region/habitat ambiguity disappears** — nothing lives on two axes anymore.
- Same-species clones are broken up: Cardinals now differ on Region + Style (and possibly Migration).
- Storms can read like tactics: "2 Mobbers AND a Southeast bird."

### Implementation implications (for the update)
- **Data:** add a `style` field per card; remove/repurpose `habitat`. Re-tag all 56 cards with Region (existing), per-state Migration (re-audit vs reality), and a hand-authored Style.
- **Evaluator:** the third matching axis switches from `habitat` → `style`. Update the axis list/`qualAxis`, and the wildcard mappings:
  - Substitute "any HABITAT" (NJ/IA/WA Goldfinch) → "any STYLE".
  - Substitute2 Mockingbird (habitat) → style. (Cardinal=region, Meadowlark=migration unchanged.)
- **Storms:** any condition that referenced a habitat value must be rewritten. Known one: **Shifting Winds (VA) "3 Forest OR 2 Southeast"** — "Forest" is a habitat; needs a new Style or Region condition.
- **Card face:** show full words (Region / Migration / Style), tie-in with backlog item #6.

---

## Backlog (not yet built)

## 1. Log → its own popup, with richer detail
- Move the bottom log out of the board. Put it behind a Log button (own popup) — possibly also reachable from Settings.
- Make entries specific enough to review at the end: who won each storm and with what (e.g. "Storm 4 The Surge — Player 2 soloed with IA + KY + NC"), team wins with the deciding flock, losses with what fell short.
- Needs the engine to record richer detail at resolution (contributing cards / who played them), not just a one-line message.

## 2. Auto-resolve on submit (drop the manual team resolve)
- Auto-check happens WHEN A PLAYER SUBMITS their cards, not when they drop them into the flock. Staging stays reversible — a player can pull a card back before submitting, nothing fires until submit.
- On each submit: if the flock now meets the win conditions, resolve immediately — even mid-round. Remaining players do NOT take their turn. (e.g. 4 players, storm satisfied after player 2 submits in round 2 → storm ends, players 3 & 4 skip.)
- If the last player submits and it's still not met → go to Round 3 (and after Round 3's last submit, auto-resolve win or loss).
- Round 1 SOLO still uses the manual "Try Solo" click (it's an attempt, not a team resolve).
- Add a winning-combo INDICATOR ICON that lights up whenever the current flock satisfies the storm, so it's visually clear a submit will win.
- NOTE: supersedes the earlier "no resolve after round 2" — there is no manual team-resolve button at all anymore.

## 3. Toasts / notices
- Notify a player when it becomes their turn.
- Show a notice when a storm ends, with the result (won/lost, solo/team).
- Requires detecting state transitions in the polling loop (turn changed to me; storm outcome changed).

## 4. Scoreboard wording → WINS / LOSSES
- Relabel "Beaten / Fallen" as Wins / Losses.

## 5. Bird active powers not firing (Draw, retrieval) — VERIFY + IMPLEMENT
- Individual on-play bird powers were never wired into the engine. Only static powers (Substitute / Count / Substitute+ / Substitute2) that affect condition-matching are in.
- "Draw" cards (e.g. Rhode Island, NM Roadrunner "if played first, draw 1 into the flock") do NOT auto-draw. Confirmed gap.
- Retrieval/Modifier cards (GA/OK/LA "pick up a previously played flock card") also not wired.
- Some of these need player choices (which card to retrieve), so this is real feature + UI work, not a one-liner.

## 6. Card face cleanup
- Spell out Region / Habitat / Migration in full (currently R / H / M).
- Remove the effect-type badge (SUBSTITUTE / DRAW / COUNT / etc.).
- Replace it with a single "POWER" label above the power text.

## 7. Per-game display names
- Let each player set a display name scoped to this game only (no account, nothing global).
- Store in game state (e.g. names[playerId]); show it everywhere "Player N" appears (scoreboard, turn indicator, hands, toasts).
- Remember the player's own name locally so they don't retype it.

## 8. Split "admin" into site-admin vs table-master
- The Lobby's all-games list + delete is SITE admin — hide it unless the URL has ?admin=true.
- The per-game overview role (currently also called "admin") is really a table-master / host role — rename it.
  - Naming options: Table Master, Host, Dealer, Game Master.
  - Likely also rename the URL param (player=admin → player=host / player=table).


## 9. Lobby intro + instructions popup
- Add an introduction/welcome on the lobby/home page.
- Add an instructions pop-up reachable from BOTH the lobby and during gameplay.
- Both should state clearly that this is under active development and not finished.


## SHIPPED 2026-06-10
- Storm card is now the control surface: state abbreviation glows green when its bird is in the flock; each condition cell lights green as satisfied; whole card glows green + BEAT THE STORM enables when resolvable (flock + your staged cards).
- BEAT THE STORM / PLAY / PASS controls stacked under the storm card, beside the flock. Removed TRY SOLO button and the floating WINNING COMBO badge.
- Round-end debrief modal (informational, self-dismiss ~7s): outcome, storm name, contributors, running score, next lead. Replaces the storm-result toast.
- Navbar player roster: name, active-turn marker (pulsing arrow), solo star count. Pencil icon edits your own name.
- Names are per game#+player# (G.names), stored in the game record only. Removed ALL localStorage name caching; prompts once on join, editable via pencil.
- DROPPED (per Casey): flock/staged bird-card glow highlighting — too busy/multi-color.

## STANDING RULES
- Never write or change code until Casey explicitly approves. Discuss first, always.
