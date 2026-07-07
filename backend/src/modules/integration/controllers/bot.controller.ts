/**
 * @file src/modules/integration/controllers/bot.controller.ts
 * @description
 * Bot webhook and Baraza group management controllers.
 *
 * Routes:
 *   POST /telegram/webhook       — Telegram bot webhook (no JWT, secret header auth)
 *   POST /discord/webhook        — Discord interaction endpoint (Ed25519 signature)
 *   POST /baraza-groups          — Register a new baraza group (WARD_ADMIN|SUPER_ADMIN)
 *   GET  /baraza-groups          — List user's baraza groups (any verified user)
 *   POST /baraza-groups/:id/attendance — Record attendance manually (WARD_ADMIN|SUPER_ADMIN)
 *   POST /baraza-groups/:id/deactivate — Deactivate a baraza group (WARD_ADMIN|SUPER_ADMIN)
 */

import { Request, Response, NextFunction } from 'express';
import { createRequire } from 'module';
import { prisma } from '../../../core/database/client.js';
import { SystemRoles } from '../../../core/rbac/roles.js';

const require = createRequire(import.meta.url);
import { logger, logSecurityEvent } from '../../../core/logger/logger.js';
import { getRedisClient } from '../../../core/database/redis.client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { barazaBotService } from '../services/baraza-bot.service.js';
import { barazaAiService } from '../services/baraza-ai.service.js';
import {
  RegisterBarazaGroupDto,
  MarkAttendanceDto,
  TelegramUpdate,
  TelegramMessage,
} from '../types.js';

type BarazaGroupRow = {
  id: string;
  groupId: string;
  platform: string;
  externalId: string;
  isActive: boolean;
};

type TelegramFrom = { id: number; username?: string; first_name?: string };

// Cap raw Telegram Bot API calls so a slow Telegram never hangs the webhook
// async tail or an admin request.
const TELEGRAM_FETCH_TIMEOUT_MS = 10_000;

// ─────────────────────────────────────────────
// Telegram messaging helper
// ─────────────────────────────────────────────

/**
 * Send a Telegram message. Tries DM first (chat_id = userId); if the user
 * hasn't started the bot, falls back to the group chat.
 */
async function sendTelegramMessage(
  userId: number,
  text: string,
  fallbackChatId: number
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const post = (chatId: number, useMarkdown: boolean) =>
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(useMarkdown ? { parse_mode: 'Markdown' } : {}),
      }),
      signal: AbortSignal.timeout(TELEGRAM_FETCH_TIMEOUT_MS),
    });

  const send = async (chatId: number) => {
    let res = await post(chatId, true);
    if (res.ok) return;

    const body = (await res.json()) as { ok: boolean; description?: string };
    // Free-form AI replies often contain unbalanced Markdown (a stray * or _ or
    // [), which Telegram rejects, dropping the whole message. Retry once as
    // plain text so the member still gets the answer.
    if (body.description?.includes('parse entities')) {
      res = await post(chatId, false);
      if (res.ok) return;
      const retry = (await res.json()) as { ok: boolean; description?: string };
      throw new Error(retry.description ?? `HTTP ${res.status}`);
    }
    throw new Error(body.description ?? `HTTP ${res.status}`);
  };

  try {
    await send(userId);
  } catch {
    // User hasn't started the bot — fall back to group message
    try {
      await send(fallbackChatId);
    } catch (err) {
      logger.warn(
        { operationType: 'TELEGRAM_NOTIFY', error: String(err) },
        'Could not send attendance confirmation'
      );
    }
  }
}

// ─────────────────────────────────────────────
// Shared auth helpers
// ─────────────────────────────────────────────

/**
 * Verifies the Telegram sender is a LEADER of barazaGroup.groupId.
 * Returns the caller's userId on success; sends an error DM and returns null otherwise.
 */
async function requireTelegramLeader(
  from: TelegramFrom,
  chatId: number,
  barazaGroup: BarazaGroupRow,
  deniedMessage = '❌ Ni LEADER peke yake anaweza kuendesha amri hii.'
): Promise<string | null> {
  const profile = await prisma.userMessagingProfile.findFirst({
    where: { platform: 'TELEGRAM', externalUserId: String(from.id) },
  });
  const isLeader = profile
    ? await prisma.groupMember.findFirst({
        where: {
          userId: profile.userId,
          groupId: barazaGroup.groupId,
          role: 'LEADER',
        },
      })
    : null;
  if (!isLeader) {
    await sendTelegramMessage(from.id, deniedMessage, chatId);
    return null;
  }
  return profile!.userId;
}

/** Returns groupIds where the user holds LEADER or ADMIN role. */
async function getManagedGroupIds(userId: string): Promise<string[]> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, role: 'LEADER' },
    select: { groupId: true },
  });
  return memberships.map((m: { groupId: string }) => m.groupId);
}

/**
 * Fetches the BarazaGroup row and throws if not found or the HTTP caller lacks
 * admin rights (SUPER_ADMIN or group LEADER).
 */
async function requireHttpBarazaAdmin(
  user: { userId: string; roles: string[] },
  barazaGroupId: string
): Promise<BarazaGroupRow> {
  const barazaGroup = await prisma.barazaGroup.findUnique({
    where: { id: barazaGroupId },
  });
  if (!barazaGroup) throw ApiError.notFound('Baraza group not found');
  const isLocationAdmin =
    user.roles.includes(SystemRoles.SUPER_ADMIN) ||
    user.roles.includes(SystemRoles.WARD_ADMIN);
  if (!isLocationAdmin) {
    const managedIds = await getManagedGroupIds(user.userId);
    if (!managedIds.includes(barazaGroup.groupId)) {
      throw ApiError.forbidden(
        'You do not have admin rights over this baraza group'
      );
    }
  }
  return barazaGroup as BarazaGroupRow;
}

