"use client";

import * as Progress from "@radix-ui/react-progress";
import {
  IconCopy,
  IconDownload,
  IconGavel,
} from "@tabler/icons-react";
import {
  CRITERIA_KEYS,
  CRITERIA_WEIGHTS,
  type CriterionKey,
  type Debate,
} from "@/lib/domain/types";
import { CRITERIA_LABELS } from "@/lib/domain/labels";
import { useCopy } from "@/lib/client/use-copy";
import { debateFileName, debateToMarkdown, verdictToText } from "@/lib/export";

const ACTION_BUTTON =
  "inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-2 text-xs font-semibold text-fg-muted transition-colors hover:border-border-strong hover:text-fg active:translate-y-px";

export function ResultPanel({ debate }: { debate: Debate }) {
  // Hooks must run unconditionally, before the `no result` early return.
  const verdictCopy = useCopy();

  const result = debate.judgeResult;
  if (!result) return null;

  const winnerPosition =
    result.winner === "A" ? debate.debaterA.position : debate.debaterB.position;
  const winnerIsA = result.winner === "A";
  const winnerColor = winnerIsA ? "text-for" : "text-against";
  const winnerBorder = winnerIsA ? "border-for-border" : "border-against-border";
  const winnerSoft = winnerIsA ? "bg-for-soft" : "bg-against-soft";

  const downloadMarkdown = () => {
    const blob = new Blob([debateToMarkdown(debate)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = debateFileName(debate);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-labelledby="verdict-heading"
      className={`panel flex flex-col gap-5 border-2 p-5 sm:p-6 ${winnerBorder}`}
    >
      <header className="flex flex-col items-center gap-2 text-center">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 items-center justify-center rounded-full ${winnerSoft} ${winnerColor}`}
        >
          <IconGavel className="h-5 w-5" stroke={1.8} />
        </span>
        <h2
          id="verdict-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-subtle"
        >
          Winner
        </h2>
        <p
          className={`text-2xl font-extrabold tracking-wide sm:text-3xl ${winnerColor}`}
        >
          Debater {result.winner}
        </p>
        <p className="text-sm text-fg-muted">arguing {winnerPosition}</p>

        <p className="mt-1 flex items-baseline gap-2 font-mono text-3xl font-bold tabular-nums text-fg sm:text-4xl">
          <span className={winnerIsA ? "text-for" : ""}>
            {result.scoreA}
          </span>
          <span className="text-fg-subtle">—</span>
          <span className={!winnerIsA ? "text-against" : ""}>
            {result.scoreB}
          </span>
        </p>
        <p className="text-[10px] uppercase tracking-widest text-fg-subtle">
          Debater A · Debater B
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {CRITERIA_KEYS.map((key) => (
          <CriterionRow key={key} criterion={key} debate={debate} />
        ))}
      </div>

      <Block title={`Why ${result.winner} won`}>{result.reason}</Block>
      <Block title="Decisive argument">{result.decisiveArgument}</Block>
      <Block title="Weakest argument">{result.weakestArgument}</Block>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => void verdictCopy.copy(verdictToText(debate))}
          className={ACTION_BUTTON}
        >
          <IconCopy className="h-3.5 w-3.5" stroke={1.8} />
          {verdictCopy.copied ? "Copied" : "Copy verdict"}
        </button>
        <button type="button" onClick={downloadMarkdown} className={ACTION_BUTTON}>
          <IconDownload className="h-3.5 w-3.5" stroke={1.8} />
          Download Markdown
        </button>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {verdictCopy.copied ? "Verdict copied to clipboard" : ""}
      </p>
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
    <div className="rounded-control border border-border bg-surface-muted px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">
        {CRITERIA_LABELS[criterion]}
        <span className="ml-2 font-normal text-fg-subtle">max {weight}</span>
      </p>
      <ScoreBar
        label="A"
        score={scores.A}
        weight={weight}
        speaker="A"
        ariaLabel={`${CRITERIA_LABELS[criterion]}, Debater A: ${scores.A} of ${weight}`}
      />
      <ScoreBar
        label="B"
        score={scores.B}
        weight={weight}
        speaker="B"
        ariaLabel={`${CRITERIA_LABELS[criterion]}, Debater B: ${scores.B} of ${weight}`}
      />
    </div>
  );
}

function ScoreBar({
  label,
  score,
  weight,
  speaker,
  ariaLabel,
}: {
  label: string;
  score: number;
  weight: number;
  speaker: "A" | "B";
  ariaLabel: string;
}) {
  const percent = weight > 0 ? (score / weight) * 100 : 0;
  const barColor = speaker === "A" ? "bg-for" : "bg-against";
  const textColor = speaker === "A" ? "text-for" : "text-against";

  return (
    <div className="mt-2 flex items-center gap-3">
      <span className={`w-3 text-xs font-bold ${textColor}`}>{label}</span>
      <Progress.Root
        value={percent}
        aria-label={ariaLabel}
        className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken"
      >
        <Progress.Indicator
          className={`h-full w-full rounded-full transition-transform duration-500 ease-out ${barColor}`}
          style={{ transform: `translateX(-${100 - percent}%)` }}
        />
      </Progress.Root>
      <span className="w-12 text-right font-mono text-xs tabular-nums text-fg-muted">
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
    <div className="rounded-control border border-border bg-surface-muted px-4 py-3 sm:px-5 sm:py-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">
        {title}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">
        {children}
      </p>
    </div>
  );
}
