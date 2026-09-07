import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { GoogleProvider } from "@/lib/ai/google-provider";

// Stub the Google SDK: we only need to capture `interactions.create` calls and
// return canned responses. The real Zod schema conversion still runs.
const { createMock } = vi.hoisted(() => {
  const createMock = vi.fn();
  return { createMock };
});

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    interactions = { create: createMock };
    constructor() {}
  },
}));

const OK = { status: "completed", output_text: "hello from gemini" };

beforeEach(() => {
  createMock.mockReset();
  createMock.mockResolvedValue(OK);
});

describe("GoogleProvider", () => {
  it("exposes the configured model id", () => {
    const provider = new GoogleProvider({
      apiKey: "test-key",
      model: "gemini-3.8-flash",
    });
    expect(provider.modelId).toBe("gemini-3.8-flash");
  });

  it("generateText maps the contract onto the Interactions API", async () => {
    const provider = new GoogleProvider({ apiKey: "k", model: "gemini-3.8-flash" });
    const res = await provider.generateText({
      system: "be concise",
      prompt: "hello",
      maxOutputTokens: 123,
      temperature: 0.7, // must be ignored by this provider
      timeoutMs: 42_000,
    });

    expect(res.text).toBe("hello from gemini");
    expect(createMock).toHaveBeenCalledTimes(1);

    const [params, opts] = createMock.mock.calls[0];
    expect(params).toMatchObject({
      model: "gemini-3.8-flash",
      input: "hello",
      system_instruction: "be concise",
      generation_config: {
        max_output_tokens: 123,
        // Thinking tokens are charged against max_output_tokens; "minimal" is
        // the lowest level and keeps the budget for the visible reply.
        thinking_level: "minimal",
      },
    });
    // The Interactions API has no temperature parameter; it must not leak in.
    expect(params).not.toHaveProperty("temperature");
    expect(params.generation_config).not.toHaveProperty("temperature");
    // The timeout contract is forwarded as the SDK's `timeout_ms`.
    expect(opts).toEqual({ timeout_ms: 42_000 });
  });

  it("generateText omits timeout_ms when no timeout is set", async () => {
    const provider = new GoogleProvider({ apiKey: "k", model: "m" });
    await provider.generateText({ system: "s", prompt: "p" });
    const [, opts] = createMock.mock.calls[0];
    expect(opts).toEqual({});
  });

  it("generateObject sends the schema and returns the parsed object", async () => {
    const schema = z.object({ score: z.number(), label: z.string() });
    createMock.mockResolvedValue({
      status: "completed",
      output_text: JSON.stringify({ score: 9, label: "A" }),
    });

    const provider = new GoogleProvider({ apiKey: "k", model: "m" });
    const out = await provider.generateObject({
      system: "s",
      prompt: "p",
      schema,
      maxOutputTokens: 50,
    });
    expect(out).toEqual({ score: 9, label: "A" });

    const [params] = createMock.mock.calls[0];
    expect(params.response_format).toMatchObject({
      type: "text",
      mime_type: "application/json",
    });
    expect(params.response_format.schema).toBeTypeOf("object");
    expect(params.response_format.schema.type).toBe("object");
    // Structured requests still must not carry temperature.
    expect(params).not.toHaveProperty("temperature");
  });

  it("generateObject throws when Gemini returns non-JSON text", async () => {
    const schema = z.object({ score: z.number() });
    createMock.mockResolvedValue({
      status: "completed",
      output_text: "not json at all",
    });
    const provider = new GoogleProvider({ apiKey: "k", model: "m" });
    await expect(
      provider.generateObject({ system: "s", prompt: "p", schema }),
    ).rejects.toThrow(/non-JSON text/);
  });

  it("generateObject rethrows on a schema mismatch", async () => {
    const schema = z.object({ score: z.number() });
    createMock.mockResolvedValue({
      status: "completed",
      output_text: JSON.stringify({ score: "nine" }),
    });
    const provider = new GoogleProvider({ apiKey: "k", model: "m" });
    await expect(
      provider.generateObject({ system: "s", prompt: "p", schema }),
    ).rejects.toThrow();
  });

  it("throws when the interaction reports a failure status", async () => {
    createMock.mockResolvedValue({ status: "failed", output_text: "" });
    const provider = new GoogleProvider({ apiKey: "k", model: "m" });
    await expect(
      provider.generateText({ system: "s", prompt: "p" }),
    ).rejects.toThrow(/interaction failed/);
  });
});
