"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Debate, DebateMessage, Speaker } from "@/lib/domain/types";
import { KIND_LABELS } from "@/lib/domain/labels";
import { usePrefersReducedMotion } from "@/lib/client/use-reduced-motion";

/** Messages longer than this get a "show more" affordance. */
const COLLAPSE_THRESHOLD = 480;

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

  // Only auto-scroll when the reader is already at the bottom — otherwise we
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
          {/* Center spine — the arena's dividing line. Desktop only. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-border lg:block"
          />

          {messages.length === 0 ? (
            <p className="m-auto text-center text-sm text-fg-subtle">
              {debate.transcript.length === 0
                ? "The debate has not started yet."
                : `No entries from Debater ${filter} yet.`}
            </p>
          ) : (
            <ol className="flex flex-col gap-5">
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
    <li className="relative lg:grid lg:grid-cols-2">
      {/* On desktop the spacer occupies the opposite column so each side's
          content hugs the center spine: A left, B right. */}
      {!isA && <div aria-hidden="true" className="hidden lg:block" />}

      <div
        className={`border-l-2 pl-3 lg:border-l-0 lg:pl-0 ${sideBorder} ${
          isA ? "lg:pr-6 lg:text-right" : "lg:pl-6 lg:text-left"
        }`}
      >
        <div
          className={`flex items-center gap-2 ${isA ? "lg:justify-end" : ""}`}
        >
          <span className={`text-xs font-bold tracking-widest ${sideColor}`}>
            DEBATER {message.speaker}
          </span>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-fg-subtle">
            {KIND_LABELS[message.kind]}
          </span>
        </div>

        <MessageBubble
          message={message}
          sideColor={sideColor}
          sideSoft={sideSoft}
          sideBorder={sideBorder}
          rightAligned={isA}
        />
      </div>

      {isA && <div aria-hidden="true" className="hidden lg:block" />}
    </li>
  );
}

function MessageBubble({
  message,
  sideColor,
  sideSoft,
  sideBorder,
  rightAligned,
}: {
  message: DebateMessage;
  sideColor: string;
  sideSoft: string;
  sideBorder: string;
  rightAligned: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const collapsible = message.content.length > COLLAPSE_THRESHOLD;
  const shown =
    collapsible && !expanded
      ? truncateAtWord(message.content, COLLAPSE_THRESHOLD)
      : message.content;

  return (
    <div
      className={`mt-1.5 inline-block max-w-full whitespace-pre-wrap rounded-control border px-4 py-3 text-sm leading-relaxed text-fg lg:max-w-[88%] ${
        rightAligned ? "lg:ml-auto" : "lg:mr-auto"
      } ${sideBorder} ${sideSoft}`}
    >
      {shown}
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className={`mt-2 block text-xs font-semibold underline underline-offset-2 hover:no-underline ${sideColor}`}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
