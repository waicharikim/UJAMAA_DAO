/**
 * @file src/core/ai/claude.ts
 * @description
 * Shared Claude client + a thin completion helper, so multiple modules can call
 * the Anthropic API without duplicating client init or coupling to the
 * integration module.
 *
 * Graceful degradation: getClaudeClient() returns null when CLAUDE_API_KEY is
 * not set. Callers MUST null-check and skip the AI path (dormant until the key
 * is configured) — exactly the pattern the Telegram baraza service uses.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../logger/logger.js';

export const CLAUDE_MODEL =
  process.env.DELIBERATION_AI_MODEL ??
  process.env.BARAZA_AI_MODEL ??
  'claude-haiku-4-5-20251001';

/**
 * Optional Anthropic-compatible gateway. Set CLAUDE_BASE_URL to route through a
 * provider that speaks the Anthropic `/v1/messages` protocol — e.g. DigitalOcean
 * Serverless Inference (`https://inference.do-ai.run`) — instead of calling
 * Anthropic directly. When set, the key is sent as a Bearer token (`authToken`)
 * rather than `x-api-key`, which is what those gateways expect, and the model id
 * must be the gateway's own id (set DELIBERATION_AI_MODEL / BARAZA_AI_MODEL).
 * Unset = call api.anthropic.com directly with `x-api-key`.
 */
const CLAUDE_BASE_URL = process.env.CLAUDE_BASE_URL;

/** True when routing through a non-Anthropic gateway (see CLAUDE_BASE_URL). */
export const isAnthropicGateway = !!CLAUDE_BASE_URL;

let client: Anthropic | null = null;
let initialised = false;

/**
 * Returns a singleton Anthropic client, or null if CLAUDE_API_KEY is unset.
 */
export function getClaudeClient(): Anthropic | null {
  if (!initialised) {
    initialised = true;
    const apiKey = process.env.CLAUDE_API_KEY;
    if (apiKey) {
      client = new Anthropic(
        CLAUDE_BASE_URL
          ? { authToken: apiKey, baseURL: CLAUDE_BASE_URL }
          : { apiKey }
      );
    }
  }
  return client;
}

export function isClaudeAvailable(): boolean {
  return getClaudeClient() !== null;
}

interface CompleteOptions {
  /** System prompt — cached ephemerally (5-min TTL) to save input tokens. */
  system: string;
  /** Single user message text. */
  userMessage: string;
  maxTokens?: number;
}

/**
 * One-shot text completion with ephemeral prompt caching on the system prompt.
 * Returns the concatenated text output, or null if the client is unavailable
 * or the call fails (never throws — callers treat null as "AI unavailable").
 */
export async function complete(opts: CompleteOptions): Promise<string | null> {
  const anthropic = getClaudeClient();
  if (!anthropic) return null;

  // Prompt caching (the system-block cache_control + the prompt-caching beta
  // header) is an Anthropic-direct feature. Gateways like DigitalOcean reject the
  // beta header, so skip caching when routing through CLAUDE_BASE_URL — it only
  // affects input-token cost, never the output.
  const useCaching = !isAnthropicGateway;
  const base = {
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    messages: [{ role: 'user' as const, content: opts.userMessage }],
  };

  try {
    const response = useCaching
      ? await (anthropic as Anthropic).messages.create({
          ...base,
          system: [
            {
              type: 'text' as const,
              text: opts.system,
              cache_control: { type: 'ephemeral' as const },
            },
          ],
          // @ts-expect-error — beta header accepted by SDK at runtime
          betas: ['prompt-caching-2024-07-31'],
        })
      : await (anthropic as Anthropic).messages.create({
          ...base,
          system: opts.system,
        });

    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  } catch (err) {
    logger.warn({ err }, '[AI] Claude completion failed');
    return null;
  }
}
