/**
 * @file src/core/ai/web-search.ts
 * @description
 * Real web search as an OpenAI **function tool** — the pattern Qwen Cloud's own
 * reference agents use (a tool the model calls, backed by a real search API),
 * NOT DashScope's `enable_search` flag, which is silently ignored on the
 * international compatible-mode endpoint.
 *
 * Provider: **Tavily** (LLM-oriented search, free tier). Set `TAVILY_API_KEY`
 * to activate. Fail-open: with no key or on any error it returns no results, so
 * an agent degrades to reasoning from the provided context rather than crashing.
 */
import type OpenAI from 'openai';
import { logger } from '../logger/logger.js';

const TAVILY_URL = 'https://api.tavily.com/search';

export function isWebSearchAvailable(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

export interface WebResult {
  title: string;
  url: string;
  content: string;
}

/** Live web search via Tavily. Fail-open: returns `{ results: [] }` on no key / error. */
export async function webSearch(
  query: string,
  maxResults = 5
): Promise<{ answer?: string; results: WebResult[] }> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return { results: [] };
  try {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: maxResults,
        search_depth: 'basic',
        include_answer: true,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      logger.warn(
        { status: res.status, operationType: 'AI' },
        '[AI] web search HTTP error'
      );
      return { results: [] };
    }
    const j = (await res.json()) as {
      answer?: string;
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    return {
      answer: j.answer,
      results: (j.results ?? []).map((r) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        content: (r.content ?? '').slice(0, 500),
      })),
    };
  } catch (err) {
    logger.warn({ err, operationType: 'AI' }, '[AI] web search failed');
    return { results: [] };
  }
}

/** OpenAI-style function-tool definition for the model to call. */
export const WEB_SEARCH_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the live web to verify a claim or find current facts (prices, dates, events, statistics, laws). Returns summarised results with source URLs. Use it before asserting any external or current figure.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
      },
      required: ['query'],
    },
  },
};

/** Executor for `web_search` — returns a JSON string of sources for the model. */
export async function executeWebSearchTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  if (name !== 'web_search') return JSON.stringify({ error: 'unknown tool' });
  const query = String(args.query ?? '').trim();
  if (!query) return JSON.stringify({ error: 'empty query' });
  logger.info({ query, operationType: 'AI' }, '[AI] web_search invoked');
  const { answer, results } = await webSearch(query);
  logger.info(
    { query, resultCount: results.length, operationType: 'AI' },
    '[AI] web_search returned'
  );
  if (results.length === 0) {
    return JSON.stringify({
      note: 'No web results available. Do NOT assert unverifiable current facts; reason from the provided context only.',
    });
  }
  return JSON.stringify({
    answer,
    sources: results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    })),
  });
}
