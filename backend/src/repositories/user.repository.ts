/**
 * @file user.repository.ts
 * @description
 * Encapsulates Prisma DB access for User-related queries.
 * Accepts optional transactional client (`tx`) so callers can run operations inside a Prisma transaction.
 *
 * Methods:
 *  - findById, findByEmailOrWallet, create, update, findByWalletAddress
 *
 * Note: `tx` should be a PrismaClient or Prisma.TransactionClient passed from a service using prisma.$transaction(tx => ...) .
 */

import prisma from '../prismaClient.js';
import type { Prisma, User } from '@prisma/client';

type TxClient = Prisma.TransactionClient | typeof prisma;

export const UserRepository = {
  async findById(id: string, tx?: TxClient) {
    const client = tx ?? prisma;
    return client.user.findUnique({
      where: { id },
      include: { privacySettings: true, goodsServices: true },
    });
  },

  async findByEmailOrWallet(email?: string, walletAddress?: string, tx?: TxClient) {
    const client = tx ?? prisma;
    return client.user.findFirst({
      where: {
        OR: [
          email ? { email } : undefined,
          walletAddress ? { walletAddress } : undefined,
        ].filter(Boolean) as object[],
      },
    });
  },

  async create(data: Prisma.UserCreateInput, tx?: TxClient) {
    const client = tx ?? prisma;
    return client.user.create({
      data,
      include: { privacySettings: true, goodsServices: true },
    }) as Promise<User>;
  },

  async update(id: string, data: Prisma.UserUpdateInput, tx?: TxClient) {
    const client = tx ?? prisma;
    return client.user.update({
      where: { id },
      data,
      include: { privacySettings: true, goodsServices: true },
    }) as Promise<User>;
  },

  async findByWalletAddress(walletAddress: string, tx?: TxClient) {
    const client = tx ?? prisma;
    return client.user.findUnique({
      where: { walletAddress },
      include: { privacySettings: true, goodsServices: true },
    });
  },
};