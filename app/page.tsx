"use client";

import { useDebateStream } from "@/lib/client/use-debate-stream";
import { TopicForm } from "@/components/TopicForm";
import { DebateArena } from "@/components/DebateArena";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConnectionStatus } from "@/components/ConnectionStatus";

const PROTOCOL = [
  { title: "Independent research", note: "Each side searches within a fixed budget" },
  { title: "Opening statements", note: "Both positions stated, uninterrupted" },
  { title: "Rebuttals", note: "Each side answers the other" },
  { title: "Cross-examination", note: "Direct questions, direct answers" },
  { title: "Closing statements", note: "Final appeal to the evidence" },
  { title: "Impartial judgment", note: "A blind judge scores the debate" },
];

export default function Home() {
  const {
    status,
    debate,
    error,
    researchStartedAt,
    connection,
    start,
    retry,
    reset,
  } = useDebateStream();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="sticky top-0 z-30 h-14 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-baseline gap-2">
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-[3px] bg-fg"
            />
            <h1 className="text-lg font-black tracking-tight text-fg sm:text-xl">
              Open<span className="text-fg-subtle">Debate</span>
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ConnectionStatus state={connection} onRetry={retry} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-12"
      >
        {debate ? (
          <DebateArena
            debate={debate}
            researchStartedAt={researchStartedAt}
            onReset={reset}
          />
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            <section className="flex flex-col gap-6 reveal">
              <div className="flex flex-col gap-4">
                <h2 className="text-4xl font-black leading-[1.05] tracking-tight text-fg sm:text-5xl">
                  Two sides, one question, an impartial judge.
                </h2>
                <p className="max-w-prose text-base leading-relaxed text-fg-muted sm:text-lg">
                  Two AI debaters research independently, argue both positions,
                  and a blind judge scores the evidence rather than the rhetoric.
                </p>
              </div>

              <TopicForm
                onStart={(topic) => void start(topic)}
                loading={status === "creating"}
                error={error}
                onRetry={retry}
              />
            </section>

            <aside
              aria-label="How a debate unfolds"
              className="panel reveal p-5 sm:p-6"
              style={{ animationDelay: "80ms" }}
            >
              <h3 className="text-sm font-semibold text-fg">How it unfolds</h3>
              <p className="mt-1 text-xs text-fg-subtle">
                A fixed protocol, run by a server-side engine.
              </p>

              <ol className="mt-5 flex flex-col">
                {PROTOCOL.map((step, index) => (
                  <li key={step.title} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-muted text-[11px] font-bold tabular-nums text-fg-muted">
                        {index + 1}
                      </span>
                      {index < PROTOCOL.length - 1 && (
                        <span
                          aria-hidden="true"
                          className="w-px flex-1 bg-border"
                        />
                      )}
                    </div>
                    <div className={index < PROTOCOL.length - 1 ? "pb-5" : ""}>
                      <p className="text-sm font-semibold text-fg">
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-fg-subtle">
                        {step.note}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        )}
      </main>

      <footer className="border-t border-border px-4 py-5 text-center text-[11px] leading-relaxed text-fg-subtle sm:text-xs">
        Each debater researches within a fixed budget. The judge scores against a
        published rubric, blind to who argued which side.
      </footer>
    </div>
  );
}
