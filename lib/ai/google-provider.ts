import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type {
  AIObjectRequest,
  AIProvider,
  AIRequest,
  AIResponse,
} from "./types";

/**
 * Gemini-backed implementation of the shared {@link AIProvider} contract, built
 * on the Interactions API (`ai.interactions.create`).
 *
 * Per-role provider selection lives in `lib/config.ts`; this class only knows
 * how to talk to Gemini once constructed.
 */
export class GoogleProvider implements AIProvider {
  private client: GoogleGenAI;
  readonly modelId: string;

  constructor(options: { apiKey?: string; model: string }) {
    // `new GoogleGenAI({})` resolves its key from GOOGLE_API_KEY /
    // GEMINI_API_KEY in the environment on its own. We only forward an explicit
    // key (e.g. set in tests), so a missing key surfaces through the SDK's own
    // error rather than an awkwardly-constructed empty options object.
    this.client = new GoogleGenAI(
      options.apiKey ? { apiKey: options.apiKey } : {},
    );
    this.modelId = options.model;
  }

  async generateText(input: AIRequest): Promise<AIResponse> {
    const response = await this.client.interactions.create(
      {
        model: this.modelId,
        input: input.prompt,
        system_instruction: input.system,
        // The Interactions API has no temperature parameter; we accept it on the
        // contract for parity with the OpenAI provider but deliberately do not
        // forward it (passing an unknown field is a type error on GenerationConfig).
        generation_config: { max_output_tokens: input.maxOutputTokens },
      },
      requestOptions(input.timeoutMs),
    );
    return { text: interactionOutput(response) };
  }

  async generateObject<T>(input: AIObjectRequest<T>): Promise<T> {
    const response = await this.client.interactions.create(
      {
        model: this.modelId,
        input: input.prompt,
        system_instruction: input.system,
        generation_config: { max_output_tokens: input.maxOutputTokens },
        // Structured output: the model is constrained to a JSON object matching
        // the supplied JSON Schema. Gemini's schema subset is OpenAPI 3.0.
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: schemaFor(input.schema),
        },
      },
      requestOptions(input.timeoutMs),
    );

    const text = interactionOutput(response);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error(
        "Gemini returned non-JSON text for a structured (generateObject) request",
      );
    }
    return input.schema.parse(raw);
  }
}

/**
 * Maps the timeout contract onto the SDK's `timeout_ms` option. The SDK aborts
 * the in-flight request once the budget is exceeded and surfaces a timeout
 * error, matching the OpenAI provider's `AbortSignal.timeout` behavior.
 */
function requestOptions(timeoutMs?: number) {
  return timeoutMs ? { timeout_ms: timeoutMs } : {};
}

/**
 * Terminal statuses that yield no usable output. The SDK adds `output_text`
 * only on a completed interaction, so any of these mean we cannot return text.
 */
const FAILED_STATUSES = new Set(["failed", "cancelled", "budget_exceeded"]);

/** Narrow the SDK's union response to the completed interaction's text. */
function interactionOutput(response: unknown): string {
  if (!response || typeof response !== "object") {
    throw new Error("Gemini interaction returned an unexpected response");
  }
  const interaction = response as {
    status?: string;
    output_text?: string;
  };
  if (interaction.status && FAILED_STATUSES.has(interaction.status)) {
    throw new Error(`Gemini interaction ${interaction.status}`);
  }
  return interaction.output_text ?? "";
}

/**
 * Converts a Zod schema to the JSON Schema Gemini expects. Zod 4 ships
 * `toJSONSchema`, so no extra dependency is needed.
 */
function schemaFor(schema: z.ZodType<unknown>): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: "openapi-3.0" }) as Record<
    string,
    unknown
  >;
}
