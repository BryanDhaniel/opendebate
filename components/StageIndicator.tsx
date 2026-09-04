"use client";

import * as Progress from "@radix-ui/react-progress";
import { useEffect, useState } from "react";
import { PROTOCOL_STAGES } from "@/lib/domain/state-machine";
import { STAGE_LABELS } from "@/lib/domain/labels";
import type { DebateStage } from "@/lib/domain/types";

const TOTAL_STAGES = PROTOCOL_STAGES.length;

export function StageIndicator({
  stage,
  researchStartedAt,
  researchDurationSec,
}: {
  stage: DebateStage;
  researchStartedAt: string | null;
  researchDurationSec: number;
}) {
  // "failed" is not part of the happy-path protocol, so it has no index.
  const rawIndex = PROTOCOL_STAGES.indexOf(stage);
  const activeIndex = rawIndex === -1 ? TOTAL_STAGES - 1 : rawIndex;

  const progress =
    stage === "failed"
      ? 100
      : Math.round((activeIndex / (TOTAL_STAGES - 1)) * 100);

  const showCountdown =
    stage === "researching" &&
    researchStartedAt !== null &&
    researchDurationSec > 0;

  const stageColor =
    stage === "failed"
      ? "text-danger"
      : stage === "completed"
        ? "text-success"
        : "text-fg";

  return (
    <section
      aria-label="Debate progress"
      className="sticky top-14 z-20 border-y border-border bg-bg/85 px-4 py-3 backdrop-blur-md sm:rounded-panel sm:border"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            Current stage
          </p>
          <p
            className={`mt-0.5 text-base font-bold tracking-tight sm:text-xl ${stageColor}`}
          >
            {STAGE_LABELS[stage]}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-fg-muted tabular-nums">
          {stage === "failed" ? "Aborted" : `${activeIndex + 1} / ${TOTAL_STAGES}`}
        </span>
      </div>

      {/* Announce stage transitions without spamming on every re-render. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {stage === "failed"
          ? "The debate failed."
          : `Stage ${activeIndex + 1} of ${TOTAL_STAGES}: ${STAGE_LABELS[stage]}`}
      </p>

      <div className="mt-3">
        {showCountdown ? (
          <Countdown
            startedAt={researchStartedAt}
            durationSec={researchDurationSec}
          />
        ) : (
          <div className="h-6" aria-hidden="true" />
        )}
      </div>

      <Progress.Root
        value={progress}
        aria-label="Debate progress"
        className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
      >
        <Progress.Indicator
          className="h-full w-full rounded-full bg-fg transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${100 - progress}%)` }}
        />
      </Progress.Root>

      {/* Compact rail of every protocol stage — scrolls horizontally on mobile. */}
      <div className="scroll-area mt-2 flex gap-1 overflow-x-auto">
        {PROTOCOL_STAGES.map((protocolStage, index) => (
          <span
            key={protocolStage}
            title={STAGE_LABELS[protocolStage]}
            aria-hidden="true"
            className={`h-1 w-6 shrink-0 rounded-full transition-colors ${
              index <= activeIndex ? "bg-fg" : "bg-surface-sunken"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

function Countdown({
  startedAt,
  durationSec,
}: {
  startedAt: string;
  durationSec: number;
}) {
  const [remaining, setRemaining] = useState(durationSec);

  useEffect(() => {
    const started = new Date(startedAt).getTime();
    const tick = () => {
      const elapsed = (Date.now() - started) / 1000;
      setRemaining(Math.max(0, Math.ceil(durationSec - elapsed)));
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [startedAt, durationSec]);

  const fraction = durationSec > 0 ? remaining / durationSec : 0;
  // Off: a per-second live region would flood assistive tech. The remaining
  // time is decorative; the stage announcement above carries the real signal.
  const low = remaining <= 10;

  return (
    <div
      className="flex h-6 items-center gap-2"
      role="timer"
      aria-live="off"
      aria-label={`${remaining} seconds of research time remaining`}
    >
      <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-sunken sm:w-40">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            low ? "bg-danger" : "bg-for"
          }`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <span
        className={`font-mono text-sm tabular-nums sm:text-base ${
          low ? "text-danger" : "text-for"
        }`}
      >
        {remaining}s
      </span>
      <span className="hidden text-[10px] uppercase tracking-widest text-fg-subtle sm:inline">
        research time left
      </span>
    </div>
  );
}
