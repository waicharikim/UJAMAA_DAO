// backend/src/services/impactPointService.ts

import prisma from '../prismaClient.js';

/**
 * Reuse HolderType enum from tokens.
 */
export enum HolderType {
  USER = 'USER',
  GROUP = 'GROUP',
}

/**
 * Get the current impact points for a holder (user or group).
 * Creates an entry if none exists, starting from zero.
 *
 * @param holderType 'USER' | 'GROUP'
 * @param holderId string
 * @returns number current points
 */
export async function getImpactPoints(holderType: HolderType, holderId: string): Promise<number> {
  let record = await prisma.impactPoint.findUnique({
    where: {
      holderType_holderId: {
        holderType,
        holderId,
      },
    },
  });

  if (!record) {
    record = await prisma.impactPoint.create({
      data: {
        holderType,
        holderId,
        points: 0,
      },
    });
  }

  return record.points;
}

/**
 * Add impact points to a holder atomically.
 * Points accumulate and do not decrease.
 *
 * @param holderType 'USER' | 'GROUP'
 * @param holderId string
 * @param amount number of points to add (must be positive)
 * @returns updated point balance
 */
export async function addImpactPoints(holderType: HolderType, holderId: string, amount: number): Promise<number> {
  if (amount <= 0) {
    throw new Error('Amount to add must be positive');
  }

  return await prisma.$transaction(async (tx) => {
    let record = await tx.impactPoint.findUnique({
      where: { holderType_holderId: { holderType, holderId } },
  //    lock: { mode: 'Update' },
    });

    if (!record) {
      record = await tx.impactPoint.create({
        data: { holderType, holderId, points: 0 },
      });
    }

    const updated = await tx.impactPoint.update({
      where: { holderType_holderId: { holderType, holderId } },
      data: { points: record.points + amount },
    });

    return updated.points;
  });
}