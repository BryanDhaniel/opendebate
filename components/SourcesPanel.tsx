"use client";

import { IconExternalLink } from "@tabler/icons-react";
import type { Debate, Speaker } from "@/lib/domain/types";

export function SourcesPanel({ debate }: { debate: Debate }) {
  const hasAny =
    (debate.research.A?.sources.length ?? 0) > 0 ||
    (debate.research.B?.sources.length ?? 0) > 0;

  return (
    <section aria-labelledby="sources-heading" className="flex flex-col gap-3">
      <h2 id="sources-heading" className="text-sm font-semibold text-fg">
        Research sources
      </h2>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <DebaterSources debate={debate} speaker="A" />
        <DebaterSources debate={debate} speaker="B" />
      </div>

      {!hasAny && (
        <p className="text-xs text-fg-subtle">
          Sources appear here once the research phase completes.
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
  const position =
    speaker === "A" ? debate.debaterA.position : debate.debaterB.position;
  const accent = speaker === "A" ? "text-for" : "text-against";
  const count = research?.sources.length ?? 0;

  return (
    <details className="panel px-4 py-3 sm:px-5 sm:py-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[7px]">
        <span className={`text-sm font-semibold ${accent}`}>
          Debater {speaker}
        </span>
        <span className="text-xs uppercase tracking-widest text-fg-subtle">
          {position}
        </span>
        <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-fg-muted tabular-nums">
          {count} {count === 1 ? "source" : "sources"}
        </span>
      </summary>

      {research && research.keyClaims.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
            Key claims
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-fg-muted">
            {research.keyClaims.map((claim, index) => (
              <li key={index}>{claim}</li>
            ))}
          </ul>
        </div>
      )}

      {count > 0 && (
        <ol className="mt-3 space-y-3 border-t border-border pt-3">
          {research?.sources.map((source, index) => (
            <li key={source.url} className="text-sm">
              <p className="font-medium text-fg">
                [{index + 1}] {source.title}
              </p>
              <p className="text-xs text-fg-subtle">
                {source.publisher}
                {source.relevance ? ` — ${source.relevance}` : ""}
              </p>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 break-all text-xs text-fg-muted underline-offset-2 hover:text-fg hover:underline"
              >
                <span>{source.url}</span>
                <IconExternalLink className="h-3 w-3 shrink-0" stroke={1.8} />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ol>
      )}

      {research?.timedOut && (
        <p className="mt-3 text-xs text-warning">
          Research window ended before all sources could be gathered.
        </p>
      )}
    </details>
  );
}
