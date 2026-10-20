import { useEffect } from "react";
import type { Answer } from "@/domain/types";
import { useGame } from "@/data/store";
import { useAutoFocus } from "@/lib/useAutoFocus";
import { cn } from "@/lib/cn";
import { t } from "@/strings";

/* Fixed classes, not an inline style: the CSP in public/_headers does not allow style attributes. */
const DRAIN: Record<number, string> = {
  5: "[animation:kyr-drain_5s_linear_forwards]",
  10: "[animation:kyr-drain_10s_linear_forwards]",
  20: "[animation:kyr-drain_20s_linear_forwards]",
};

interface Props {
  answers: Answer[];
  /** Index the Hint button is pointing at. */
  hint: number | null;
  /** Answer timer in seconds; 0 = untimed. */
  seconds: number;
}

export function Choices({ answers, hint, seconds }: Props) {
  const { answer, expire } = useGame();
  const first = useAutoFocus<HTMLButtonElement>(answers);

  useEffect(() => {
    if (!seconds || !answers.length) return;
    const id = setTimeout(expire, seconds * 1000);
    return () => clearTimeout(id);
  }, [seconds, answers, expire]);

  if (!answers.length) return null;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 flex w-full items-center gap-3 font-display text-xs font-bold tracking-[0.2em] text-dim uppercase">
        <span className="flex-none">{t.whatDoYouDo}</span>
        {seconds > 0 && (
          <>
            <span className="sr-only">{t.secondsLeft(seconds)}</span>
            <span aria-hidden className="h-1.5 flex-1 overflow-hidden bg-line">
              <span className={cn("block h-full origin-left bg-accent", DRAIN[seconds])} />
            </span>
          </>
        )}
      </legend>
      {answers.map((a, i) => (
        <button
          key={a.text}
          ref={i === 0 ? first : undefined}
          type="button"
          onClick={() => answer(i)}
          className={cn(
            "flex min-h-12 w-full cursor-pointer items-start gap-3 border-2 border-line bg-surface-2 px-4 py-3 text-left text-sm leading-snug hover:border-primary",
            hint === i && "[animation:kyr-hint_0.8s_ease-in-out_2] border-accent",
          )}
        >
          <span aria-hidden className="text-primary">
            ▶
          </span>
          <span>{a.text}</span>
        </button>
      ))}
    </fieldset>
  );
}
