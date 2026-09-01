import type { DebateStage } from "./types";

export const PROTOCOL_STAGES: readonly DebateStage[] = [
  "idle",
  "initializing",
  "assigning_positions",
  "researching",
  "opening_a",
  "opening_b",
  "rebuttal_a",
  "rebuttal_b",
  "cross_examination_a",
  "cross_examination_b",
  "closing_a",
  "closing_b",
  "judging",
  "completed",
] as const;

export function stageIndex(stage: DebateStage): number {
  return PROTOCOL_STAGES.indexOf(stage);
}

export function nextStage(stage: DebateStage): DebateStage | null {
  const i = stageIndex(stage);
  if (i === -1 || i === PROTOCOL_STAGES.length - 1) return null;
  return PROTOCOL_STAGES[i + 1];
}

export function canTransition(from: DebateStage, to: DebateStage): boolean {
  if (from === "failed" || from === "completed") return false;
  if (to === "failed") return true;
  return nextStage(from) === to;
}

export function assertTransition(from: DebateStage, to: DebateStage): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid stage transition: ${from} -> ${to}`);
  }
}

export const TERMINAL_STAGES: readonly DebateStage[] = ["completed", "failed"];

export function isTerminal(stage: DebateStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}
