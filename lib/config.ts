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

/**
 * AI providers ship behind a shared {@link AIProvider} contract
 * (`lib/ai/types.ts`). Each debate role can be pointed at a different provider
 * via env vars, so a deployment can keep the cheap debater on OpenAI and the
 * heavier judge on Gemini (or vice versa).
 */
export type ProviderName = "openai" | "gemini";

const KNOWN_PROVIDERS: readonly ProviderName[] = ["openai", "gemini"];

/**
 * Resolves the provider for a role from an env object. Unset falls back to
 * `"openai"` for backward compatibility. An explicit but unknown value (a typo,
 * renamed provider, ...) throws instead of silently defaulting — a
 * misconfiguration should fail loudly, not degrade silently.
 */
export function resolveProvider(
  env: NodeJS.ProcessEnv,
  role: "debater" | "judge",
): ProviderName {
  const raw = role === "debater" ? env.DEBATER_PROVIDER : env.JUDGE_PROVIDER;
  if (raw === undefined) return "openai";
  if ((KNOWN_PROVIDERS as readonly string[]).includes(raw)) {
    return raw as ProviderName;
  }
  throw new Error(
    `Unknown AI provider "${raw}". Expected one of: ${KNOWN_PROVIDERS.join(", ")}`,
  );
}

/**
 * Default model per provider, used when the role-specific model env var is
 * unset. Gemini defaults to a current flash model.
 */
const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-3.8-flash",
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
