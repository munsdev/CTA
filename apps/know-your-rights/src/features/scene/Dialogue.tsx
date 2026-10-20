import type { ScriptLine } from "@/domain/engine";
import { useGame } from "@/data/store";
import { useAutoFocus } from "@/lib/useAutoFocus";
import { useTypewriter } from "@/lib/useTypewriter";
import { cn } from "@/lib/cn";
import { t } from "@/strings";

/**
 * One line of the script. Continue (focused, so Enter or Space works) moves on;
 * a tap anywhere on the box does the same. Screen readers get the whole line at
 * once from the live region; the typewriter text is visual only.
 */
export function Dialogue({ line, index }: { line: ScriptLine; index: number }) {
  const next = useGame((s) => s.next);
  const { visible, done, finish } = useTypewriter(line.text);
  const button = useAutoFocus<HTMLButtonElement>(index);
  const go = () => (done ? next() : finish());
  const label = line.speaker ?? (line.kind === "why" ? "Why" : t.narration);

  return (
    // The box is a large tap target for pointer users; keyboard users have the Continue button.
    <div
      onClick={(e) =>
        e.target === e.currentTarget || !(e.target as HTMLElement).closest("button") ? go() : undefined
      }
      className={cn(
        "flex min-h-52 cursor-pointer flex-col gap-2 border-2 bg-panel p-4",
        line.kind === "why" ? "border-accent" : "border-line",
      )}
    >
      <p className="sr-only" aria-live="polite">
        {label}: {line.text}
      </p>
      <span aria-hidden className="font-display text-xs font-bold tracking-[0.2em] text-primary uppercase">
        {label}
      </span>
      <span
        aria-hidden
        className={cn("flex-1 text-base leading-relaxed", !line.speaker && "text-dim italic")}
      >
        {visible}
      </span>
      <button
        ref={button}
        type="button"
        onClick={go}
        className="min-h-11 cursor-pointer self-end px-2 font-display text-xs font-bold tracking-[0.2em] text-primary uppercase"
      >
        {t.continue} <span aria-hidden>▸</span>
      </button>
    </div>
  );
}
