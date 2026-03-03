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

  // Only process /present command
  if (!text.startsWith('/present')) return;

  try {
    // Find baraza group by Telegram chat ID
    const barazaGroup = await prisma.barazaGroup.findFirst({
      where: {
        platform: 'TELEGRAM',
        externalId: String(chatId),
        isActive: true,
      },
    });
    if (!barazaGroup) return;

    const sessionDate = new Date().toISOString().slice(0, 10);
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
  } catch (err) {
    logger.warn(
      { operationType: 'TELEGRAM_WEBHOOK', error: String(err) },
      'Failed to process /present command — non-fatal'
    );
  }
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
    const barazaGroup = await barazaBotService.registerBarazaGroup(
      user.id,
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
    const groups = await barazaBotService.getBarazaGroupsForUser(user.id);
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

export async function deactivateBarazaGroup(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const barazaGroupId = req.params.id;
    const barazaGroup = await prisma.barazaGroup.update({
      where: { id: barazaGroupId },
      data: { isActive: false },
    });
    sendSuccess(res, barazaGroup, 'Baraza group deactivated');
  } catch (err) {
    next(err);
  }
}
