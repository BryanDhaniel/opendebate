import { LIMITS } from "./config";

export type TopicValidation =
  | { ok: true; topic: string }
  | { ok: false; error: string };

export function sanitizeTopic(input: unknown): TopicValidation {
  if (typeof input !== "string") {
    return { ok: false, error: "Topic must be a string" };
  }
  const cleaned = input
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < LIMITS.topicMinLength) {
    return { ok: false, error: "Topic must not be empty" };
  }
  if (cleaned.length > LIMITS.topicMaxLength) {
    return {
      ok: false,
      error: `Topic must be at most ${LIMITS.topicMaxLength} characters`,
    };
  }
  return { ok: true, topic: cleaned };
}
