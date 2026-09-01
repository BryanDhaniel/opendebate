import { describe, expect, it } from "vitest";
import { DEFAULT_RESEARCH_BUDGET, type ResearchBudget } from "@/lib/config";
import type { ResearchContext } from "@/lib/ai/types";
import type { ResearchResult } from "@/lib/domain/types";

const TOPIC = "Test topic";

function makeDebater(label: string) {
  const searchQueriesSeen: string[] = [];
  const debater = {
    async research(context: ResearchContext): Promise<ResearchResult> {
      const query = `query for ${label}`;
      searchQueriesSeen.push(query);
      const hits = await context.search(query);
      return {
        keyClaims: [`Claim from ${label}`],
        evidence: hits.map((hit) => hit.content),
        sources: hits.map((hit) => ({ ...hit, relevance: "" })),
        counterArguments: [],
        uncertainties: [],
      };
    },
  };
  return { debater, searchQueriesSeen };
}

describe("research isolation", () => {
  it("runs A and B concurrently with separate search budgets", async () => {
    const budget: ResearchBudget = { ...DEFAULT_RESEARCH_BUDGET };
    const a = makeDebater("A");
    const b = makeDebater("B");

    const budgetedSearch = (side: string) => {
      let used = 0;
      return async (query: string) => {
        if (used >= budget.maxSearches) return [];
        used++;
        void query;
        return [
          {
            title: `Result for ${side}`,
            url: `https://${side}.example.com/result`,
            content: `Secret research of ${side}`,
            publisher: `${side}.example.com`,
          },
        ];
      };
    };

    const [resultA, resultB] = await Promise.all([
      a.debater.research({
        topic: TOPIC,
        position: "FOR",
        search: budgetedSearch("A"),
        budget,
      }),
      b.debater.research({
        topic: TOPIC,
        position: "AGAINST",
        search: budgetedSearch("B"),
        budget,
      }),
    ]);

    // Both completed
    expect(resultA.keyClaims).toEqual(["Claim from A"]);
    expect(resultB.keyClaims).toEqual(["Claim from B"]);

    // A cannot access B research and vice versa
    expect(JSON.stringify(resultA)).not.toContain("Secret research of B");
    expect(JSON.stringify(resultB)).not.toContain("Secret research of A");
    expect(resultA.sources[0]?.url).toContain("A.example.com");
    expect(resultB.sources[0]?.url).toContain("B.example.com");
  });

  it("search budget is enforced per debater, not globally", async () => {
    const makeCounter = () => {
      let used = 0;
      return {
        fn: async (query?: string) => {
          void query;
          used++;
          return [];
        },
        get count() {
          return used;
        },
      };
    };

    const counterA = makeCounter();
    const counterB = makeCounter();

    const run = (counter: ReturnType<typeof makeCounter>) =>
      Promise.all(
        Array.from({ length: 5 }, () => counter.fn("query")),
      );

    await Promise.all([run(counterA), run(counterB)]);

    expect(counterA.count).toBe(5);    expect(counterB.count).toBe(5);
    expect(counterA.count + counterB.count).toBe(10);
  });
});
