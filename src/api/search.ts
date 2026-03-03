import client from './client';
import { Document } from '../types';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

export const searchApi = {
  webSearch: (query: string, maxResults = 10) =>
    client
      .post<SearchResponse>('/search/web', { query, max_results: maxResults })
      .then(r => r.data),

  importUrls: (sessionId: string, items: { url: string; title: string }[]) =>
    client
      .post<Document[]>('/search/import', { session_id: sessionId, items })
      .then(r => r.data),
};
