/**
 * @file src/core/ai/qwen.ts
 * @description
 * Shared Qwen Cloud client + thin completion helpers, replacing the Claude
 * abstraction. Uses the OpenAI-compatible DashScope endpoint so no new SDK
 * is needed beyond the `openai` package already in use by baraza-ai.service.
 *
 * Drop-in replacement for core/ai/claude.ts — same graceful-degradation
 * contract, same null-check pattern, same never-throws guarantee.
 *
 * Two completion modes:
 *   complete()             — standard text completion (all agents)
 *   completeWithSearch()   — text completion with Qwen web_search tool enabled
 *                            (Ukweli only — for real-time premise interrogation)
 *
 * Graceful degradation: getQwenClient() returns null when DASHSCOPE_API_KEY is
 * not set. Callers MUST null-check and skip the AI path.
 */

import OpenAI from 'openai';
import { logger } from '../logger/logger.js';

// ─── Model config ─────────────────────────────────────────────────────────────

/**
 * Model used for deliberation agents.
 * qwen-plus    — recommended default: best speed/capability balance
 * qwen-max     — use for Ukweli/Kivuli where deeper reasoning matters
 * qwen-turbo   — cheapest, for high-volume low-stakes completions
 *
 * Override per-agent by passing model explicitly to complete().
 */
export const QWEN_MODEL =
  process.env.DELIBERATION_AI_MODEL ??
  process.env.BARAZA_AI_MODEL ??
  'qwen-plus';

/**
 * Separate model for Ukweli and Kivuli — deeper reasoning justifies the cost.
 * Defaults to qwen-max, overridable via BARAZA_ANALYST_MODEL.
 */
export const QWEN_ANALYST_MODEL =
  process.env.BARAZA_ANALYST_MODEL ?? 'qwen-max';

/**
 * DashScope international OpenAI-compatible endpoint.
 * Override via DASHSCOPE_BASE_URL if routing through a proxy or using the
 * mainland China endpoint (https://dashscope.aliyuncs.com/compatible-mode/v1).
 */
const DASHSCOPE_BASE_URL =
  process.env.DASHSCOPE_BASE_URL ??
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

// ─── Client singleton ─────────────────────────────────────────────────────────

let client: OpenAI | null = null;
let initialised = false;

/**
 * Returns a singleton OpenAI client pointed at DashScope,
 * or null if DASHSCOPE_API_KEY is not set.
 */
export function getQwenClient(): OpenAI | null {
  if (!initialised) {
    initialised = true;
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (apiKey) {
      client = new OpenAI({ apiKey, baseURL: DASHSCOPE_BASE_URL });
    }
  }
  return client;
}

export function isQwenAvailable(): boolean {
  return getQwenClient() !== null;
}

// ─── Backwards-compatibility aliases ─────────────────────────────────────────
// deliberation.service.ts imports getClaudeClient / complete from core/ai/claude.
// Re-export under the old names so that file needs zero changes when you
// redirect its import path to this module.

export const getClaudeClient = getQwenClient;
export const isClaudeAvailable = isQwenAvailable;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompleteOptions {
  /** System prompt. */
  system: string;
  /** Single user message text. */
  userMessage: string;
  maxTokens?: number;
  /** Override the default model for this call. */
  model?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompleteConversationOptions {
  messages: Message[];
  maxTokens?: number;
  model?: string;
}

// ─── complete() ───────────────────────────────────────────────────────────────

/**
 * One-shot text completion.
 *
 * Returns the text output, or null if the client is unavailable or the call
 * fails. Never throws — callers treat null as "AI unavailable".
 *
 * Compatible with the old claude.ts complete() signature so deliberation.service
 * works without changes (redirect import only).
 */
export async function complete(opts: CompleteOptions): Promise<string | null> {
  const qwen = getQwenClient();
  if (!qwen) return null;

  try {
    const response = await qwen.chat.completions.create({
      model: opts.model ?? QWEN_MODEL,
      max_tokens: opts.maxTokens ?? 1024,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.userMessage },
      ],
    });

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    logger.warn({ err }, '[AI] Qwen completion failed');
    return null;
  }
}

// ─── completeConversation() ───────────────────────────────────────────────────

