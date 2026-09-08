/**
 * Pure text helpers shared across server (and potentially client) modules.
 *
 * This is the single home for small string utilities so they are not re-declared
 * inside unrelated modules — `truncate` used to be duplicated byte-for-byte in
 * both lib/ai/debater.ts and lib/ai/judge.ts.
 */

/** Truncates `text` to `max` characters, appending an ellipsis when cut. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}
