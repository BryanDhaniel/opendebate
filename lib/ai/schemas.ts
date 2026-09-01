import { z } from "zod";
import { CRITERIA_WEIGHTS } from "../domain/types";

export const researchQueriesSchema = z.object({
  queries: z
    .array(z.string().min(1).max(300))
    .min(1)
    .max(5)
    .describe("Search queries to research the topic, at most 5"),
});

export const researchSynthesisSchema = z.object({
  keyClaims: z.array(z.string().max(400)).max(8),
  evidence: z.array(z.string().max(600)).max(10),
  counterArguments: z.array(z.string().max(600)).max(8),
  uncertainties: z.array(z.string().max(400)).max(6),
});

export type ResearchSynthesis = z.infer<typeof researchSynthesisSchema>;

const criterionScoresShape = {
  evidenceQuality: z.number().int().min(0).max(CRITERIA_WEIGHTS.evidenceQuality),
  argumentStrength: z.number().int().min(0).max(CRITERIA_WEIGHTS.argumentStrength),
  rebuttalQuality: z.number().int().min(0).max(CRITERIA_WEIGHTS.rebuttalQuality),
  logicalReasoning: z.number().int().min(0).max(CRITERIA_WEIGHTS.logicalReasoning),
  responseToOpponent: z.number().int().min(0).max(CRITERIA_WEIGHTS.responseToOpponent),
  clarity: z.number().int().min(0).max(CRITERIA_WEIGHTS.clarity),
} as const;

const sideScoresSchema = z.object(criterionScoresShape);

export const judgeOutputSchema = z.object({
  winner: z.enum(["position1", "position2"]),
  scores: z.object({
    position1: sideScoresSchema,
    position2: sideScoresSchema,
  }),
  decisiveArgument: z.string().min(1).max(2000),
  weakestArgument: z.string().min(1).max(2000),
  reason: z.string().min(1).max(4000),
});

export type JudgeOutput = z.infer<typeof judgeOutputSchema>;