// ─────────────────────────────────────────────
// Telegram webhook helpers
// ─────────────────────────────────────────────

function verifyWebhookSecret(req: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true;
  return req.headers['x-telegram-bot-api-secret-token'] === expected;
}

async function fetchBarazaGroup(
  chatId: number
): Promise<BarazaGroupRow | null> {
  return (await prisma.barazaGroup.findFirst({
    where: { platform: 'TELEGRAM', externalId: String(chatId), isActive: true },
  })) as BarazaGroupRow | null;
}

async function resolveUserContext(
  from: TelegramFrom | undefined,
  groupIds: string[] = []
): Promise<{
  userId: string | null;
  displayName: string;
  ward?: string;
  verificationLevel?: string;
  participationRights?: number;
  activeElectionCount?: number;
}> {
  const displayName = from?.first_name ?? from?.username ?? 'Member';
  if (!from?.id) return { userId: null, displayName };

  const profile = await prisma.userMessagingProfile.findFirst({
    where: { platform: 'TELEGRAM', externalUserId: String(from.id) },
    select: { userId: true },
  });
  if (!profile) return { userId: null, displayName };

  const [user, activeElectionCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: profile.userId },
      select: {
        verificationLevel: true,
        participationRights: true,
        primaryWard: { select: { name: true } },
      },
    }),
    groupIds.length
      ? prisma.election.count({
          where: {
            groupId: { in: groupIds },
            status: { in: ['NOMINATIONS_OPEN', 'VOTING_OPEN'] },
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    userId: profile.userId,
    displayName,
    ward: user?.primaryWard?.name,
    verificationLevel: user?.verificationLevel ?? undefined,
    participationRights: user?.participationRights ?? undefined,
    activeElectionCount,
  };
}

// ─────────────────────────────────────────────
// Bot identity + AI invocation gate
// ─────────────────────────────────────────────

let cachedBot: { id: number; username: string } | null = null;
let botFetchAttempted = false;

/** Bot's id + @username (from getMe), cached. Used to gate AI replies. */
async function getBotIdentity(): Promise<{
  id: number;
  username: string;
} | null> {
  if (cachedBot || botFetchAttempted) return cachedBot;
  botFetchAttempted = true;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(TELEGRAM_FETCH_TIMEOUT_MS),
    });
    const data = (await res.json()) as {
      ok: boolean;
      result?: { id: number; username: string };
    };
    if (data.ok && data.result) {
      cachedBot = { id: data.result.id, username: data.result.username };
    }
  } catch (err) {
    logger.warn(
      { operationType: 'TELEGRAM_GETME', error: String(err) },
      'Could not fetch bot identity'
    );
  }
  return cachedBot;
}

/**
 * The AI bot only answers free-text when explicitly addressed:
 *  - a private chat (every message is for the bot), OR
 *  - a reply to one of the bot's own messages, OR
 *  - a message that @mentions the bot's username.
 * Otherwise it stays silent — no replying to every message in the group.
 */
function isBotAddressed(
  message: TelegramMessage,
  bot: { id: number; username: string } | null
): boolean {
  if (message.chat?.type === 'private') return true;
  if (!bot) return false;
  if (message.reply_to_message?.from?.id === bot.id) return true;
  return new RegExp(`@${bot.username}(\\b|$)`, 'i').test(message.text ?? '');
}

/** Strip an @botname mention so the AI sees a clean question. */
function stripBotMention(text: string, username?: string): string {
  if (!username) return text.trim();
  return text.replace(new RegExp(`@${username}`, 'ig'), '').trim();
}

async function dispatchCommand(
  text: string,
  from: TelegramFrom | undefined,
  chatId: number,
  barazaGroup: BarazaGroupRow | null,
  message: TelegramMessage
): Promise<void> {
  if (text.startsWith('/verify')) {
    // /verify carries a secret code. In a group everyone can see it, and for a
    // first-time verifier (account not yet linked to any Telegram) a bystander
    // could DM that code to bind the victim's account. So: only process it in a
    // private chat, and treat a code pasted in a group as compromised — expire
    // it immediately so it can't be reused.
    if (message.chat?.type !== 'private') {
      return handleVerifyInGroup(text, from, chatId);
    }
    return handleVerifyCommand(text, from, chatId);
  }
  if (text.startsWith('/register'))
    return handleRegisterCommand(text, from, chatId, barazaGroup);

  // Group-scoped slash commands need a registered baraza group.
  if (barazaGroup) {
    if (text.startsWith('/schedule'))
      return handleScheduleCommand(text, from, chatId, barazaGroup);
    if (text.startsWith('/open'))
      return handleOpenCommand(from, chatId, barazaGroup);
    if (text.startsWith('/close'))
      return handleCloseCommand(from, chatId, barazaGroup);
    if (text.startsWith('/present'))
      return handlePresentCommand(from, chatId, barazaGroup);
  } else if (text.startsWith('/present')) {
    logger.info(
      { operationType: 'TELEGRAM_UNREGISTERED_GROUP', chatId },
      'Unregistered group — use this chatId to register a baraza group'
    );
    return;
  }

  // Free-text → AI layer. Allowed in registered baraza groups AND in private
  // chats (DMs). Unregistered group chats stay silent. The bot only answers
  // when explicitly addressed (mentioned, replied-to, or a private chat).
  if (!text || text.startsWith('/')) return;
  const isPrivate = message.chat?.type === 'private';
  if (!barazaGroup && !isPrivate) return;
  if (!barazaAiService.isAvailable) return;

  const bot = await getBotIdentity();
  if (!isBotAddressed(message, bot)) return;

  const question = stripBotMention(text, bot?.username) || text;
  // Resolve the community set the bot should reason over.
  //  - In a registered baraza group chat: just that group (the bot is that
  //    room's assistant and must not leak other communities into a shared chat).
  //  - In a DM: ALL the user's communities (their up-to-7 system groups +
  //    every voluntary group), so "my communities" questions resolve fully.
  const communities = barazaGroup
    ? await resolveSingleCommunity(barazaGroup.groupId)
    : await resolveUserCommunities(from);
  const groupIds = communities.map((c) => c.groupId);
  const userContext = await resolveUserContext(from, groupIds);
  // Per-user, per-chat thread so memory is isolated between members in a shared
  // baraza group and scoped to the room (group chat vs DM are separate threads).
  const conversationKey = `${chatId}:${from?.id ?? 'anon'}`;
  const reply = await barazaAiService.reply(
    question,
    userContext,
    communities,
    conversationKey
  );
  if (from?.id) await sendTelegramMessage(from.id, reply, chatId);
}

