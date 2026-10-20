import { ENDINGS } from "@/content";
import type { Run } from "@/domain/engine";
import { useGame } from "@/data/store";
import { useAutoFocus } from "@/lib/useAutoFocus";
import { Button } from "@/ui/Button";
import { cn } from "@/lib/cn";
import { t } from "@/strings";

export function Result({ run }: { run: Run }) {
  const { start, quit } = useGame();
  const heading = useAutoFocus<HTMLHeadingElement>(run);
  const result = run.result!;
  const ending = ENDINGS[result.ending];
  const truth = result.forced && run.scene.forcedEntry ? run.scene.forcedEntry.text : ending.truth;

  return (
    <main className="flex flex-1 flex-col gap-6 py-8">
      <h1
        ref={heading}
        tabIndex={-1}
        className={cn(
          "mx-auto border-3 px-6 py-3 text-center font-display text-3xl font-bold tracking-[0.2em] uppercase outline-none",
          result.detained ? "border-bad text-bad" : "border-ok text-ok",
        )}
      >
        {ending.stamp}
      </h1>
      <p className="text-center leading-relaxed">{truth}</p>

      <section aria-labelledby="credits-h" className="border-2 border-line bg-surface-2 p-4">
        <h2
          id="credits-h"
          className="mb-3 font-display text-xs font-bold tracking-[0.2em] text-dim uppercase"
        >
          {t.resultCard}
        </h2>
        <ul className="flex flex-col gap-2">
          {run.scene.credits.map((c) => {
            const got = result.earned.includes(c.key);
            return (
              <li
                key={c.key}
                className={cn("flex gap-3 text-sm leading-snug", got ? "text-ink" : "text-dim")}
              >
                <span aria-hidden className={got ? "text-ok" : "text-dim"}>
                  {got ? "✓" : "○"}
                </span>
                <span>
                  <span className="sr-only">{got ? t.done : t.missed}: </span>
                  {c.label}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="border-t-2 border-line pt-4 text-center text-sm leading-relaxed text-dim">
        {run.scene.law}
      </p>

      <div className="mt-auto grid grid-cols-2 gap-3">
        <Button onClick={() => start(run.scene.slug)}>{t.playAgain}</Button>
        <Button variant="ghost" onClick={quit}>
          {t.backToTitle}
        </Button>
      </div>
      <p className="text-center text-xs tracking-[0.16em] text-dim uppercase">{t.notAdvice}</p>
    </main>
  );
}
