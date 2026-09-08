"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Debate, DebateMessage, Speaker } from "@/lib/domain/types";
import { KIND_LABELS } from "@/lib/domain/labels";
import { usePrefersReducedMotion } from "@/lib/client/use-reduced-motion";

/** Distance (px) from the bottom that still counts as "following along". */
const FOLLOW_SLACK = 80;

type Filter = "all" | Speaker;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
];

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

export function Transcript({ debate }: { debate: Debate }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  const messages = useMemo(
    () =>
      filter === "all"
        ? debate.transcript
        : debate.transcript.filter((message) => message.speaker === filter),
    [debate.transcript, filter],
  );

  // Only auto-scroll when the reader is already at the bottom, otherwise we
  // would yank the viewport away from what they are reading.
  useEffect(() => {
    if (!atBottom) return;
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({
      top: element.scrollHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [messages.length, atBottom, reduced, filter]);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    setAtBottom(distanceFromBottom < FOLLOW_SLACK);
  }, []);

  const jumpToLatest = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({
      top: element.scrollHeight,
      behavior: reduced ? "auto" : "smooth",
    });
    setAtBottom(true);
  }, [reduced]);

  const latest = messages[messages.length - 1];

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-fg">Transcript</h2>

        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label="Filter transcript by debater"
            className="flex gap-0.5 rounded-control border border-border bg-surface-muted p-0.5"
          >
            {FILTERS.map((option) => {
              const selected = filter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  aria-pressed={selected}
                  className={`rounded-[7px] px-2.5 py-1 text-xs font-semibold transition-colors ${
                    selected
                      ? "bg-surface text-fg shadow-sm"
                      : "text-fg-subtle hover:text-fg"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <span className="text-xs tabular-nums text-fg-subtle">
            {messages.length} {messages.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      </header>

      {/* Curated live region: announce a short summary rather than dumping
          every full message into the assistive-tech queue. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {latest
          ? `New ${KIND_LABELS[latest.kind].toLowerCase()} from Debater ${latest.speaker}: ${truncateAtWord(latest.content, 140)}`
          : ""}
      </p>

      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          tabIndex={0}
          role="region"
          aria-label="Debate transcript"
          className="scroll-area relative flex max-h-[55vh] min-h-[14rem] flex-col overflow-y-auto p-4 sm:p-5"
        >
          {messages.length === 0 ? (
            <p className="m-auto text-center text-sm text-fg-subtle">
              {debate.transcript.length === 0
                ? "The debate has not started yet."
                : `No entries from Debater ${filter} yet.`}
            </p>
          ) : (
            <ol className="flex flex-col gap-5 sm:gap-6">
              {messages.map((message) => (
                <MessageRow key={message.id} message={message} />
              ))}
            </ol>
          )}
        </div>

        {!atBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute bottom-3 right-3 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-fg shadow-lg transition-colors hover:border-border-strong active:translate-y-px"
          >
            Jump to latest ↓
          </button>
        )}
      </div>
    </section>
  );
}

function MessageRow({ message }: { message: DebateMessage }) {
  const isA = message.speaker === "A";
  const sideColor = isA ? "text-for" : "text-against";
  const sideBorder = isA ? "border-for-border" : "border-against-border";
  const sideSoft = isA ? "bg-for-soft" : "bg-against-soft";

  return (
    // The colored left border is the arena timeline: each turn gets a
    // speaker-coloured segment running the full height of the message.
    <li className={`relative border-l-2 pl-4 sm:pl-5 ${sideBorder}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[11px] font-bold tracking-widest ${sideColor}`}>
          DEBATER {message.speaker}
        </span>
        <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-fg-subtle">
          {KIND_LABELS[message.kind]}
        </span>
      </div>

      <div
        className={`mt-2 max-w-[68ch] whitespace-pre-wrap rounded-control border px-4 py-3 text-[15px] leading-relaxed text-fg sm:px-5 ${sideBorder} ${sideSoft}`}
      >
        {message.content}
      </div>
    </li>
  );
}