/** Resolves a single group's id + name into a one-element community list. */
async function resolveSingleCommunity(
  groupId: string
): Promise<{ groupId: string; groupName: string }[]> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { name: true },
  });
  return [{ groupId, groupName: group?.name ?? 'this community' }];
}

/**
 * Resolves every community the Telegram user actively belongs to — all their
 * system groups (ward/constituency/county/national, primary + secondary) AND
 * all voluntary groups. Used in DMs where there is no single group context.
 * Returns [] if the user isn't linked to a UjamaaDAO account.
 */
async function resolveUserCommunities(
  from: TelegramFrom | undefined
): Promise<{ groupId: string; groupName: string }[]> {
  if (!from?.id) return [];
  const profile = await prisma.userMessagingProfile.findFirst({
    where: { platform: 'TELEGRAM', externalUserId: String(from.id) },
    select: { userId: true },
  });
  if (!profile) return [];
  const memberships = await prisma.groupMember.findMany({
    where: { userId: profile.userId, active: true },
    select: { group: { select: { id: true, name: true } } },
    orderBy: { joinedAt: 'desc' },
  });
  return memberships.map((m) => ({
    groupId: m.group.id,
    groupName: m.group.name,
  }));
}

// ─────────────────────────────────────────────
// Web chat (in-app Baraza assistant)
// ─────────────────────────────────────────────

/**
 * POST /integration/baraza/ask — the Baraza Q&A assistant embedded in the web
 * app. Same brain as the Telegram bot (`barazaAiService.reply`), but the user
 * is identified from the JWT rather than a Telegram messaging profile, so the
 * assistant reasons over ALL of the signed-in member's communities (their
 * system-group location chain + every voluntary group), exactly like a DM.
 *
 * The conversation thread is keyed `web:{userId}` so it's isolated from the
 * member's Telegram threads and continuous across turns in the widget.
 */
export async function askBaraza(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as any).user;
    const userId: string = user.userId;
    const message: string = req.body.message;

    if (!barazaAiService.isAvailable) {
      sendSuccess(res, {
        answer:
          'The Baraza assistant is not available right now. Please try again later.',
        available: false,
      });
      return;
    }

    const communities = await resolveWebUserCommunities(userId);
    const groupIds = communities.map((c) => c.groupId);
    const userContext = await resolveWebUserContext(userId, groupIds);
    const answer = await barazaAiService.reply(
      message,
      userContext,
      communities,
      `web:${userId}`
    );
    sendSuccess(res, { answer, available: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Every community the signed-in user actively belongs to — all their system
 * groups (ward/constituency/county/national, primary + secondary) AND all
 * voluntary groups. Web equivalent of `resolveUserCommunities` (which starts
 * from a Telegram profile); here the userId comes straight from the JWT.
 */
async function resolveWebUserCommunities(
  userId: string
): Promise<{ groupId: string; groupName: string }[]> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, active: true },
    select: { group: { select: { id: true, name: true } } },
    orderBy: { joinedAt: 'desc' },
  });
  return memberships.map((m) => ({
    groupId: m.group.id,
    groupName: m.group.name,
  }));
}

/** Web equivalent of `resolveUserContext`, keyed by the authenticated userId. */
async function resolveWebUserContext(
  userId: string,
  groupIds: string[] = []
): Promise<{
  userId: string | null;
  displayName: string;
  ward?: string;
  verificationLevel?: string;
  participationRights?: number;
  activeElectionCount?: number;
}> {
  const [user, activeElectionCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        verificationLevel: true,
        participationRights: true,
        primaryWard: { select: { name: true } },
      },
    }),
    groupIds.length
      ? prisma.election.count({
          where: {
            groupId: { in: groupIds },
            status: { in: ['NOMINATIONS_OPEN', 'VOTING_OPEN'] },
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    userId,
    displayName: user?.name ?? 'Member',
    ward: user?.primaryWard?.name,
    verificationLevel: user?.verificationLevel ?? undefined,
    participationRights: user?.participationRights ?? undefined,
    activeElectionCount,
  };
}

// ─────────────────────────────────────────────
// Telegram webhook
// ─────────────────────────────────────────────

export async function handleTelegramWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!verifyWebhookSecret(req)) {
    res.status(403).json({ ok: false });
    return;
  }

  res.status(200).json({ ok: true });

  // Everything below runs AFTER the response is sent, so any throw here would
  // be an unhandled rejection. Contain it — a bad update must never destabilise
  // the web process.
  try {
    const update = req.body as TelegramUpdate;
    const message = update?.message;
    if (!message) return;

    const chatId = message.chat.id;
    const from = message.from;
    const text = message.text?.trim() ?? '';

    const barazaGroup = await fetchBarazaGroup(chatId);
    await dispatchCommand(text, from, chatId, barazaGroup, message);
  } catch (err) {
    logger.warn(
      { operationType: 'TELEGRAM_WEBHOOK', error: String(err) },
      'Telegram webhook processing failed — non-fatal'
    );
  }
}

