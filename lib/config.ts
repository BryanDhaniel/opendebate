export interface ResearchBudget {
  durationMs: number;
  maxSearches: number;
  maxSources: number;
}

export const DEFAULT_RESEARCH_BUDGET: ResearchBudget = {
  durationMs: 60_000,
  maxSearches: 5,
  maxSources: 10,
};

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
  topicMinLength: 1,
  topicMaxLength: 500,
  maxActiveDebates: Number(process.env.MAX_ACTIVE_DEBATES ?? 5),
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
