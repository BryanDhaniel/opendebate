import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  isTerminal,
  nextStage,
  PROTOCOL_STAGES,
} from "@/lib/domain/state-machine";
import type { DebateStage } from "@/lib/domain/types";

describe("debate state machine", () => {
  it("walks the full protocol in order", () => {
    for (let i = 0; i < PROTOCOL_STAGES.length - 1; i++) {
      const from = PROTOCOL_STAGES[i];
      const to = PROTOCOL_STAGES[i + 1];
      expect(canTransition(from, to), `${from} -> ${to}`).toBe(true);
      expect(nextStage(from)).toBe(to);
    }
    expect(nextStage("completed")).toBeNull();
  });

  it("accepts a full valid sequence of transitions", () => {
    let current: DebateStage = "idle";
    for (const stage of PROTOCOL_STAGES.slice(1)) {
      assertTransition(current, stage);
      current = stage;
    }
    expect(current).toBe("completed");
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("idle", "researching")).toBe(false);
    expect(canTransition("researching", "judging")).toBe(false);
    expect(canTransition("opening_a", "opening_a")).toBe(false);
    expect(canTransition("completed", "researching")).toBe(false);
    expect(() => assertTransition("idle", "judging")).toThrow(
      /Invalid stage transition/,
    );
  });

  it("allows entering failed from every active stage", () => {
    const activeStages = PROTOCOL_STAGES.filter(
      (stage) => !isTerminal(stage),
    );
    for (const stage of activeStages) {
      expect(canTransition(stage, "failed"), `${stage} -> failed`).toBe(true);
    }
  });

  it("treats terminal stages as absorbing", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(canTransition("failed", "completed")).toBe(false);
    expect(canTransition("failed", "failed")).toBe(false);
    expect(canTransition("completed", "failed")).toBe(false);
  });
});
