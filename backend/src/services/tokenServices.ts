// backend/src/services/tokenService.ts

import prisma from '../prismaClient.js';

/**
 * Enum to represent the holder type for token balances.
 * Must correspond with the HolderType enum in the Prisma schema.
 */
export enum HolderType {
  USER = 'USER',
  GROUP = 'GROUP',
}

/**
 * Fetch the current token balance for a holder (user or group).
 * If the balance record does not exist, create it with zero balance.
 * 
 * @param holderType - 'USER' | 'GROUP'
 * @param holderId - ID of the user or group
 * @returns Promise<number> - the token balance
 */
export async function getTokenBalance(holderType: HolderType, holderId: string): Promise<number> {
  let tokenRecord = await prisma.tokenBalance.findUnique({
    where: {
      holderType_holderId: {
        holderType,
        holderId,
      },
    },
  });

  if (!tokenRecord) {
    tokenRecord = await prisma.tokenBalance.create({
      data: {
        holderType,
        holderId,
        balance: 0,
      },
    });
  }

  return tokenRecord.balance;
}

/**
 * Deduct tokens from the holder's balance in an atomic transaction.
 * Throws an error if the balance is insufficient.
 * 
 * @param holderType - 'USER' | 'GROUP'
 * @param holderId - ID of the user or group
 * @param amount - Number of tokens to deduct
 * @throws Error when amount is not positive or balance too low
 * @returns Promise<number> - updated balance after deduction
 */
export async function deductTokens(holderType: HolderType, holderId: string, amount: number): Promise<number> {
  if (amount <= 0) {
    throw new Error('Deduction amount must be positive');
  }

  return await prisma.$transaction(async (tx) => {
    const record = await tx.tokenBalance.findUnique({
      where: {
        holderType_holderId: {
          holderType,
          holderId,
        },
      },
     /**lock: {
        mode: 'Update', // Explicit row lock for transaction safety
      },
     */ 
    });

    if (!record) {
      throw new Error('TokenBalance record not found');
    }

    if (record.balance < amount) {
      throw new Error('Insufficient token balance');
    }

    const updated = await tx.tokenBalance.update({
      where: {
        holderType_holderId: {
          holderType,
          holderId,
        },
      },
      data: {
        balance: record.balance - amount,
      },
    });

    return updated.balance;
  });
}

/**
 * Mint (add) tokens to the holder's balance.
 * Creates a balance record if it doesn’t exist.
 * 
 * @param holderType - 'USER' | 'GROUP'
 * @param holderId - ID of the user or group
 * @param amount - Number of tokens to add
 * @throws Error when amount is not positive
 * @returns Promise<number> - updated balance after mint
 */
export async function mintTokens(holderType: HolderType, holderId: string, amount: number): Promise<number> {
  if (amount <= 0) {
    throw new Error('Mint amount must be positive');
  }

  return await prisma.$transaction(async (tx) => {
    let record = await tx.tokenBalance.findUnique({
      where: {
        holderType_holderId: {
          holderType,
          holderId,
        },
      },
     // lock: {
       // mode: 'Update',
     // },
    });

    if (!record) {
      record = await tx.tokenBalance.create({
        data: {
          holderType,
          holderId,
          balance: 0,
        },
      });
    }

    const updated = await tx.tokenBalance.update({
      where: {
        holderType_holderId: {
          holderType,
          holderId,
        },
      },
      data: {
        balance: record.balance + amount,
      },
    });

    return updated.balance;
  });
}