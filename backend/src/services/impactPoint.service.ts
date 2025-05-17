import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import { ImpactPointUpdate } from '../validation/impact.validation.js';
import logger from '../utils/logger.js';

/**
 * Adds or subtracts impact points for a user or group.
 * Requires using separate unique keys for user/group impact points.
 */
export async function addImpactPoints(data: ImpactPointUpdate) {
  const { holderType, holderId, points, locationScope, constituency, county } = data;

  logger.info('addImpactPoints called with data', data);

  try {
    if (holderType === 'USER') {
      const impactPoint = await prisma.impactPoint.upsert({
        where: {
          holderType_userId_locationScope: {
            holderType,
            userId: holderId,
            locationScope: locationScope ?? null,
          },
        },
        create: {
          holderType,
          userId: holderId,
          points,
          locationScope,
          constituency,
          county,
        },
        update: {
          points: { increment: points },
          updatedAt: new Date(),
        },
      });

      if (impactPoint.points < 0) {
        logger.error('Impact points became negative for user', { impactPoint });
        throw new ApiError('Impact points cannot be negative', 400);
      }

      logger.info('ImpactPoint updated for user', { impactPoint });
      return impactPoint;
    } else if (holderType === 'GROUP') {
      const impactPoint = await prisma.impactPoint.upsert({
        where: {
          holderType_groupId_locationScope: {
            holderType,
            groupId: holderId,
            locationScope: locationScope ?? null,
          },
        },
        create: {
          holderType,
          groupId: holderId,
          points,
          locationScope,
          constituency,
          county,
        },
        update: {
          points: { increment: points },
          updatedAt: new Date(),
        },
      });

      if (impactPoint.points < 0) {
        logger.error('Impact points became negative for group', { impactPoint });
        throw new ApiError('Impact points cannot be negative', 400);
      }

      logger.info('ImpactPoint updated for group', { impactPoint });
      return impactPoint;
    } else {
      logger.error('Invalid holderType in addImpactPoints', { holderType });
      throw new ApiError('Invalid holderType', 400);
    }
  } catch (err) {
    if (err instanceof Error) {
      logger.error('Error in addImpactPoints service', {
        message: err.message,
        stack: err.stack,
        inputData: data,
      });
    } else {
      logger.error('Unknown error in addImpactPoints service', { error: err, inputData: data });
    }
    throw err;
  }
}

/**
 * Gets impact points for a user or group.
 */
export async function getImpactPoints(
  holderType: 'USER' | 'GROUP',
  holderId: string,
  locationScope?: string | null
) {
  try {
    if (holderType === 'USER') {
      const impactPoint = await prisma.impactPoint.findFirst({
        where: {
          holderType,
          userId: holderId,
          locationScope: locationScope ?? undefined,
        },
      });
      const points = impactPoint?.points ?? 0;
      logger.info('Retrieved impact points for user', { holderId, locationScope, points });
      return points;
    } else if (holderType === 'GROUP') {
      const impactPoint = await prisma.impactPoint.findFirst({
        where: {
          holderType,
          groupId: holderId,
          locationScope: locationScope ?? undefined,
        },
      });
      const points = impactPoint?.points ?? 0;
      logger.info('Retrieved impact points for group', { holderId, locationScope, points });
      return points;
    } else {
      logger.error('Invalid holderType in getImpactPoints', { holderType });
      throw new ApiError('Invalid holderType', 400);
    }
  } catch (err) {
    if (err instanceof Error) {
      logger.error('Error retrieving impact points', {
        message: err.message,
        stack: err.stack,
        holderType,
        holderId,
        locationScope,
      });
    } else {
      logger.error('Unknown error retrieving impact points', { error: err });
    }
    throw err;
  }
}