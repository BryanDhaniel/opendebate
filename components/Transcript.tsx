"use client";

import { useEffect, useRef } from "react";
import type { Debate, DebateMessage, Speaker } from "@/lib/domain/types";

const KIND_LABELS: Record<DebateMessage["kind"], string> = {
  opening: "OPENING",
  rebuttal: "REBUTTAL",
  question: "QUESTION",
  answer: "ANSWER",
  closing: "CLOSING",
};

export function Transcript({ debate }: { debate: Debate }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [debate.transcript.length]);

  if (debate.transcript.length === 0) {
    return (
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-8 text-center text-neutral-500">
        The debate has not started yet.
      </section>
    );
  }

  return (
    <section className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
      {debate.transcript.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </section>
  );
}

function MessageBubble({ message }: { message: DebateMessage }) {
  const isA = message.speaker === "A";
  return (
    <div
      className={`flex flex-col gap-1 ${isA ? "items-start" : "items-end"}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-bold tracking-widest ${
            isA ? "text-sky-400" : "text-red-400"
          }`}
        >
          DEBATER {message.speaker}
        </span>
        <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] tracking-widest text-neutral-400">
          {KIND_LABELS[message.kind]}
        </span>
      </div>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isA
            ? "rounded-tl-sm bg-sky-950/60 text-neutral-100"
            : "rounded-tr-sm bg-red-950/60 text-neutral-100"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

export function speakerColor(speaker: Speaker): string {
  return speaker === "A" ? "text-sky-400" : "text-red-400";
}
