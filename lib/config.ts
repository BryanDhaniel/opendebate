import { TOPIC_MAX_LENGTH, TOPIC_MIN_LENGTH } from "./domain/constants";

// Re-exported so existing `@/lib/config` imports keep working, while client
// components can import the constants module directly without pulling in the
// server-only `process.env` reads below.
export { DEFAULT_RESEARCH_BUDGET } from "./domain/constants";
export type { ResearchBudget } from "./domain/constants";

/**
 * Reads a positive integer from an env var, falling back when unset or
 * malformed. A bare `Number(...)` is not safe here: `Number("abc")` is NaN,
 * and every comparison against NaN is false — which would silently disable
 * the limit it is meant to enforce.
 */
function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const TOKEN_LIMITS = {
  researchQueries: 300,
  researchSynthesis: 1200,
  opening: 250,
  rebuttal: 250,
  question: 100,
  answer: 150,
  closing: 150,
  judge: 2000,
} as const;

export const LIMITS = {
  topicMinLength: TOPIC_MIN_LENGTH,
  topicMaxLength: TOPIC_MAX_LENGTH,
  maxActiveDebates: positiveInt(process.env.MAX_ACTIVE_DEBATES, 5),
  aiCallTimeoutMs: 90_000,
  judgeTimeoutMs: 180_000,
  searchTimeoutMs: 15_000,
  maxResultsPerSearch: 4,
  maxContentCharsPerSource: 1500,
} as const;

export const MODELS = {
  debater: process.env.OPENAI_DEBATER_MODEL ?? "gpt-4o-mini",
  judge: process.env.OPENAI_JUDGE_MODEL ?? "gpt-4o",
} as const;
