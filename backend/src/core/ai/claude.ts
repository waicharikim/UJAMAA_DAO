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
      client = new Anthropic({ apiKey });
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

  try {
    const response = await (anthropic as Anthropic).messages.create({
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 1024,
      system: [
        {
          type: 'text' as const,
          text: opts.system,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: [{ role: 'user', content: opts.userMessage }],
      // @ts-expect-error — beta header accepted by SDK at runtime
      betas: ['prompt-caching-2024-07-31'],
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
