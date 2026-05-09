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
import { logger } from '../../../core/logger/logger.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { barazaBotService } from '../services/baraza-bot.service.js';
import {
  RegisterBarazaGroupDto,
  MarkAttendanceDto,
  TelegramUpdate,
} from '../types.js';

type BarazaGroupRow = {
  id: string;
  groupId: string;
  platform: string;
  externalId: string;
  isActive: boolean;
};

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

  const send = async (chatId: number) => {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
      }
    );
    if (!res.ok) {
      const body = (await res.json()) as { ok: boolean; description?: string };
      throw new Error(body.description ?? `HTTP ${res.status}`);
    }
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
// Telegram webhook
// ─────────────────────────────────────────────

export async function handleTelegramWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Verify secret token header
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const provided = req.headers['x-telegram-bot-api-secret-token'];
    if (provided !== expectedSecret) {
      res.status(403).json({ ok: false });
      return;
    }
  }

  // Ack immediately — Telegram requires fast response
  res.status(200).json({ ok: true });

  const update = req.body as TelegramUpdate;
  const message = update?.message;
  if (!message) return;

  const chatId = message.chat.id;
  const from = message.from;
  const text = message.text?.trim() ?? '';

  // Find baraza group for this chat (needed by most commands)
  const barazaGroup = (await prisma.barazaGroup.findFirst({
    where: { platform: 'TELEGRAM', externalId: String(chatId), isActive: true },
  })) as BarazaGroupRow | null;

  // Route commands
  if (text.startsWith('/schedule')) {
    if (barazaGroup)
      await handleScheduleCommand(text, from, chatId, barazaGroup);
    return;
  }

  if (text.startsWith('/open')) {
    if (barazaGroup) await handleOpenCommand(from, chatId, barazaGroup);
    return;
  }

  if (text.startsWith('/close')) {
    if (barazaGroup) await handleCloseCommand(from, chatId, barazaGroup);
    return;
  }

  if (text.startsWith('/verify')) {
    await handleVerifyCommand(text, from, chatId);
    return;
  }

  if (!text.startsWith('/present')) return;

  // ── /present ──────────────────────────────────
  if (!barazaGroup) {
    logger.info(
      { operationType: 'TELEGRAM_UNREGISTERED_GROUP', chatId },
      'Unregistered group — use this chatId to register a baraza group'
    );
    return;
  }

  try {
    const externalUserId = String(from?.id ?? '');
    if (!externalUserId) return;

    // Update externalUserId on profile if known username or ID just appeared
    if (from?.id) {
      await prisma.userMessagingProfile.updateMany({
        where: {
          platform: 'TELEGRAM',
          externalUserId: null,
          handle: from.username ? `@${from.username}` : undefined,
        },
        data: { externalUserId },
      });
    }

    const firstName = from?.first_name ?? 'Wewe';

    // Check for an open session
    const openSession = await barazaBotService.getOpenSession(barazaGroup.id);
    if (!openSession) {
      await sendTelegramMessage(
        from!.id,
        'ℹ️ Hakuna baraza inayoendelea saa hii. Admin ataifungua hivi karibuni — subiri kidogo! 🌿',
        chatId
      );
      return;
    }

    const sessionDate = new Date().toISOString().slice(0, 10);

    // Look up platform profile to get userId
    const profile = await prisma.userMessagingProfile.findFirst({
      where: { platform: 'TELEGRAM', externalUserId },
    });

    if (profile) {
      // Check if already recorded today
      const alreadyRecorded = await prisma.barazaAttendance.findUnique({
        where: {
          userId_barazaGroupId_sessionDate: {
            userId: profile.userId,
            barazaGroupId: barazaGroup.id,
            sessionDate,
          },
        },
      });

      if (alreadyRecorded) {
        await sendTelegramMessage(
          from!.id,
          `ℹ️ Wewe tayari umesajiliwa leo ${firstName}! 😄 Hongera kwa kuwa consistent. Tutaonana baraza ijayo! 🌿`,
          chatId
        );
        return;
      }
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

    const confirmationText =
      `✅ Poa ${firstName}! Umefika, tumekusajili.\n\n` +
      `Umepata *15 PR* ya leo — baraza ya ${sessionDate}. 🔥\n\n` +
      `Keep showing up, ndio maana ya Ujamaa. Heshima! 🌿`;

    await sendTelegramMessage(from!.id, confirmationText, chatId);
  } catch (err) {
    logger.warn(
      { operationType: 'TELEGRAM_WEBHOOK', error: String(err) },
      'Failed to process /present command — non-fatal'
    );
  }
}

