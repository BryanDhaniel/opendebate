export type Speaker = "A" | "B";

export type Position = "FOR" | "AGAINST";

export type DebateStage =
  | "idle"
  | "initializing"
  | "assigning_positions"
  | "researching"
  | "opening_a"
  | "opening_b"
  | "rebuttal_a"
  | "rebuttal_b"
  | "cross_examination_a"
  | "cross_examination_b"
  | "closing_a"
  | "closing_b"
  | "judging"
  | "completed"
  | "failed";

export interface Source {
  title: string;
  url: string;
  publisher: string;
  relevance: string;
}

export interface ResearchResult {
  keyClaims: string[];
  evidence: string[];
  sources: Source[];
  counterArguments: string[];
  uncertainties: string[];
  timedOut?: boolean;
}

export type MessageKind =
  | "opening"
  | "rebuttal"
  | "question"
  | "answer"
  | "closing";

export interface DebateMessage {
  id: string;
  stage: DebateStage;
  speaker: Speaker;
  kind: MessageKind;
  content: string;
  createdAt: string;
}

export type CriterionKey =
  | "evidenceQuality"
  | "argumentStrength"
  | "rebuttalQuality"
  | "logicalReasoning"
  | "responseToOpponent"
  | "clarity";

export const CRITERIA_WEIGHTS: Record<CriterionKey, number> = {
  evidenceQuality: 25,
  argumentStrength: 25,
  rebuttalQuality: 20,
  logicalReasoning: 15,
  responseToOpponent: 10,
  clarity: 5,
};

export const CRITERIA_KEYS = Object.keys(CRITERIA_WEIGHTS) as CriterionKey[];

export interface JudgeResult {
  winner: Speaker;
  scoreA: number;
  scoreB: number;
  criteria: Record<CriterionKey, { A: number; B: number }>;
  decisiveArgument: string;
  weakestArgument: string;
  reason: string;
}

export interface DebaterInfo {
  position: Position;
  model: string;
}

export interface Debate {
  id: string;
  topic: string;
  debaterA: DebaterInfo;
  debaterB: DebaterInfo;
  stage: DebateStage;
  transcript: DebateMessage[];
  research: { A?: ResearchResult; B?: ResearchResult };
  judgeResult?: JudgeResult;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export function validateJudgeResult(result: JudgeResult): string | null {
  let scoreA = 0;
  let scoreB = 0;
  for (const key of CRITERIA_KEYS) {
    const scores = result.criteria[key];
    const weight = CRITERIA_WEIGHTS[key];
    if (!scores) return `Missing criterion ${key}`;
    if (!Number.isInteger(scores.A) || scores.A < 0 || scores.A > weight)
      return `Invalid A score for ${key}`;
    if (!Number.isInteger(scores.B) || scores.B < 0 || scores.B > weight)
      return `Invalid B score for ${key}`;
    scoreA += scores.A;
    scoreB += scores.B;
  }
  if (result.scoreA !== scoreA) return `scoreA ${result.scoreA} != sum ${scoreA}`;
  if (result.scoreB !== scoreB) return `scoreB ${result.scoreB} != sum ${scoreB}`;
  if (result.winner === "A" && result.scoreA < result.scoreB)
    return "Winner A has lower score than B";
  if (result.winner === "B" && result.scoreB < result.scoreA)
    return "Winner B has lower score than A";
  return null;
}
