import { beforeEach, describe, expect, it, vi } from "vitest";
import { tmpdir } from "node:os";

// Mock the concrete providers so build() can be exercised without real SDK
// clients. We only care that the right class is constructed per role.
const openaiCtor = vi.fn();
const googleCtor = vi.fn();

vi.mock("@/lib/ai/openai-provider", () => ({
  OpenAIProvider: class {
    modelId = "mock";
    constructor(...args: unknown[]) {
      openaiCtor(...args);
    }
  },
}));
vi.mock("@/lib/ai/google-provider", () => ({
  GoogleProvider: class {
    modelId = "mock";
    constructor(...args: unknown[]) {
      googleCtor(...args);
    }
  },
}));

import { build, MissingConfigError } from "@/lib/debate-engine/runtime";

const DATA_DIR = tmpdir();

describe("runtime.build provider selection", () => {
  beforeEach(() => {
    openaiCtor.mockClear();
    googleCtor.mockClear();
  });

  it("requires only OPENAI_API_KEY when both roles stay on OpenAI", () => {
    const rt = build({
      OPENAI_API_KEY: "ok",
      DATA_DIR,
    } as unknown as NodeJS.ProcessEnv);
    expect(rt).toBeDefined();
    expect(openaiCtor).toHaveBeenCalledTimes(2);
    expect(googleCtor).not.toHaveBeenCalled();
  });

  it("mixes providers and only requires the keys in use", () => {
    const rt = build({
      OPENAI_API_KEY: "ok",
      GEMINI_API_KEY: "gk",
      DEBATER_PROVIDER: "gemini",
      DATA_DIR,
    } as unknown as NodeJS.ProcessEnv);
    expect(rt).toBeDefined();

    expect(openaiCtor).toHaveBeenCalledTimes(1); // judge
    expect(googleCtor).toHaveBeenCalledTimes(1); // debater

    const geminiArgs = googleCtor.mock.calls[0][0] as {
      apiKey: string;
      model: string;
    };
    expect(geminiArgs.apiKey).toBe("gk");
    expect(geminiArgs.model).toContain("gemini");
  });

  it("throws MissingConfigError naming the missing key for the provider in use", () => {
    let err: unknown;
    try {
      build({ DEBATER_PROVIDER: "gemini", DATA_DIR } as unknown as NodeJS.ProcessEnv);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(MissingConfigError);
    expect((err as MissingConfigError).missing).toContain("GEMINI_API_KEY");
  });
});
