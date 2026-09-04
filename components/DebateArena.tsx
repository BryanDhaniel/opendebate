"use client";

import type { Debate, Speaker } from "@/lib/domain/types";
import { DEFAULT_RESEARCH_BUDGET } from "@/lib/domain/constants";
import { StageIndicator } from "./StageIndicator";
import { Transcript } from "./Transcript";
import { SourcesPanel } from "./SourcesPanel";
import { ResultPanel } from "./ResultPanel";

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
  const activeSpeaker = activeSpeakerFor(debate.stage);

  return (
    <div className="flex w-full flex-col gap-4 sm:gap-6">
      {/* The motion under debate */}
      <section className="panel px-5 py-6 text-center sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
          The question
        </p>
        <h2 className="mx-auto mt-2 max-w-3xl text-xl font-bold leading-snug tracking-tight text-fg sm:text-2xl">
          {debate.topic}
        </h2>
      </section>

      <StageIndicator
        stage={debate.stage}
        researchStartedAt={researchStartedAt}
        researchDurationSec={DEFAULT_RESEARCH_BUDGET.durationMs / 1000}
      />

      {/* The two adversaries face off */}
      <section aria-label="Debaters" className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-5">
        <DebaterCard
          speaker="A"
          position={debate.debaterA.position}
          model={debate.debaterA.model}
          active={activeSpeaker === "A"}
        />
        <div className="hidden items-center justify-center lg:flex" aria-hidden="true">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-xs font-black tracking-wide text-fg-subtle">
            VS
          </span>
        </div>
        <DebaterCard
          speaker="B"
          position={debate.debaterB.position}
          model={debate.debaterB.model}
          active={activeSpeaker === "B"}
        />
      </section>

      {debate.stage === "failed" && debate.error && (
        <section
          role="alert"
          className="rounded-control border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger"
        >
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
          className="mx-auto inline-flex items-center rounded-control border border-border bg-surface px-6 py-2.5 text-sm font-semibold text-fg-muted transition-colors hover:border-fg hover:text-fg active:translate-y-px"
        >
          Start a new debate
        </button>
      )}
    </div>
  );
}

function activeSpeakerFor(stage: Debate["stage"]): Speaker | null {
  if (stage.endsWith("_a")) return "A";
  if (stage.endsWith("_b")) return "B";
  return null;
}

function DebaterCard({
  speaker,
  position,
  model,
  active,
}: {
  speaker: Speaker;
  position: string;
  model: string;
  active: boolean;
}) {
  const isA = speaker === "A";
  const colorSoft = isA ? "bg-for-soft" : "bg-against-soft";
  const colorBorder = isA ? "border-for-border" : "border-against-border";
  const colorText = isA ? "text-for" : "text-against";

  return (
    <div
      className={`panel flex items-center gap-3 px-4 py-4 transition-colors sm:gap-4 sm:px-5 ${
        active ? colorBorder + " " + colorSoft : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-black ${colorSoft} ${colorText}`}
      >
        {speaker}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
          Debater {speaker}
        </p>
        <p className={`text-sm font-bold sm:text-base ${colorText}`}>
          {position}
        </p>
        <p className="truncate text-[10px] text-fg-subtle">{model}</p>
      </div>

      {active && (
        <span
          className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${colorBorder} ${colorSoft} ${colorText}`}
        >
          <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${isA ? "bg-for" : "bg-against"}`} />
          <span className="hidden sm:inline">Speaking</span>
        </span>
      )}
    </div>
  );
}
