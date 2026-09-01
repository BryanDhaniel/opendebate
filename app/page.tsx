"use client";

import { useDebateStream } from "@/lib/client/use-debate-stream";
import { TopicForm } from "@/components/TopicForm";
import { DebateArena } from "@/components/DebateArena";

export default function Home() {
  const {
    status,
    debate,
    error,
    researchStartedAt,
    start,
    reset,
  } = useDebateStream();

  return (
    <main className="flex min-h-screen flex-col items-center gap-10 px-4 py-12">
      <header className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-4xl font-black tracking-tight text-neutral-100">
          OPEN<span className="text-amber-400">DEBATE</span>
        </h1>
        <p className="text-sm text-neutral-500">
          Two AI debaters. One independent judge. Evidence over rhetoric.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {debate ? (
        <DebateArena
          debate={debate}
          researchStartedAt={researchStartedAt}
          onReset={reset}
        />
      ) : (
        <TopicForm
          onStart={(topic) => void start(topic)}
          loading={status === "creating"}
        />
      )}
    </main>
  );
}