// ─────────────────────────────────────────────
// /schedule — admin schedules next baraza
// ─────────────────────────────────────────────

async function handleScheduleCommand(
  text: string,
  from: { id: number; username?: string; first_name?: string } | undefined,
  chatId: number,
  barazaGroup: BarazaGroupRow
): Promise<void> {
  if (!from?.id) return;

  // Verify sender is a group leader
  const profile = await prisma.userMessagingProfile.findFirst({
    where: { platform: 'TELEGRAM', externalUserId: String(from.id) },
  });
  if (!profile) {
    await sendTelegramMessage(
      from.id,
      '❌ Hautambuliwi kwenye mfumo — verify akaunti yako kwanza.',
      chatId
    );
    return;
  }

  const isLeader = await prisma.groupMember.findFirst({
    where: {
      userId: profile.userId,
      groupId: barazaGroup.groupId,
      role: 'LEADER',
    },
  });
  if (!isLeader) {
    await sendTelegramMessage(
      from.id,
      '❌ Huna ruhusa ya kupanga baraza. Ni LEADER peke yake.',
      chatId
    );
    return;
  }

  // Parse: /schedule 2026-03-29 10:00
  const parts = text.trim().split(/\s+/);
  const dateStr = parts[1]; // YYYY-MM-DD
  const timeStr = parts[2]; // HH:MM

  if (
    !dateStr ||
    !timeStr ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateStr) ||
    !/^\d{2}:\d{2}$/.test(timeStr)
  ) {
    await sendTelegramMessage(
      from.id,
      '❌ Format si sahihi. Tuma hivi:\n\n`/schedule 2026-03-29 10:00`\n\nTarehe: YYYY-MM-DD, Muda: HH:MM (saa 24)',
      chatId
    );
    return;
  }

  const scheduledAt = new Date(`${dateStr}T${timeStr}:00+03:00`); // Nairobi time (EAT = UTC+3)
  if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
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
    profile.userId
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

  const announcementText =
    `📢 *Baraza imepangwa!*\n\n` +
    `📅 ${formattedDate}\n` +
    `🕐 Saa ${formattedTime}\n\n` +
    `Andika /present ukifika. Usikose! 🌿`;

  // Announce in group
  await sendTelegramMessage(chatId, announcementText, chatId);

  // Platform + email notifications to all members
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
  from: { id: number; username?: string; first_name?: string } | undefined,
  chatId: number,
  barazaGroup: BarazaGroupRow
): Promise<void> {
  if (!from?.id) return;

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
    await sendTelegramMessage(
      from.id,
      '❌ Ni LEADER peke yake anaweza kufungua baraza.',
      chatId
    );
    return;
  }

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
  from: { id: number; username?: string; first_name?: string } | undefined,
  chatId: number,
  barazaGroup: BarazaGroupRow
): Promise<void> {
  if (!from?.id) return;

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
    await sendTelegramMessage(
      from.id,
      '❌ Ni LEADER peke yake anaweza kufunga baraza.',
      chatId
    );
    return;
  }

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
      {
        key: keyBuffer,
        format: 'der',
        type: 'spki',
      },
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

async function handleVerifyCommand(
  text: string,
  from: { id: number; username?: string; first_name?: string } | undefined,
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

  // Find the pending verification record by code
  const verification = await prisma.phoneVerification.findFirst({
    where: { code, verified: false, expiresAt: { gt: new Date() } },
  });

  if (!verification) {
    await sendTelegramMessage(
      from.id,
      '❌ Code haipo au imeisha muda wake. Rudi UjamaaDAO upate code mpya — itachukua sekunde moja tu. 💪',
      chatId
    );
    return;
  }

  // Mark phone as verified
  await prisma.phoneVerification.update({
    where: { id: verification.id },
    data: { verified: true, verifiedAt: new Date() },
  });

  if (verification.userId) {
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

    // Link this Telegram user ID to their messaging profile
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

/** Returns groupIds where the user holds LEADER or ADMIN role. */
async function getManagedGroupIds(userId: string): Promise<string[]> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, role: 'LEADER' },
    select: { groupId: true },
  });
  return memberships.map((m: { groupId: string }) => m.groupId);
}