// ─────────────────────────────────────────────
// /present — member marks attendance
// ─────────────────────────────────────────────

async function syncTelegramUserId(from: TelegramFrom): Promise<void> {
  await prisma.userMessagingProfile.updateMany({
    where: {
      platform: 'TELEGRAM',
      externalUserId: null,
      handle: from.username ? `@${from.username}` : undefined,
    },
    data: { externalUserId: String(from.id) },
  });
}

async function hasAlreadyAttended(
  profile: { userId: string } | null,
  barazaGroup: BarazaGroupRow,
  sessionDate: string
): Promise<boolean> {
  if (!profile) return false;
  const record = await prisma.barazaAttendance.findUnique({
    where: {
      userId_barazaGroupId_sessionDate: {
        userId: profile.userId,
        barazaGroupId: barazaGroup.id,
        sessionDate,
      },
    },
  });
  return record !== null;
}

async function handlePresentCommand(
  from: TelegramFrom | undefined,
  chatId: number,
  barazaGroup: BarazaGroupRow
): Promise<void> {
  try {
    const externalUserId = String(from?.id ?? '');
    if (!externalUserId) return;

    if (from?.id) await syncTelegramUserId(from);

    const firstName = from?.first_name ?? 'Wewe';
    const sessionDate = new Date().toISOString().slice(0, 10);

    const openSession = await barazaBotService.getOpenSession(barazaGroup.id);
    if (!openSession) {
      await sendTelegramMessage(
        from!.id,
        'ℹ️ Hakuna baraza inayoendelea saa hii. Admin ataifungua hivi karibuni — subiri kidogo! 🌿',
        chatId
      );
      return;
    }

    const profile = await prisma.userMessagingProfile.findFirst({
      where: { platform: 'TELEGRAM', externalUserId },
    });

    if (await hasAlreadyAttended(profile, barazaGroup, sessionDate)) {
      await sendTelegramMessage(
        from!.id,
        `ℹ️ Wewe tayari umesajiliwa leo ${firstName}! 😄 Hongera kwa kuwa consistent. Tutaonana baraza ijayo! 🌿`,
        chatId
      );
      return;
    }

    await barazaBotService.recordAttendance({
      platform: 'TELEGRAM',
      externalGroupId: String(chatId),
      sessionDate,
      attendeeExternalIds: [externalUserId],
      reportedBy: 'telegram_bot',
    });

    logger.info(
      {
        operationType: 'TELEGRAM_WEBHOOK',
        chatId,
        externalUserId,
        sessionDate,
      },
      'Attendance recorded via /present command'
    );

    await sendTelegramMessage(
      from!.id,
      `✅ Poa ${firstName}! Umefika, tumekusajili.\n\n` +
        `Umepata *15 PR* ya leo — baraza ya ${sessionDate}. 🔥\n\n` +
        `Keep showing up, ndio maana ya Ujamaa. Heshima! 🌿`,
      chatId
    );
  } catch (err) {
    logger.warn(
      { operationType: 'TELEGRAM_WEBHOOK', error: String(err) },
      'Failed to process /present command — non-fatal'
    );
  }
}

// ─────────────────────────────────────────────
// /register — self-register a Telegram group as a BarazaGroup
// ─────────────────────────────────────────────

