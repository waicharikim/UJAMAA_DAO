/**
 * @file user.service.ts
 *
 * @description
 * Domain service for user management.
 *
 * Responsibilities:
 * - Create, update, fetch users.
 * - Validate references (industry, goods/services, location relationships).
 * - Ensure DB operations are atomic and audit rows are created inside same transaction.
 * - Convert DB uniqueness errors into friendly ApiError(409).
 * - Emit domain events after successful transactions (EventBus).
 *
 * Integration notes:
 * - Controllers call service methods and will perform serialization (serializeUser)
 *   before sending responses to clients.
 * - Background workers should subscribe to EventBus to perform long-running tasks
 *   such as sending emails, granting tokens on-chain, or other async side-effects.
 *
 * Tests:
 * - Service is written to be testable: it uses UserRepository and logUserAudit(tx)
 *   and catches Prisma known request errors for assertions.
 */

import { Prisma } from '@prisma/client';
import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { logUserAudit } from '../utils/audit.util.js';
import { UserRepository } from '../repositories/user.repository.js';
import { EventBus } from '../events/eventBus.js';
import type { CreateUserInput, UpdateUserInput } from '../validation/user.validation.js';

/**
 * Validate location relations and consistency.
 * Throws ApiError(400) on failure.
 * (Keeps the validation logic in the service layer to avoid accidental DB
 *  inconsistencies; the controller/validation layer should already do most checks.)
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
 * Validate references for industry and goodsServices; delegates location validation.
 * Throws ApiError(400) on invalid references.
 */
async function validateUserReferences(input: CreateUserInput | UpdateUserInput) {
  if (input.industryId) {
    const industry = await prisma.industry.findUnique({ where: { id: input.industryId } });
    if (!industry) throw new ApiError(`Invalid industryId: ${input.industryId}`, 400);
  }

  if (input.goodsServices && input.goodsServices.length > 0) {
    const count = await prisma.goodsService.count({ where: { id: { in: input.goodsServices } } });
    if (count !== input.goodsServices.length) {
      throw new ApiError('One or more goodsServices IDs are invalid', 400);
    }
  }

  await validateUserLocations(input);
}

/**
 * Create user - main entry point.
 *
 * Behavior:
 * - Validates references.
 * - Checks for existing user collisions (email/wallet) first (optimistic).
 * - Performs Prisma transaction to create user, assign role, and write creation audit.
 * - Catches unique-constraint (P2002) and returns ApiError(409).
 * - Publishes 'user.created' event on EventBus after success.
 *
 * Returns: raw Prisma user object (with default includes if needed)
 */
export async function createUser(input: CreateUserInput) {
  logger.info('user.service.createUser: validating references', {
    email: input.email,
    walletAddress: input.walletAddress,
  });

  await validateUserReferences(input);

  // Quick existence check (not a replacement for DB unique constraints)
  const existing = await UserRepository.findByEmailOrWallet(input.email, input.walletAddress);
  if (existing) {
    throw new ApiError('User with this email or wallet already exists', 409);
  }

  // Prepare goodsServices connection if provided
  const goodsServicesConnect = input.goodsServices && input.goodsServices.length > 0
    ? { connect: input.goodsServices.map(id => ({ id })) }
    : undefined;

  // Run atomic creation + role assignment + audit inside transaction
  try {
    const created = await prisma.$transaction(async (tx) => {
      // Use repository create via tx to keep consistency and testability
      const user = await UserRepository.create({
        walletAddress: input.walletAddress,
        email: input.email,
        name: input.name,
        phoneNumber: input.phoneNumber,
        constituencyOrigin: input.constituencyOrigin,
        countyOrigin: input.countyOrigin,
        constituencyLive: input.constituencyLive,
        countyLive: input.countyLive,
        industryId: input.industryId,
        goodsServices: goodsServicesConnect,
        nonce: (input as any).nonce ?? crypto.randomUUID(),
        avatarUrl: input.avatarUrl,
      }, tx);

      // Assign default role
      await tx.userRole.create({
        data: { userId: user.id, role: 'GENERAL_USER', scope: null },
      });

      // Write creation audit inside same transaction using tx
      await logUserAudit({
        userId: user.id,
        field: 'created',
        oldValue: null,
        newValue: JSON.stringify({ email: user.email, name: user.name }),
        changedBy: null,
      }, tx);

      return user;
    });

    // Publish domain event (non-blocking). Subscribers (workers) will handle heavy tasks.
    try {
      EventBus.publish('user.created', { userId: created.id, email: created.email });
    } catch (evtErr) {
      // Log publishing errors but do not rollback the main transaction
      logger.error('user.service.createUser: EventBus.publish failed', { err: evtErr, userId: created.id });
    }

    return created;
  } catch (err) {
    // Convert Prisma unique constraint failures into user-friendly 409
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      logger.warn('user.service.createUser: unique constraint violation', { code: err.code, meta: err.meta });
      throw new ApiError('User with this email or wallet already exists', 409);
    }
    // propagate other errors
    throw err;
  }
}

