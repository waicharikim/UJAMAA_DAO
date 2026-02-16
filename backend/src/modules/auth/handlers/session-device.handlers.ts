/**
 * @file src/modules/auth/handlers/session-device.handlers.ts
 * @description
 * Request handlers for advanced session and device management
 * 
 * Version: 1.0 — January 2026
 */

import { Response } from "express";
import { AuthRequest } from "../../../core/types/Ujamaadao.types.js";
import { sessionDeviceService } from "../services/session-device.service.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { ApiError } from "../../../core/errors/ApiError.js";

/**
 * PATCH /auth/sessions/:sessionId/rename
 * Rename a session (give it a friendly name)
 * 
 * Body: { deviceName: string }
 */
export async function renameSession(req: AuthRequest, res: Response) {
  const { sessionId } = req.params;
  const { deviceName } = req.body;
  const userId = req.user!.userId;

  if (!deviceName) {
    throw ApiError.badRequest("Device name is required");
  }

  await sessionDeviceService.renameSession(userId, sessionId, deviceName);

  sendSuccess(
    res,
    { success: true },
    "Session renamed successfully",
    200
  );
}

/**
 * POST /auth/sessions/:sessionId/trust
 * Trust a device (skip additional security checks)
 */
export async function trustDevice(req: AuthRequest, res: Response) {
  const { sessionId } = req.params;
  const userId = req.user!.userId;

  await sessionDeviceService.trustDevice(userId, sessionId);

  sendSuccess(
    res,
    { success: true },
    "Device trusted successfully",
    200
  );
}

/**
 * DELETE /auth/sessions/:sessionId/trust
 * Untrust a device
 */
export async function untrustDevice(req: AuthRequest, res: Response) {
  const { sessionId } = req.params;
  const userId = req.user!.userId;

  await sessionDeviceService.untrustDevice(userId, sessionId);

  sendSuccess(
    res,
    { success: true },
    "Device untrusted successfully",
    200
  );
}

/**
 * GET /auth/sessions/suspicious
 * Get list of suspicious sessions (unusual IPs, concurrent logins, etc.)
 */
export async function getSuspiciousSessions(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  const suspiciousSessions = await sessionDeviceService.detectSuspiciousSessions(userId);

  sendSuccess(
    res,
    { sessions: suspiciousSessions },
    suspiciousSessions.length > 0
      ? "Suspicious sessions detected"
      : "No suspicious sessions found",
    200
  );
}