async function handleRegisterCommand(
  text: string,
  from: TelegramFrom | undefined,
  chatId: number,
  existingBarazaGroup: BarazaGroupRow | null
): Promise<void> {
  if (!from?.id) return;

  // Guard: already registered
  if (existingBarazaGroup) {
    await sendTelegramMessage(
      from.id,
      `ℹ️ Kikundi hiki kimesha-sajiliwa tayari kama *${existingBarazaGroup.externalId}*.\n\nKama kuna tatizo wasiliana na admin kupitia app.`,
      chatId
    );
    return;
  }

  // Parse: /register <group-uuid>
  const parts = text.trim().split(/\s+/);
  const groupId = parts[1];
  if (!groupId || !/^[0-9a-f-]{36}$/i.test(groupId)) {
    await sendTelegramMessage(
      from.id,
      '❌ Format si sahihi. Tuma hivi:\n\n`/register <group-uuid>`\n\nPata UUID ya group yako kutoka UjamaaDAO app.',
      chatId
    );
    return;
  }

  // Look up the caller's UjamaaDAO account
  const profile = await prisma.userMessagingProfile.findFirst({
    where: { platform: 'TELEGRAM', externalUserId: String(from.id) },
    select: { userId: true },
  });
  if (!profile) {
    await sendTelegramMessage(
      from.id,
      '❌ Akaunti yako ya UjamaaDAO haijaunganishwa na Telegram bado.\n\nNenda app → Settings → Verify Phone, kisha tuma /verify <code>.',
      chatId
    );
    return;
  }

  // Check the group exists
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true },
  });
  if (!group) {
    await sendTelegramMessage(
      from.id,
      `❌ Group UUID *${groupId}* haipatikani. Angalia tena kwenye app.`,
      chatId
    );
    return;
  }

  // Check admin rights: SUPER_ADMIN, WARD_ADMIN, or LEADER of the group
  const user = await prisma.user.findUnique({
    where: { id: profile.userId },
    select: { roles: true },
  });
  const roles: string[] = user?.roles ?? [];
  const isSystemAdmin =
    roles.includes(SystemRoles.SUPER_ADMIN) ||
    roles.includes(SystemRoles.WARD_ADMIN);
  if (!isSystemAdmin) {
    const leaderMembership = await prisma.groupMember.findFirst({
      where: { userId: profile.userId, groupId, role: 'LEADER' },
    });
    if (!leaderMembership) {
      await sendTelegramMessage(
        from.id,
        '❌ Huna ruhusa ya kusajili kikundi hiki. Lazima uwe LEADER wa kikundi hicho au WARD_ADMIN.',
        chatId
      );
      return;
    }
  }

  try {
    const barazaGroup = await barazaBotService.registerBarazaGroup(
      profile.userId,
      {
        groupId,
        platform: 'TELEGRAM',
        externalId: String(chatId),
        name: group.name,
      }
    );

    await sendTelegramMessage(
      chatId,
      `✅ *${group.name}* imesajiliwa kama Baraza!\n\n` +
        `Sasa mnaweza kutumia:\n` +
        `• /schedule YYYY-MM-DD HH:MM — panga mkutano\n` +
        `• /open — fungua baraza\n` +
        `• /present — sajili mahudhurio\n` +
        `• /close — funga baraza\n\n` +
        `Ujamaa unaanza hapa! 🌿`,
      chatId
    );

    logger.info(
      {
        operationType: 'TELEGRAM_REGISTER',
        chatId,
        barazaGroupId: barazaGroup.id,
        groupId,
      },
      'Baraza group self-registered via /register command'
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isDuplicate = msg.includes('Unique constraint');
    await sendTelegramMessage(
      from.id,
      isDuplicate
        ? '❌ Kikundi hiki kimesha-sajiliwa tayari. Tafadhali angalia upya.'
        : `❌ Usajili haukufanikiwa: ${msg}`,
      chatId
    );
  }
}

// ─────────────────────────────────────────────
// /schedule — admin schedules next baraza
// ─────────────────────────────────────────────

function isValidScheduleInput(
  dateStr: string | undefined,
  timeStr: string | undefined
): boolean {
  return !!(
    dateStr &&
    timeStr &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateStr) &&
    /^\d{2}:\d{2}$/.test(timeStr)
  );
}

function isValidFutureDateTime(dt: Date): boolean {
  return !isNaN(dt.getTime()) && dt > new Date();
}

async function handleScheduleCommand(
  text: string,
  from: TelegramFrom | undefined,
  chatId: number,
  barazaGroup: BarazaGroupRow
): Promise<void> {
  if (!from?.id) return;

  const userId = await requireTelegramLeader(
    from,
    chatId,
    barazaGroup,
    '❌ Huna ruhusa ya kupanga baraza. Ni LEADER peke yake.'
  );
  if (!userId) return;

  // Parse: /schedule 2026-03-29 10:00
  const parts = text.trim().split(/\s+/);
  const dateStr = parts[1]; // YYYY-MM-DD
  const timeStr = parts[2]; // HH:MM

  if (!isValidScheduleInput(dateStr, timeStr)) {
    await sendTelegramMessage(
      from.id,
      '❌ Format si sahihi. Tuma hivi:\n\n`/schedule 2026-03-29 10:00`\n\nTarehe: YYYY-MM-DD, Muda: HH:MM (saa 24)',
      chatId
    );
    return;
  }

  const scheduledAt = new Date(`${dateStr}T${timeStr}:00+03:00`); // Nairobi time (EAT = UTC+3)
  if (!isValidFutureDateTime(scheduledAt)) {
    await sendTelegramMessage(
      from.id,
      '❌ Tarehe au muda si sahihi. Lazima iwe wakati ujao.',
      chatId
    );
    return;
  }

  const session = await barazaBotService.scheduleSession(
    barazaGroup.id,
    scheduledAt,
    userId
  );

  const formattedDate = scheduledAt.toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Nairobi',
  });
  const formattedTime = scheduledAt.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Nairobi',
  });

  await sendTelegramMessage(
    chatId,
    `📢 *Baraza imepangwa!*\n\n📅 ${formattedDate}\n🕐 Saa ${formattedTime}\n\nAndika /present ukifika. Usikose! 🌿`,
    chatId
  );

  await barazaBotService.notifyGroupMembers(
    barazaGroup.id,
    'Baraza imepangwa!',
    `Baraza ijayo: ${formattedDate} saa ${formattedTime}. Andika /present ukifika.`
  );

  logger.info(
    {
      operationType: 'TELEGRAM_SCHEDULE',
      chatId,
      sessionId: session.id,
      scheduledAt,
    },
    'Baraza session scheduled via bot'
  );
}

// ─────────────────────────────────────────────
// /open — admin opens session for /present
// ─────────────────────────────────────────────

async function handleOpenCommand(
  from: TelegramFrom | undefined,
  chatId: number,
  barazaGroup: BarazaGroupRow
): Promise<void> {
  if (!from?.id) return;

  const userId = await requireTelegramLeader(
    from,
    chatId,
    barazaGroup,
    '❌ Ni LEADER peke yake anaweza kufungua baraza.'
  );
  if (!userId) return;

  const session = await barazaBotService.openSession(barazaGroup.id);
  if (!session) {
    await sendTelegramMessage(
      from.id,
      'ℹ️ Hakuna baraza iliyopangwa. Panga kwanza na /schedule YYYY-MM-DD HH:MM',
      chatId
    );
    return;
  }

  await sendTelegramMessage(
    chatId,
    '✅ *Baraza imefunguliwa!*\n\nWanachama wanaweza kutuma /present sasa. Karibu nyote! 🌿',
    chatId
  );
}

