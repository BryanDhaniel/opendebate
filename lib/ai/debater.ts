import {
  researchQueriesPrompt,
  researchSynthesisPrompt,
  openingPrompt,
  rebuttalPrompt,
  questionPrompt,
  answerPrompt,
  closingPrompt,
  formatResearchSummary,
} from "../prompts/debater";
import { researchQueriesSchema, researchSynthesisSchema } from "./schemas";
import { LIMITS, TOKEN_LIMITS } from "../config";
import type {
  AIProvider,
  ClosingContext,
  CrossExaminationContext,
  Debater,
  OpeningContext,
  RebuttalContext,
  ResearchContext,
} from "./types";
import type { ResearchResult, Source } from "../domain/types";
import type { SearchHit } from "../research/types";

function emptyResearch(note: string): ResearchResult {
  return {
    keyClaims: [],
    evidence: [],
    sources: [],
    counterArguments: [],
    uncertainties: [note],
  };
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export class AiDebater implements Debater {
  constructor(
    private provider: AIProvider,
    private model: string,
  ) {}

  private callOptions(maxOutputTokens: number) {
    return {
      maxOutputTokens,
      timeoutMs: LIMITS.aiCallTimeoutMs,
      // Higher than 0.4 (which produced near-deterministic mirror-image
      // phrasing between A and B). 0.7 keeps the prose disciplined while
      // letting each side develop its own voice. Gemini ignores this field.
      temperature: 0.7,
    };
  }

  async research(context: ResearchContext): Promise<ResearchResult> {
    const queries = await this.provider.generateObject({
      ...researchQueriesPrompt(context.topic, context.position),
      schema: researchQueriesSchema,
      ...this.callOptions(TOKEN_LIMITS.researchQueries),
    });

    const capped = queries.queries.slice(0, context.budget.maxSearches);
    const resultsPerQuery = await Promise.all(
      capped.map((query) =>
        context
          .search(query)
          .then((hits) => hits.map((hit) => ({ ...hit, query })))
          .catch(() => [] as (SearchHit & { query: string })[]),
      ),
    );

    const seen = new Set<string>();
    const collected: (SearchHit & { query: string })[] = [];
    for (const hits of resultsPerQuery) {
      for (const hit of hits) {
        if (seen.has(hit.url)) continue;
        if (collected.length >= context.budget.maxSources) break;
        seen.add(hit.url);
        collected.push(hit);
      }
    }

    if (collected.length === 0) {
      return emptyResearch(
        "No search results were available during the research window.",
      );
    }

    const formatted = collected
      .map(
        (hit, i) =>
          `[${i + 1}] ${hit.title} — ${hit.publisher} (retrieved via query: "${hit.query}")
URL: ${hit.url}
Excerpt: ${truncate(hit.content, LIMITS.maxContentCharsPerSource)}`,
      )
      .join("\n\n");

    const synthesis = await this.provider.generateObject({
      ...researchSynthesisPrompt(context.topic, context.position, formatted),
      schema: researchSynthesisSchema,
      ...this.callOptions(TOKEN_LIMITS.researchSynthesis),
    });

    const sources: Source[] = collected.map((hit) => ({
      title: hit.title,
      url: hit.url,
      publisher: hit.publisher,
      relevance: `Retrieved via query: "${hit.query}"`,
    }));

    return {
      keyClaims: synthesis.keyClaims,
      evidence: synthesis.evidence,
      sources,
      counterArguments: synthesis.counterArguments,
      uncertainties: synthesis.uncertainties,
    };
  }

  async generateOpening(context: OpeningContext): Promise<string> {
    const result = await this.provider.generateText({
      ...openingPrompt({
        topic: context.topic,
        position: context.position,
        speaker: context.speaker,
        researchSummary: formatResearchSummary(context.research),
      }),
      ...this.callOptions(TOKEN_LIMITS.opening),
    });
    return result.text.trim();
  }

  async generateRebuttal(context: RebuttalContext): Promise<string> {
    const result = await this.provider.generateText({
      ...rebuttalPrompt({
        topic: context.topic,
        position: context.position,
        speaker: context.speaker,
        researchSummary: formatResearchSummary(context.research),
        opponentOpening: context.opponentOpening,
        opponentRebuttal: context.opponentRebuttal,
      }),
      ...this.callOptions(TOKEN_LIMITS.rebuttal),
    });
    return result.text.trim();
  }

  async generateQuestion(context: CrossExaminationContext): Promise<string> {
    const result = await this.provider.generateText({
      ...questionPrompt({
        topic: context.topic,
        position: context.position,
        speaker: context.speaker,
        transcript: context.transcript,
      }),
      ...this.callOptions(TOKEN_LIMITS.question),
    });
    return result.text.trim();
  }

  async generateAnswer(context: CrossExaminationContext): Promise<string> {
    const result = await this.provider.generateText({
      ...answerPrompt({
        topic: context.topic,
        position: context.position,
        speaker: context.speaker,
        researchSummary: formatResearchSummary(context.research),
        question: context.question ?? "",
      }),
      ...this.callOptions(TOKEN_LIMITS.answer),
    });
    return result.text.trim();
  }

  async generateClosing(context: ClosingContext): Promise<string> {
    const result = await this.provider.generateText({
      ...closingPrompt({
        topic: context.topic,
        position: context.position,
        speaker: context.speaker,
        researchSummary: formatResearchSummary(context.research),
        transcript: context.transcript,
      }),
      ...this.callOptions(TOKEN_LIMITS.closing),
    });
    return result.text.trim();
  }
}
