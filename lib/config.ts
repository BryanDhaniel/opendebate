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
export function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

// Per-stage output budgets. These are hard ceilings, not targets — the word
// targets that shape the prose live in `lib/prompts/debater.ts`. At roughly
// Token ceilings per generation stage — these are the HARD `max_output_tokens`
// caps. Gemini 3 charges its internal *thinking* tokens against the same
// budget, so the visible prose must fit inside (ceiling − thinking).
//
// Word targets that actually drive length live in lib/prompts/debater.ts
// (~ upper target ÷ 0.75 words-per-token). The ceilings below carry generous
// headroom over the upper word target so a ~300-token thinking budget (even at
// `thinking_level: "minimal"`) plus mild rambling never causes a mid-sentence
// truncation. They were raised after a real failure: the opening (the critical
// stage) truncated on both retries and failed the whole debate, because its
// 900-token ceiling left no room for thinking tokens. See `guardStageOutput`
// plus `withRetry` in lib/debate-engine/stage-guard.ts.
export const TOKEN_LIMITS = {
  researchQueries: 400,
  researchSynthesis: 1600,
  opening: 1500,
  rebuttal: 1100,
  question: 500,
  answer: 1000,
  closing: 1050,
  judge: 2000,
} as const;

export const LIMITS = {
  topicMinLength: TOPIC_MIN_LENGTH,
  topicMaxLength: TOPIC_MAX_LENGTH,
  maxActiveDebates: positiveInt(process.env.MAX_ACTIVE_DEBATES, 5),
  // Idle debates that were created via POST /api/debates but whose stream was
  // never opened leak a slot forever (see REVIEW.md C2): they never leave
  // "idle", so activeCount() keeps counting them and five abandoned creates
  // wedge the API into a permanent 429. Idle debates older than this are
  // swept from the store on the next count/create.
  idleTtlMs: positiveInt(process.env.IDLE_TTL_MS, 10 * 60_000),
  // Creation rate limits for POST /api/debates (REVIEW.md C1). Each creation
  // triggers paid LLM work, so we cap how many can start per window — globally
  // and per client IP — in addition to the concurrency cap.
  rateLimitWindowMs: positiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  maxCreatesPerIp: positiveInt(process.env.MAX_CREATES_PER_IP, 5),
  maxCreatesGlobal: positiveInt(process.env.MAX_CREATES_GLOBAL, 20),
  aiCallTimeoutMs: 90_000,
  judgeTimeoutMs: 180_000,
  searchTimeoutMs: 15_000,
  maxResultsPerSearch: 4,
  maxContentCharsPerSource: 1500,
} as const;

/**
 * AI providers ship behind a shared {@link AIProvider} contract
 * (`lib/ai/types.ts`). Each debate role can be pointed at a different provider
 * via env vars, so a deployment can keep the cheap debater on OpenAI and the
 * heavier judge on Gemini (or vice versa).
 */
export type ProviderName = "openai" | "gemini";

const KNOWN_PROVIDERS: readonly ProviderName[] = ["openai", "gemini"];

/**
 * Resolves the provider for a role from an env object.
 *
 * - An explicit per-role choice (`DEBATER_PROVIDER` / `JUDGE_PROVIDER`) always
 *   wins and is validated against the known set (a typo throws rather than
 *   silently defaulting).
 * - The judge follows the debater when unset, so flipping one `DEBATER_PROVIDER`
 *   switch moves both roles onto the same provider.
 * - With no explicit choice, prefer Gemini when it is the *only* key present,
 *   otherwise stay on the OpenAI default for backward compatibility. This means
 *   dropping in a `GEMINI_API_KEY` is enough to run fully on Gemini.
 */
export function resolveProvider(
  env: NodeJS.ProcessEnv,
  role: "debater" | "judge",
): ProviderName {
  const raw = role === "debater" ? env.DEBATER_PROVIDER : env.JUDGE_PROVIDER;
  if (raw !== undefined) {
    if ((KNOWN_PROVIDERS as readonly string[]).includes(raw)) {
      return raw as ProviderName;
    }
    throw new Error(
      `Unknown AI provider "${raw}". Expected one of: ${KNOWN_PROVIDERS.join(", ")}`,
    );
  }
  if (role === "judge") {
    return resolveProvider(env, "debater");
  }
  if (env.GEMINI_API_KEY && !env.OPENAI_API_KEY) return "gemini";
  return "openai";
}

/**
 * Default model per provider, used when the role-specific model env var is
 * unset. Gemini defaults to a current flash model.
 */
const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-3.5-flash-lite",
};

/** Resolves the model id for a role given its already-resolved provider. */
export function resolveModel(
  env: NodeJS.ProcessEnv,
  role: "debater" | "judge",
  provider: ProviderName,
): string {
  if (provider === "gemini") {
    return role === "debater"
      ? (env.GEMINI_DEBATER_MODEL ?? DEFAULT_MODELS.gemini)
      : (env.GEMINI_JUDGE_MODEL ?? DEFAULT_MODELS.gemini);
  }
  return role === "debater"
    ? (env.OPENAI_DEBATER_MODEL ?? DEFAULT_MODELS.openai)
    : (env.OPENAI_JUDGE_MODEL ?? "gpt-4o");
}

/**
 * Module-level resolution from `process.env`, kept for backward-compatible
 * inspection. `runtime.build()` re-derives these from its own `env` argument so
 * configuration is fully parameterized and testable.
 */
export const PROVIDERS = {
  debater: resolveProvider(process.env, "debater"),
  judge: resolveProvider(process.env, "judge"),
} as const;

export const MODELS = {
  debater: resolveModel(process.env, "debater", PROVIDERS.debater),
  judge: resolveModel(process.env, "judge", PROVIDERS.judge),
} as const;
