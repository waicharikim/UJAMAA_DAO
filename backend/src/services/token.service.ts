import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import { TokenBalanceUpdate } from '../validation/impact.validation.js';
import logger from '../utils/logger.js';

/**
 * Update token balance for a user or group.
 * Amount can be positive or negative.
 */
export async function updateTokenBalance(data: TokenBalanceUpdate) {
  const { holderType, holderId, amount } = data;

  logger.info('updateTokenBalance called', { holderType, holderId, amount });

  if (holderType === 'USER') {
    const tokenBalance = await prisma.tokenBalance.upsert({
      where: { holderType_userId: { holderType, userId: holderId } }, // Unique constraint for users
      create: {
        holderType,
        userId: holderId,
        balance: amount,
      },
      update: {
        balance: { increment: amount },
        updatedAt: new Date(),
      },
    });

    if (tokenBalance.balance < 0) {
      logger.error('Token balance cannot be negative', { tokenBalance });
      throw new ApiError('Token balance cannot be negative', 400);
    }

    logger.info('Token balance updated for user', { tokenBalance });
    return tokenBalance;
  } else if (holderType === 'GROUP') {
    const tokenBalance = await prisma.tokenBalance.upsert({
      where: { holderType_groupId: { holderType, groupId: holderId } }, // Unique constraint for groups
      create: {
        holderType,
        groupId: holderId,
        balance: amount,
      },
      update: {
        balance: { increment: amount },
        updatedAt: new Date(),
      },
    });

    if (tokenBalance.balance < 0) {
      logger.error('Token balance cannot be negative', { tokenBalance });
      throw new ApiError('Token balance cannot be negative', 400);
    }

    logger.info('Token balance updated for group', { tokenBalance });
    return tokenBalance;
  } else {
    logger.error('Invalid holderType for token balance update', { holderType });
    throw new ApiError('Invalid holderType', 400);
  }
}

/**
 * Get current token balance for a holder.
 */
export async function getTokenBalance(holderType: 'USER' | 'GROUP', holderId: string) {
  logger.info('getTokenBalance called', { holderType, holderId });

  if (holderType === 'USER') {
    const tokenBalance = await prisma.tokenBalance.findFirst({
      where: { holderType, userId: holderId },
    });
    logger.info('Token balance retrieved for user', { balance: tokenBalance?.balance ?? 0 });
    return tokenBalance?.balance ?? 0;
  } else if (holderType === 'GROUP') {
    const tokenBalance = await prisma.tokenBalance.findFirst({
      where: { holderType, groupId: holderId },
    });
    logger.info('Token balance retrieved for group', { balance: tokenBalance?.balance ?? 0 });
    return tokenBalance?.balance ?? 0;
  } else {
    logger.error('Invalid holderType for getting token balance', { holderType });
    throw new ApiError('Invalid holderType', 400);
  }
}