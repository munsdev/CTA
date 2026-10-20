import { useGame } from "@/data/store";
import { Title } from "@/features/title/Title";
import { Play } from "@/features/scene/Play";
import { Result } from "@/features/result/Result";

export function App() {
  const run = useGame((s) => s.run);
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col px-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      {!run ? <Title /> : run.phase === "over" ? <Result run={run} /> : <Play run={run} />}
    </div>
  );
}