// ─────────────────────────────────────────────
// /close — admin closes session
// ─────────────────────────────────────────────

async function handleCloseCommand(
  from: TelegramFrom | undefined,
  chatId: number,
  barazaGroup: BarazaGroupRow
): Promise<void> {
  if (!from?.id) return;

  const userId = await requireTelegramLeader(
    from,
    chatId,
    barazaGroup,
    '❌ Ni LEADER peke yake anaweza kufunga baraza.'
  );
  if (!userId) return;

  const result = await barazaBotService.closeSession(barazaGroup.id);
  if (!result) {
    await sendTelegramMessage(
      from.id,
      'ℹ️ Hakuna baraza inayoendelea saa hii.',
      chatId
    );
    return;
  }

  await sendTelegramMessage(
    chatId,
    `🏁 *Baraza imefungwa.*\n\nWatu *${result.attendanceCount}* walihudhulia leo. Asante kwa kuja — hii ndiyo Ujamaa! 🌿`,
    chatId
  );
}

// ─────────────────────────────────────────────
// Discord webhook
// ─────────────────────────────────────────────

export async function handleDiscordWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;

  if (PUBLIC_KEY) {
    const signature = req.headers['x-signature-ed25519'] as string;
    const timestamp = req.headers['x-signature-timestamp'] as string;
    const rawBody = JSON.stringify(req.body);

    try {
      const isValid = verifyDiscordSignature(
        PUBLIC_KEY,
        signature,
        timestamp,
        rawBody
      );
      if (!isValid) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    } catch {
      res.status(401).json({ error: 'Signature verification error' });
      return;
    }
  }

  const body = req.body as { type?: number };

  // Respond to Discord ping
  if (body.type === 1) {
    res.status(200).json({ type: 1 });
    return;
  }

  // Placeholder for slash command handling (/baraza, /attendance)
  res.status(200).json({ type: 4, data: { content: 'Command received.' } });
}

function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  // Discord uses Ed25519 — Node 21+ supports crypto.verify for Ed25519 sync
  try {
    const crypto = require('crypto');
    const signedData = Buffer.from(timestamp + body);
    const keyBuffer = Buffer.from(publicKey, 'hex');
    const sigBuffer = Buffer.from(signature, 'hex');
    return crypto.verify(
      null,
      signedData,
      { key: keyBuffer, format: 'der', type: 'spki' },
      sigBuffer
    );
  } catch {
    // Fallback: deny request if verification fails or crypto.verify not available
    return false;
  }
}

// ─────────────────────────────────────────────
// /verify command — Telegram phone verification
// ─────────────────────────────────────────────

async function linkTelegramProfile(
  verification: { id: string; userId: string | null; phoneNumber: string },
  from: TelegramFrom
): Promise<void> {
  if (!verification.userId) return;
  const user = await prisma.user.findUnique({
    where: { id: verification.userId },
    select: { verificationLevel: true },
  });
  await prisma.user.update({
    where: { id: verification.userId },
    data: {
      phoneNumber: verification.phoneNumber,
      phoneVerified: true,
      ...(user?.verificationLevel === 'EMAIL_VERIFIED' && {
        verificationLevel: 'PHONE_VERIFIED',
      }),
    },
  });
  await prisma.userMessagingProfile.upsert({
    where: {
      userId_platform: { userId: verification.userId, platform: 'TELEGRAM' },
    },
    create: {
      userId: verification.userId,
      platform: 'TELEGRAM',
      externalUserId: String(from.id),
      handle: from.username ? `@${from.username}` : null,
    },
    update: {
      externalUserId: String(from.id),
      handle: from.username ? `@${from.username}` : null,
    },
  });
}

// ─────────────────────────────────────────────
// /verify brute-force throttle (keyed on Telegram from.id)
//
// `/verify <code>` looks a code up GLOBALLY (the bot has no phone to scope by),
// so without a per-sender cap an attacker could spam random 6-digit codes and
// bind their Telegram to whichever account holds a matching pending code.
// from.id is set by Telegram and the webhook is secret-gated, so it is a sound
// throttle axis. Redis-backed, with a per-process in-memory fallback.
// ─────────────────────────────────────────────

const VERIFY_MAX_FAILURES = 5;
const VERIFY_WINDOW_SECONDS = 15 * 60;

const verifyFailMemory = new Map<string, { count: number; resetAt: number }>();

function verifyFailKey(fromId: number): string {
  return `tg:verify:fail:${fromId}`;
}

async function getVerifyFailures(fromId: number): Promise<number> {
  const redis = getRedisClient();
  if (redis) {
    const v = await redis.get(verifyFailKey(fromId));
    return v ? parseInt(v, 10) : 0;
  }
  const entry = verifyFailMemory.get(String(fromId));
  if (!entry || entry.resetAt < Date.now()) return 0;
  return entry.count;
}

async function recordVerifyFailure(fromId: number): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    const key = verifyFailKey(fromId);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, VERIFY_WINDOW_SECONDS);
    return;
  }
  const k = String(fromId);
  const now = Date.now();
  const entry = verifyFailMemory.get(k);
  if (!entry || entry.resetAt < now) {
    verifyFailMemory.set(k, {
      count: 1,
      resetAt: now + VERIFY_WINDOW_SECONDS * 1000,
    });
  } else {
    entry.count += 1;
  }
}

async function clearVerifyFailures(fromId: number): Promise<void> {
  const redis = getRedisClient();
  if (redis) await redis.del(verifyFailKey(fromId));
  verifyFailMemory.delete(String(fromId));
}

