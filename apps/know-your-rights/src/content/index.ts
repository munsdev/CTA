import type { Ending, EndingKey, Scene } from "@/domain/types";
import door from "./door.json";

/** Scenes in title-screen order. Add a scene by adding its JSON here; validate.test.ts checks every entry. */
export const SCENES: Scene[] = [door as Scene];

export const ENDINGS: Record<EndingKey, Ending> = {
  clean: { stamp: "Walked away", truth: "You gave them nothing, and they had nothing." },
  lucky: {
    stamp: "Walked away",
    truth: "You handed them something and they let you go anyway. That was luck. Luck is not a plan.",
  },
  intact: {
    stamp: "Detained",
    truth: "They took you anyway. You gave them nothing. That is what a lawyer will need.",
  },
  damaged: { stamp: "Detained", truth: "They took you, and they took what you gave them." },
};
