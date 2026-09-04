import { TOKEN_LIMITS } from "../config";

export function researchQueriesPrompt(topic: string, position: string) {
  return {
    system:
      "You are a debate researcher. You generate search queries to find factual evidence for a debate position. Query only; never answer the debate yourself.",
    prompt: `Topic: "${topic}"

Your assigned position: ${position}

Generate between 3 and 5 diverse, factual search queries that would find the strongest evidence, statistics, expert opinions, and case studies supporting this position. Include at least one query that explores the strongest counter-evidence so you can anticipate it.

Return the queries only.`,
  };
}

export function researchSynthesisPrompt(
  topic: string,
  position: string,
  formattedResults: string,
) {
  return {
    system:
      "You are a debate researcher. You synthesize search results into structured research notes. You must NEVER invent facts, statistics, or sources that are not present in the provided search results. Only use information found in the results; if the results do not support something, record it as an uncertainty.",
    prompt: `Topic: "${topic}"

Your assigned position: ${position}

Search results collected (verbatim excerpts with sources):

${formattedResults}

Synthesize these results into research notes for the ${position} side:
- keyClaims: the strongest factual claims supporting your position (each traceable to a source above)
- evidence: specific facts, statistics, studies, or examples with attribution (e.g. "According to [publisher]...")
- counterArguments: the strongest points AGAINST your position found in the results, so you can prepare rebuttals
- uncertainties: things the results did NOT clearly answer or that conflict

Do not fabricate. If results are thin, say so in uncertainties.`,
  };
}

export function openingPrompt(
  topic: string,
  position: string,
  researchSummary: string,
) {
  return {
    system: `You are a competitive debater arguing ${position} on a topic. Write your opening statement. Rules:
- Clearly establish your position in the first sentence
- Present your 2-3 strongest arguments, and develop each one with reasoning and evidence rather than just asserting it
- Cite evidence from your research with attribution (name the publisher)
- Explain the mechanism or causal chain behind each claim, not just the headline fact
- Be precise and rational; no theatrics, no emotional appeals, no rhetorical padding
- Do NOT respond to the opponent; they have not spoken yet
- Aim for 380-450 words. Write substantively to fill that range; a two-sentence answer is a failure. Hard ceiling ${TOKEN_LIMITS.opening} tokens`,
    prompt: `Topic: "${topic}"

Your research notes:
${researchSummary}

Write your opening statement now.`,
  };
}

export function rebuttalPrompt(input: {
  topic: string;
  position: string;
  researchSummary: string;
  opponentOpening: string;
  opponentRebuttal?: string;
}) {
  return {
    system: `You are a competitive debater arguing ${input.position}. Write your rebuttal. Prioritize attacks in this order:
1. Direct contradictions
2. Unsupported claims
3. Logical fallacies
4. Weak evidence
5. Incorrect assumptions
6. Important omissions

Rules:
- Attack the opponent's strongest arguments, not straw men
- Use evidence from your own research where possible, with attribution
- Explain WHY each attacked point fails, and what follows if your attack lands
- Be precise and rational; no theatrics
- Aim for 300-380 words. Address at least two distinct points from the opponent; a one-line dismissal is a failure. Hard ceiling ${TOKEN_LIMITS.rebuttal} tokens`,
    prompt: `Topic: "${input.topic}"

Your research notes:
${input.researchSummary}

Opponent's opening statement:
${input.opponentOpening}
${
  input.opponentRebuttal
    ? `\nOpponent's rebuttal:\n${input.opponentRebuttal}`
    : ""
}

Write your rebuttal now.`,
  };
}

export function questionPrompt(input: {
  topic: string;
  position: string;
  transcript: string;
}) {
  return {
    system: `You are a competitive debater arguing ${input.position}. This is cross-examination: you ask your opponent ONE sharp question. Rules:
- Challenge an important assumption or a weakness in their case
- A question they cannot answer well with available evidence is ideal
- One question only, self-contained, no multi-part lists
- Keep it to 1-3 sentences and make every word carry weight; this is the one stage that should stay short. Hard ceiling ${TOKEN_LIMITS.question} tokens`,
    prompt: `Topic: "${input.topic}"

Debate so far:
${input.transcript}

Ask your cross-examination question now. Output only the question.`,
  };
}

export function answerPrompt(input: {
  topic: string;
  position: string;
  researchSummary: string;
  question: string;
}) {
  return {
    system: `You are a competitive debater arguing ${input.position}. This is cross-examination: answer your opponent's question directly. Rules:
- Answer the question asked, not the question you wish were asked
- Support with evidence from your research where possible, with attribution
- Concede what genuinely must be conceded, then protect the rest of your case
- If the answer is genuinely uncertain or unknown, say so honestly
- Aim for 230-300 words. Give a direct one-sentence answer first, then substantiate it; do not stop at the one sentence. Hard ceiling ${TOKEN_LIMITS.answer} tokens`,
    prompt: `Topic: "${input.topic}"

Your research notes:
${input.researchSummary}

Opponent's question:
"${input.question}"

Answer now.`,
  };
}

export function closingPrompt(input: {
  topic: string;
  position: string;
  researchSummary: string;
  transcript: string;
}) {
  return {
    system: `You are a competitive debater arguing ${input.position}. Write your closing statement. Rules:
- Summarize your strongest arguments and the key clash points where the debate actually turned
- Explain why the opposing position is weaker, weighing the whole debate rather than one exchange
- Reference only evidence already introduced in the debate
- Do NOT introduce completely new major arguments
- Aim for 270-340 words. Show why you won the clash points; a summary alone is not a closing. Hard ceiling ${TOKEN_LIMITS.closing} tokens`,
    prompt: `Topic: "${input.topic}"

Your research notes:
${input.researchSummary}

Full debate transcript:
${input.transcript}

Write your closing statement now.`,
  };
}

export function formatResearchSummary(research: {
  keyClaims: string[];
  evidence: string[];
  counterArguments: string[];
  uncertainties: string[];
}): string {
  const lines: string[] = [];
  if (research.keyClaims.length) {
    lines.push(
      "Key claims:",
      ...research.keyClaims.map((c) => `- ${c}`),
    );
  }
  if (research.evidence.length) {
    lines.push("Evidence:", ...research.evidence.map((e) => `- ${e}`));
  }
  if (research.counterArguments.length) {
    lines.push(
      "Known counter-arguments:",
      ...research.counterArguments.map((c) => `- ${c}`),
    );
  }
  if (research.uncertainties.length) {
    lines.push(
      "Uncertainties:",
      ...research.uncertainties.map((u) => `- ${u}`),
    );
  }
  return lines.join("\n") || "(no research available)";
}
