"use client";

import { useEffect, useState } from "react";
import { PROTOCOL_STAGES } from "@/lib/domain/state-machine";
import type { DebateStage } from "@/lib/domain/types";

export const STAGE_LABELS: Record<DebateStage, string> = {
  idle: "Waiting",
  initializing: "Initializing",
  assigning_positions: "Assigning positions",
  researching: "Researching",
  opening_a: "Opening statement — Debater A",
  opening_b: "Opening statement — Debater B",
  rebuttal_a: "Rebuttal — Debater A",
  rebuttal_b: "Rebuttal — Debater B",
  cross_examination_a: "Cross examination — A asks B",
  cross_examination_b: "Cross examination — B asks A",
  closing_a: "Closing statement — Debater A",
  closing_b: "Closing statement — Debater B",
  judging: "Judge deliberating",
  completed: "Completed",
  failed: "Failed",
};

export function StageIndicator({
  stage,
  researchStartedAt,
  researchDurationSec,
}: {
  stage: DebateStage;
  researchStartedAt: string | null;
  researchDurationSec: number;
}) {
  const activeIndex = PROTOCOL_STAGES.indexOf(stage);
  const progress =
    stage === "failed"
      ? 100
      : Math.round((activeIndex / (PROTOCOL_STAGES.length - 1)) * 100);

  const showCountdown =
    stage === "researching" &&
    researchStartedAt !== null &&
    researchDurationSec > 0;

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-6 py-5">
      <div className="flex flex-col items-center gap-3">
        <span className="text-xs uppercase tracking-[0.3em] text-neutral-500">
          Current stage
        </span>
        <span
          className={`text-2xl font-bold tracking-wide ${
            stage === "failed"
              ? "text-red-400"
              : stage === "completed"
                ? "text-emerald-400"
                : "text-amber-400"
          }`}
        >
          {STAGE_LABELS[stage].toUpperCase()}
        </span>
        {showCountdown ? (
          <Countdown
            startedAt={researchStartedAt}
            durationSec={researchDurationSec}
          />
        ) : (
          <div className="h-6" aria-hidden />
        )}
        <div className="mt-1 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-amber-500 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
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

  return (
    <div className="flex h-6 items-center gap-3">
      <div className="h-1 w-40 overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full bg-sky-400 transition-all duration-300"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <span className="font-mono text-lg text-sky-300">{remaining}s</span>
    </div>
  );
}
