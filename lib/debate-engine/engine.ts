import { randomUUID } from "node:crypto";
import type { DebateEvent, DebateEventType } from "../domain/events";
import {
  CRITERIA_KEYS,
  type Debate,
  type DebateMessage,
  type DebateStage,
  type MessageKind,
  type ResearchResult,
  type Speaker,
  validateJudgeResult,
} from "../domain/types";
import { DEFAULT_RESEARCH_BUDGET, LIMITS, type ResearchBudget } from "../config";
import type { Debater, Judge } from "../ai/types";
import type { ResearchTool, SearchFn } from "../research/types";
import { formatTranscript, lastMessageOfKind } from "../ai/transcript";
import type { DebateBus } from "./bus";
import type { DebateStore } from "./store";

class DebateAbortedError extends Error {}

export class RateLimitError extends Error {
  constructor() {
    super("Maximum number of concurrent debates reached");
  }
}

export interface EngineDeps {
  store: DebateStore;
  bus: DebateBus;
  createDebater: () => Debater;
  createJudge: () => Judge;
  researchTool: ResearchTool | null;
  budget?: ResearchBudget;
  maxActiveDebates?: number;
}

function cloneDebate(debate: Debate): Debate {
  return JSON.parse(JSON.stringify(debate)) as Debate;
}

