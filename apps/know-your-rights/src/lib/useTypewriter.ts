import { useEffect, useState } from "react";

const CHAR_MS = 18;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Reveal `text` a character at a time. Returns how much is visible and a
 * `finish` to show it all at once. With reduced motion the text appears whole.
 */
export function useTypewriter(text: string) {
  const [state, setState] = useState({ text, shown: prefersReducedMotion() ? text.length : 0 });
  // A new line restarts the reveal (reset during render, React's pattern for state derived from props).
  if (state.text !== text) setState({ text, shown: prefersReducedMotion() ? text.length : 0 });
  const shown = state.text === text ? state.shown : 0;
  const done = shown >= text.length;

  useEffect(() => {
    if (done) return;
    const id = setInterval(
      () => setState((s) => (s.shown >= s.text.length ? s : { ...s, shown: s.shown + 1 })),
      CHAR_MS,
    );
    return () => clearInterval(id);
  }, [done, text]);

  return { visible: text.slice(0, shown), done, finish: () => setState({ text, shown: text.length }) };
}
