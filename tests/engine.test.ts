import { describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DebateBus } from "@/lib/debate-engine/bus";
import { DebateRunner } from "@/lib/debate-engine/engine";
import { DebateStore } from "@/lib/debate-engine/store";
import type { EngineDeps } from "@/lib/debate-engine/engine";
import type {
  Debater,
  Judge,
  JudgeContext,
  OpeningContext,
  ResearchContext,
} from "@/lib/ai/types";
import type { DebateMessage, JudgeResult, ResearchResult } from "@/lib/domain/types";
import { isTerminalEvent } from "@/lib/domain/events";

const TOPIC = "Should AI replace software developers?";

function emptyResearch(): ResearchResult {
  return {
    keyClaims: [],
    evidence: [],
    sources: [],
    counterArguments: [],
    uncertainties: [],
  };
}

function scriptedDebater(options?: {
  failRebuttal?: boolean;
}): Debater {
  return {
    async research(context: ResearchContext) {
      const hits = await context.search(`${context.position} evidence`);
      return {
        keyClaims: [`${context.position} claim`],
        evidence: hits.map((h) => h.content),
        sources: hits.map((h) => ({ ...h, relevance: "" })),
        counterArguments: [],
        uncertainties: [],
      };
    },
    async generateOpening(context: OpeningContext) {
      return `Opening for ${context.position}.`;
    },
    async generateRebuttal() {
      if (options?.failRebuttal) throw new Error("rebuttal service down");
      return "Rebuttal content.";
    },
    async generateQuestion() {
      return "Question content?";
    },
    async generateAnswer() {
      return "Answer content.";
    },
    async generateClosing() {
      return "Closing content.";
    },
  };
}

function scriptedJudge(
  impl?: (context: JudgeContext) => Promise<JudgeResult>,
): Judge {
  return { evaluate: impl ?? (async () => defaultJudgeResult()) };
}

function defaultJudgeResult(winner: "A" | "B" = "A"): JudgeResult {
  const scores = { A: 0, B: 0 };
  const criteria = {} as JudgeResult["criteria"];
  const aParts = [22, 21, 17, 13, 7, 4];
  const bParts = [18, 20, 15, 12, 7, 4];
  const keys = [
    "evidenceQuality",
    "argumentStrength",
    "rebuttalQuality",
    "logicalReasoning",
    "responseToOpponent",
    "clarity",
  ] as const;
  keys.forEach((key, i) => {
    criteria[key] = { A: aParts[i], B: bParts[i] };
  });
  scores.A = aParts.reduce((x, y) => x + y, 0);
  scores.B = bParts.reduce((x, y) => x + y, 0);
  return {
    winner,
    scoreA: scores.A,
    scoreB: scores.B,
    criteria,
    decisiveArgument: "d",
    weakestArgument: "w",
    reason: "r",
  };
}

function makeDeps(overrides: Partial<EngineDeps> = {}) {
  const store = new DebateStore(join(tmpdir(), `opendebate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`));
  const bus = new DebateBus();
  const deps: EngineDeps = {
    store,
    bus,
    createDebater: () => scriptedDebater(),
    createJudge: () => scriptedJudge(),
    researchTool: null,
    maxActiveDebates: 5,
    ...overrides,
  };
  return { store, bus, deps };
}

