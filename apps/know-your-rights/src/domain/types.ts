/**
 * Scene content model. One JSON file per scene in src/content, checked by
 * validate.ts in CI. A scene is a graph of cards; each card shows one backdrop,
 * plays its lines, then offers answers that point at the next card.
 */

/** How good an answer is. The grade alone sets how much the hidden risk moves. */
export type Grade = "shield" | "steady" | "soft" | "harmful" | "severe" | "fatal";

/** Risk change per grade, in percentage points. A fatal answer ends the scene detained. */
export const GRADE_RISK: Record<Grade, number> = {
  shield: 0,
  steady: -8,
  soft: 12,
  harmful: 30,
  severe: 45,
  fatal: 100,
};

export interface Line {
  /** Speaker id from scene.speakers; omit for narration. */
  speaker?: string;
  /** One of these is picked at random each run, so replays don't read identically. */
  texts: string[];
}

export interface Answer {
  text: string;
  grade: Grade;
  goto: string;
  /** Credit keys earned by choosing this answer. */
  credits?: string[];
  /** The answer handed them something they can use, whatever happens next. */
  damaged?: boolean;
  /** Shown after the choice: why this answer is good or bad. */
  why?: string;
}

interface CardBase {
  backdrop: string;
  lines: Line[];
}

export interface PlayCard extends CardBase {
  end?: false;
  answers: Answer[];
}

export interface EndCard extends CardBase {
  end: true;
  /** Reaching this card means you are detained, whatever the risk roll says. */
  fatal?: boolean;
  /** Credits earned by reaching this card (e.g. "you never opened the door"). */
  credits?: string[];
}

export type Card = PlayCard | EndCard;

export interface Backdrop {
  id: string;
  file: string;
  /** Alt text: what a sighted player sees. */
  alt: string;
}

export interface Scene {
  slug: string;
  name: string;
  /** One line under the scene name on the title screen. */
  teaches: string;
  /** Opening narration. */
  open: string;
  /** The plain-language rule shown on the result screen. Player-facing. */
  law: string;
  /** Legal review status. Never shown to players. */
  review: { status: "draft" | "attorney-reviewed"; notes: string };
  /** Risk never drops below this. */
  floor: number;
  /** Chance that a perfect, zero-risk run is detained anyway, and the text shown when it is. */
  forcedEntry?: { chance: number; backdrop: string; text: string };
  speakers: { id: string; label: string }[];
  backdrops: Backdrop[];
  credits: { key: string; label: string }[];
  start: string;
  cards: Record<string, Card>;
}

export type EndingKey = "clean" | "lucky" | "intact" | "damaged";

export interface Ending {
  stamp: string;
  truth: string;
}
