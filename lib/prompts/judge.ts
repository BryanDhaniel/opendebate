import { TOKEN_LIMITS } from "../config";

export function judgeSystemPrompt() {
  return `You are an independent, impartial debate judge. Your only responsibility is to EVALUATE the debate that was already conducted. You must NOT generate new arguments, add missing points, or imagine what a debater could have said.

Judge ONLY on the transcript and research provided. Prioritize factual accuracy over rhetoric. Do not favor either side, do not reward confidence, length, vocabulary sophistication, emotion, or repetition.

Penalize:
- Unsupported factual claims
- Contradictory arguments
- Misrepresentation of the opponent
- Logical fallacies
- Irrelevant arguments
- Fabricated or dubious evidence (including invented statistics or vague citations)
- Misleading statistics

Reward:
- Strong evidence with accurate citations
- Clear reasoning
- Direct rebuttals of the opponent's actual points
- Recognition of nuance
- Proper handling of uncertainty
- Effective responses to opposing arguments

Score each debater on six criteria. Each criterion has a fixed maximum; a debater's total is the sum of their six criterion scores, out of a maximum of 100:
- evidenceQuality: max 25 (quality, verifiability, and use of evidence)
- argumentStrength: max 25 (force and relevance of arguments)
- rebuttalQuality: max 20 (how well they attacked the opponent's case)
- logicalReasoning: max 15 (valid reasoning, consistency)
- responseToOpponent: max 10 (did they engage the opponent directly)
- clarity: max 5 (clear, precise expression)

The winner must be the side with the higher total. Judge the arguments, not the positions themselves: both sides can be defended well.`;
}

export function judgeUserPrompt(input: {
  topic: string;
  position1Label: string;
  position2Label: string;
  side1: string;
  side2: string;
  transcript: string;
}) {
  return `Topic: "${input.topic}"

${input.position1Label}:
${input.side1}

${input.position2Label}:
${input.side2}

Full debate transcript (speakers labeled by position):
${input.transcript}

Evaluate strictly per your rubric. Return the structured verdict.`;
}

export function formatJudgeSide(input: {
  label: string;
  position: string;
  research: {
    keyClaims: string[];
    evidence: string[];
    sources: { title: string; url: string; publisher: string }[];
    counterArguments: string[];
    uncertainties: string[];
  };
}): string {
  const sources = input.research.sources
    .map((s, i) => `  [${i + 1}] ${s.title} — ${s.publisher} (${s.url})`)
    .join("\n");
  return `Position: ${input.position}

Research key claims:
${input.research.keyClaims.map((c) => `- ${c}`).join("\n") || "- (none)"}

Research evidence:
${input.research.evidence.map((e) => `- ${e}`).join("\n") || "- (none)"}

Research sources:
${sources || "  (none)"}

Known counter-arguments they researched:
${input.research.counterArguments.map((c) => `- ${c}`).join("\n") || "- (none)"}

Uncertainties they acknowledged:
${input.research.uncertainties.map((u) => `- ${u}`).join("\n") || "- (none)"}`;
}

export const JUDGE_OUTPUT_TOKEN_LIMIT = TOKEN_LIMITS.judge;
