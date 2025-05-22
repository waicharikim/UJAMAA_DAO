/**
 * @file user.service.ts
 * 
 * @description
 * User service handles all business logic related to user management including
 * creation, updating, retrieval with privacy-aware serialization, and audit logging.
 * 
 * - Validates input references and location integrity.
 * - Normalizes data such as wallet addresses.
 * - Creates users with default system roles.
 * - Updates user info while auditing changes.
 * - Applies privacy filtering based on user settings and requester roles.
 */

import { logUserAudit } from './userAudit.service.js';
import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import type { CreateUserInput, UpdateUserInput } from '../validation/user.validation.js';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import { serializeUser } from '../utils/userSerialization.js';

/**
 * Validates that user location fields reference existing and related County and Constituency records.
 * Throws ApiError on invalid references.
 */
async function validateUserLocations(input: CreateUserInput | UpdateUserInput) {
  const { countyLive, constituencyLive, countyOrigin, constituencyOrigin } = input;

  if (countyLive) {
    const liveCounty = await prisma.county.findUnique({ where: { id: countyLive } });
    if (!liveCounty) throw new ApiError(`Invalid countyLive: ${countyLive}`, 400);
  }
  if (countyOrigin) {
    const originCounty = await prisma.county.findUnique({ where: { id: countyOrigin } });
    if (!originCounty) throw new ApiError(`Invalid countyOrigin: ${countyOrigin}`, 400);
  }
  if (constituencyLive) {
    const liveConstituency = await prisma.constituency.findUnique({ where: { id: constituencyLive } });
    if (!liveConstituency) throw new ApiError(`Invalid constituencyLive: ${constituencyLive}`, 400);
    if (countyLive && liveConstituency.countyId !== countyLive) {
      throw new ApiError(`constituencyLive (${constituencyLive}) does not belong to countyLive (${countyLive})`, 400);
    }
  }
  if (constituencyOrigin) {
    const originConstituency = await prisma.constituency.findUnique({ where: { id: constituencyOrigin } });
    if (!originConstituency) throw new ApiError(`Invalid constituencyOrigin: ${constituencyOrigin}`, 400);
    if (countyOrigin && originConstituency.countyId !== countyOrigin) {
      throw new ApiError(`constituencyOrigin (${constituencyOrigin}) does not belong to countyOrigin (${countyOrigin})`, 400);
    }
  }
}

/**
 * Validates references such as industry and goods/services IDs.
 * Throws ApiError if references are invalid.
 */
async function validateUserReferences(input: CreateUserInput | UpdateUserInput) {
  if (input.industryId) {
    const industry = await prisma.industry.findUnique({ where: { id: input.industryId } });
    if (!industry) throw new ApiError(`Invalid industryId: ${input.industryId}`, 400);
  }
  if (input.goodsServices && input.goodsServices.length > 0) {
    const count = await prisma.goodsService.count({
      where: { id: { in: input.goodsServices } },
    });
    if (count !== input.goodsServices.length) {
      throw new ApiError('One or more goodsServices IDs are invalid', 400);
    }
  }
  await validateUserLocations(input);
}

/**
 * Normalize wallet address to lowercase and trimmed format.
 */
function normalizeWalletAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * Creates a new user after validating references and uniqueness.
 * Assigns default GENERAL_USER system role.
 */
