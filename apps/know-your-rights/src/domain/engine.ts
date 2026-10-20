import { produce } from "immer";
import { GRADE_RISK, type Answer, type Card, type EndingKey, type PlayCard, type Scene } from "./types";

/**
 * The game as pure functions over a Run. No timers, DOM or randomness of its
 * own: callers pass `rng` so tests can replay any run exactly.
 *
 * A run alternates between two phases. In "lines" the player steps through
 * `script` (narration, dialogue, the "why" after a choice). When the script
 * runs out on a play card the phase becomes "choose"; on an end card the run
 * finishes and `result` is set.
 */

export type Rng = () => number;

export interface ScriptLine {
  /** Speaker label, or undefined for narration. */
  speaker?: string;
  text: string;
  kind: "line" | "why" | "pressure";
}

export interface Result {
  ending: EndingKey;
  detained: boolean;
  /** Detained despite a perfect run, because they forced the door. */
  forced: boolean;
  earned: string[];
}

export interface Run {
  scene: Scene;
  cardId: string;
  risk: number;
  credits: string[];
  damaged: boolean;
  /** Set by a fatal answer or a fatal end card: detained whatever the roll. */
  fatal: boolean;
  script: ScriptLine[];
  phase: "lines" | "choose" | "over";
  /** Cards visited, for the progress indicator. */
  steps: number;
  /** Bumped on every state change, so the UI can tell one line from the next even when the text repeats. */
  seq: number;
  result?: Result;
}

export const TIMEOUT_PENALTY = 10;

const PRESSURE = ["I am not going to ask again.", "Answer me. Now.", "You are running out of time."];

const pick = <T>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)];

export function card(run: Run): Card {
  return run.scene.cards[run.cardId];
}

/** The answers on offer, or none while lines are still playing. */
export function choices(run: Run): Answer[] {
  const c = card(run);
  return run.phase === "choose" && !c.end ? c.answers : [];
}

function speakerLabel(scene: Scene, id: string | undefined): string | undefined {
  if (!id) return undefined;
  return scene.speakers.find((s) => s.id === id)?.label ?? id;
}

function cardLines(scene: Scene, c: Card, rng: Rng): ScriptLine[] {
  return c.lines.map((l) => ({
    speaker: speakerLabel(scene, l.speaker),
    text: pick(l.texts, rng),
    kind: "line",
  }));
}

function addCredits(run: Run, keys: string[] | undefined) {
  for (const k of keys ?? []) if (!run.credits.includes(k)) run.credits.push(k);
}

/** Move to the next phase once the script is empty: choose, or finish on an end card. */
function settle(run: Run, rng: Rng) {
  if (run.script.length) return;
  const c = card(run);
  if (!c.end) {
    run.phase = "choose";
    return;
  }
  addCredits(run, c.credits);
  if (c.fatal) run.fatal = run.damaged = true;
  run.phase = "over";
  run.result = roll(run, rng);
}

function roll(run: Run, rng: Rng): Result {
  const { scene } = run;
  let detained = run.fatal || rng() * 100 < run.risk;
  let forced = false;
  const fe = scene.forcedEntry;
  if (!detained && fe && scene.floor === 0 && run.risk === 0 && !run.damaged && rng() < fe.chance) {
    detained = true;
    forced = true;
  }
  const ending: EndingKey = detained ? (run.damaged ? "damaged" : "intact") : run.damaged ? "lucky" : "clean";
  return { ending, detained, forced, earned: [...run.credits] };
}

export function startRun(scene: Scene, rng: Rng): Run {
  const first = scene.cards[scene.start];
  const run: Run = {
    scene,
    cardId: scene.start,
    risk: scene.floor,
    credits: [],
    damaged: false,
    fatal: false,
    script: [{ text: scene.open, kind: "line" }, ...cardLines(scene, first, rng)],
    phase: "lines",
    steps: 1,
    seq: 0,
  };
  return run;
}

/** Step past the current line. */
export function advance(run: Run, rng: Rng): Run {
  if (run.phase !== "lines") return run;
  return produce(run, (r) => {
    r.script.shift();
    r.seq += 1;
    settle(r, rng);
  });
}

export function choose(run: Run, index: number, rng: Rng): Run {
  const answer = choices(run)[index];
  if (!answer) return run;
  return produce(run, (r) => {
    addCredits(r, answer.credits);
    if (answer.damaged) r.damaged = true;
    r.risk = Math.min(100, Math.max(r.scene.floor, r.risk + GRADE_RISK[answer.grade]));
    // Opening up or stepping out hands them consent, so a fatal answer also damages the case.
    if (answer.grade === "fatal") r.fatal = r.damaged = true;
    r.cardId = answer.goto;
    r.steps += 1;
    const next = r.scene.cards[answer.goto];
    r.script = [
      ...(answer.why ? [{ text: answer.why, kind: "why" as const }] : []),
      ...cardLines(r.scene, next, rng),
    ];
    r.phase = "lines";
    r.seq += 1;
    settle(r, rng);
  });
}

/** The answer timer ran out: risk goes up and the agent presses, then the same choices return. */
export function timeout(run: Run, rng: Rng): Run {
  if (run.phase !== "choose") return run;
  return produce(run, (r) => {
    r.risk = Math.min(100, r.risk + TIMEOUT_PENALTY);
    const lead = r.scene.speakers[0]?.label;
    r.script = [{ speaker: lead, text: pick(PRESSURE, rng), kind: "pressure" }];
    r.phase = "lines";
    r.seq += 1;
  });
}

/** Index of the answer the Hint button points at: the best grade on offer. */
export function hintIndex(c: PlayCard): number {
  const order = ["shield", "steady", "soft", "harmful", "severe", "fatal"];
  let best = 0;
  c.answers.forEach((a, i) => {
    if (order.indexOf(a.grade) < order.indexOf(c.answers[best].grade)) best = i;
  });
  return best;
}
