/**
 * @file user.controller.ts
 *
 * @description
 * Express controller handling user-related HTTP endpoints.
 * Provides:
 * - User registration (creation)
 * - Fetching currently authenticated user's profile
 * - Updating authenticated user's profile
 * - Public endpoint to fetch user by wallet address
 *
 * Includes input validation using Zod schemas,
 * structured error handling with ApiError,
 * and structured logging for monitoring and debugging.
 *
 * Protects authenticated routes using user info injected by auth middleware.
 */

import type { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service.js';
import { createUserSchema, updateUserSchema } from '../validation/user.validation.js';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js'; // Adjust the path if needed

/**
 * Handler for creating a new user.
 * Validates input, calls userService, and sends created user in response.
 * Sends 400 for validation errors, appropriate status for other errors.
 */
export const createUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = createUserSchema.parse(req.body);
    logger.info('createUserHandler: Creating user', { walletAddress: input.walletAddress, email: input.email });
    const user = await userService.createUser(input);
    res.status(201).json(user);
    logger.info('createUserHandler: User created', { userId: user.id });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      logger.warn('createUserHandler: Validation error', { errors: (err as ZodError).errors });
      res.status(400).json({ errors: (err as ZodError).errors });
      return;
    }
    if (err instanceof ApiError) {
      logger.warn('createUserHandler: API error', { message: err.message, statusCode: err.statusCode });
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    logger.error('createUserHandler: Unexpected error', { error: err });
    next(err);
  }
};

/**
 * Handler to fetch the currently authenticated user's profile.
 * Requires userId in request context (from auth middleware).
 */
export const getCurrentUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      logger.warn('getCurrentUserHandler: Unauthorized access attempt');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    logger.info('getCurrentUserHandler: Fetching user profile', { userId });
    const user = await userService.getUserById(userId);
    res.json(user);
    logger.info('getCurrentUserHandler: User profile sent', { userId });
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      logger.warn('getCurrentUserHandler: API error', { message: err.message, statusCode: err.statusCode });
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    logger.error('getCurrentUserHandler: Unexpected error', { error: err });
    next(err);
  }
};

/**
 * Handler to update the currently authenticated user's profile.
 * Validates input, performs update via userService.
 */
export const updateUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      logger.warn('updateUserHandler: Unauthorized update attempt');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const input = updateUserSchema.parse(req.body);
    logger.info('updateUserHandler: Updating user profile', { userId, updateFields: Object.keys(input) });
    const updatedUser = await userService.updateUser(userId, input);
    res.json(updatedUser);
    logger.info('updateUserHandler: User profile updated', { userId });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      logger.warn('updateUserHandler: Validation error', { errors: (err as ZodError).errors });
      res.status(400).json({ errors: (err as ZodError).errors });
      return;
    }
    if (err instanceof ApiError) {
      logger.warn('updateUserHandler: API error', { message: err.message, statusCode: err.statusCode });
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    logger.error('updateUserHandler: Unexpected error', { error: err });
    next(err);
  }
};

/**
 * Public handler to fetch a user by their wallet address.
 * No authentication required.
 */
export const getUserByWalletHandler = async (
  req: Request<{ walletAddress: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const walletAddress = req.params.walletAddress;
    if (!walletAddress || typeof walletAddress !== 'string' || !walletAddress.trim()) {
      logger.warn('getUserByWalletHandler: Missing or invalid walletAddress param', { walletAddress });
      res.status(400).json({ error: 'walletAddress is required' });
      return;
    }
    logger.info('getUserByWalletHandler: Fetching user by wallet address', { walletAddress });
    const user = await userService.getUserByWallet(walletAddress.toLowerCase());
    res.json(user);
    logger.info('getUserByWalletHandler: User found and returned', { userId: user.id });
  } catch (err: unknown) {
    if (err instanceof ApiError && err.statusCode === 404) {
      logger.info('getUserByWalletHandler: User not found', { walletAddress: req.params.walletAddress });
      res.status(404).json({ error: 'User not found' });
      return;
    }
    logger.error('getUserByWalletHandler: Unexpected error', { error: err });
    next(err);
  }
};