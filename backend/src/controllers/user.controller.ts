/**
 * @file user.controller.ts
 *
 * @description
 * Controller for handling user-related HTTP requests.
 * Includes handlers for:
 * - Creating new users
 * - Retrieving current user's profile
 * - Updating current user's profile
 * - Uploading avatar images
 * - Retrieving user by wallet address
 */

import type { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service.js';
import { createUserSchema, updateUserSchema } from '../validation/user.validation.js';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { USER_ACCESS_ROLES } from '../constants/roles.js';

/**
 * POST /api/users
 * Creates a new user after validating input.
 */
export const createUserHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createUserSchema.parse(req.body);
    const user = await userService.createUser(validated);
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: (error as ZodError).errors });
    }
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
};

/**
 * GET /api/users/me
 * Retrieves the authenticated user's profile.
 */
export const getCurrentUserHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });

    const roles = (req.userRoles ?? []).map((r: { role: string }) => r.role);
    const user = await userService.getUserById(req.user.userId, roles);

    res.json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/users/me
 * Updates the authenticated user's profile.
 */
export const updateUserHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });

    const validated = updateUserSchema.parse(req.body);
    const updated = await userService.updateUser(req.user.userId, validated, req.user.userId);

    res.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
};

/**
 * POST /api/users/me/avatar
 * Handles avatar image upload for the authenticated user.
 */
export async function uploadAvatarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const updatedUser = await userService.updateUser(req.user.userId, { avatarUrl }, req.user.userId);

    res.json({ message: 'Avatar uploaded successfully', avatarUrl: updatedUser.avatarUrl });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users/wallet/:walletAddress
 * Retrieves user profile by their wallet address with privacy filtering.
 */
export const getUserByWalletHandler = async (
  req: Request<{ walletAddress: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const walletAddress = req.params.walletAddress;
    const roles = (req.userRoles ?? []).map((r: { role: string }) => r.role);

    const user = await userService.getUserByWallet(walletAddress, roles);
    res.json(user);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
};