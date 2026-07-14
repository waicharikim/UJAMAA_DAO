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
 *                            (Shahidi only — for real-time premise interrogation)
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
 * qwen-max     — use for Shahidi/Mpelelezi where deeper reasoning matters
 * qwen-turbo   — cheapest, for high-volume low-stakes completions
 *
 * Override per-agent by passing model explicitly to complete().
 */
export const QWEN_MODEL =
  process.env.DELIBERATION_AI_MODEL ??
  process.env.BARAZA_AI_MODEL ??
  'qwen-plus';

/**
 * Separate model for Shahidi and Mpelelezi — deeper reasoning justifies the cost.
 * Defaults to qwen-max, overridable via BARAZA_ANALYST_MODEL.
 */
export const QWEN_ANALYST_MODEL =
  process.env.BARAZA_ANALYST_MODEL ?? 'qwen-max';

/** DashScope embedding model for the knowledge layer (RAG). */
export const QWEN_EMBED_MODEL =
  process.env.QWEN_EMBED_MODEL ?? 'text-embedding-v3';

/**
 * DashScope international OpenAI-compatible endpoint.
 * Override via DASHSCOPE_BASE_URL if routing through a proxy or using the
 * mainland China endpoint (https://dashscope.aliyuncs.com/compatible-mode/v1).
 */
// NB: `||` (not `??`) — compose injects DASHSCOPE_BASE_URL as an empty string
// when the host var is unset, and an empty baseURL makes the OpenAI SDK fall
// back to api.openai.com (→ invalid_api_key). `||` treats "" as "use default".
const DASHSCOPE_BASE_URL =
  process.env.DASHSCOPE_BASE_URL ||
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

/**
 * Disable Qwen "thinking" on every chat call. Qwen3 hybrid models default to
 * thinking ON (~14s/reply), which makes the council crawl and can time out the
 * bot. `enable_thinking:false` is DashScope's switch (not in the OpenAI SDK
 * types, hence the cast); it is ignored by non-hybrid models.
 */
function noThink<T>(params: T): T {
  return { ...(params as object), enable_thinking: false } as unknown as T;
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
    const response = await qwen.chat.completions.create(
      noThink({
        model: opts.model ?? QWEN_MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.userMessage },
        ],
      })
    );

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
    const response = await qwen.chat.completions.create(
      noThink({
        model: opts.model ?? QWEN_MODEL,
        max_tokens: opts.maxTokens ?? 2048,
        messages: opts.messages,
      })
    );

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    logger.warn({ err }, '[AI] Qwen conversation completion failed');
    return null;
  }
}

// NOTE: web search is done via a real `web_search` function tool (see
// `core/ai/web-search.ts`) routed through `completeWithTools` — the pattern
// Qwen Cloud's own reference agents use. DashScope's `enable_search` flag is
// silently ignored on the international compatible-mode endpoint, so the former
// `completeWithSearch()` helper was removed (it never actually searched).

// ─── completeWithTools() ──────────────────────────────────────────────────────

export interface CompleteWithToolsOptions {
  system: string;
  userMessage: string;
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  /** Executes a tool call by name; returns a string result for the model. */
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  /** Max tool-call rounds before forcing a final text answer (default 2). */
  maxRounds?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Completion with OpenAI-style function tool-calling. Lets an agent fetch real
 * data on demand (e.g. ward stats, treasury, past decisions) before answering.
 *
 * Runs the tool loop up to `maxRounds`, executing each function call via
 * `executeTool`. Never throws — on error it falls back to a plain completion so
 * the agent still produces a position. Returns null only when the client is
 * unavailable.
 */
export async function completeWithTools(
  opts: CompleteWithToolsOptions
): Promise<string | null> {
  const qwen = getQwenClient();
  if (!qwen) return null;

  const maxRounds = opts.maxRounds ?? 2;
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: opts.system },
    { role: 'user', content: opts.userMessage },
  ];

  try {
    let response = await qwen.chat.completions.create(
      noThink({
        model: opts.model ?? QWEN_MODEL,
        max_tokens: opts.maxTokens ?? 2048,
        tools: opts.tools,
        tool_choice: 'auto',
        messages,
      })
    );

    let round = 0;
    while (
      response.choices[0]?.finish_reason === 'tool_calls' &&
      round < maxRounds
    ) {
      round++;
      const assistantMessage = response.choices[0].message;
      messages.push(assistantMessage);

      for (const tc of assistantMessage.tool_calls ?? []) {
        // OpenAI v6 tool_calls is a union (function | custom).
        if (tc.type !== 'function') continue;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch {
          args = {};
        }
        const result = await opts.executeTool(tc.function.name, args);
        messages.push({
          role: 'tool' as const,
          tool_call_id: tc.id,
          content: result,
        });
      }

      response = await qwen.chat.completions.create(
        noThink({
          model: opts.model ?? QWEN_MODEL,
          max_tokens: opts.maxTokens ?? 2048,
          tools: opts.tools,
          tool_choice: 'auto',
          messages,
        })
      );
    }

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    logger.warn({ err }, '[AI] Qwen tool completion failed');
    return complete({
      system: opts.system,
      userMessage: opts.userMessage,
      maxTokens: opts.maxTokens,
      model: opts.model,
    });
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
    // Strip only the fence markers, keeping the JSON between them (an earlier
    // version removed the whole fenced block *including* its contents, so a
    // model that wrapped its JSON in ```json … ``` yielded an empty parse).
    const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(match ? match[0] : cleaned) as T;
  } catch (err) {
    logger.warn({ err, raw }, '[AI] JSON parse failed after Qwen completion');
    return null;
  }
}

// ─── embed() ─────────────────────────────────────────────────────────────────

/**
 * Embed one or more texts via DashScope's OpenAI-compatible embeddings endpoint.
 * Returns one vector per input (order-preserving), or null if the client is
 * unavailable or the call fails. Never throws. Callers should batch large inputs
 * (DashScope caps inputs per request).
 */
export async function embed(input: string[]): Promise<number[][] | null> {
  const qwen = getQwenClient();
  if (!qwen || input.length === 0) return null;
  try {
    const res = await qwen.embeddings.create({
      model: QWEN_EMBED_MODEL,
      input,
    });
    return res.data.map((d) => d.embedding as number[]);
  } catch (err) {
    logger.warn({ err }, '[AI] Qwen embedding failed');
    return null;
  }
}
