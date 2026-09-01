import { generateObject, generateText } from "ai";
import { createOpenAI, type OpenAIProvider as OpenAISdkProvider } from "@ai-sdk/openai";
import type {
  AIObjectRequest,
  AIProvider,
  AIRequest,
  AIResponse,
} from "./types";
import { LIMITS } from "../config";

export class OpenAIProvider implements AIProvider {
  private provider: OpenAISdkProvider;
  readonly modelId: string;

  constructor(options: {
    apiKey?: string;
    baseURL?: string;
    model: string;
  }) {
    this.provider = createOpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });
    this.modelId = options.model;
  }

  private model() {
    return this.provider(this.modelId);
  }

  async generateText(input: AIRequest): Promise<AIResponse> {
    const result = await generateText({
      model: this.model(),
      system: input.system,
      prompt: input.prompt,
      maxOutputTokens: input.maxOutputTokens,
      temperature: input.temperature,
      abortSignal: input.timeoutMs
        ? AbortSignal.timeout(input.timeoutMs)
        : undefined,
      maxRetries: 2,
    });
    return { text: result.text };
  }

  async generateObject<T>(input: AIObjectRequest<T>): Promise<T> {
    const result = await generateObject({
      model: this.model(),
      system: input.system,
      prompt: input.prompt,
      schema: input.schema,
      maxOutputTokens: input.maxOutputTokens,
      temperature: input.temperature,
      abortSignal: input.timeoutMs
        ? AbortSignal.timeout(input.timeoutMs)
        : undefined,
      maxRetries: 2,
    });
    return result.object as T;
  }
}

export function defaultProviderTimeout(): number {
  return LIMITS.aiCallTimeoutMs;
}
