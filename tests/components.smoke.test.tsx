import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DebateArena } from "@/components/DebateArena";
import { TopicForm } from "@/components/TopicForm";
import { ResultPanel } from "@/components/ResultPanel";
import { Transcript } from "@/components/Transcript";
import { SourcesPanel } from "@/components/SourcesPanel";
import { StageIndicator } from "@/components/StageIndicator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConnectionStatus } from "@/components/ConnectionStatus";

import type { Debate, JudgeResult } from "@/lib/domain/types";
import { validateJudgeResult } from "@/lib/domain/types";
import { TOPIC_MAX_LENGTH } from "@/lib/domain/constants";
import { debateToMarkdown, verdictToText } from "@/lib/export";

/**
 * Render smoke tests.
 *
 * These render the UI components to static HTML with representative data to
 * catch crashes, bad props and missing accessibility affordances. They use
 * react-dom/server, so no DOM environment or extra dependency is required.
 */

function makeDebate(overrides: Partial<Debate> = {}): Debate {
  const criteria = {
    evidenceQuality: { A: 21, B: 18 },
    argumentStrength: { A: 20, B: 19 },
    rebuttalQuality: { A: 16, B: 14 },
    logicalReasoning: { A: 12, B: 11 },
    responseToOpponent: { A: 8, B: 7 },
    clarity: { A: 4, B: 4 },
  } satisfies JudgeResult["criteria"];

  const scoreA = Object.values(criteria).reduce((sum, c) => sum + c.A, 0);
  const scoreB = Object.values(criteria).reduce((sum, c) => sum + c.B, 0);

  const base: Debate = {
    id: "debate-1",
    topic: "Should AI replace human software developers?",
    debaterA: { position: "FOR", model: "gpt-4o-mini" },
    debaterB: { position: "AGAINST", model: "gpt-4o-mini" },
    stage: "completed",
    transcript: [
      {
        id: "m1",
        stage: "opening_a",
        speaker: "A",
        kind: "opening",
        content: "A short opening statement.",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "m2",
        stage: "opening_b",
        speaker: "B",
        kind: "opening",
        // Long enough to verify full rendering without a truncation control.
        content: `${"A very long opening statement. ".repeat(40)}`,
        createdAt: "2026-01-01T00:00:01.000Z",
      },
      {
        id: "m3",
        stage: "rebuttal_a",
        speaker: "A",
        kind: "rebuttal",
        content: "A short rebuttal.",
        createdAt: "2026-01-01T00:00:02.000Z",
      },
    ],
    research: {
      A: {
        keyClaims: ["Claim one"],
        evidence: ["Evidence one"],
        sources: [
          {
            title: "Study on developer productivity",
            url: "https://example.com/study",
            publisher: "Example Journal",
            relevance: "Directly compares throughput",
          },
        ],
        counterArguments: ["Counter one"],
        uncertainties: ["Uncertainty one"],
      },
      B: {
        keyClaims: [],
        evidence: [],
        sources: [],
        counterArguments: [],
        uncertainties: [],
      },
    },
    judgeResult: {
      winner: "A",
      scoreA,
      scoreB,
      criteria,
      decisiveArgument: "The decisive point.",
      weakestArgument: "The weakest point.",
      reason: "Because the evidence was stronger.",
    },
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  return { ...base, ...overrides };
}

describe("topic form", () => {
  const html = renderToStaticMarkup(
    <TopicForm onStart={() => {}} loading={false} />,
  );

  it("labels the textarea and wires up help and count text", () => {
    expect(html).toContain('for="topic"');
    expect(html).toContain('aria-describedby="topic-help topic-count"');
    expect(html).toContain(`0/${TOPIC_MAX_LENGTH}<`);
  });

  it("offers examples and a submit control", () => {
    expect(html).toContain("Open the debate");
    expect(html).toContain("Or start from a prompt");
  });

  it("renders an alert when creation fails", () => {
    const failed = renderToStaticMarkup(
      <TopicForm
        onStart={() => {}}
        loading={false}
        error="Network error while creating the debate."
        onRetry={() => {}}
      />,
    );
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("Network error while creating the debate.");
    expect(failed).toContain("Try again");
  });
});

describe("stage indicator", () => {
  it("exposes progress to assistive tech and shows the step counter", () => {
    const html = renderToStaticMarkup(
      <StageIndicator
        stage="opening_a"
        researchStartedAt={null}
        researchDurationSec={60}
      />,
    );
    expect(html).toContain('role="progressbar"');
    expect(html).toContain("Opening statement");
    // opening_a is the 5th entry in PROTOCOL_STAGES (idle → researching → …).
    expect(html).toContain("5 / 14");
  });

  it("renders the research countdown only while researching", () => {
    const researching = renderToStaticMarkup(
      <StageIndicator
        stage="researching"
        researchStartedAt={new Date().toISOString()}
        researchDurationSec={60}
      />,
    );
    expect(researching).toContain('role="timer"');
    expect(researching).toContain("research time left");

    const judging = renderToStaticMarkup(
      <StageIndicator
        stage="judging"
        researchStartedAt={null}
        researchDurationSec={60}
      />,
    );
    expect(judging).not.toContain('role="timer"');
  });
});

describe("transcript", () => {
  const debate = makeDebate();
  const html = renderToStaticMarkup(<Transcript debate={debate} />);

  it("renders every entry with an accessible region and count", () => {
    expect(html).toContain('aria-label="Debate transcript"');
    expect(html).toContain("3 entries");
    expect(html).toContain("A short opening statement.");
    expect(html).toContain("A short rebuttal.");
  });

  it("renders long messages in full without a disclosure control", () => {
    // The redesign dropped the "Show more"/"Show less" truncation so the full
    // prose is always readable; assert the long opening is present and that no
    // collapse affordance exists.
    expect(html).toContain("A very long opening statement.");
    expect(html).not.toContain("Show more");
    expect(html).not.toContain("Show less");
  });

  it("provides a speaker filter group and a live region", () => {
    expect(html).toContain('aria-label="Filter transcript by debater"');
    expect(html).toContain('aria-live="polite"');
  });

  it("shows an empty state before the debate starts", () => {
    const empty = renderToStaticMarkup(
      <Transcript debate={makeDebate({ transcript: [] })} />,
    );
    expect(empty).toContain("The debate has not started yet.");
  });
});

describe("sources panel", () => {
  const html = renderToStaticMarkup(
    <SourcesPanel debate={makeDebate()} />,
  );

  it("lists sources and flags external links for screen readers", () => {
    expect(html).toContain("Study on developer productivity");
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("(opens in a new tab)");
    expect(html).toContain("1 source");
  });

  it("explains itself when research has not produced sources yet", () => {
    const empty = renderToStaticMarkup(
      <SourcesPanel debate={makeDebate({ research: {} })} />,
    );
    expect(empty).toContain("once the research phase completes");
  });
});

describe("result panel", () => {
  const debate = makeDebate();
  const html = renderToStaticMarkup(<ResultPanel debate={debate} />);

  it("renders the winner, scores and every rubric criterion", () => {
    expect(html).toContain("Winner");
    // The winner name is rendered in sentence case; the uppercase "Winner"
    // eyebrow above it is uppercased in CSS, not in the markup.
    expect(html).toContain("Debater A");
    for (const label of [
      "Evidence Quality",
      "Argument Strength",
      "Rebuttal Quality",
      "Logical Reasoning",
      "Response to Opponent",
      "Clarity",
    ]) {
      expect(html).toContain(label);
    }
  });

  it("labels each score bar for assistive tech", () => {
    expect(html).toContain(
      'aria-label="Evidence Quality, Debater A: 21 of 25"',
    );
  });

  it("offers copy and export actions", () => {
    expect(html).toContain("Copy verdict");
    expect(html).toContain("Download Markdown");
  });

  it("renders nothing before the judge has scored", () => {
    expect(
      renderToStaticMarkup(
        <ResultPanel debate={makeDebate({ judgeResult: undefined })} />,
      ),
    ).toBe("");
  });
});

describe("debate arena", () => {
  const html = renderToStaticMarkup(
    <DebateArena
      debate={makeDebate()}
      researchStartedAt={null}
      onReset={() => {}}
    />,
  );

  it("renders the topic, both debaters and every panel", () => {
    expect(html).toContain("Should AI replace human software developers?");
    expect(html).toContain("DEBATER A");
    expect(html).toContain("DEBATER B");
    expect(html).toContain("Transcript");
    expect(html).toContain("Research sources");
    expect(html).toContain("Winner");
  });

  it("offers a reset control once the debate is over", () => {
    expect(html).toContain("Start a new debate");
  });

  it("marks the active speaker during a live stage", () => {
    const live = renderToStaticMarkup(
      <DebateArena
        debate={makeDebate({ stage: "closing_b" })}
        researchStartedAt={null}
        onReset={() => {}}
      />,
    );
    expect(live).toContain("Speaking");
    expect(live).not.toContain("Start a new debate");
  });

  it("surfaces failures as an alert", () => {
    const failed = renderToStaticMarkup(
      <DebateArena
        debate={makeDebate({ stage: "failed", error: "Provider timed out" })}
        researchStartedAt={null}
        onReset={() => {}}
      />,
    );
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("Provider timed out");
  });
});

describe("chrome", () => {
  it("theme toggle exposes an accessible, stateful control", () => {
    const html = renderToStaticMarkup(<ThemeToggle />);
    expect(html).toContain('aria-label="Switch to dark theme"');
    expect(html).toContain('aria-pressed="false"');
  });

  it("connection status renders every state with a retry affordance when lost", () => {
    for (const state of ["live", "reconnecting", "closed"] as const) {
      const html = renderToStaticMarkup(<ConnectionStatus state={state} />);
      expect(html).toContain('aria-hidden="true"');
    }
    const lost = renderToStaticMarkup(
      <ConnectionStatus state="error" onRetry={() => {}} />,
    );
    expect(lost).toContain("Disconnected");
    expect(lost).toContain("Retry");
  });
});

describe("export", () => {
  const debate = makeDebate();

  it("produces a markdown document with scores, transcript and sources", () => {
    const markdown = debateToMarkdown(debate);
    expect(markdown.startsWith("# Should AI replace")).toBe(true);
    expect(markdown).toContain("## Result");
    expect(markdown).toContain("| Evidence Quality | 25 | 21 | 18 |");
    expect(markdown).toContain("## Transcript");
    expect(markdown).toContain("A short opening statement.");
    expect(markdown).toContain("## Sources");
    expect(markdown).toContain("[Study on developer productivity]");
  });

  it("produces a shareable verdict summary", () => {
    const text = verdictToText(debate);
    expect(text).toContain("Winner: Debater A (FOR)");
    expect(text).toContain(`Debater A ${debate.judgeResult!.scoreA}`);
  });

  it("fixture scores satisfy the judge validation rules", () => {
    expect(validateJudgeResult(debate.judgeResult!)).toBeNull();
  });
});