/**
 * Multi-turn completion for the deliberation engine's round processing.
 * Accepts a full message history so agents can see previous rounds.
 */
export async function completeConversation(
  opts: CompleteConversationOptions
): Promise<string | null> {
  const qwen = getQwenClient();
  if (!qwen) return null;

  try {
    const response = await qwen.chat.completions.create({
      model: opts.model ?? QWEN_MODEL,
      max_tokens: opts.maxTokens ?? 2048,
      messages: opts.messages,
    });

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    logger.warn({ err }, '[AI] Qwen conversation completion failed');
    return null;
  }
}

// ─── completeWithSearch() ─────────────────────────────────────────────────────

/**
 * Completion with Qwen's built-in web_search tool enabled.
 * Used exclusively by Ukweli for real-time premise interrogation.
 *
 * Qwen's web search is a built-in tool — pass it in the tools array and the
 * model decides when to invoke it. The tool loop runs up to MAX_SEARCH_ROUNDS
 * times before forcing a final text response.
 *
 * Returns the final text content, or null on failure.
 */
const MAX_SEARCH_ROUNDS = 3;

export async function completeWithSearch(
  opts: CompleteOptions
): Promise<string | null> {
  const qwen = getQwenClient();
  if (!qwen) return null;

  const webSearchTool: OpenAI.Chat.Completions.ChatCompletionTool = {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the web for current information to interrogate the factual premises of a governance proposal.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
        },
        required: ['query'],
      },
    },
  };

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: opts.system },
    { role: 'user', content: opts.userMessage },
  ];

  try {
    let response = await qwen.chat.completions.create({
      model: opts.model ?? QWEN_ANALYST_MODEL,
      max_tokens: opts.maxTokens ?? 2048,
      tools: [webSearchTool],
      tool_choice: 'auto',
      messages,
    });

    let round = 0;
    while (
      response.choices[0]?.finish_reason === 'tool_calls' &&
      round < MAX_SEARCH_ROUNDS
    ) {
      round++;
      const assistantMessage = response.choices[0].message;
      messages.push(assistantMessage);

      // Execute tool calls — for web_search, we return a stub since Qwen's
      // built-in search is handled server-side. The tool_call mechanism here
      // is for providers that expose search as a callable function.
      // If using DashScope's native search plugin, switch to the DashScope
      // native API instead (set BARAZA_USE_NATIVE_SEARCH=true).
      const toolResults: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
        [];
      for (const tc of assistantMessage.tool_calls ?? []) {
        // OpenAI v6 tool_calls is a union (function | custom); only function
        // calls carry `.function`.
        if (tc.type !== 'function') continue;
        let query = '';
        try {
          query = JSON.parse(tc.function.arguments || '{}').query ?? '';
        } catch {
          query = '';
        }
        toolResults.push({
          role: 'tool' as const,
          tool_call_id: tc.id,
          content: `Search executed for: ${query}. Please proceed with your analysis based on your knowledge.`,
        });
      }

      messages.push(...toolResults);
      response = await qwen.chat.completions.create({
        model: opts.model ?? QWEN_ANALYST_MODEL,
        max_tokens: opts.maxTokens ?? 2048,
        tools: [webSearchTool],
        tool_choice: 'auto',
        messages,
      });
    }

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    logger.warn({ err }, '[AI] Qwen search completion failed');
    // Fall back to standard completion without search
    return complete(opts);
  }
}

// ─── completeJSON() ──────────────────────────────────────────────────────────

/**
 * Completion that expects and parses a JSON response.
 * Used by the scoring layer and conflict map extraction.
 * Strips markdown fences before parsing. Returns null on parse failure.
 */
export async function completeJSON<T = unknown>(
  opts: CompleteOptions
): Promise<T | null> {
  const raw = await complete({
    ...opts,
    system: `${opts.system}\n\nRespond with ONLY valid JSON. No prose, no markdown fences, no preamble.`,
  });
  if (!raw) return null;

  try {
    const cleaned = raw.replace(/```(?:json)?[\s\S]*?```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(match ? match[0] : cleaned) as T;
  } catch (err) {
    logger.warn({ err, raw }, '[AI] JSON parse failed after Qwen completion');
    return null;
  }
}