export async function registerBarazaGroup(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as any).user;
    const dto = req.body as RegisterBarazaGroupDto;

    // Non-super-admins may only register barazas for groups they manage
    if (!user.roles.includes(SystemRoles.SUPER_ADMIN)) {
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

    // Verify baraza group exists
    const barazaGroup = await prisma.barazaGroup.findUnique({
      where: { id: barazaGroupId },
    });
    if (!barazaGroup) {
      throw ApiError.notFound('Baraza group not found');
    }

    // Inject the baraza group's externalId into the DTO
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
      include: {
        _count: { select: { attendances: true } },
      },
    });
    sendSuccess(res, groups);
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
    const barazaGroupId = req.params.id;

    const existing = await prisma.barazaGroup.findUnique({
      where: { id: barazaGroupId },
    });
    if (!existing) throw ApiError.notFound('Baraza group not found');

    if (!user.roles.includes(SystemRoles.SUPER_ADMIN)) {
      const managedIds = await getManagedGroupIds(user.userId);
      if (!managedIds.includes(existing.groupId)) {
        throw ApiError.forbidden(
          'You do not have admin rights over this baraza group'
        );
      }
    }

    const barazaGroup = await prisma.barazaGroup.update({
      where: { id: barazaGroupId },
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
    const barazaGroupId = req.params.id;
    const { scheduledAt } = req.body as { scheduledAt: string };

    const dt = new Date(scheduledAt);
    if (isNaN(dt.getTime()) || dt <= new Date()) {
      throw ApiError.badRequest('scheduledAt must be a valid future ISO datetime');
    }

    const barazaGroup = await prisma.barazaGroup.findUnique({
      where: { id: barazaGroupId },
    });
    if (!barazaGroup) throw ApiError.notFound('Baraza group not found');

    if (!user.roles.includes(SystemRoles.SUPER_ADMIN)) {
      const managedIds = await getManagedGroupIds(user.userId);
      if (!managedIds.includes(barazaGroup.groupId)) {
        throw ApiError.forbidden('You do not have admin rights over this baraza group');
      }
    }

    const session = await barazaBotService.scheduleSession(
      barazaGroupId,
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
    const barazaGroupId = req.params.id;

    const barazaGroup = await prisma.barazaGroup.findUnique({
      where: { id: barazaGroupId },
    });
    if (!barazaGroup) throw ApiError.notFound('Baraza group not found');

    if (!user.roles.includes(SystemRoles.SUPER_ADMIN)) {
      const managedIds = await getManagedGroupIds(user.userId);
      if (!managedIds.includes(barazaGroup.groupId)) {
        throw ApiError.forbidden('You do not have admin rights over this baraza group');
      }
    }

    const session = await barazaBotService.openSession(barazaGroupId);
    if (!session) {
      throw ApiError.badRequest('No scheduled session found — schedule one first');
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
    const barazaGroupId = req.params.id;

    const barazaGroup = await prisma.barazaGroup.findUnique({
      where: { id: barazaGroupId },
    });
    if (!barazaGroup) throw ApiError.notFound('Baraza group not found');

    if (!user.roles.includes(SystemRoles.SUPER_ADMIN)) {
      const managedIds = await getManagedGroupIds(user.userId);
      if (!managedIds.includes(barazaGroup.groupId)) {
        throw ApiError.forbidden('You do not have admin rights over this baraza group');
      }
    }

    const result = await barazaBotService.closeSession(barazaGroupId);
    if (!result) {
      throw ApiError.badRequest('No open session to close');
    }
    sendSuccess(res, result, 'Session closed');
  } catch (err) {
    next(err);
  }
}
