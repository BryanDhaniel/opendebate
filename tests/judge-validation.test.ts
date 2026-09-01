import { describe, expect, it } from "vitest";
import {
  CRITERIA_KEYS,
  CRITERIA_WEIGHTS,
  validateJudgeResult,
  type JudgeResult,
} from "@/lib/domain/types";
import { judgeOutputSchema } from "@/lib/ai/schemas";

function validResult(): JudgeResult {
  const criteria = {} as JudgeResult["criteria"];
  const aScores = [22, 21, 17, 13, 7, 4];
  const bScores = [18, 20, 15, 12, 7, 4];
  CRITERIA_KEYS.forEach((key, i) => {
    criteria[key] = { A: aScores[i], B: bScores[i] };
  });
  return {
    winner: "A",
    scoreA: 84,
    scoreB: 76,
    criteria,
    decisiveArgument: "A cited verifiable statistics",
    weakestArgument: "B's appeal to authority",
    reason: "A maintained stronger evidentiary support.",
  };
}

describe("judge result validation", () => {
  it("accepts a result whose totals match the criteria sums", () => {
    expect(validateJudgeResult(validResult())).toBeNull();
  });

  it("rejects when a total does not equal the sum of its criteria", () => {
    const result = validResult();
    result.scoreA = 50;
    const error = validateJudgeResult(result);
    expect(error).toMatch(/scoreA/);
  });

  it("rejects criterion scores above their weight", () => {
    const result = validResult();
    result.criteria.evidenceQuality.A = CRITERIA_WEIGHTS.evidenceQuality + 1;
    expect(validateJudgeResult(result)).toMatch(/Invalid A score/);
  });

  it("rejects a winner with a lower score", () => {
    const result = validResult();
    result.winner = "B";
    expect(validateJudgeResult(result)).toMatch(/Winner B/);
  });
});

describe("judge output schema", () => {
  it("accepts well-formed anonymized output", () => {
    const parsed = judgeOutputSchema.safeParse({
      winner: "position1",
      scores: {
        position1: {
          evidenceQuality: 22,
          argumentStrength: 21,
          rebuttalQuality: 17,
          logicalReasoning: 13,
          responseToOpponent: 10,
          clarity: 5,
        },
        position2: {
          evidenceQuality: 18,
          argumentStrength: 20,
          rebuttalQuality: 15,
          logicalReasoning: 12,
          responseToOpponent: 10,
          clarity: 5,
        },
      },
      decisiveArgument: "x",
      weakestArgument: "y",
      reason: "z",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects output whose criterion scores do not sum to 100", () => {
    // A score above its criterion weight is rejected outright.
    const parsed = judgeOutputSchema.safeParse({
      winner: "position1",
      scores: {
        position1: {
          evidenceQuality: 26,
          argumentStrength: 21,
          rebuttalQuality: 17,
          logicalReasoning: 13,
          responseToOpponent: 10,
          clarity: 4,
        },
        position2: {
          evidenceQuality: 18,
          argumentStrength: 20,
          rebuttalQuality: 15,
          logicalReasoning: 12,
          responseToOpponent: 10,
          clarity: 5,
        },
      },
      decisiveArgument: "x",
      weakestArgument: "y",
      reason: "z",
    });
    // evidenceQuality 26 exceeds its weight of 25
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown winners and out-of-range scores", () => {
    const base = {
      scores: {
        position1: {
          evidenceQuality: 25,
          argumentStrength: 25,
          rebuttalQuality: 20,
          logicalReasoning: 15,
          responseToOpponent: 10,
          clarity: 5,
        },
        position2: {
          evidenceQuality: 20,
          argumentStrength: 20,
          rebuttalQuality: 20,
          logicalReasoning: 15,
          responseToOpponent: 10,
          clarity: 5,
        },
      },
      decisiveArgument: "x",
      weakestArgument: "y",
      reason: "z",
    };
    expect(
      judgeOutputSchema.safeParse({ ...base, winner: "A" }).success,
    ).toBe(false);
    expect(
      judgeOutputSchema.safeParse({
        ...base,
        winner: "position1",
        scores: {
          ...base.scores,
          position2: { ...base.scores.position2, evidenceQuality: 30 },
        },
      }).success,
    ).toBe(false);
  });
});
