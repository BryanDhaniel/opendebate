import type { DebateMessage, Speaker } from "../domain/types";

export function speakerLabel(speaker: Speaker): string {
  return speaker === "A" ? "DEBATER A" : "DEBATER B";
}

export function formatTranscript(messages: DebateMessage[]): string {
  return messages
    .map((m) => `[${speakerLabel(m.speaker)} | ${m.kind}] ${m.content}`)
    .join("\n\n");
}

export function lastMessageOfKind(
  messages: DebateMessage[],
  speaker: Speaker,
  kind: DebateMessage["kind"],
): DebateMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.speaker === speaker && m.kind === kind) return m;
  }
  return undefined;
}
