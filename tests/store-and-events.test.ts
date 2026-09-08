import { beforeEach, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { DebateStore } from "@/lib/debate-engine/store";
import {
  isTerminalEvent,
  synthesizeTerminalEvent,
} from "@/lib/domain/events";
import type { Debate, DebateStage } from "@/lib/domain/types";

const DATA_DIR = tmpdir();

async function makeDebate(
  store: DebateStore,
  stage: DebateStage = "idle",
): Promise<Debate> {
  const debate = await store.create({ topic: "original", debaterModel: "m" });
  return { ...debate, stage };
}

describe("synthesizeTerminalEvent", () => {
  it("emits debate_completed for a completed debate with seq = lastSeq + 1", async () => {
    const debate = await makeDebate(new DebateStore(DATA_DIR), "completed");
    const event = synthesizeTerminalEvent(debate, 4);
    expect(event.seq).toBe(5);
    expect(event.type).toBe("debate_completed");
    expect(event.stage).toBe("completed");
    expect(isTerminalEvent(event)).toBe(true);
  });

  it("emits debate_failed for a failed debate and defaults lastSeq to 0", async () => {
    const debate = await makeDebate(new DebateStore(DATA_DIR), "failed");
    const event = synthesizeTerminalEvent(debate);
    expect(event.seq).toBe(1);
    expect(event.type).toBe("debate_failed");
    expect(event.stage).toBe("failed");
  });

  it("returns a deep clone so callers cannot mutate the stored debate", async () => {
    const debate = await makeDebate(new DebateStore(DATA_DIR), "completed");
    const event = synthesizeTerminalEvent(debate);
    event.debate.topic = "mutated";
    expect(debate.topic).toBe("original");
  });
});

describe("DebateStore.reclaimIfIdle", () => {
  let store: DebateStore;
  beforeEach(() => {
    store = new DebateStore(DATA_DIR);
  });

  it("removes an idle debate and reports true", async () => {
    const debate = await store.create({ topic: "t", debaterModel: "m" });
    expect(store.reclaimIfIdle(debate.id)).toBe(true);
    expect(store.get(debate.id)).toBeUndefined();
  });

  it("does not remove a debate past idle and reports false", async () => {
    const debate = await store.create({ topic: "t", debaterModel: "m" });
    await store.save({ ...debate, stage: "researching" });
    expect(store.reclaimIfIdle(debate.id)).toBe(false);
    expect(store.get(debate.id)?.stage).toBe("researching");
  });

  it("returns false for an unknown id", () => {
    expect(store.reclaimIfIdle("does-not-exist")).toBe(false);
  });
});
