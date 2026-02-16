/**
 * @file src/modules/auth/handlers/wallet.handlers.ts
 * @description
 * Request handlers for wallet authentication
 * 
 * Version: 2.1 — January 2026
 */

import { Response } from "express";
import { AuthRequest } from "../../../core/types/Ujamaadao.types.js";
import { walletService } from "../services/wallet.service.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { env } from "../../../core/utils/env.js";

/**
 * POST /auth/wallet/nonce
 * Generate nonce for wallet signature
 */
export async function generateNonce(req: AuthRequest, res: Response) {
  const { walletAddress } = req.body;

  const nonce = await walletService.generateNonce(walletAddress, req.correlationId);

  const message = `Welcome to UjamaaDAO!\n\nSign this message to authenticate.\n\nNonce: ${nonce}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;

  sendSuccess(
    res,
    {
      nonce,
      message,
      expiresIn: 300, // 5 minutes
    },
    "Nonce generated successfully",
    200
  );
}

/**
 * POST /auth/wallet/verify
 * Verify wallet signature and login
 */
export async function verifySignature(req: AuthRequest, res: Response) {
  const { walletAddress, signature } = req.body;

  const context = {
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };

  const result = await walletService.verifyAndLogin(
    walletAddress,
    signature,
    context,
    req.correlationId
  );

  sendSuccess(
    res,
    result,
    result.needsProfileCompletion
      ? "Wallet verified. Please complete your profile."
      : "Wallet authentication successful. Welcome!",
    200
  );
}

/**
 * POST /auth/wallet/link
 * Link wallet to existing account
 */
export async function linkWallet(req: AuthRequest, res: Response) {
  const { walletAddress, signature } = req.body;
  const userId = req.user!.userId;

  await walletService.linkWallet(userId, walletAddress, signature, req.correlationId);

  sendSuccess(
    res,
    { success: true },
    "Wallet linked successfully",
    200
  );
}

/**
 * DELETE /auth/wallet/disconnect
 * Disconnect wallet from account
 */
export async function disconnectWallet(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  await walletService.disconnectWallet(userId, req.correlationId);

  sendSuccess(
    res,
    { success: true },
    "Wallet disconnected successfully",
    200
  );
}