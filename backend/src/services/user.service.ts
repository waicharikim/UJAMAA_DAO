/**
 * @file user.service.ts
 *
 * @description
 * Domain service for user management.
 *
 * Responsibilities:
 * - Create, update, fetch users.
 * - Validate references (industry, goods/services, location relationships).
 * - **ENHANCED**: Auto-assign location holdings, roles, and impact points.
 * - Ensure DB operations are atomic and audit rows are created inside same transaction.
 * - Convert DB uniqueness errors into friendly ApiError(409).
 * - Emit domain events after successful transactions (EventBus).
 */

import { Prisma } from '@prisma/client';
import { v4 } from 'uuid';
import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { logUserAudit } from '../utils/audit.util.js';
import { UserRepository } from '../repositories/user.repository.js';
import { EventBus } from '../events/eventBus.js';
import type { CreateUserInput, UpdateUserInput } from '../validation/user.validation.js';

/**
 * Validate location relations and consistency.
 * **ENHANCED**: Supports both UUID and string-based locations.
 */
async function validateUserLocations(input: CreateUserInput | UpdateUserInput) {
  const { 
    countyLive, constituencyLive, countyOrigin, constituencyOrigin,
    countyCode, constituencyName, wardName 
  } = input;

  // UUID VALIDATION (existing)
  if (countyLive) {
    const liveCounty = await prisma.county.findUnique({ where: { id: countyLive } });
    if (!liveCounty) throw new ApiError(`Invalid countyLive: ${countyLive}`, 400);
  }

  if (constituencyLive) {
    const liveConstituency = await prisma.constituency.findUnique({ where: { id: constituencyLive } });
    if (!liveConstituency) throw new ApiError(`Invalid constituencyLive: ${constituencyLive}`, 400);
    if (countyLive && liveConstituency.countyId !== countyLive) {
      throw new ApiError(`constituencyLive does not belong to countyLive`, 400);
    }
  }

  // STRING LOCATION VALIDATION (NEW)
  if (wardName && constituencyName && countyCode) {
    const wardHolding = await prisma.holding.findFirst({
      where: {
        name: { endsWith: ` ${wardName} Ward` },
        holdingType: 1,
        county: { code: countyCode },
        constituency: { name: constituencyName }
      }
    });
    if (!wardHolding) {
      throw new ApiError(`Ward "${wardName}" not found in "${constituencyName}", "${countyCode}"`, 400);
    }
  }
}

/**
 * Validate references for industry and goodsServices; delegates location validation.
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
 * **ENHANCED**: Create user with location auto-assignment, roles, and impact points.
 */