export async function createUser(input: CreateUserInput) {
  input.walletAddress = normalizeWalletAddress(input.walletAddress);

  logger.info('createUser: Checking for existing user', {
    email: input.email,
    walletAddress: input.walletAddress,
  });

  await validateUserReferences(input);

  const exists = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { walletAddress: input.walletAddress }] },
  });

  if (exists) {
    throw new ApiError('User with this email or wallet already exists', 409);
  }

  const goodsServicesInput = input.goodsServices && input.goodsServices.length > 0
    ? { connect: input.goodsServices.map((id: string) => ({ id })) }
    : undefined;

  const user = await prisma.user.create({
    data: {
      walletAddress: input.walletAddress,
      email: input.email,
      name: input.name,
      phoneNumber: input.phoneNumber,
      constituencyOrigin: input.constituencyOrigin,
      countyOrigin: input.countyOrigin,
      constituencyLive: input.constituencyLive,
      countyLive: input.countyLive,
      industryId: input.industryId,
      goodsServices: goodsServicesInput,
      nonce: crypto.randomUUID(),
    },
  });

  // Assign default global role
  await prisma.userRole.create({
    data: { userId: user.id, role: 'GENERAL_USER', scope: null },
  });

  logger.info('createUser: User created successfully', { userId: user.id });
  return user;
}

/**
 * Fetches a user by ID and serializes output filtered by requester's roles 
 * respecting privacy settings.
 */
export async function getUserById(id: string, requesterRoles: string[] = []) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { privacySettings: true, goodsServices: true },
  });
  if (!user) throw new ApiError('User not found', 404);

  return serializeUser(user, requesterRoles);
}

/**
 * Updates user properties with audit logging on changes.
 * @param changedById - ID of user performing the update (for audit)
 */
export async function updateUser(id: string, input: UpdateUserInput, changedById?: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    logger.warn('updateUser: User not found', { userId: id });
    throw new ApiError('User not found', 404);
  }

  if (input.walletAddress) {
    input.walletAddress = normalizeWalletAddress(input.walletAddress);
  }

  await validateUserReferences(input);

  const conflictUser = await prisma.user.findFirst({
    where: {
      AND: [
        { id: { not: id } },
        {
          OR: [
            input.walletAddress ? { walletAddress: input.walletAddress } : undefined,
            input.email ? { email: input.email } : undefined,
          ].filter(Boolean) as object[],
        },
      ],
    },
  });

  if (conflictUser) {
    if (conflictUser.walletAddress === input.walletAddress) {
      throw new ApiError('Wallet address already registered.', 409);
    }
    if (conflictUser.email === input.email) {
      throw new ApiError('Email already registered.', 409);
    }
  }

  // Fields to audit on change
  const auditFields = [
    'email',
    'phoneNumber',
    'walletAddress',
    'constituencyLive',
    'countyLive',
    'constituencyOrigin',
    'countyOrigin',
    'name',
  ];

  // Capture old values for auditing
  const oldValues: Record<string, any> = {};
  for (const field of auditFields) {
    // @ts-ignore TypeScript dynamic property
    oldValues[field] = user[field] ?? null;
  }

  const goodsServicesInput = input.goodsServices && input.goodsServices.length > 0
    ? { set: input.goodsServices.map((id: string) => ({ id })) }
    : { set: [] }; // Clear association if empty

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...input,
      goodsServices: goodsServicesInput,
    },
  });

  logger.info('updateUser: User updated', { userId: id });

  // Log changes asynchronously - no blocking
  if (changedById) {
    for (const field of auditFields) {
      const newValue = updated[field] ?? null;
      if (oldValues[field] !== newValue) {
        logUserAudit({
          userId: id,
          field: `privacySettings.${field}`,
          oldValue: oldValues[field] !== null ? JSON.stringify(oldValues[field]) : null,
          newValue: newValue !== null ? JSON.stringify(newValue) : null,
          changedBy: changedById,
        }).catch((error) => {
          logger.error('Audit log failed', { error, userId: id, field });
        });
      }
    }
  }

  return updated;
}

/**
 * Retrieves a user by wallet address with privacy-aware serialization.
 * @param requesterRoles Roles of requesting user to enforce privacy filtering
 */
export async function getUserByWallet(walletAddress: string, requesterRoles: string[] = []) {
  const normalized = normalizeWalletAddress(walletAddress);
  const user = await prisma.user.findUnique({
    where: { walletAddress: normalized },
    include: { privacySettings: true, goodsServices: true },
  });
  if (!user) throw new ApiError('User not found', 404);

  return serializeUser(user, requesterRoles);
}