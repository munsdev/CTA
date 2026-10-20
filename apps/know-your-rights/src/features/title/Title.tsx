import { SCENES } from "@/content";
import { TIMER_OPTIONS, useGame } from "@/data/store";
import { useAutoFocus } from "@/lib/useAutoFocus";
import { cn } from "@/lib/cn";
import { t } from "@/strings";

export function Title() {
  const { timer, setTimer, start } = useGame();
  const heading = useAutoFocus<HTMLHeadingElement>("title");

  return (
    <main className="flex flex-1 flex-col justify-center gap-8 py-8">
      <header className="text-center">
        <h1 ref={heading} tabIndex={-1} className="font-display font-bold uppercase outline-none">
          <span className="block text-7xl tracking-[0.3em] text-primary">{t.titleBig}</span>
          <span className="mt-1 block text-sm tracking-[0.32em] text-dim">{t.titleSmall}</span>
        </h1>
        <p className="mt-4 text-sm text-dim">{t.tagline}</p>
      </header>

      <section aria-labelledby="scenes-h">
        <h2
          id="scenes-h"
          className="mb-3 text-center font-display text-xs font-bold tracking-[0.2em] text-dim uppercase"
        >
          {t.chooseScene}
        </h2>
        <ul className="flex flex-col gap-2">
          {SCENES.map((s) => (
            <li key={s.slug}>
              <button
                type="button"
                onClick={() => start(s.slug)}
                className="group flex min-h-14 w-full cursor-pointer items-center gap-3 border-2 border-line bg-surface-2 px-4 py-3 text-left hover:border-primary"
              >
                <span aria-hidden className="text-primary">
                  ▶
                </span>
                <span>
                  <span className="block font-display text-lg font-bold tracking-[0.12em] uppercase">
                    {s.name}
                  </span>
                  <span className="block text-sm text-dim">{s.teaches}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <fieldset className="text-center">
        <legend className="mx-auto mb-2 font-display text-xs font-bold tracking-[0.2em] text-dim uppercase">
          {t.timerLabel}
        </legend>
        <div className="inline-flex border-2 border-line">
          {TIMER_OPTIONS.map((sec) => (
            <label
              key={sec}
              className={cn(
                "flex min-h-11 min-w-16 cursor-pointer items-center justify-center px-3 text-sm has-focus-visible:outline-3 has-focus-visible:outline-accent",
                timer === sec ? "bg-primary text-primary-ink" : "text-ink hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="timer"
                className="sr-only"
                checked={timer === sec}
                onChange={() => setTimer(sec)}
              />
              {sec ? `${sec}s` : t.timerOff}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">{t.timerHelp}</p>
      </fieldset>

      <p className="text-center text-xs tracking-[0.16em] text-dim uppercase">{t.notAdvice}</p>
    </main>
  );
}