function emptyResearch(note: string): ResearchResult {
  return {
    keyClaims: [],
    evidence: [],
    sources: [],
    counterArguments: [],
    uncertainties: [note],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

const START_EVENT: Partial<Record<DebateStage, DebateEventType>> = {
  researching: "research_started",
  opening_a: "opening_started",
  opening_b: "opening_started",
  rebuttal_a: "rebuttal_started",
  rebuttal_b: "rebuttal_started",
  cross_examination_a: "cross_examination_started",
  cross_examination_b: "cross_examination_started",
  closing_a: "closing_started",
  closing_b: "closing_started",
  judging: "judging_started",
};

const COMPLETED_EVENT: Partial<Record<DebateStage, DebateEventType>> = {
  researching: "research_completed",
  opening_a: "opening_completed",
  opening_b: "opening_completed",
  rebuttal_a: "rebuttal_completed",
  rebuttal_b: "rebuttal_completed",
  cross_examination_a: "cross_examination_completed",
  cross_examination_b: "cross_examination_completed",
  closing_a: "closing_completed",
  closing_b: "closing_completed",
  judging: "judging_completed",
};

const STAGE_LABEL: Partial<Record<DebateStage, string>> = {
  researching: "Research",
  opening_a: "Opening statement (A)",
  opening_b: "Opening statement (B)",
  rebuttal_a: "Rebuttal (A)",
  rebuttal_b: "Rebuttal (B)",
  cross_examination_a: "Cross examination (A questions B)",
  cross_examination_b: "Cross examination (B questions A)",
  closing_a: "Closing statement (A)",
  closing_b: "Closing statement (B)",
  judging: "Judging",
};

export class DebateRunner {
  private activeRuns = new Set<string>();

  constructor(private deps: EngineDeps) {}

  startIfIdle(debateId: string): Debate | null {
    const debate = this.deps.store.get(debateId);
    if (!debate) return null;
    if (debate.stage !== "idle" || this.activeRuns.has(debateId)) return debate;
    const max = this.deps.maxActiveDebates ?? LIMITS.maxActiveDebates;
    if (this.activeRuns.size >= max) throw new RateLimitError();
    this.activeRuns.add(debateId);
    void this.run(debate)
      .catch((error) => {
        if (!(error instanceof DebateAbortedError)) {
          console.error(`[engine] debate ${debateId} crashed:`, error);
          this.failDebate(debate, errorMessage(error));
        }
      })
      .finally(() => {
        this.activeRuns.delete(debateId);
      });
    return debate;
  }

  private failDebate(debate: Debate, message: string): void {
    debate.stage = "failed";
    debate.error = message;
    debate.completedAt = new Date().toISOString();
    this.deps.store.save(debate);
    this.emit(debate, "debate_failed", message);
  }

  private emit(
    debate: Debate,
    type: DebateEventType,
    detail?: string,
  ): DebateEvent {
    void this.deps.store.save(debate);
    return this.deps.bus.publish(debate.id, {
      type,
      stage: debate.stage,
      debate: cloneDebate(debate),
      detail,
      at: new Date().toISOString(),
    });
  }

  private pushMessage(
    debate: Debate,
    speaker: Speaker,
    kind: MessageKind,
    stage: DebateStage,
    content: string,
  ): void {
    const message: DebateMessage = {
      id: randomUUID(),
      stage,
      speaker,
      kind,
      content,
      createdAt: new Date().toISOString(),
    };
    debate.transcript.push(message);
  }

  private async run(debate: Debate): Promise<void> {
    const budget = this.deps.budget ?? DEFAULT_RESEARCH_BUDGET;
    const debaterA = this.deps.createDebater();
    const debaterB = this.deps.createDebater();

    const setStage = (stage: DebateStage) => {
      debate.stage = stage;
    };

    const stage = async (
      name: DebateStage,
      options: { critical: boolean },
      body: () => Promise<void>,
    ): Promise<void> => {
      setStage(name);
      const label = STAGE_LABEL[name] ?? name;
      this.emit(debate, START_EVENT[name] ?? "debate_started", label);
      try {
        await withRetry(body);
        this.emit(debate, COMPLETED_EVENT[name] ?? "debate_completed");
      } catch (error) {
        if (options.critical) {
          this.failDebate(debate, `${label} failed: ${errorMessage(error)}`);
          throw new DebateAbortedError();
        }
        this.emit(
          debate,
          "stage_skipped",
          `${label} skipped: ${errorMessage(error)}`,
        );
      }
    };

    setStage("initializing");
    debate.startedAt = new Date().toISOString();
    this.emit(debate, "debate_started", "Debate started");

    // Position assignment is deterministic: A argues FOR, B argues AGAINST.
    setStage("assigning_positions");
    debate.debaterA.position = "FOR";
    debate.debaterB.position = "AGAINST";
    void this.deps.store.save(debate);

    // Research: both debaters run concurrently, isolated from each other.
    const searchA = this.budgetedSearch(budget);
    const searchB = this.budgetedSearch(budget);
    const timeoutFallback = () =>
      emptyResearch("Research ran out of time before results were collected.");
    await stage("researching", { critical: true }, async () => {
      const [researchA, researchB] = await Promise.all([
        withTimeout(
          debaterA.research({
            topic: debate.topic,
            position: "FOR",
            search: searchA,
            budget,
          }),
          budget.durationMs,
          timeoutFallback(),
        ),
        withTimeout(
          debaterB.research({
            topic: debate.topic,
            position: "AGAINST",
            search: searchB,
            budget,
          }),
          budget.durationMs,
          timeoutFallback(),
        ),
      ]);
      researchA.timedOut = researchA.timedOut || researchA.sources.length === 0;
      researchB.timedOut = researchB.timedOut || researchB.sources.length === 0;
      debate.research = { A: researchA, B: researchB };
    });

    const researchA = debate.research.A ?? emptyResearch("Research unavailable.");
    const researchB = debate.research.B ?? emptyResearch("Research unavailable.");
    const transcriptText = () => formatTranscript(debate.transcript);

    await stage("opening_a", { critical: true }, async () => {
      const content = await debaterA.generateOpening({
        topic: debate.topic,
        position: "FOR",
        research: researchA,
      });
      if (!content.trim()) throw new Error("empty opening statement");
      this.pushMessage(debate, "A", "opening", "opening_a", content);
    });

    await stage("opening_b", { critical: true }, async () => {
      const content = await debaterB.generateOpening({
        topic: debate.topic,
        position: "AGAINST",
        research: researchB,
      });
      if (!content.trim()) throw new Error("empty opening statement");
      this.pushMessage(debate, "B", "opening", "opening_b", content);
    });

    await stage("rebuttal_a", { critical: false }, async () => {
      const opponentOpening = lastMessageOfKind(
        debate.transcript,
        "B",
        "opening",
      );
      if (!opponentOpening) throw new Error("no opponent opening to rebut");
      const content = await debaterA.generateRebuttal({
        topic: debate.topic,
        position: "FOR",
        research: researchA,
        opponentOpening: opponentOpening.content,
      });
      this.pushMessage(debate, "A", "rebuttal", "rebuttal_a", content);
    });

    await stage("rebuttal_b", { critical: false }, async () => {
      const ownOpening = lastMessageOfKind(debate.transcript, "B", "opening");
      if (!ownOpening) throw new Error("no own opening to defend");
      const opponentOpening = lastMessageOfKind(
        debate.transcript,
        "A",
        "opening",
      );
      if (!opponentOpening) throw new Error("no opponent opening to rebut");
      const opponentRebuttal = lastMessageOfKind(
        debate.transcript,
        "A",
        "rebuttal",
      );
      const content = await debaterB.generateRebuttal({
        topic: debate.topic,
        position: "AGAINST",
        research: researchB,
        opponentOpening: opponentOpening.content,
        opponentRebuttal: opponentRebuttal?.content,
      });
      this.pushMessage(debate, "B", "rebuttal", "rebuttal_b", content);
    });

    await stage("cross_examination_a", { critical: false }, async () => {
      const question = await debaterA.generateQuestion({
        topic: debate.topic,
        position: "FOR",
        research: researchA,
        transcript: transcriptText(),
      });
      this.pushMessage(
        debate,
        "A",
        "question",
        "cross_examination_a",
        question,
      );
      const answer = await debaterB.generateAnswer({
        topic: debate.topic,
        position: "AGAINST",
        research: researchB,
        question,
        transcript: transcriptText(),
      });
      this.pushMessage(debate, "B", "answer", "cross_examination_a", answer);
    });

    await stage("cross_examination_b", { critical: false }, async () => {
      const question = await debaterB.generateQuestion({
        topic: debate.topic,
        position: "AGAINST",
        research: researchB,
        transcript: transcriptText(),
      });
      this.pushMessage(
        debate,
        "B",
        "question",
        "cross_examination_b",
        question,
      );
      const answer = await debaterA.generateAnswer({
        topic: debate.topic,
        position: "FOR",
        research: researchA,
        question,
        transcript: transcriptText(),
      });
      this.pushMessage(debate, "A", "answer", "cross_examination_b", answer);
    });

    await stage("closing_a", { critical: false }, async () => {
      const content = await debaterA.generateClosing({
        topic: debate.topic,
        position: "FOR",
        research: researchA,
        transcript: transcriptText(),
      });
      this.pushMessage(debate, "A", "closing", "closing_a", content);
    });

    await stage("closing_b", { critical: false }, async () => {
      const content = await debaterB.generateClosing({
        topic: debate.topic,
        position: "AGAINST",
        research: researchB,
        transcript: transcriptText(),
      });
      this.pushMessage(debate, "B", "closing", "closing_b", content);
    });

    await stage("judging", { critical: true }, async () => {
      const judge = this.deps.createJudge();
      const result = await judge.evaluate({
        topic: debate.topic,
        debaterA: { position: "FOR", research: researchA },
        debaterB: { position: "AGAINST", research: researchB },
        transcript: transcriptText(),
      });
      const invalid = validateJudgeResult(result);
      if (invalid) throw new Error(`invalid judge result: ${invalid}`);
      if (!CRITERIA_KEYS.every((key) => result.criteria[key])) {
        throw new Error("judge result missing criteria");
      }
      debate.judgeResult = result;
    });

    setStage("completed");
    debate.completedAt = new Date().toISOString();
    this.emit(debate, "debate_completed");
  }

  private budgetedSearch(budget: ResearchBudget): SearchFn {
    let used = 0;
    return async (query: string) => {
      if (used >= budget.maxSearches) return [];
      used++;
      if (!this.deps.researchTool) return [];
      try {
        return await this.deps.researchTool.search(
          query,
          LIMITS.maxResultsPerSearch,
        );
      } catch (error) {
        console.error(
          `[engine] search failed for "${query}":`,
          errorMessage(error),
        );
        return [];
      }
    };
  }
}

async function withRetry(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.warn("[engine] stage failed once, retrying:", errorMessage(error));
    await fn();
  }
}
