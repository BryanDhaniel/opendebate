"use client";

import {
  CRITERIA_KEYS,
  CRITERIA_WEIGHTS,
  type CriterionKey,
  type Debate,
} from "@/lib/domain/types";

const CRITERIA_LABELS: Record<CriterionKey, string> = {
  evidenceQuality: "Evidence Quality",
  argumentStrength: "Argument Strength",
  rebuttalQuality: "Rebuttal Quality",
  logicalReasoning: "Logical Reasoning",
  responseToOpponent: "Response to Opponent",
  clarity: "Clarity",
};

export function ResultPanel({ debate }: { debate: Debate }) {
  const result = debate.judgeResult;
  if (!result) return null;

  const winnerPosition =
    result.winner === "A" ? debate.debaterA.position : debate.debaterB.position;

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-amber-900/60 bg-gradient-to-b from-amber-950/30 to-neutral-900/60 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-4xl">🏆</span>
        <span className="text-xs uppercase tracking-[0.3em] text-neutral-400">
          Winner
        </span>
        <span className="text-3xl font-extrabold tracking-wide text-amber-400">
          DEBATER {result.winner}
        </span>
        <span className="text-sm text-neutral-400">arguing {winnerPosition}</span>
        <span className="font-mono text-4xl font-bold text-neutral-100">
          {result.scoreA} <span className="text-neutral-600">—</span>{" "}
          {result.scoreB}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-neutral-500">
          Debater A · Debater B
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {CRITERIA_KEYS.map((key) => (
          <CriterionRow key={key} criterion={key} debate={debate} />
        ))}
      </div>

      <Block title={`Why ${result.winner} won`}>{result.reason}</Block>
      <Block title="Decisive argument">{result.decisiveArgument}</Block>
      <Block title="Weakest argument">{result.weakestArgument}</Block>
    </section>
  );
}

function CriterionRow({
  criterion,
  debate,
}: {
  criterion: CriterionKey;
  debate: Debate;
}) {
  const scores = debate.judgeResult?.criteria[criterion];
  if (!scores) return null;
  const weight = CRITERIA_WEIGHTS[criterion];

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
        {CRITERIA_LABELS[criterion]}
        <span className="ml-2 text-neutral-600">max {weight}</span>
      </p>
      <ScoreBar
        label="A"
        score={scores.A}
        weight={weight}
        barColor="bg-sky-400"
        textColor="text-sky-400"
      />
      <ScoreBar
        label="B"
        score={scores.B}
        weight={weight}
        barColor="bg-red-400"
        textColor="text-red-400"
      />
    </div>
  );
}

function ScoreBar({
  label,
  score,
  weight,
  barColor,
  textColor,
}: {
  label: string;
  score: number;
  weight: number;
  barColor: string;
  textColor: string;
}) {
  const percent = weight > 0 ? (score / weight) * 100 : 0;
  return (
    <div className="mt-2 flex items-center gap-3">
      <span className={`w-4 text-xs font-bold ${textColor}`}>{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-14 text-right font-mono text-xs text-neutral-300">
        {score}/{weight}
      </span>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
        {title}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
        {children}
      </p>
    </div>
  );
}
