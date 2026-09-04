"use client";

import { useState } from "react";
import { IconArrowRight } from "@tabler/icons-react";
import { TOPIC_MAX_LENGTH } from "@/lib/domain/constants";

const EXAMPLES = [
  "Should governments ban social media for children under 16?",
  "Should AI replace human software developers?",
  "Is remote work better than office work?",
];

export function TopicForm({
  onStart,
  loading,
  error,
  onRetry,
}: {
  onStart: (topic: string) => void;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const [topic, setTopic] = useState("");
  const trimmed = topic.trim();
  const canSubmit = trimmed.length > 0 && !loading;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (canSubmit) onStart(trimmed);
  };

  // Cmd/Ctrl + Enter submits from anywhere in the textarea.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (canSubmit) onStart(trimmed);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="panel flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <label
            htmlFor="topic"
            className="block text-sm font-semibold text-fg"
          >
            The question to debate
          </label>
          <p id="topic-help" className="mt-1 text-xs text-fg-subtle">
            Phrase it as a question or statement with two defensible sides.
          </p>
        </div>

        <textarea
          id="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Should universal basic income replace welfare?"
          rows={3}
          maxLength={TOPIC_MAX_LENGTH}
          disabled={loading}
          aria-describedby="topic-help topic-count"
          aria-invalid={error ? true : undefined}
          className="w-full resize-y rounded-control border border-border bg-surface-muted px-3.5 py-3 text-base text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none disabled:opacity-60"
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span
            id="topic-count"
            className="text-xs tabular-nums text-fg-subtle"
          >
            {topic.length}/{TOPIC_MAX_LENGTH}
          </span>

          <div className="flex items-center gap-3">
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle sm:inline">
              ⌘/Ctrl + ↵
            </kbd>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-control bg-accent px-6 py-2.5 text-sm font-semibold text-accent-contrast transition-[opacity,transform] hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              {loading ? "Preparing the arena…" : "Open the debate"}
              {!loading && <IconArrowRight className="h-4 w-4" stroke={2} />}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-control border border-danger-border bg-danger-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-danger">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 self-start rounded-control border border-danger-border px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger-soft sm:self-auto"
            >
              Try again
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs text-fg-subtle">Or start from a prompt</span>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setTopic(example)}
              disabled={loading}
              className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-fg-muted transition-colors hover:border-fg hover:text-fg disabled:opacity-50 sm:text-sm"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
