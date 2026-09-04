import { CRITERIA_KEYS, CRITERIA_WEIGHTS, type Debate } from "@/lib/domain/types";
import { CRITERIA_LABELS, KIND_LABELS } from "@/lib/domain/labels";

/**
 * Plain-text helpers for clipboard sharing and Markdown export.
 * Pure functions over the Debate domain model — safe to call from client or server.
 */

function speakerLabel(debate: Debate, speaker: "A" | "B"): string {
  const info = speaker === "A" ? debate.debaterA : debate.debaterB;
  return `Debater ${speaker} (${info.position})`;
}

/** Short, shareable summary of the outcome. */
export function verdictToText(debate: Debate): string {
  const result = debate.judgeResult;
  const lines: string[] = [
    `Topic: ${debate.topic}`,
    `${speakerLabel(debate, "A")} vs ${speakerLabel(debate, "B")}`,
  ];

  if (!result) {
    lines.push("", "Status: This debate has not been judged yet.");
    return lines.join("\n");
  }

  lines.push(
    "",
    `Winner: ${speakerLabel(debate, result.winner)}`,
    `Final score: Debater A ${result.scoreA} — ${result.scoreB} Debater B`,
    "",
    "Scores by criterion:",
  );

  for (const key of CRITERIA_KEYS) {
    const scores = result.criteria[key];
    if (!scores) continue;
    lines.push(
      `  ${CRITERIA_LABELS[key]} (max ${CRITERIA_WEIGHTS[key]}): A ${scores.A} — ${scores.B} B`,
    );
  }

  lines.push("", `Why: ${result.reason}`);
  lines.push(`Decisive argument: ${result.decisiveArgument}`);
  lines.push(`Weakest argument: ${result.weakestArgument}`);
  return lines.join("\n");
}

/** Full debate as readable plain text (used by "copy transcript"). */
export function transcriptToText(debate: Debate): string {
  const lines: string[] = [`Topic: ${debate.topic}`, ""];

  for (const message of debate.transcript) {
    lines.push(
      `--- ${speakerLabel(debate, message.speaker)} · ${KIND_LABELS[message.kind]} ---`,
      message.content,
      "",
    );
  }

  return lines.join("\n").trim();
}

/** Full debate as Markdown, for download. */
export function debateToMarkdown(debate: Debate): string {
  const out: string[] = [
    `# ${debate.topic}`,
    "",
    `**${speakerLabel(debate, "A")}** · model \`${debate.debaterA.model}\`  `,
    `**${speakerLabel(debate, "B")}** · model \`${debate.debaterB.model}\``,
    "",
  ];

  const result = debate.judgeResult;
  if (result) {
    out.push("## Result", "");
    out.push(
      `**Winner:** ${speakerLabel(debate, result.winner)}`,
      "",
      `**Final score:** Debater A ${result.scoreA} — ${result.scoreB} Debater B`,
      "",
      "| Criterion | Max | A | B |",
      "| --- | --- | --- | --- |",
    );
    for (const key of CRITERIA_KEYS) {
      const scores = result.criteria[key];
      if (!scores) continue;
      out.push(
        `| ${CRITERIA_LABELS[key]} | ${CRITERIA_WEIGHTS[key]} | ${scores.A} | ${scores.B} |`,
      );
    }
    out.push(
      "",
      `### Why ${result.winner} won`,
      "",
      result.reason,
      "",
      "### Decisive argument",
      "",
      result.decisiveArgument,
      "",
      "### Weakest argument",
      "",
      result.weakestArgument,
      "",
    );
  }

  out.push("## Transcript", "");
  if (debate.transcript.length === 0) {
    out.push("_No transcript entries._", "");
  } else {
    for (const message of debate.transcript) {
      out.push(
        `### ${KIND_LABELS[message.kind]} — ${speakerLabel(debate, message.speaker)}`,
        "",
        message.content,
        "",
      );
    }
  }

  const anySources =
    (debate.research.A?.sources.length ?? 0) > 0 ||
    (debate.research.B?.sources.length ?? 0) > 0;

  if (anySources) {
    out.push("## Sources", "");
    for (const speaker of ["A", "B"] as const) {
      const research = debate.research[speaker];
      if (!research || research.sources.length === 0) continue;
      out.push(`### ${speakerLabel(debate, speaker)}`, "");
      research.sources.forEach((source, index) => {
        out.push(
          `${index + 1}. [${source.title}](${source.url}) — ${source.publisher}${
            source.relevance ? ` — ${source.relevance}` : ""
          }`,
        );
      });
      out.push("");
    }
  }

  return out.join("\n").trim() + "\n";
}

/** Filesystem-safe-ish filename derived from the topic. */
export function debateFileName(debate: Debate): string {
  const slug =
    debate.topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "debate";
  return `opendebate-${slug}.md`;
}
