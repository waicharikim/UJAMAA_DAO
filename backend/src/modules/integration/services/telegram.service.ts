/**
 * @file src/modules/integration/services/telegram.service.ts
 * @description
 * Telegram Bot API wrapper.
 * Null-guard pattern: returns null when TELEGRAM_BOT_TOKEN not set.
 * Never throws — all errors are caught and logged as warn.
 */

import { logger } from '../../../core/logger/logger.js';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = TELEGRAM_TOKEN
  ? `https://api.telegram.org/bot${TELEGRAM_TOKEN}`
  : null;

// Cap every Telegram API call so a slow/hanging Telegram never blocks the
// caller (an admin HTTP request or a worker job) indefinitely.
const TELEGRAM_TIMEOUT_MS = 10_000;

export function isTelegramConfigured(): boolean {
  return !!TELEGRAM_TOKEN;
}

async function telegramApiCall(
  method: string,
  body: Record<string, unknown>
): Promise<unknown | null> {
  if (!BASE_URL) return null;

  try {
    const res = await fetch(`${BASE_URL}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    logger.warn(
      { operationType: 'TELEGRAM', method, error: String(err) },
      'Telegram API call failed'
    );
    return null;
  }
}

export async function telegramSendMessage(
  chatId: string | number,
  text: string
): Promise<unknown | null> {
  return telegramApiCall('sendMessage', { chat_id: chatId, text });
}

export async function telegramSendInviteLink(
  userChatId: string | number,
  groupName: string,
  inviteLink: string
): Promise<unknown | null> {
  const text =
    `You've been invited to join the ${groupName} Baraza group.\n\n` +
    `Join here: ${inviteLink}`;
  return telegramSendMessage(userChatId, text);
}

export async function telegramSetWebhook(
  webhookUrl: string,
  secretToken?: string
): Promise<unknown | null> {
  const body: Record<string, unknown> = { url: webhookUrl };
  if (secretToken) body.secret_token = secretToken;
  return telegramApiCall('setWebhook', body);
}
