import path from "node:path";
import { MODELS } from "../config";
import { AiDebater } from "../ai/debater";
import { AiJudge } from "../ai/judge";
import { OpenAIProvider } from "../ai/openai-provider";
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

function build(env: NodeJS.ProcessEnv = process.env): Runtime {
  const missing: string[] = [];
  if (!env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
  if (missing.length) throw new MissingConfigError(missing);

  const providerOptions = {
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
  };

  const debaterProvider = new OpenAIProvider({
    ...providerOptions,
    model: MODELS.debater,
  });
  const judgeProvider = new OpenAIProvider({
    ...providerOptions,
    model: MODELS.judge,
  });

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
    createDebater: () => new AiDebater(debaterProvider, MODELS.debater),
    createJudge: () => new AiJudge(judgeProvider, MODELS.judge),
    researchTool,
  };

  return { store, bus, runner: new DebateRunner(deps) };
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
