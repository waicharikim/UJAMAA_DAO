import prisma from '../src/prismaClient.js';

/**
 * Sets the user's token balance to an exact amount.
 * Creates token balance record if not exists.
 * @param userId string ID of user
 * @param amount number token balance to set (>=0)
 */
export async function setUserTokenBalance(userId: string, amount: number) {
  const existing = await prisma.tokenBalance.findFirst({
    where: { holderType: 'USER', userId },
  });

  if (existing) {
    return await prisma.tokenBalance.update({
      where: { id: existing.id },
      data: { balance: amount },
    });
  } else {
    return await prisma.tokenBalance.create({
      data: { holderType: 'USER', userId, balance: amount },
    });
  }
}