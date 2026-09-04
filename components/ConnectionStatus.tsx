"use client";

import type { ConnectionState } from "@/lib/client/use-debate-stream";

interface StatusConfig {
  label: string;
  /** Extra detail announced to screen readers only. */
  hint: string;
  dot: string;
  pulse: boolean;
}

const CONFIG: Record<ConnectionState, StatusConfig> = {
  idle: {
    label: "Ready",
    hint: "Not connected to a debate.",
    dot: "bg-fg-subtle",
    pulse: false,
  },
  creating: {
    label: "Starting",
    hint: "Preparing the debate arena.",
    dot: "bg-accent",
    pulse: true,
  },
  connecting: {
    label: "Connecting",
    hint: "Opening the live event stream.",
    dot: "bg-accent",
    pulse: true,
  },
  live: {
    label: "Live",
    hint: "Connected and receiving updates.",
    dot: "bg-live",
    pulse: true,
  },
  reconnecting: {
    label: "Reconnecting",
    hint: "The event stream was interrupted and is retrying.",
    dot: "bg-warning",
    pulse: true,
  },
  closed: {
    label: "Finished",
    hint: "The debate has ended.",
    dot: "bg-fg-subtle",
    pulse: false,
  },
  error: {
    label: "Disconnected",
    hint: "The connection to the debate was lost.",
    dot: "bg-danger",
    pulse: false,
  },
};

export function ConnectionStatus({
  state,
  onRetry,
}: {
  state: ConnectionState;
  onRetry?: () => void;
}) {
  const config = CONFIG[state];

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
        {/* Decorative: the label and sr-only hint carry the meaning. */}
        <span aria-hidden="true" className="relative flex h-2 w-2 shrink-0">
          {config.pulse && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.dot}`}
            />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${config.dot}`}
          />
        </span>
        <span className="text-xs font-medium text-fg-muted">{config.label}</span>
        <span className="sr-only">{config.hint}</span>
      </div>

      {state === "error" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-danger-border bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:brightness-95"
        >
          Retry
        </button>
      )}
    </div>
  );
}
