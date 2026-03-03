/**
 * @file src/modules/integration/services/discord.service.ts
 * @description
 * Discord Bot API wrapper.
 * Null-guard pattern: returns null when DISCORD_BOT_TOKEN not set.
 * Never throws — all errors are caught and logged as warn.
 */

import { logger } from '../../../core/logger/logger.js';

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_BASE = 'https://discord.com/api/v10';

export function isDiscordConfigured(): boolean {
  return !!DISCORD_TOKEN;
}

function discordHeaders(): HeadersInit {
  return {
    Authorization: `Bot ${DISCORD_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export async function discordSendDM(
  discordUserId: string,
  content: string
): Promise<unknown | null> {
  if (!DISCORD_TOKEN) return null;

  try {
    // Step 1: Create DM channel
    const dmRes = await fetch(`${DISCORD_BASE}/users/@me/channels`, {
      method: 'POST',
      headers: discordHeaders(),
      body: JSON.stringify({ recipient_id: discordUserId }),
    });
    const dmChannel = (await dmRes.json()) as { id?: string };
    if (!dmChannel.id) return null;

    // Step 2: Send message
    const msgRes = await fetch(
      `${DISCORD_BASE}/channels/${dmChannel.id}/messages`,
      {
        method: 'POST',
        headers: discordHeaders(),
        body: JSON.stringify({ content }),
      }
    );
    return await msgRes.json();
  } catch (err) {
    logger.warn(
      { operationType: 'DISCORD', userId: discordUserId, error: String(err) },
      'Discord DM send failed'
    );
    return null;
  }
}

export async function discordGetInviteLink(
  channelId: string
): Promise<string | null> {
  if (!DISCORD_TOKEN) return null;

  try {
    const res = await fetch(`${DISCORD_BASE}/channels/${channelId}/invites`, {
      method: 'POST',
      headers: discordHeaders(),
      body: JSON.stringify({ max_age: 0, max_uses: 0, unique: false }),
    });
    const data = (await res.json()) as { code?: string };
    return data.code ? `https://discord.gg/${data.code}` : null;
  } catch (err) {
    logger.warn(
      { operationType: 'DISCORD', channelId, error: String(err) },
      'Discord invite link creation failed'
    );
    return null;
  }
}

export async function discordSendInviteLink(
  discordUserId: string,
  groupName: string,
  inviteLink: string
): Promise<unknown | null> {
  const content =
    `You've been invited to join the **${groupName}** Baraza channel.\n\n` +
    `Join here: ${inviteLink}`;
  return discordSendDM(discordUserId, content);
}
