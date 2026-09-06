import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DebateStore } from "@/lib/debate-engine/store";
import {
  CreationRateLimiter,
  WindowedLimiter,
  clientIp,
} from "@/lib/server/rate-limit";
import { LIMITS } from "@/lib/config";

describe("DebateStore idle-TTL sweep (REVIEW C2)", () => {
  it("sweeps idle debates older than the TTL from activeCount", async () => {
    const dir = tmp();
    const store = new DebateStore(dir);
    const old = await store.create({ topic: "t", debaterModel: "mock" });
    // Age the returned object (same reference the store holds) past the TTL.
    old.createdAt = new Date(Date.now() - LIMITS.idleTtlMs - 1000).toISOString();

    expect(store.activeCount()).toBe(0);
    expect(store.get(old.id)).toBeUndefined();
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps idle debates within the TTL", async () => {
    const store = new DebateStore(tmp());
    const fresh = await store.create({ topic: "t", debaterModel: "mock" });
    fresh.createdAt = new Date(Date.now() - 1_000).toISOString();
    expect(store.activeCount()).toBe(1);
  });

  it("never sweeps non-idle (running) debates regardless of age", async () => {
    const store = new DebateStore(tmp());
    const running = await store.create({ topic: "t", debaterModel: "mock" });
    running.createdAt = new Date(Date.now() - LIMITS.idleTtlMs - 1000).toISOString();
    running.stage = "researching";
    expect(store.activeCount()).toBe(1);
  });

  it("create() reclaims expired idle debates before counting the new one", async () => {
    const store = new DebateStore(tmp());
    const old = await store.create({ topic: "t", debaterModel: "mock" });
    old.createdAt = new Date(Date.now() - LIMITS.idleTtlMs - 1000).toISOString();
    await store.create({ topic: "new", debaterModel: "mock" });
    // Old idle one swept; the new one counts as 1.
    expect(store.activeCount()).toBe(1);
  });

  it("delete() removes the debate from memory", async () => {
    const store = new DebateStore(tmp());
    const debate = await store.create({ topic: "t", debaterModel: "mock" });
    store.delete(debate.id);
    expect(store.get(debate.id)).toBeUndefined();
  });
});

describe("WindowedLimiter", () => {
  it("allows up to the ceiling then denies within the window", () => {
    const limiter = new WindowedLimiter(1000, 3);
    expect(limiter.consume("k", 10_000).allowed).toBe(true);
    expect(limiter.consume("k", 10_000).allowed).toBe(true);
    expect(limiter.consume("k", 10_000).allowed).toBe(true);
    const denied = limiter.consume("k", 10_000);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it("forgets entries that fall outside the window (sliding)", () => {
    const limiter = new WindowedLimiter(1000, 1);
    expect(limiter.consume("k", 10_000).allowed).toBe(true);
    expect(limiter.consume("k", 10_999).allowed).toBe(false);
    // One ms after the first entry leaves the window: allowed again.
    expect(limiter.consume("k", 11_001).allowed).toBe(true);
  });

  it("isolates keys", () => {
    const limiter = new WindowedLimiter(1000, 1);
    expect(limiter.consume("a", 10_000).allowed).toBe(true);
    expect(limiter.consume("b", 10_000).allowed).toBe(true);
    expect(limiter.peek("a", 10_000)).toBe(1);
    expect(limiter.peek("b", 10_000)).toBe(1);
  });
});

describe("CreationRateLimiter (REVIEW C1)", () => {
  it("denies once an IP exhausts its per-IP bucket", () => {
    const limiter = new CreationRateLimiter(1000, 2, 100);
    expect(limiter.check("1.2.3.4", 10_000).allowed).toBe(true);
    expect(limiter.check("1.2.3.4", 10_000).allowed).toBe(true);
    expect(limiter.check("1.2.3.4", 10_000).allowed).toBe(false);
  });

  it("denies once the global bucket exhausts, independent of IPs", () => {
    const limiter = new CreationRateLimiter(1000, 100, 2);
    expect(limiter.check("a", 10_000).allowed).toBe(true);
    expect(limiter.check("b", 10_000).allowed).toBe(true);
    expect(limiter.check("c", 10_000).allowed).toBe(false);
  });

  it("does not burn a token when denied", () => {
    const limiter = new CreationRateLimiter(1000, 1, 100);
    expect(limiter.check("x", 10_000).allowed).toBe(true);
    expect(limiter.check("x", 10_000).allowed).toBe(false);
    // A different IP must still be allowed (global had only 1 consumed).
    expect(limiter.check("y", 10_000).allowed).toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers the first x-forwarded-for entry", () => {
    expect(
      clientIp(
        new Request("https://x.test", {
          headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" },
        }),
      ),
    ).toBe("9.9.9.9");
  });

  it("falls back to 'local' without proxy headers", () => {
    expect(clientIp(new Request("https://x.test"))).toBe("local");
  });
});

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "opendebate-store-test-"));
}
