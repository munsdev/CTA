import { useState } from "react";
import { card, choices, hintIndex, type Run } from "@/domain/engine";
import { useGame } from "@/data/store";
import { Button } from "@/ui/Button";
import { t } from "@/strings";
import { Dialogue } from "./Dialogue";
import { Choices } from "./Choices";

export function Play({ run }: { run: Run }) {
  const { quit, timer } = useGame();
  const current = card(run);
  const backdrop = run.scene.backdrops.find((b) => b.id === current.backdrop);
  const answers = choices(run);
  const [hint, setHint] = useState<{ at: string; index: number } | null>(null);
  const hintFor = hint && hint.at === run.cardId && answers.length ? hint.index : null;

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 pt-3">
      <h1 className="sr-only">
        {t.appName}: {run.scene.name}
      </h1>
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate font-display text-sm font-bold tracking-[0.14em] text-dim uppercase">
          {run.scene.name} · {t.progress(run.steps)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!answers.length || current.end}
          onClick={() => !current.end && setHint({ at: run.cardId, index: hintIndex(current) })}
        >
          {t.hint}
        </Button>
        <Button variant="quiet" size="sm" onClick={quit} aria-label={t.quit}>
          <span aria-hidden>✕</span>
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden border-2 border-line bg-surface-2">
        {run.scene.backdrops.map((b) => (
          <img
            key={b.id}
            src={`/${b.file}`}
            alt={b.alt}
            hidden={b.id !== backdrop?.id}
            width={1600}
            height={1440}
            className="absolute inset-0 h-full w-full object-contain"
          />
        ))}
      </div>

      <div className="min-h-52">
        {run.phase === "lines" && run.script[0] ? (
          <Dialogue line={run.script[0]} index={run.seq} />
        ) : (
          <Choices key={`${run.cardId}:${run.risk}`} answers={answers} hint={hintFor} seconds={timer} />
        )}
      </div>
      <HintAnnouncer text={hintFor != null ? answers[hintFor]?.text : undefined} />
    </main>
  );
}

function HintAnnouncer({ text }: { text?: string }) {
  return (
    <p className="sr-only" aria-live="polite">
      {text ? `${t.hint}: ${text}` : ""}
    </p>
  );
}
