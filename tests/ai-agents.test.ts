import { describe, expect, it } from "vitest";
import { AiDebater } from "@/lib/ai/debater";
import { AiJudge } from "@/lib/ai/judge";
import { researchSynthesisSchema, judgeOutputSchema } from "@/lib/ai/schemas";
import { DEFAULT_RESEARCH_BUDGET } from "@/lib/config";
import type { SearchFn, SearchHit } from "@/lib/research/types";

import type {
  AIObjectRequest,
  AIProvider,
  AIRequest,
  Judge,
  JudgeContext,
} from "@/lib/ai/types";
class MockProvider implements AIProvider {
  textHandler: (input: AIRequest) => string = () => "mock text";
  objectHandler: <T>(input: AIObjectRequest<T>) => T = (input) =>
    input.schema.parse({});

  textCalls: AIRequest[] = [];
  objectCalls: AIObjectRequest<unknown>[] = [];

  async generateText(input: AIRequest) {
    this.textCalls.push(input);
    return { text: this.textHandler(input) };
  }

  async generateObject<T>(input: AIObjectRequest<T>): Promise<T> {
    this.objectCalls.push(input);
    return this.objectHandler<T>(input);
  }
}

function makeHit(index: number, url = `https://example.com/${index}`): SearchHit {
  return {
    title: `Article ${index}`,
    url,
    content: `Evidence content ${index}`,
    publisher: "example.com",
  };
}

const TOPIC = "Should social media be banned for under-16s?";

function judgeContext(): JudgeContext {
  const research = {
    keyClaims: ["Claim"],
    evidence: ["Evidence"],
    sources: [
      { title: "T", url: "https://x.com", publisher: "x.com", relevance: "" },
    ],
    counterArguments: ["Counter"],
    uncertainties: ["Uncertain"],
  };
  return {
    topic: TOPIC,
    debaterA: { position: "FOR", research },
    debaterB: { position: "AGAINST", research },
    transcript: "[DEBATER A | opening] hello\n\n[DEBATER B | opening] hi",
  };
}

function validJudgeOutput(swapAware: { winner: "position1" | "position2" }) {
  const side1 = {
    evidenceQuality: 22,
    argumentStrength: 21,
    rebuttalQuality: 17,
    logicalReasoning: 13,
    responseToOpponent: 10,
    clarity: 5,
  };
  const side2 = {
    evidenceQuality: 20,
    argumentStrength: 19,
    rebuttalQuality: 15,
    logicalReasoning: 11,
    responseToOpponent: 10,
    clarity: 3,
  };
  return {
    winner: swapAware.winner,
    scores: { position1: side1, position2: side2 },
    decisiveArgument: "d",
    weakestArgument: "w",
    reason: "r",
  };
}

describe("AiDebater.research", () => {
  it("generates queries, searches, dedupes and synthesizes", async () => {
    const provider = new MockProvider();
    provider.objectHandler = (input) => {
      if (input.system.includes("generate search queries")) {
        // Deliberately over-offers queries; the debater must cap them.
        return { queries: ["q1", "q2", "q3", "q4", "q5", "q6"] } as never;
      }
      return researchSynthesisSchema.parse({
        keyClaims: ["claim"],
        evidence: ["evidence"],
        counterArguments: ["counter"],
        uncertainties: [],
      }) as never;
    };
    const debater = new AiDebater(provider, "mock");
    const searchCalls: string[] = [];
    const search: SearchFn = async (query) => {
      searchCalls.push(query);
      return [makeHit(searchCalls.length), makeHit(1, "https://example.com/1")];
    };

    const result = await debater.research({
      topic: TOPIC,
      position: "FOR",
      search,
      budget: DEFAULT_RESEARCH_BUDGET,
    });

    expect(searchCalls).toHaveLength(5);
    expect(result.sources).toHaveLength(5);
    expect(new Set(result.sources.map((s) => s.url)).size).toBe(5);
    expect(result.keyClaims).toEqual(["claim"]);
    expect(provider.objectCalls).toHaveLength(2);
  });

  it("returns empty research when the search yields nothing", async () => {
    const provider = new MockProvider();
    provider.objectHandler = (input) => {
      if (input.system.includes("generate search queries")) {
        return { queries: ["q"] } as never;
      }
      return researchSynthesisSchema.parse({
        keyClaims: [],
        evidence: [],
        counterArguments: [],
        uncertainties: [],
      }) as never;
    };
    const debater = new AiDebater(provider, "mock");
    const search: SearchFn = async () => [];

    const result = await debater.research({
      topic: TOPIC,
      position: "AGAINST",
      search,
      budget: DEFAULT_RESEARCH_BUDGET,
    });

    expect(result.sources).toHaveLength(0);
    expect(result.uncertainties.join(" ")).toMatch(/No search results/);
    // Only the query-generation call happened; synthesis was skipped to save cost.
    expect(provider.objectCalls).toHaveLength(1);
  });

  it("caps searches and sources to the budget", async () => {
    const provider = new MockProvider();
    provider.objectHandler = (input) => {
      if (input.system.includes("generate search queries")) {
        return { queries: ["a", "b", "c"] } as never;
      }
      return researchSynthesisSchema.parse({
        keyClaims: [],
        evidence: [],
        counterArguments: [],
        uncertainties: [],
      }) as never;
    };
    const debater = new AiDebater(provider, "mock");
    let searches = 0;
    const search: SearchFn = async () => {
      searches++;
      return Array.from({ length: 10 }, (_, i) => makeHit(searches * 10 + i));
    };

    const result = await debater.research({
      topic: TOPIC,
      position: "FOR",
      search,
      budget: { durationMs: 60_000, maxSearches: 2, maxSources: 4 },
    });

    expect(searches).toBe(2);
    expect(result.sources).toHaveLength(4);
  });
});

