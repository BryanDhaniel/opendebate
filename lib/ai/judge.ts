import {
  judgeSystemPrompt,
  judgeUserPrompt,
  formatJudgeSide,
} from "../prompts/judge";
import { judgeOutputSchema, type JudgeOutput } from "./schemas";
import { LIMITS, TOKEN_LIMITS } from "../config";
import { truncate } from "../format";
import type { AIProvider, Judge, JudgeContext } from "./types";
import type { CriterionKey, JudgeResult, Speaker } from "../domain/types";
import { CRITERIA_KEYS } from "../domain/types";
import { NoObjectGeneratedError } from "ai";

interface SideMapping {
  side1: Speaker;
  side2: Speaker;
  speakerOf: (label: "position1" | "position2") => Speaker;
}

function buildMapping(swap: boolean): SideMapping {
  const side1: Speaker = swap ? "B" : "A";
  const side2: Speaker = swap ? "A" : "B";
  return {
    side1,
    side2,
    speakerOf: (label) => (label === "position1" ? side1 : side2),
  };
}

function mapToJudgeResult(output: JudgeOutput, mapping: SideMapping): JudgeResult {
  const criteria = {} as Record<CriterionKey, { A: number; B: number }>;
  for (const key of CRITERIA_KEYS) {
    criteria[key] = {
      A: output.scores[mapping.side1 === "A" ? "position1" : "position2"][key],
      B: output.scores[mapping.side1 === "B" ? "position1" : "position2"][key],
    };
  }
  const winner = mapping.speakerOf(output.winner);
  const scoreA = CRITERIA_KEYS.reduce((sum, key) => sum + criteria[key].A, 0);
  const scoreB = CRITERIA_KEYS.reduce((sum, key) => sum + criteria[key].B, 0);
  return {
    winner,
    scoreA,
    scoreB,
    criteria,
    decisiveArgument: output.decisiveArgument,
    weakestArgument: output.weakestArgument,
    reason: output.reason,
  };
}

function labelOf(mapping: SideMapping, speaker: Speaker): string {
  if (speaker === mapping.side1) return "POSITION 1";
  return "POSITION 2";
}

function anonymizeTranscript(
  transcript: string,
  mapping: SideMapping,
): string {
  return transcript
    .replace(/DEBATER A/g, labelOf(mapping, "A"))
    .replace(/DEBATER B/g, labelOf(mapping, "B"));
}

export class AiJudge implements Judge {
  constructor(
    private provider: AIProvider,
    private model: string,
    private rng: () => number = Math.random,
  ) {}

  async evaluate(context: JudgeContext): Promise<JudgeResult> {
    const mapping = buildMapping(this.rng() < 0.5);
    const sideFor = (speaker: Speaker) =>
      speaker === mapping.side1 ? context.debaterA : context.debaterB;

    const side1Input = sideFor(mapping.side1);
    const side2Input = sideFor(mapping.side2);

    const side1Text = formatJudgeSide({
      label: "POSITION 1",
      position: side1Input.position,
      research: side1Input.research,
    });
    const side2Text = formatJudgeSide({
      label: "POSITION 2",
      position: side2Input.position,
      research: side2Input.research,
    });

    const basePrompt = judgeUserPrompt({
      topic: context.topic,
      position1Label: "POSITION 1",
      position2Label: "POSITION 2",
      side1: side1Text,
      side2: side2Text,
      transcript: anonymizeTranscript(context.transcript, mapping),
    });

    const callOptions = {
      maxOutputTokens: TOKEN_LIMITS.judge,
      timeoutMs: LIMITS.judgeTimeoutMs,
      temperature: 0.2,
    };

    let output: JudgeOutput;
    try {
      output = await this.provider.generateObject({
        system: judgeSystemPrompt(),
        prompt: basePrompt,
        schema: judgeOutputSchema,
        ...callOptions,
      });
    } catch (error) {
      const detail = describeError(error);
      output = await this.provider.generateObject({
        system: judgeSystemPrompt(),
        prompt: `${basePrompt}

Your previous verdict was rejected because: ${detail}

Try again and make sure every criterion score is an integer within its maximum weight.`,
        schema: judgeOutputSchema,
        ...callOptions,
      });
    }

    return mapToJudgeResult(output, mapping);
  }
}

function describeError(error: unknown): string {
  if (NoObjectGeneratedError.isInstance(error)) {
    const text = error.text ?? "";
    return `the response was not valid against the verdict schema: ${truncate(text, 300)}`;
  }
  return error instanceof Error ? truncate(error.message, 300) : "unknown error";
}
