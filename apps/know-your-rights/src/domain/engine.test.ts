import { describe, expect, it } from "vitest";
import { SCENES } from "@/content";
import { advance, choices, choose, hintIndex, startRun, timeout, type Rng, type Run } from "./engine";
import type { PlayCard } from "./types";

const door = SCENES[0];
/** rng that always returns the same value: 0.99 avoids every random detention, 0 triggers all of them. */
const fixed =
  (v: number): Rng =>
  () =>
    v;

function skipLines(run: Run, rng: Rng): Run {
  while (run.phase === "lines") run = advance(run, rng);
  return run;
}

/** Play a run choosing answers by their text prefix. */
function play(prefixes: string[], rng: Rng): Run {
  let run = skipLines(startRun(door, rng), rng);
  for (const p of prefixes) {
    const i = choices(run).findIndex((a) => a.text.replace(/^"/, "").startsWith(p));
    expect(i, `no answer starting "${p}" on card ${run.cardId}`).toBeGreaterThanOrEqual(0);
    run = skipLines(choose(run, i, rng), rng);
  }
  return run;
}

const BEST = [
  "Look through the peephole",
  "Are you immigration",
  "Do you have a warrant signed by a judge",
  "Slide it under the door",
  "Check the signature line",
  "That's signed by an officer",
  "I'm not coming out",
  "I'm going to remain silent. I want",
  "Write down the time",
];

describe("door scene", () => {
  it("a perfect run walks away clean with every credit", () => {
    const run = play(BEST, fixed(0.99));
    expect(run.phase).toBe("over");
    expect(run.result).toMatchObject({ ending: "clean", detained: false, forced: false });
    expect(new Set(run.result!.earned)).toEqual(new Set(door.credits.map((c) => c.key)));
  });

  it("a perfect run can still end in forced entry, detained but intact", () => {
    const run = play(BEST, fixed(0));
    expect(run.result).toMatchObject({ ending: "intact", detained: true, forced: true });
  });

  it("opening the door for 'police' is always detained, never 'walked away'", () => {
    for (const v of [0, 0.5, 0.99]) {
      const run = play(["Open the door. They said police."], fixed(v));
      expect(run.result).toMatchObject({ detained: true, ending: "damaged" });
    }
  });

  it("stepping outside is fatal", () => {
    const run = play(
      [
        "Call through the door",
        "Do you have a warrant signed by a judge",
        "I don't need to see it",
        "Step outside",
      ],
      fixed(0.99),
    );
    expect(run.result?.detained).toBe(true);
  });

  it("pushing the door shut on a boot marks the case damaged", () => {
    const run = play(
      ["Call through the door", "I'm not opening the door. Who", "Crack the door", "Push it shut"],
      fixed(0.99),
    );
    expect(run.damaged).toBe(true);
    expect(run.cardId).toBe("pressure");
  });

  it("a timeout raises risk and returns to the same choices without crashing", () => {
    const rng = fixed(0.99);
    let run = skipLines(startRun(door, rng), rng);
    const before = choices(run).map((a) => a.text);
    run = timeout(run, rng);
    expect(run.phase).toBe("lines");
    expect(run.risk).toBe(10);
    run = skipLines(run, rng);
    expect(run.phase).toBe("choose");
    expect(choices(run).map((a) => a.text)).toEqual(before);
  });

  it("risk never drops below the floor", () => {
    const run = play(["Stay completely still"], fixed(0.99));
    expect(run.risk).toBe(0);
  });

  it("hint points at the shield answer, not a steady one listed later", () => {
    for (const c of Object.values(door.cards)) {
      if (c.end) continue;
      const best = (c as PlayCard).answers[hintIndex(c as PlayCard)].grade;
      if ((c as PlayCard).answers.some((a) => a.grade === "shield")) expect(best).toBe("shield");
    }
  });
});