/**
 * getUserById
 * - Simple fetch wrapper that returns raw Prisma object with useful relations.
 * - Controllers should call serializeUser(...) before returning to clients.
 */
export async function getUserById(id: string) {
  const user = await UserRepository.findById(id);
  if (!user) throw new ApiError('User not found', 404);
  return user;
}

/**
 * updateUser
 * - Validates references and conflict checks.
 * - Performs atomic update and writes field-level audits inside the same transaction.
 * - Emits 'user.updated' event after success for background workers.
 *
 * Note: changedById is used to mark who performed the change.
 */
export async function updateUser(id: string, input: UpdateUserInput, changedById?: string) {
  // Fetch existing user (to compute diffs for audit)
  const existing = await UserRepository.findById(id);
  if (!existing) throw new ApiError('User not found', 404);

  // Defensive normalization is handled in validation; still validate references
  await validateUserReferences(input);

  // Conflict detection (email/wallet used by other accounts)
  const conflict = await UserRepository.findByEmailOrWallet(input.email, input.walletAddress);
  if (conflict && conflict.id !== id) {
    throw new ApiError('Email or wallet already registered to another account', 409);
  }

  // Fields to audit
  const auditFields = [
    'email', 'phoneNumber', 'walletAddress',
    'constituencyLive', 'countyLive', 'constituencyOrigin', 'countyOrigin', 'name',
  ];

  // Capture old values
  const oldValues = {} as Record<string, any>;
  for (const f of auditFields) {
    // @ts-ignore
    oldValues[f] = (existing as any)[f] ?? null;
  }

  // Prepare relations update if goodsServices present
  const dataToUpdate: any = { ...input };
  if (input.goodsServices) {
    dataToUpdate.goodsServices = { set: input.goodsServices.map((gid: string) => ({ id: gid })) };
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const u = await UserRepository.update(id, dataToUpdate, tx);

      // Write audit rows inside same transaction so they commit/rollback together
      if (changedById) {
        for (const field of auditFields) {
          // @ts-ignore
          const newValue = (u as any)[field] ?? null;
          const oldValue = oldValues[field];
          if (oldValue !== newValue) {
            await logUserAudit({
              userId: id,
              field,
              oldValue: oldValue !== null ? JSON.stringify(oldValue) : null,
              newValue: newValue !== null ? JSON.stringify(newValue) : null,
              changedBy: changedById,
            }, tx);
          }
        }
      }

      return u;
    });

    // Emit update event (non-blocking)
    try {
      EventBus.publish('user.updated', { userId: updated.id, changedBy: changedById ?? null });
    } catch (evtErr) {
      logger.error('user.service.updateUser: EventBus.publish failed', { err: evtErr, userId: id });
    }

    return updated;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError('Update conflicts with an existing record (email or wallet)', 409);
    }
    throw err;
  }
}

/**
 * getUserByWallet
 * - Normalize wallet address expected to be normalized earlier by validation.
 * - Returns raw Prisma user object including privacy and goodsServices.
 */
export async function getUserByWallet(walletAddress: string) {
  const user = await UserRepository.findByWalletAddress(walletAddress);
  if (!user) throw new ApiError('User not found', 404);
  return user;
}