export async function createUser(input: CreateUserInput) {
  logger.info('user.service.createUser: validating references', {
    email: input.email,
    walletAddress: input.walletAddress,
  });

  await validateUserReferences(input);

  const existing = await UserRepository.findByEmailOrWallet(input.email, input.walletAddress);
  if (existing) {
    throw new ApiError('User with this email or wallet already exists', 409);
  }

  const goodsServicesConnect = input.goodsServices && input.goodsServices.length > 0
    ? { connect: input.goodsServices.map(id => ({ id })) }
    : undefined;

  try {
    const created = await prisma.$transaction(async (tx) => {
      // 1. CREATE USER (YOUR FIELDS)
      const user = await UserRepository.create({
        walletAddress: input.walletAddress!,
        email: input.email,
        passwordHash: '', // Add password hashing
        name: input.name,
        phoneNumber: input.phoneNumber,
        // **YOUR REQUIRED UUID FIELDS** (default to National)
        constituencyOrigin: input.constituencyOrigin || 'national-origin-uuid',
        countyOrigin: input.countyOrigin || 'national-origin-uuid',
        constituencyLive: input.constituencyLive || 'national-const-uuid',
        countyLive: input.countyLive || 'national-county-uuid',
        industryId: input.industryId,
        nonce: crypto.randomUUID(),
        avatarUrl: input.avatarUrl,
        duesDestination: 1,
        affiliations: 2,
        voteWeight: 1.0,
        goodsServices: goodsServicesConnect,
      }, tx);

      // 2. **ALIGN: STRING LOCATION ASSIGNMENT**
      const holdings: number[] = [];
      let wardHolding = null;
      let locationPoints = 25;
      let locationScope: LocationScope = 'NATIONAL';

      if (input.wardName && input.constituencyName && input.countyCode) {
        wardHolding = await tx.holding.findFirst({
          where: {
            name: { endsWith: ` ${input.wardName} Ward` },
            holdingType: 1,
            county: { code: input.countyCode },
            constituency: { name: input.constituencyName }
          },
          include: { constituency: true, county: true }
        });

        if (wardHolding) {
          // Assign hierarchy
          const constituencyHolding = await tx.holding.findFirst({
            where: { name: `${input.constituencyName} Constituency`, constituencyId: wardHolding.constituencyId }
          });
          const countyHolding = await tx.holding.findFirst({
            where: { name: `${wardHolding.county.name} County`, countyId: wardHolding.countyId }
          });

          await tx.userHolding.createMany({
            data: [
              { userId: user.id, holdingId: wardHolding.id },
              { userId: user.id, holdingId: constituencyHolding!.id },
              { userId: user.id, holdingId: countyHolding!.id }
            ],
            skipDuplicates: true
          });

          holdings.push(wardHolding.id, constituencyHolding!.id, countyHolding!.id);
          locationPoints = 50;
          locationScope = 'LOCAL';
        }
      }

      // 3. **ALIGN: YOUR ROLES** (system:general_user)
      const rolesToAssign = ['system:general_user', 'location:national_member'];
      if (wardHolding) {
        rolesToAssign.push('location:ward_member', 'location:constituency_member', 'location:county_member');
      }

      for (const roleName of rolesToAssign) {
        const role = await tx.role.findUnique({ where: { name: roleName } });
        if (role) {
          await tx.userRole.create({
            data: { 
              userId: user.id, 
              roleId: role.id,
              scope: null,
              assignedBy: null
            }
          });
        }
      }

      // 4. **ALIGN: YOUR IMPACTPOINT** (HolderType + LocationScope)
      await tx.impactPoint.create({
        data: {
          id: v4(),
          holderType: 'USER',
          userId: user.id,
          points: locationPoints,
          locationScope,
          description: `Welcome to Ujamaa! ${wardHolding ? 'Ward bonus (+25)' : ''}`,
        }
      });

      // 5. AUDIT
      await logUserAudit({
        userId: user.id,
        field: 'created',
        oldValue: null,
        newValue: JSON.stringify({ 
          email: user.email, 
          holdings: holdings.length || 1,
          impactPoints: locationPoints
        }),
        changedBy: null,
      }, tx);

      return { 
        user, 
        holdings: holdings.length || 1,
        impactPoints: locationPoints,
        assignedRoles: rolesToAssign.length
      };
    });

    EventBus.publish('user.created', { 
      userId: created.user.id, 
      email: created.user.email,
      impactPoints: created.impactPoints
    });

    return created;

  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError('User with this email or wallet already exists', 409);
    }
    throw err;
  }
}

/**
 * updateUser - **UNCHANGED** (keeps existing functionality)
 */
export async function updateUser(id: string, input: UpdateUserInput, changedById?: string) {
  const existing = await UserRepository.findById(id);
  if (!existing) throw new ApiError('User not found', 404);

  await validateUserReferences(input);

  const conflict = await UserRepository.findByEmailOrWallet(input.email, input.walletAddress);
  if (conflict && conflict.id !== id) {
    throw new ApiError('Email or wallet already registered to another account', 409);
  }

  const auditFields = [
    'email', 'phoneNumber', 'walletAddress',
    'constituencyLive', 'countyLive', 'constituencyOrigin', 'countyOrigin', 'name',
  ];

  const oldValues = {} as Record<string, any>;
  for (const f of auditFields) {
    // @ts-ignore
    oldValues[f] = (existing as any)[f] ?? null;
  }

  const dataToUpdate: any = { ...input };
  if (input.goodsServices) {
    dataToUpdate.goodsServices = { set: input.goodsServices.map((gid: string) => ({ id: gid })) };
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const u = await UserRepository.update(id, dataToUpdate, tx);

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

    try {
      EventBus.publish('user.updated', { userId: updated.id, changedBy: changedById ?? null });
    } catch (evtErr) {
      logger.error('user.service.updateUser: EventBus.publish failed', { err: evtErr });
    }

    return updated;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError('Update conflicts with an existing record', 409);
    }
    throw err;
  }
}

/**
 * getUserByWallet - **UNCHANGED**
 */
export async function getUserByWallet(walletAddress: string) {
  const user = await UserRepository.findByWalletAddress(walletAddress);
  if (!user) throw new ApiError('User not found', 404);
  return user;
}