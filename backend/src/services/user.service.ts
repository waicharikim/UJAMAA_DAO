/**
 * @file user.service.ts
 *
 * @description
 * Service layer for user-related operations.
 *
 * Responsibilities include:
 * - Creating new users with normalized wallet addresses and unique nonce generation.
 * - Retrieving users by ID or wallet address.
 * - Updating user information.
 *
 * This module handles critical business logic related to users,
 * including input normalization and error handling via ApiError.
 * All database interactions are performed with Prisma ORM.
 */

import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import type { CreateUserInput, UpdateUserInput } from '../validation/user.validation.js';
import crypto from 'crypto'; // For generating random UUIDs for nonce
import logger from '../utils/logger.js'; // Adjust if you have a logger setup

/**
 * Creates a new user with normalized wallet address and a nonce.
 * Throws error if email or wallet address already exists.
 * 
 * @param {CreateUserInput} input - User data to create
 * @returns {Promise<object>} - The created user record
 * @throws {ApiError} - If user with email or wallet exists
 */
export async function createUser(input: CreateUserInput) {
  // Normalize wallet address to lowercase to ensure consistency
  input.walletAddress = input.walletAddress.toLowerCase();

  logger.info('createUser: Checking for existing user', {
    email: input.email,
    walletAddress: input.walletAddress,
  });

  const exists = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { walletAddress: input.walletAddress }] },
  });

  if (exists) {
    logger.warn('createUser: User already exists', {
      email: input.email,
      walletAddress: input.walletAddress,
    });
    throw new ApiError('User with this email or wallet already exists', 409);
  }

  const user = await prisma.user.create({
    data: {
      ...input,
      nonce: crypto.randomUUID(),
    },
  });

  logger.info('createUser: User created successfully', { userId: user.id });

  return user;
}

/**
 * Fetches a user by their unique ID.
 * 
 * @param {string} id - User ID (UUID)
 * @returns {Promise<object>} - The user record if found
 * @throws {ApiError} - If user not found
 */
export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    logger.warn('getUserById: User not found', { userId: id });
    throw new ApiError('User not found', 404);
  }
  return user;
}

/**
 * Updates an existing user's details.
 * 
 * @param {string} id - User ID
 * @param {UpdateUserInput} data - Partial user data to update
 * @returns {Promise<object>} - Updated user record
 * @throws {ApiError} - If user not found
 */
export async function updateUser(id: string, data: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    logger.warn('updateUser: User not found', { userId: id });
    throw new ApiError('User not found', 404);
  }
  const updated = await prisma.user.update({
    where: { id },
    data,
  });
  logger.info('updateUser: User updated', { userId: id });
  return updated;
}

/**
 * Fetches a user by their wallet address.
 * Wallet address is normalized to lowercase for lookup.
 * 
 * @param {string} walletAddress - Wallet address string
 * @returns {Promise<object>} - User record if found
 * @throws {ApiError} - If user not found
 */
export async function getUserByWallet(walletAddress: string) {
  const normalizedWallet = walletAddress.toLowerCase();

  const user = await prisma.user.findUnique({ where: { walletAddress: normalizedWallet } });
  if (!user) {
    logger.warn('getUserByWallet: User not found', { walletAddress: normalizedWallet });
    const error = new ApiError('User not found', 404);
    error.statusCode = 404;
    throw error;
  }
  return user;
}