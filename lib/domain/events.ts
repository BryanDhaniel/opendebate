import type { Debate, DebateStage } from "./types";

export type DebateEventType =
  | "debate_started"
  | "research_started"
  | "research_completed"
  | "opening_started"
  | "opening_completed"
  | "rebuttal_started"
  | "rebuttal_completed"
  | "cross_examination_started"
  | "cross_examination_completed"
  | "closing_started"
  | "closing_completed"
  | "judging_started"
  | "judging_completed"
  | "debate_completed"
  | "debate_failed"
  | "stage_skipped";

export interface DebateEvent {
  seq: number;
  type: DebateEventType;
  stage: DebateStage;
  debate: Debate;
  detail?: string;
  at: string;
}

export const TERMINAL_EVENT_TYPES: readonly DebateEventType[] = [
  "debate_completed",
  "debate_failed",
];

export function isTerminalEvent(event: DebateEvent): boolean {
  return TERMINAL_EVENT_TYPES.includes(event.type);
}