/**
 * /verify was sent in a group chat. The code is now visible to everyone, so we
 * never bind from here. We expire the exposed code (so a bystander can't DM it
 * to hijack the account) and steer the user to a private chat.
 */
async function handleVerifyInGroup(
  text: string,
  from: TelegramFrom | undefined,
  chatId: number
): Promise<void> {
  const exposed = text.trim().split(/\s+/)[1]?.replace(/\D/g, '');
  if (exposed && exposed.length === 6) {
    // Expire any pending verification matching the leaked code. updateMany never
    // throws on zero matches, and we never set verified=true here.
    await prisma.phoneVerification.updateMany({
      where: { code: exposed, verified: false, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date(0) },
    });
    logSecurityEvent(
      'Telegram /verify code exposed in a group — expired',
      'SUSPICIOUS_ACTIVITY',
      'MEDIUM',
      `A /verify code was posted in group chat ${chatId} and has been invalidated`,
      { metadata: { telegramId: from?.id, chatId } }
    );
  }
  await sendTelegramMessage(
    from?.id ?? chatId,
    '⚠️ Usitume /verify kwenye group — code yako huwa wazi kwa kila mtu. Nimeibatilisha kwa usalama wako. Pata code mpya kwenye UjamaaDAO app, kisha nitumie hapa kwenye *DM* (private chat).',
    chatId
  );
}

async function handleVerifyCommand(
  text: string,
  from: TelegramFrom | undefined,
  chatId: number
): Promise<void> {
  if (!from?.id) return;

  const parts = text.trim().split(/\s+/);
  const code = parts[1]?.replace(/\D/g, '');

  if (!code || code.length !== 6) {
    await sendTelegramMessage(
      from.id,
      '❌ Hiyo haikufanya kazi buda. Tuma code yako hivi:\n\n`/verify 123456`\n\nPata code yako kwenye UjamaaDAO kwanza.',
      chatId
    );
    return;
  }

  // Brute-force gate: too many recent failures from this Telegram account → lock out.
  if ((await getVerifyFailures(from.id)) >= VERIFY_MAX_FAILURES) {
    logSecurityEvent(
      'Telegram /verify locked out after repeated failures',
      'BRUTE_FORCE',
      'HIGH',
      `Telegram user ${from.id} exceeded ${VERIFY_MAX_FAILURES} /verify attempts`,
      { metadata: { telegramId: from.id } }
    );
    await sendTelegramMessage(
      from.id,
      '🚫 Umejaribu mara nyingi mno. Subiri dakika 15, kisha pata code mpya kwenye UjamaaDAO ujaribu tena.',
      chatId
    );
    return;
  }

  // Find the pending verification record by code
  const verification = await prisma.phoneVerification.findFirst({
    where: { code, verified: false, expiresAt: { gt: new Date() } },
  });

  if (!verification) {
    await recordVerifyFailure(from.id);
    await sendTelegramMessage(
      from.id,
      '❌ Code haipo au imeisha muda wake. Rudi UjamaaDAO upate code mpya — itachukua sekunde moja tu. 💪',
      chatId
    );
    return;
  }

  // Safe-binding guard: if this account is already linked to a DIFFERENT Telegram
  // account, refuse — a leaked code must not let someone re-point the binding.
  // (Switching devices is done by unlinking in the app first.)
  if (verification.userId) {
    const existing = await prisma.userMessagingProfile.findUnique({
      where: {
        userId_platform: {
          userId: verification.userId,
          platform: 'TELEGRAM',
        },
      },
      select: { externalUserId: true },
    });
    if (
      existing?.externalUserId &&
      existing.externalUserId !== String(from.id)
    ) {
      await recordVerifyFailure(from.id);
      logSecurityEvent(
        'Telegram /verify rejected — account already linked to another Telegram',
        'ACCOUNT_TAKEOVER_ATTEMPT',
        'HIGH',
        `Telegram user ${from.id} used a valid code for an account already bound to a different Telegram id`,
        { userId: verification.userId, metadata: { telegramId: from.id } }
      );
      await sendTelegramMessage(
        from.id,
        '❌ Akaunti hii tayari imeunganishwa na Telegram nyingine. Ukitaka kubadilisha, ondoa muunganisho kwenye app kwanza (Settings).',
        chatId
      );
      return;
    }
  }

  // Mark phone as verified
  await prisma.phoneVerification.update({
    where: { id: verification.id },
    data: { verified: true, verifiedAt: new Date() },
  });

  await linkTelegramProfile(verification, from);
  await clearVerifyFailures(from.id);

  // Now that the account is linked, pull them into any of their communities that
  // already have a Telegram baraza (invite DMs via the queue). Non-fatal.
  if (verification.userId) {
    try {
      await barazaBotService.fanOutInvitesToUser(
        verification.userId,
        'TELEGRAM'
      );
    } catch (err) {
      logger.warn(
        { operationType: 'BARAZA_INVITE', error: String(err) },
        'fanOutInvitesToUser after /verify failed — non-fatal'
      );
    }
  }

  const firstName = from.first_name ?? 'Wewe';
  await sendTelegramMessage(
    from.id,
    `✅ Sawa sawa ${firstName}! Namba yako imechukuliwa — uko set! 🔥\n\nRudi UjamaaDAO uendelee na community verification. Ukifika hapo utakuwa karibu sana na kura yako. Karibu ndani! 🌿`,
    chatId
  );

  logger.info(
    {
      operationType: 'TELEGRAM_PHONE_VERIFIED',
      telegramId: from.id,
      phoneNumber: verification.phoneNumber,
    },
    'Phone verified via Telegram bot'
  );
}

