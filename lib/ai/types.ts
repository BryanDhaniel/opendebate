import type { Position, ResearchResult, Speaker } from "../domain/types";
import type { ResearchBudget } from "../config";
import type { SearchFn } from "../research/types";

export interface AIRequest {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface AIResponse {
  text: string;
}

export interface AIObjectRequest<T> {
  system: string;
  prompt: string;
  schema: import("zod").ZodType<T>;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface AIProvider {
  generateText(input: AIRequest): Promise<AIResponse>;
  generateObject<T>(input: AIObjectRequest<T>): Promise<T>;
}

export interface ResearchContext {
  topic: string;
  position: Position;
  search: SearchFn;
  budget: ResearchBudget;
}

export interface OpeningContext {
  topic: string;
  position: Position;
  research: ResearchResult;
}

export interface RebuttalContext {
  topic: string;
  position: Position;
  research: ResearchResult;
  opponentOpening: string;
  opponentRebuttal?: string;
}

export interface CrossExaminationContext {
  topic: string;
  position: Position;
  research: ResearchResult;
  question?: string;
  transcript: string;
}

export interface ClosingContext {
  topic: string;
  position: Position;
  research: ResearchResult;
  transcript: string;
}

export interface Debater {
  research(context: ResearchContext): Promise<ResearchResult>;
  generateOpening(context: OpeningContext): Promise<string>;
  generateRebuttal(context: RebuttalContext): Promise<string>;
  generateQuestion(context: CrossExaminationContext): Promise<string>;
  generateAnswer(context: CrossExaminationContext): Promise<string>;
  generateClosing(context: ClosingContext): Promise<string>;
}

export interface JudgeSideInput {
  position: Position;
  research: ResearchResult;
}

export interface JudgeContext {
  topic: string;
  debaterA: JudgeSideInput;
  debaterB: JudgeSideInput;
  transcript: string;
}

export interface Judge {
  evaluate(context: JudgeContext): Promise<import("../domain/types").JudgeResult>;
}

export type { Speaker };
