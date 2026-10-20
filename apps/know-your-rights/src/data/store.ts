import { create } from "zustand";
import { SCENES } from "@/content";
import { advance, choose, startRun, timeout, type Run } from "@/domain/engine";

export const TIMER_OPTIONS = [0, 20, 10, 5] as const;
export type TimerSeconds = (typeof TIMER_OPTIONS)[number];

interface GameState {
  /** Seconds to answer each prompt; 0 = no timer (the default). */
  timer: TimerSeconds;
  run: Run | null;
  setTimer(t: TimerSeconds): void;
  start(slug: string): void;
  next(): void;
  answer(index: number): void;
  expire(): void;
  quit(): void;
}

const rng = Math.random;

export const useGame = create<GameState>()((set, get) => ({
  timer: 0,
  run: null,
  setTimer: (timer) => set({ timer }),
  start: (slug) => {
    const scene = SCENES.find((s) => s.slug === slug);
    if (scene) set({ run: startRun(scene, rng) });
  },
  next: () => {
    const { run } = get();
    if (run) set({ run: advance(run, rng) });
  },
  answer: (index) => {
    const { run } = get();
    if (run) set({ run: choose(run, index, rng) });
  },
  expire: () => {
    const { run } = get();
    if (run) set({ run: timeout(run, rng) });
  },
  quit: () => set({ run: null }),
}));