// ─────────────────────────────────────────────
// Baraza group management
// ─────────────────────────────────────────────

export async function registerBarazaGroup(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as any).user;
    const dto = req.body as RegisterBarazaGroupDto;

    // Location admins (WARD_ADMIN+) can register barazas for any group;
    // non-admins must be LEADER of the group.
    const isLocationAdmin =
      user.roles.includes(SystemRoles.SUPER_ADMIN) ||
      user.roles.includes(SystemRoles.WARD_ADMIN);
    if (!isLocationAdmin) {
      const managedIds = await getManagedGroupIds(user.userId);
      if (!managedIds.includes(dto.groupId)) {
        throw ApiError.forbidden(
          'You do not have admin rights over the selected group'
        );
      }
    }

    const barazaGroup = await barazaBotService.registerBarazaGroup(
      user.userId,
      dto
    );
    sendSuccess(res, barazaGroup, 'Baraza group registered', 201);
  } catch (err) {
    next(err);
  }
}

export async function getBarazaGroups(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as any).user;
    const groups = await barazaBotService.getBarazaGroupsForUser(user.userId);
    sendSuccess(res, groups);
  } catch (err) {
    next(err);
  }
}

export async function recordAttendance(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const barazaGroupId = req.params.id;
    const dto = req.body as MarkAttendanceDto;

    const barazaGroup = await prisma.barazaGroup.findUnique({
      where: { id: barazaGroupId },
    });
    if (!barazaGroup) {
      throw ApiError.notFound('Baraza group not found');
    }

    const enrichedDto: MarkAttendanceDto = {
      ...dto,
      platform: barazaGroup.platform as any,
      externalGroupId: barazaGroup.externalId,
    };

    const records = await barazaBotService.recordAttendance(enrichedDto);
    sendSuccess(res, records, 'Attendance recorded');
  } catch (err) {
    next(err);
  }
}

export async function getAllBarazaGroups(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as any).user;
    const isSuperAdmin = user.roles.includes(SystemRoles.SUPER_ADMIN);

    const whereClause = isSuperAdmin
      ? {}
      : { groupId: { in: await getManagedGroupIds(user.userId) } };

    const groups = await prisma.barazaGroup.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { attendances: true } } },
    });
    sendSuccess(res, groups);
  } catch (err) {
    next(err);
  }
}

export async function getBarazaDemand(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rows = await barazaBotService.getCommunitiesNeedingBaraza('TELEGRAM');
    sendSuccess(res, rows);
  } catch (err) {
    next(err);
  }
}

export async function refreshInviteLink(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const barazaGroupId = req.params.id;
    const link = await barazaBotService.refreshInviteLink(barazaGroupId);
    if (!link) {
      throw ApiError.badRequest(
        'Could not generate invite link — ensure the bot is an admin of the group'
      );
    }
    sendSuccess(res, { inviteLink: link }, 'Invite link refreshed');
  } catch (err) {
    next(err);
  }
}

export async function deactivateBarazaGroup(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as any).user;
    await requireHttpBarazaAdmin(user, req.params.id);

    const barazaGroup = await prisma.barazaGroup.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    sendSuccess(res, barazaGroup, 'Baraza group deactivated');
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// Session management (HTTP API)
// ─────────────────────────────────────────────

export async function listSessions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const barazaGroupId = req.params.id;
    const limit = Math.min(parseInt(String(req.query.limit ?? 20), 10), 50);

    const sessions = await prisma.barazaSession.findMany({
      where: { barazaGroupId },
      orderBy: { scheduledAt: 'desc' },
      take: limit,
    });

    sendSuccess(res, sessions);
  } catch (err) {
    next(err);
  }
}

export async function scheduleSessionHttp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as any).user;
    const { scheduledAt } = req.body as { scheduledAt: string };

    const dt = new Date(scheduledAt);
    if (isNaN(dt.getTime()) || dt <= new Date()) {
      throw ApiError.badRequest(
        'scheduledAt must be a valid future ISO datetime'
      );
    }

    await requireHttpBarazaAdmin(user, req.params.id);

    const session = await barazaBotService.scheduleSession(
      req.params.id,
      dt,
      user.userId
    );
    sendSuccess(res, session, 'Session scheduled', 201);
  } catch (err) {
    next(err);
  }
}

export async function openSessionHttp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as any).user;
    await requireHttpBarazaAdmin(user, req.params.id);

    const pending = await prisma.barazaSession.findFirst({
      where: { barazaGroupId: req.params.id, openedAt: null, closedAt: null },
      orderBy: { scheduledAt: 'asc' },
    });
    if (!pending) {
      throw ApiError.badRequest(
        'No scheduled session found — schedule one first'
      );
    }
    const diffMs = Math.abs(
      Date.now() - new Date(pending.scheduledAt).getTime()
    );
    if (diffMs > 4 * 60 * 60 * 1000) {
      throw ApiError.badRequest(
        'Session can only be opened within 4 hours of its scheduled time'
      );
    }

    const session = await barazaBotService.openSession(req.params.id);
    if (!session) {
      throw ApiError.badRequest(
        'No scheduled session found — schedule one first'
      );
    }
    sendSuccess(res, session, 'Session opened');
  } catch (err) {
    next(err);
  }
}

export async function closeSessionHttp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as any).user;
    await requireHttpBarazaAdmin(user, req.params.id);

    const result = await barazaBotService.closeSession(req.params.id);
    if (!result) {
      throw ApiError.badRequest('No open session to close');
    }
    sendSuccess(res, result, 'Session closed');
  } catch (err) {
    next(err);
  }
}
