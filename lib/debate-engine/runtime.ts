import path from "node:path";
import {
  resolveModel,
  resolveProvider,
  type ProviderName,
} from "../config";
import { AiDebater } from "../ai/debater";
import { AiJudge } from "../ai/judge";
import { OpenAIProvider } from "../ai/openai-provider";
import { GoogleProvider } from "../ai/google-provider";
import type { AIProvider } from "../ai/types";
import { TavilyResearchTool } from "../research/tavily-tool";
import { DebateBus } from "./bus";
import { DebateRunner, type EngineDeps } from "./engine";
import { DebateStore } from "./store";

export class MissingConfigError extends Error {
  constructor(public missing: string[]) {
    super(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export interface Runtime {
  store: DebateStore;
  bus: DebateBus;
  runner: DebateRunner;
}

/** Maps a provider to the env var that holds its API key. */
const KEY_VAR: Record<ProviderName, string> = {
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
};

export function build(env: NodeJS.ProcessEnv = process.env): Runtime {
  // Resolve per-role configuration from the supplied env (not module-level
  // state) so it is fully parameterized and testable.
  const debaterName = resolveProvider(env, "debater");
  const judgeName = resolveProvider(env, "judge");
  const debaterModel = resolveModel(env, "debater", debaterName);
  const judgeModel = resolveModel(env, "judge", judgeName);

  // Only require the API key for the providers actually in use. A debate with
  // both roles on OpenAI needs only OPENAI_API_KEY; one that mixes providers
  // needs just the keys for those providers — nothing more.
  const missing: string[] = [];
  for (const name of [debaterName, judgeName]) {
    const keyVar = KEY_VAR[name];
    if (!env[keyVar]) missing.push(keyVar);
  }
  if (missing.length) throw new MissingConfigError(missing);

  const debaterProvider = makeProvider(debaterName, debaterModel, env);
  const judgeProvider = makeProvider(judgeName, judgeModel, env);

  const researchTool = env.TAVILY_API_KEY
    ? new TavilyResearchTool(env.TAVILY_API_KEY)
    : null;

  const dataDir =
    env.DATA_DIR ?? path.join(process.cwd(), "data", "debates");
  const store = new DebateStore(dataDir);
  const bus = new DebateBus();

  const deps: EngineDeps = {
    store,
    bus,
    createDebater: () => new AiDebater(debaterProvider, debaterModel),
    createJudge: () => new AiJudge(judgeProvider, judgeModel),
    researchTool,
  };

  return { store, bus, runner: new DebateRunner(deps) };
}

/**
 * Constructs the concrete {@link AIProvider} for a role. Unknown provider names
 * are rejected by config.ts at load time, so this switch is exhaustive; the
 * `never` check guards against a provider being added to config without a branch
 * here.
 */
function makeProvider(
  name: ProviderName,
  model: string,
  env: NodeJS.ProcessEnv,
): AIProvider {
  switch (name) {
    case "openai":
      return new OpenAIProvider({
        apiKey: env.OPENAI_API_KEY,
        baseURL: env.OPENAI_BASE_URL,
        model,
      });
    case "gemini":
      return new GoogleProvider({ apiKey: env.GEMINI_API_KEY, model });
    default: {
      const _exhaustive: never = name;
      throw new Error(`Unhandled AI provider: ${String(_exhaustive)}`);
    }
  }
}

const globalForRuntime = globalThis as unknown as {
  __opendebateRuntime?: Runtime;
};

export function getRuntime(): Runtime {
  if (!globalForRuntime.__opendebateRuntime) {
    globalForRuntime.__opendebateRuntime = build();
  }
  return globalForRuntime.__opendebateRuntime;
}
