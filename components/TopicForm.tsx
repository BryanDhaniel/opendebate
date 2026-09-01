"use client";

import { useState } from "react";

const EXAMPLES = [
  "Should governments ban social media for children under 16?",
  "Should AI replace human software developers?",
  "Is remote work better than office work?",
];

export function TopicForm({
  onStart,
  loading,
  disabled,
}: {
  onStart: (topic: string) => void;
  loading: boolean;
  disabled?: boolean;
}) {
  const [topic, setTopic] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (topic.trim() && !loading) onStart(topic.trim());
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label
          htmlFor="topic"
          className="text-sm font-medium uppercase tracking-widest text-neutral-400"
        >
          Debate Topic
        </label>
        <textarea
          id="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Enter a debatable question…"
          rows={3}
          maxLength={500}
          disabled={disabled || loading}
          className="w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-lg text-neutral-100 placeholder:text-neutral-600 focus:border-amber-500 focus:outline-none disabled:opacity-50"
        />
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-neutral-500">
            {topic.length}/500 characters
          </span>
          <button
            type="submit"
            disabled={disabled || loading || !topic.trim()}
            className="rounded-xl bg-amber-500 px-8 py-3 font-semibold text-neutral-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Preparing arena…" : "Start Debate"}
          </button>
        </div>
      </form>
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-neutral-500">
          Or try one
        </span>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setTopic(example)}
              disabled={disabled || loading}
              className="rounded-full border border-neutral-800 px-4 py-1.5 text-sm text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-40"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