async function runToCompletion(
  deps: EngineDeps,
  debateId: string,
): Promise<import("@/lib/domain/events").DebateEvent[]> {
  const runner = new DebateRunner(deps);
  runner.startIfIdle(debateId);
  // Wait until the bus log contains a terminal event.
  for (let i = 0; i < 200; i++) {
    const events = deps.bus.replay(debateId);
    const last = events[events.length - 1];
    if (last && isTerminalEvent(last)) return events;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("debate did not finish in time");
}

const EXPECTED_SEQUENCE = [
  "debate_started",
  "research_started",
  "research_completed",
  "opening_started",
  "opening_completed",
  "opening_started",
  "opening_completed",
  "rebuttal_started",
  "rebuttal_completed",
  "rebuttal_started",
  "rebuttal_completed",
  "cross_examination_started",
  "cross_examination_completed",
  "cross_examination_started",
  "cross_examination_completed",
  "closing_started",
  "closing_completed",
  "closing_started",
  "closing_completed",
  "judging_started",
  "judging_completed",
  "debate_completed",
];

describe("debate engine", () => {
  it("runs the full debate: research → opening → rebuttal → cross examination → closing → judging → result", async () => {
    const { store, deps } = makeDeps();
    const debate = await store.create({ topic: TOPIC, debaterModel: "mock" });

    const events = await runToCompletion(deps, debate.id);

    expect(events.map((e) => e.type)).toEqual(EXPECTED_SEQUENCE);

    const final = events[events.length - 1].debate;
    expect(final.stage).toBe("completed");
    expect(final.judgeResult).toBeDefined();
    expect(final.judgeResult?.scoreA).toBe(84);
    expect(final.judgeResult?.scoreB).toBe(76);

    const kinds = final.transcript.map((m) => `${m.speaker}:${m.kind}`);
    expect(kinds).toEqual([
      "A:opening",
      "B:opening",
      "A:rebuttal",
      "B:rebuttal",
      "A:question",
      "B:answer",
      "B:question",
      "A:answer",
      "A:closing",
      "B:closing",
    ]);

    // Research isolation in the final state
    expect(final.research.A?.keyClaims).toEqual(["FOR claim"]);
    expect(final.research.B?.keyClaims).toEqual(["AGAINST claim"]);
  });

  it("positions are assigned: A = FOR, B = AGAINST", async () => {
    const { store, deps } = makeDeps();
    const debate = await store.create({ topic: TOPIC, debaterModel: "mock" });
    await runToCompletion(deps, debate.id);
    expect(debate.debaterA.position).toBe("FOR");
    expect(debate.debaterB.position).toBe("AGAINST");
  });

  it("skips a non-critical stage when it fails and still completes", async () => {
    const { store, deps } = makeDeps({
      createDebater: () => scriptedDebater({ failRebuttal: true }),
    });
    const debate = await store.create({ topic: TOPIC, debaterModel: "mock" });

    const events = await runToCompletion(deps, debate.id);

    const types = events.map((e) => e.type);
    expect(types).toContain("stage_skipped");
    expect(events[events.length - 1].type).toBe("debate_completed");

    const final = events[events.length - 1].debate;
    // Rebuttals missing, but the debate completed
    expect(final.transcript.some((m: DebateMessage) => m.kind === "rebuttal")).toBe(false);
    expect(final.judgeResult).toBeDefined();
  });

  it("marks the debate failed when a critical stage fails", async () => {
    const { store, deps } = makeDeps({
      createJudge: () =>
        scriptedJudge(async () => {
          throw new Error("judge unavailable");
        }),
    });
    const debate = await store.create({ topic: TOPIC, debaterModel: "mock" });

    const events = await runToCompletion(deps, debate.id);

    expect(events[events.length - 1].type).toBe("debate_failed");
    const final = events[events.length - 1].debate;
    expect(final.stage).toBe("failed");
    expect(final.error).toMatch(/Judging failed/);
  });

  it("enforces the research timeout and continues with empty research", async () => {
    const slowResearchTool = {
      search: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return [];
      },
    };
    const debaterUsingSearch: Debater = {
      ...scriptedDebater(),
      async research(context: ResearchContext) {
        await context.search("slow query");
        return emptyResearch();
      },
    };
    const { store, deps } = makeDeps({
      createDebater: () => debaterUsingSearch,
      researchTool: slowResearchTool,
      budget: { durationMs: 50, maxSearches: 5, maxSources: 10 },
    });
    const debate = await store.create({ topic: TOPIC, debaterModel: "mock" });

    const events = await runToCompletion(deps, debate.id);

    expect(events[events.length - 1].type).toBe("debate_completed");
    const final = events[events.length - 1].debate;
    expect(final.research.A).toBeDefined();
    expect(final.judgeResult).toBeDefined();
  });

  it("startIfIdle does not restart a debate that already ran", async () => {
    const { store, deps } = makeDeps();
    const debate = await store.create({ topic: TOPIC, debaterModel: "mock" });
    const runner = new DebateRunner(deps);
    runner.startIfIdle(debate.id);
    for (let i = 0; i < 200; i++) {
      const events = deps.bus.replay(debate.id);
      const last = events[events.length - 1];
      if (last && isTerminalEvent(last)) break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const eventsBefore = deps.bus.replay(debate.id).length;
    const returned = runner.startIfIdle(debate.id);
    expect(returned?.stage).toBe("completed");
    expect(deps.bus.replay(debate.id).length).toBe(eventsBefore);
  });

  it("judge totals are validated against criteria before acceptance", async () => {
    const badResult = defaultJudgeResult("A");
    badResult.scoreA = 0;
    const { store, deps } = makeDeps({
      createJudge: () => scriptedJudge(async () => badResult),
    });
    const debate = await store.create({ topic: TOPIC, debaterModel: "mock" });

    const events = await runToCompletion(deps, debate.id);

    expect(events[events.length - 1].type).toBe("debate_failed");
    expect(events[events.length - 1].debate.error).toMatch(
      /invalid judge result/,
    );
  });
});

/**
 * Helpers and tests for the new `validateStageOutput()` guard: empty strings
 * and outputs that don't end with terminal punctuation (i.e. truncated
 * mid-sentence by `max_output_tokens`) must trigger `withRetry`, so the page
 * never shows an empty or fragment bubble. Gemini 3 charges thinking tokens
 * against the output budget, which previously let truncated content slip
 * through silently.
 */
function sequencedDebater(): Debater & {
  openings: string[];
  rebuttals: string[];
} {
  const openings: string[] = [];
  const rebuttals: string[] = [];
  return {
    openings,
    rebuttals,
    async research(context: ResearchContext) {
      const hits = await context.search(`${context.position} evidence`);
      return {
        keyClaims: [`${context.position} claim`],
        evidence: hits.map((h) => h.content),
        sources: hits.map((h) => ({ ...h, relevance: "" })),
        counterArguments: [],
        uncertainties: [],
      };
    },
    async generateOpening() {
      const idx = openings.length;
      openings.push(`Opening ${idx}.`);
      return openings[openings.length - 1];
    },
    async generateRebuttal() {
      const idx = rebuttals.length;
      rebuttals.push(`Rebuttal ${idx}.`);
      return rebuttals[rebuttals.length - 1];
    },
    async generateQuestion() {
      return "Question content?";
    },
    async generateAnswer() {
      return "Answer content.";
    },
    async generateClosing() {
      return "Closing content.";
    },
  };
}

describe("debate engine output validation", () => {
  it("retries and accepts valid output when the first attempt is empty", async () => {
    const debater = sequencedDebater();
    debater.generateOpening = async function () {
      const idx = debater.openings.length;
      debater.openings.push(idx === 0 ? "" : "Valid opening.");
      return debater.openings[debater.openings.length - 1];
    };
    const { store, deps } = makeDeps({ createDebater: () => debater });
    const debate = await store.create({ topic: TOPIC, debaterModel: "mock" });

    const events = await runToCompletion(deps, debate.id);

    expect(events[events.length - 1].type).toBe("debate_completed");
    // A: empty (attempt 1) + "Valid opening." (attempt 2 after retry) = 2.
    // B: "Valid opening." (attempt 1, no retry needed) = 1.
    // Both debaters come from the same factory, so they share this counter.
    expect(debater.openings).toHaveLength(3);
    const final = events[events.length - 1].debate;
    const openingA = final.transcript.find(
      (m: DebateMessage) => m.speaker === "A" && m.kind === "opening",
    );
    expect(openingA?.content).toBe("Valid opening.");
  });

  it("retries and accepts valid output when the first attempt is truncated", async () => {
    const debater = sequencedDebater();
    debater.generateOpening = async function () {
      const idx = debater.openings.length;
      debater.openings.push(
        idx === 0
          ? "If autonomous cellular metabolism is"
          : "Valid opening.",
      );
      return debater.openings[debater.openings.length - 1];
    };
    const { store, deps } = makeDeps({ createDebater: () => debater });
    const debate = await store.create({ topic: TOPIC, debaterModel: "mock" });

    const events = await runToCompletion(deps, debate.id);

    expect(events[events.length - 1].type).toBe("debate_completed");
    // Same shape as the empty-output case: A retries once, B succeeds first try.
    expect(debater.openings).toHaveLength(3);
  });

  it("skips a non-critical stage when both attempts produce empty output", async () => {
    const debater = sequencedDebater();
    debater.generateRebuttal = async function () {
      debater.rebuttals.push("");
      return debater.rebuttals[debater.rebuttals.length - 1];
    };
    const { store, deps } = makeDeps({ createDebater: () => debater });
    const debate = await store.create({ topic: TOPIC, debaterModel: "mock" });

    const events = await runToCompletion(deps, debate.id);

    const types = events.map((e) => e.type);
    expect(types).toContain("stage_skipped");
    expect(events[events.length - 1].type).toBe("debate_completed");
    expect(debater.rebuttals).toHaveLength(4); // 2 speakers × 2 attempts
    const final = events[events.length - 1].debate;
    expect(
      final.transcript.some((m: DebateMessage) => m.kind === "rebuttal"),
    ).toBe(false);
  });

  it("marks the debate failed when a critical opening is empty twice in a row", async () => {
    const debater = sequencedDebater();
    debater.generateOpening = async function () {
      debater.openings.push("");
      return debater.openings[debater.openings.length - 1];
    };
    const { store, deps } = makeDeps({ createDebater: () => debater });
    const debate = await store.create({ topic: TOPIC, debaterModel: "mock" });

    const events = await runToCompletion(deps, debate.id);

    expect(events[events.length - 1].type).toBe("debate_failed");
    expect(events[events.length - 1].debate.error).toMatch(/empty opening_a/);
  });
});