describe("AiJudge", () => {
  function makeJudge(
    provider: MockProvider,
    rng: () => number,
  ): Judge {
    return new AiJudge(provider, "mock", rng);
  }

  it("maps anonymized positions back to the correct speakers", async () => {
    const provider = new MockProvider();
    provider.objectHandler = (input) =>
      input.schema.parse(
        validJudgeOutput({ winner: "position1" }),
      ) as never;

    // rng() = 0 < 0.5 => swap, so side1 is B. Winner position1 = B.
    const judgeA = makeJudge(provider, () => 0);
    const resultA = await judgeA.evaluate(judgeContext());
    expect(resultA.winner).toBe("B");
    expect(resultA.scoreB).toBe(88);
    expect(resultA.scoreA).toBe(78);

    // rng() = 0.999 >= 0.5 => no swap, side1 is A. Winner position1 = A.
    const judgeB = makeJudge(provider, () => 0.999);
    const resultB = await judgeB.evaluate(judgeContext());
    expect(resultB.winner).toBe("A");
    expect(resultB.scoreA).toBe(88);
    expect(resultB.scoreB).toBe(78);
  });

  it("hides debater identity behind POSITION labels", async () => {
    const provider = new MockProvider();
    provider.objectHandler = (input) =>
      input.schema.parse(validJudgeOutput({ winner: "position1" })) as never;
    const judge = makeJudge(provider, () => 0.999);
    await judge.evaluate(judgeContext());
    const judgePrompt = provider.objectCalls[0].prompt;
    expect(judgePrompt).toContain("POSITION 1");
    expect(judgePrompt).not.toContain("DEBATER A");
    expect(judgePrompt).not.toContain("DEBATER B");
  });

  it("retries once with feedback when the verdict is malformed", async () => {
    const provider = new MockProvider();
    let calls = 0;
    provider.objectHandler = (input) => {
      calls++;
      if (calls === 1) {
        throw new Error("bad json");
      }
      return input.schema.parse(
        validJudgeOutput({ winner: "position2" }),
      ) as never;
    };
    const judge = makeJudge(provider, () => 0);
    const result = await judge.evaluate(judgeContext());

    expect(calls).toBe(2);
    // rng 0 => swap, side1 = B; winner position2 => side2 = A
    expect(result.winner).toBe("A");
    expect(provider.objectCalls[1].prompt).toMatch(/rejected because/);
  });

  it("surfaces failure when both attempts produce malformed output", async () => {
    const provider = new MockProvider();
    provider.objectHandler = () => {
      throw new Error("always broken");
    };
    const judge = makeJudge(provider, () => 0);
    await expect(judge.evaluate(judgeContext())).rejects.toThrow(
      /always broken/,
    );
  });

  it("schema rejects fabricated totals before any mapping", () => {
    const output = validJudgeOutput({ winner: "position1" });
    output.scores.position1.evidenceQuality = 99;
    expect(judgeOutputSchema.safeParse(output).success).toBe(false);
  });
});
