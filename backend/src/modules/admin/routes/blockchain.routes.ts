/**
 * @file src/modules/admin/routes/blockchain.routes.ts
 * @description
 * Blockchain Admin Routes — BLOCKCHAIN_ADMIN / SUPER_ADMIN gated
 *
 * Endpoints:
 *   GET  /admin/blockchain/status/:userId    — on-chain vs off-chain balance diff
 *   POST /admin/blockchain/reconcile/:userId — catch-up mint to correct drift
 *   POST /admin/blockchain/grant-role        — grant contract role to an address
 *   POST /admin/blockchain/revoke-role       — revoke contract role from an address
 */

import { Router } from 'express';
import { z } from 'zod';
import { ethers } from 'ethers';
import { asyncHandler } from '../../../core/utils/response.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { authorize } from '../../../core/middleware/authorize.js';
import { SystemRoles } from '../../../core/rbac/roles.js';
import { buildRateLimiter } from '../../../core/middleware/rateLimiter.js';
import {
  getPrContract,
  getUtContract,
  getGovernanceContract,
} from '../../../core/blockchain/client.js';
import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';

const router = Router();

const BLOCKCHAIN_ROLES = [
  SystemRoles.BLOCKCHAIN_ADMIN,
  SystemRoles.SUPER_ADMIN,
];

// Auth + role guard on all blockchain admin routes
router.use(authenticate);
router.use(authorize({ allowedRoles: BLOCKCHAIN_ROLES }));
router.use(buildRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 }));

// ─── Validators ───────────────────────────────────────────────────────────────

const userIdParam = z.object({ userId: z.string().uuid() });

const roleActionSchema = z.object({
  contract: z.enum(['PR', 'UT', 'GOVERNANCE']),
  role: z.string().min(1),
  address: z.string().refine((a) => ethers.isAddress(a), {
    message: 'Invalid Ethereum address',
  }),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getContract(name: 'PR' | 'UT' | 'GOVERNANCE') {
  switch (name) {
    case 'PR':
      return getPrContract();
    case 'UT':
      return getUtContract();
    case 'GOVERNANCE':
      return getGovernanceContract();
  }
}

async function fetchOnChainBalance(
  contract: ethers.Contract,
  walletAddress: string
): Promise<bigint> {
  try {
    return await contract.balanceOf(walletAddress);
  } catch {
    return 0n;
  }
}

// ─── GET /admin/blockchain/status/:userId ─────────────────────────────────────
// Returns off-chain balances and live on-chain balances for comparison.

router.get(
  '/status/:userId',
  validateRequest({ schema: userIdParam, target: 'params' }),
  asyncHandler(async (req, res) => {
    const { userId } = req.params as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        walletAddress: true,
        participationRights: true,
        fiatBackedUtBalance: true,
      },
    });
    if (!user) throw ApiError.notFound('User', userId);

    const result: Record<string, unknown> = {
      userId,
      walletAddress: user.walletAddress ?? null,
      offChain: {
        pr: user.participationRights,
        ut: user.fiatBackedUtBalance,
      },
      onChain: null,
      drift: null,
    };

    if (user.walletAddress) {
      const prContract = getPrContract();
      const utContract = getUtContract();

      const prOnChainWei = prContract
        ? await fetchOnChainBalance(prContract, user.walletAddress)
        : null;
      const utOnChainWei = utContract
        ? await fetchOnChainBalance(utContract, user.walletAddress)
        : null;

      const prOnChain =
        prOnChainWei !== null ? Number(prOnChainWei / BigInt(10 ** 18)) : null;
      const utOnChain =
        utOnChainWei !== null ? Number(utOnChainWei / BigInt(10 ** 18)) : null;

      result.onChain = { pr: prOnChain, ut: utOnChain };
      result.drift = {
        pr: prOnChain !== null ? user.participationRights - prOnChain : null,
        ut: utOnChain !== null ? user.fiatBackedUtBalance - utOnChain : null,
      };
    }

    res.json(result);
  })
);

// ─── POST /admin/blockchain/reconcile/:userId ─────────────────────────────────
// Mint the exact drift amount on-chain so balances match the DB.

router.post(
  '/reconcile/:userId',
  buildRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }),
  validateRequest({ schema: userIdParam, target: 'params' }),
  asyncHandler(async (req, res) => {
    const { userId } = req.params as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        walletAddress: true,
        participationRights: true,
        fiatBackedUtBalance: true,
      },
    });
    if (!user) throw ApiError.notFound('User', userId);
    if (!user.walletAddress)
      throw ApiError.badRequest('User has no linked wallet');

    const prContract = getPrContract();
    const utContract = getUtContract();
    const minted: Record<string, number> = {};

    if (prContract) {
      const onChainWei = await fetchOnChainBalance(
        prContract,
        user.walletAddress
      );
      const onChain = Number(onChainWei / BigInt(10 ** 18));
      const drift = user.participationRights - onChain;
      if (drift > 0) {
        await prContract.mint(
          user.walletAddress,
          BigInt(drift) * BigInt(10 ** 18)
        );
        minted.pr = drift;
        logger.info(
          { userId, drift },
          '[BLOCKCHAIN] Admin reconcile — PR minted'
        );
      }
    }

    if (utContract) {
      const onChainWei = await fetchOnChainBalance(
        utContract,
        user.walletAddress
      );
      const onChain = Number(onChainWei / BigInt(10 ** 18));
      const drift = user.fiatBackedUtBalance - onChain;
      if (drift > 0) {
        await utContract.mint(
          user.walletAddress,
          BigInt(drift) * BigInt(10 ** 18)
        );
        minted.ut = drift;
        logger.info(
          { userId, drift },
          '[BLOCKCHAIN] Admin reconcile — UT minted'
        );
      }
    }

    res.json({ ok: true, minted });
  })
);

// ─── POST /admin/blockchain/grant-role ────────────────────────────────────────
// Grant a contract AccessControl role to an Ethereum address.

router.post(
  '/grant-role',
  buildRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }),
  validateRequest({ schema: roleActionSchema, target: 'body' }),
  asyncHandler(async (req, res) => {
    const {
      contract: contractName,
      role,
      address,
    } = req.body as z.infer<typeof roleActionSchema>;

    const contract = getContract(contractName);
    if (!contract)
      throw ApiError.badRequest(`${contractName} contract not configured`);

    const roleBytes32 = ethers.keccak256(ethers.toUtf8Bytes(role));
    const tx = await contract.grantRole(roleBytes32, address);
    await tx.wait();

    logger.info({ contractName, role, address }, '[BLOCKCHAIN] Role granted');
    res.json({ ok: true, txHash: tx.hash });
  })
);

// ─── POST /admin/blockchain/revoke-role ───────────────────────────────────────
// Revoke a contract AccessControl role from an Ethereum address.

router.post(
  '/revoke-role',
  buildRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }),
  validateRequest({ schema: roleActionSchema, target: 'body' }),
  asyncHandler(async (req, res) => {
    const {
      contract: contractName,
      role,
      address,
    } = req.body as z.infer<typeof roleActionSchema>;

    const contract = getContract(contractName);
    if (!contract)
      throw ApiError.badRequest(`${contractName} contract not configured`);

    const roleBytes32 = ethers.keccak256(ethers.toUtf8Bytes(role));
    const tx = await contract.revokeRole(roleBytes32, address);
    await tx.wait();

    logger.info({ contractName, role, address }, '[BLOCKCHAIN] Role revoked');
    res.json({ ok: true, txHash: tx.hash });
  })
);

export default router;
