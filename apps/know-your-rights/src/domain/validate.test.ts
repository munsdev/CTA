import { describe, expect, it } from "vitest";
import { SCENES } from "@/content";
import type { Scene } from "./types";
import { validateScene } from "./validate";

const door = SCENES[0];
const clone = (): Scene => structuredClone(door);

describe("shipped scenes", () => {
  for (const scene of SCENES) {
    it(`${scene.slug} has no content problems`, () => {
      expect(validateScene(scene)).toEqual([]);
    });
  }
});

describe("validateScene catches", () => {
  it("a dangling goto", () => {
    const s = clone();
    const c = s.cards.knock;
    if (!c.end) c.answers[0].goto = "nowhere";
    expect(validateScene(s).join("\n")).toMatch(/goto "nowhere" does not exist/);
  });

  it("a missing backdrop", () => {
    const s = clone();
    s.cards.knock.backdrop = "gone";
    expect(validateScene(s).join("\n")).toMatch(/backdrop "gone" does not exist/);
  });

  it("opening the door ending on a non-fatal card (the old opened-early bug)", () => {
    const s = clone();
    const end = s.cards["opened-early"];
    if (end.end) end.fatal = false;
    expect(validateScene(s).join("\n")).toMatch(
      /fatal answer must lead to a fatal end card|without marking it damaged/,
    );
  });

  it("an internal note in the player-facing law line", () => {
    const s = clone();
    s.law = "Verified 2026-08-08. Judicial vs administrative warrant distinction.";
    expect(validateScene(s).join("\n")).toMatch(/internal note/);
  });

  it("a credit nobody can earn by playing well", () => {
    const s = clone();
    const leave = s.cards.leave;
    if (leave.end) leave.credits = [];
    expect(validateScene(s).join("\n")).toMatch(/credit "no-open" cannot be earned/);
  });

  it("an unreachable card", () => {
    const s = clone();
    s.cards.orphan = { end: true, backdrop: "door-open", lines: [] };
    expect(validateScene(s).join("\n")).toMatch(/orphan: unreachable/);
  });

  it("a card with no way to an ending", () => {
    const s = clone();
    s.cards.loop = {
      backdrop: "door-closed-inside",
      lines: [],
      answers: [{ text: "Wait.", grade: "shield", goto: "loop" }],
    };
    const k = s.cards.knock;
    if (!k.end) k.answers.push({ text: "Loop.", grade: "steady", goto: "loop" });
    expect(validateScene(s).join("\n")).toMatch(/loop: no path from here reaches an ending/);
  });
});
