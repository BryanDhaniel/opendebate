export interface SearchHit {
  title: string;
  url: string;
  content: string;
  publisher: string;
  publishedDate?: string;
}

export type SearchFn = (query: string) => Promise<SearchHit[]>;

export interface ResearchTool {
  search(query: string, maxResults: number): Promise<SearchHit[]>;
}
