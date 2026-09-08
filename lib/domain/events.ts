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

/**
 * Builds the terminal event for a debate that has already reached a terminal
 * stage but whose terminal event is absent from the event log — e.g. the server
 * restarted and the in-memory bus history was lost. The engine owns the event
 * protocol, so this lives in the domain layer rather than the SSE transport,
 * which should only relay events it is handed.
 */
export function synthesizeTerminalEvent(
  debate: Debate,
  lastSeq = 0,
): DebateEvent {
  return {
    seq: lastSeq + 1,
    type: debate.stage === "completed" ? "debate_completed" : "debate_failed",
    stage: debate.stage,
    debate: JSON.parse(JSON.stringify(debate)),
    at: new Date().toISOString(),
  };
}
