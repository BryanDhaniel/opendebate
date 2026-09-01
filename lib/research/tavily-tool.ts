import { tavily } from "@tavily/core";
import type { ResearchTool, SearchHit } from "./types";
import { LIMITS } from "../config";

export class TavilyResearchTool implements ResearchTool {
  private client;

  constructor(apiKey: string) {
    this.client = tavily({ apiKey });
  }

  async search(query: string, maxResults: number): Promise<SearchHit[]> {
    const response = await this.client.search(query, {
      searchDepth: "basic",
      maxResults: Math.min(maxResults, LIMITS.maxResultsPerSearch),
      timeout: Math.floor(LIMITS.searchTimeoutMs / 1000),
    });
    return response.results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.content,
      publisher: publisherFromUrl(result.url),
      publishedDate: result.publishedDate || undefined,
    }));
  }
}

export function publisherFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
