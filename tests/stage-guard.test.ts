import { describe, expect, it, vi } from "vitest";
import { guardStageOutput, withRetry } from "@/lib/debate-engine/stage-guard";

describe("guardStageOutput", () => {
  it("throws on an empty string", () => {
    expect(() => guardStageOutput("", "opening_a")).toThrow(/empty opening_a output/);
  });

  it("throws on whitespace-only string", () => {
    expect(() => guardStageOutput("   \n", "opening_a")).toThrow(/empty opening_a output/);
  });

  it("returns trimmed text for valid output ending in a period", () => {
    expect(guardStageOutput("  Valid opening.  ", "opening_a")).toBe("Valid opening.");
  });

  it("accepts output ending in an exclamation mark", () => {
    expect(guardStageOutput("We must act now!", "closing_a")).toBe("We must act now!");
  });

  it("accepts output ending in a question mark", () => {
    expect(guardStageOutput("Is this even true?", "cross_examination_a")).toBe("Is this even true?");
  });

  it("accepts a trailing quotation mark and keeps it intact", () => {
    const input = 'The opposition has not met its burden."';
    expect(guardStageOutput(input, "opening_a")).toBe(input);
  });

  it("accepts a trailing bracket/parenthesis before terminal punctuation", () => {
    const input = "The trend is unambiguous).";
    expect(guardStageOutput(input, "rebuttal_a")).toBe(input);
  });

  it("throws on text truncated mid-sentence", () => {
    expect(() => guardStageOutput("If autonomous cellular metabolism is", "opening_a")).toThrow(
      /opening_a output truncated mid-sentence/,
    );
  });

  it("does not emit a truncation warning for a trailing quote", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    guardStageOutput('The opposition has not met its burden."', "opening_a");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("withRetry", () => {
  it("returns after a single successful attempt", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    await withRetry(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries once on a thrown error and then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await withRetry(fn);
    expect(fn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("throws the last error after exhausting all attempts (default max=2)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(withRetry(fn)).rejects.toThrow(/always fails/);
    expect(fn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("honors a custom attempt count", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("nope"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(withRetry(fn, { max: 4 })).rejects.toThrow(/nope/);
    expect(fn).toHaveBeenCalledTimes(4);
    warn.mockRestore();
  });
});
