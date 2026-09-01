"use client";

import type { Debate, Speaker } from "@/lib/domain/types";

export function SourcesPanel({ debate }: { debate: Debate }) {
  const hasAny =
    (debate.research.A?.sources.length ?? 0) > 0 ||
    (debate.research.B?.sources.length ?? 0) > 0;

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <DebaterSources debate={debate} speaker="A" />
      <DebaterSources debate={debate} speaker="B" />
      {!hasAny && (
        <p className="text-xs text-neutral-600 md:col-span-2">
          Sources will appear here once the research phase completes.
        </p>
      )}
    </section>
  );
}

function DebaterSources({
  debate,
  speaker,
}: {
  debate: Debate;
  speaker: Speaker;
}) {
  const research = speaker === "A" ? debate.research.A : debate.research.B;
  const position = speaker === "A" ? debate.debaterA.position : debate.debaterB.position;
  const accent = speaker === "A" ? "text-sky-400" : "text-red-400";

  return (
    <details className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-5 py-4">
      <summary className="cursor-pointer select-none">
        <span className={`font-semibold ${accent}`}>DEBATER {speaker}</span>
        <span className="ml-2 text-xs uppercase tracking-widest text-neutral-500">
          {position} · {research?.sources.length ?? 0} sources
        </span>
      </summary>
      {research && research.keyClaims.length > 0 && (
        <div className="mt-3 border-t border-neutral-800 pt-3">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500">
            Key claims
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-neutral-400">
            {research.keyClaims.map((claim, i) => (
              <li key={i}>{claim}</li>
            ))}
          </ul>
        </div>
      )}
      <ol className="mt-3 space-y-3 border-t border-neutral-800 pt-3">
        {(research?.sources ?? []).map((source, i) => (
          <li key={source.url} className="text-sm">
            <p className="font-medium text-neutral-200">
              [{i + 1}] {source.title}
            </p>
            <p className="text-xs text-neutral-500">
              {source.publisher}
              {source.relevance ? ` — ${source.relevance}` : ""}
            </p>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-400 underline-offset-2 hover:underline"
            >
              {source.url}
            </a>
          </li>
        ))}
      </ol>
      {research?.timedOut && (
        <p className="mt-3 text-xs text-amber-500/80">
          Research window ended before all sources could be gathered.
        </p>
      )}
    </details>
  );
}
