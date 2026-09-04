/**
 * Constants and simple value types shared by client and server code.
 *
 * Kept separate from lib/config.ts, which reads `process.env` and is therefore
 * server-only. Importing config values into a client component would pull
 * server-only environment access into the browser bundle.
 */
export const TOPIC_MIN_LENGTH = 1;
export const TOPIC_MAX_LENGTH = 500;

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
