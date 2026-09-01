"use client";

import type { Debate } from "@/lib/domain/types";
import { StageIndicator } from "./StageIndicator";
import { Transcript } from "./Transcript";
import { SourcesPanel } from "./SourcesPanel";
import { ResultPanel } from "./ResultPanel";
import { DEFAULT_RESEARCH_BUDGET } from "@/lib/config";

export function DebateArena({
  debate,
  researchStartedAt,
  onReset,
}: {
  debate: Debate;
  researchStartedAt: string | null;
  onReset: () => void;
}) {
  const finished = debate.stage === "completed" || debate.stage === "failed";

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6">
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-6 py-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
          Topic
        </p>
        <h1 className="mt-2 text-xl font-semibold leading-snug text-neutral-100">
          {debate.topic}
        </h1>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <DebaterCard
          speaker="A"
          position={debate.debaterA.position}
          model={debate.debaterA.model}
          active={debate.stage.endsWith("_a")}
        />
        <DebaterCard
          speaker="B"
          position={debate.debaterB.position}
          model={debate.debaterB.model}
          active={debate.stage.endsWith("_b")}
        />
      </section>

      <StageIndicator
        stage={debate.stage}
        researchStartedAt={researchStartedAt}
        researchDurationSec={DEFAULT_RESEARCH_BUDGET.durationMs / 1000}
      />

      {debate.stage === "failed" && debate.error && (
        <section className="rounded-xl border border-red-900/60 bg-red-950/40 px-6 py-4 text-sm text-red-300">
          This debate failed: {debate.error}
        </section>
      )}

      <ResultPanel debate={debate} />

      <Transcript debate={debate} />

      <SourcesPanel debate={debate} />

      {finished && (
        <button
          type="button"
          onClick={onReset}
          className="mx-auto rounded-xl border border-neutral-700 px-6 py-2.5 text-sm text-neutral-300 transition hover:border-amber-500 hover:text-amber-400"
        >
          Start a new debate
        </button>
      )}
    </div>
  );
}

function DebaterCard({
  speaker,
  position,
  model,
  active,
}: {
  speaker: "A" | "B";
  position: string;
  model: string;
  active: boolean;
}) {
  const accent =
    speaker === "A"
      ? "border-sky-700/60 bg-sky-950/30"
      : "border-red-700/60 bg-red-950/30";
  return (
    <div
      className={`flex items-center gap-4 rounded-xl border px-5 py-4 transition ${
        active ? accent : "border-neutral-800 bg-neutral-900/60"
      }`}
    >
      <span className="text-3xl">🤖</span>
      <div>
        <p className="font-bold tracking-wide text-neutral-100">
          DEBATER {speaker}
        </p>
        <p
          className={`text-sm font-semibold ${
            speaker === "A" ? "text-sky-400" : "text-red-400"
          }`}
        >
          {position}
        </p>
        <p className="text-[10px] text-neutral-500">{model}</p>
      </div>
      {active && (
        <span className="ml-auto animate-pulse text-xs uppercase tracking-widest text-amber-400">
          Speaking…
        </span>
      )}
    </div>
  );
}
