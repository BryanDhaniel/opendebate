import type { DebateStage } from "../domain/types";

/**
 * StageGuard concentrates the debate's output-validation and retry policy in one
 * place. It was extracted from DebateRunner so the policy is testable directly
 * (a handful of string cases) instead of only through a full debate run, and so
 * the ten call sites in the engine collapse onto a single `record()` method.
 */

/**
 * Validates a stage's text output. We push only substantive output to the
 * transcript: empty strings are obvious failures (Gemini occasionally returns
 * none), and text without terminal punctuation has been truncated mid-sentence
 * by `max_output_tokens` (typically because Gemini's thinking tokens ate the
 * budget). Both surface as errors so `withRetry` kicks in before the message
 * lands on the page.
 */
export function guardStageOutput(text: string, stage: DebateStage): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`empty ${stage} output`);
  }
  // A trailing quotation mark or closing bracket is not "mid-sentence": models
  // legitimately end a paragraph with a cited quote ("…as the data shows.") or a
  // parenthetical. Treating that as truncation forces a retry that re-runs a paid
  // LLM generation for no reason. Validate the punctuation on a copy with the
  // trailing noise removed, but return the original text (quote intact) for display.
  const check = trimmed.replace(/["'”’)\]]$/, "");
  if (!check) {
    throw new Error(`empty ${stage} output`);
  }
  const lastChar = check[check.length - 1];
  if (lastChar !== "." && lastChar !== "!" && lastChar !== "?") {
    // Ground truth for diagnosis: log the length and the exact tail of the
    // rejected text so a repeat failure shows whether the model was cut off by
    // the token ceiling (long text, stops mid-word) or ended with a non-terminal
    // character (short text, odd ending) — the fixes are different.
    console.warn(
      `[engine] ${stage} failed terminal-punctuation check ` +
        `(len=${trimmed.length}, tail=${JSON.stringify(trimmed.slice(-80))})`,
    );
    throw new Error(`${stage} output truncated mid-sentence`);
  }
  return trimmed;
}

export interface RetryOptions {
  /** Total attempts before giving up. Defaults to 2 (one retry). */
  max?: number;
}

/**
 * Runs `fn`, retrying up to `max` total attempts on thrown errors. The
 * DebateEngine uses the default of 2: a generation that returns empty or
 * truncated output is retried once before the stage is skipped (non-critical)
 * or fails (critical).
 */
export async function withRetry(
  fn: () => Promise<void>,
  options: RetryOptions = {},
): Promise<void> {
  const max = options.max ?? 2;
  let lastError: unknown;
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      await fn();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < max - 1) {
        console.warn(
          "[engine] stage attempt failed, retrying:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }
  throw lastError;
}
