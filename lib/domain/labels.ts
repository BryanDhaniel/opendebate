import type { CriterionKey, DebateMessage, DebateStage } from "./types";

/**
 * Human-readable display labels.
 *
 * Lives outside `components/` so both client components and server-side /
 * non-React modules (e.g. the Markdown exporter) can share one source of truth.
 */

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

export const KIND_LABELS: Record<DebateMessage["kind"], string> = {
  opening: "Opening",
  rebuttal: "Rebuttal",
  question: "Question",
  answer: "Answer",
  closing: "Closing",
};

export const CRITERIA_LABELS: Record<CriterionKey, string> = {
  evidenceQuality: "Evidence Quality",
  argumentStrength: "Argument Strength",
  rebuttalQuality: "Rebuttal Quality",
  logicalReasoning: "Logical Reasoning",
  responseToOpponent: "Response to Opponent",
  clarity: "Clarity",
};
