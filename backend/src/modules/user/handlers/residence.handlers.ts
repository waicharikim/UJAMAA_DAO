/**
 * @file src/modules/user/handlers/residence.handlers.ts
 * @description
 * Handlers for residence change requests and temporary location management
 * 
 * Version: 1.0 — February 2026
 */

import { Response } from "express";
import { AuthRequest } from "../../../core/types/Ujamaadao.types.js";
import { userService } from "../services/user.service.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { ApiError } from "../../../core/errors/ApiError.js";
import { logger } from "../../../core/logger/logger.js";

/**
 * POST /users/me/request-residence-change
 * Request primary residence change (7-day review + cooldown)
 */
export async function requestResidenceChange(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const dto = req.body;

  try {
    const request = await userService.requestResidenceChange(userId, dto);

    sendSuccess(
      res,
      request,
      "Residence change request submitted successfully",
      201
    );
  } catch (error) {
    logger.error(
      { operationType: "USER_RESIDENCE", userId, error: error instanceof Error ? error.message : String(error) },
      "Failed to request residence change"
    );
    throw error;
  }
}

/**
 * GET /users/me/residence-change-requests
 * Get user's residence change requests
 */
export async function getMyResidenceChangeRequests(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  try {
    const requests = await userService.getUserResidenceChangeRequests(userId);

    sendSuccess(
      res,
      requests,
      "Residence change requests retrieved successfully",
      200
    );
  } catch (error) {
    logger.error(
      { operationType: "USER_RESIDENCE", userId, error: error instanceof Error ? error.message : String(error) },
      "Failed to retrieve residence change requests"
    );
    throw error;
  }
}

/**
 * POST /users/me/temporary-location
 * Set temporary location (for travelling)
 */
export async function setTemporaryLocation(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { wardId, until } = req.body;

  try {
    const untilDate = new Date(until);
    if (isNaN(untilDate.getTime())) {
      throw ApiError.badRequest("Invalid 'until' date format");
    }

    const result = await userService.setTemporaryLocation(userId, wardId, untilDate);

    sendSuccess(
      res,
      result,
      "Temporary location set successfully",
      200
    );
  } catch (error) {
    logger.error(
      { operationType: "USER_RESIDENCE", userId, error: error instanceof Error ? error.message : String(error) },
      "Failed to set temporary location"
    );
    throw error;
  }
}

/**
 * DELETE /users/me/temporary-location
 * Clear temporary location (return to primary residence)
 */
export async function clearTemporaryLocation(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  try {
    await userService.clearTemporaryLocation(userId);

    sendSuccess(
      res,
      { success: true },
      "Temporary location cleared successfully",
      200
    );
  } catch (error) {
    logger.error(
      { operationType: "USER_RESIDENCE", userId, error: error instanceof Error ? error.message : String(error) },
      "Failed to clear temporary location"
    );
    throw error;
  }
}