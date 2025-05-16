/**
 * @file auth.controller.ts
 * @description Express controller handling authentication endpoints:
 *  - Fetching nonce for wallet-based authentication challenge
 *  - Verifying signature and issuing JWT tokens
 *
 * Includes input validation, error handling, and logging.
 */

import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
/**
 * Handler to get the current nonce for a wallet address
 * Used as a challenge for wallet signature authentication.
 * Expects walletAddress as a query parameter.
 */
export async function getNonceHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress } = req.query;

    if (typeof walletAddress !== 'string' || !walletAddress.trim()) {
      logger.warn('getNonceHandler: Missing or invalid walletAddress query param', { query: req.query });
      throw new ApiError('walletAddress query parameter is required', 400);
    }

    logger.info('getNonceHandler: Processing nonce request', { walletAddress });

    const nonce = await authService.getNonce(walletAddress.toLowerCase());
    res.json({ nonce });

    logger.info('getNonceHandler: Successfully returned nonce', { walletAddress });
  } catch (err) {
    logger.error('getNonceHandler: Error retrieving nonce', { error: err });
    next(err);
  }
}

/**
 * Handler to verify signed nonce and authenticate user.
 * Expects JSON body with walletAddress and signature.
 */
export async function verifySignatureHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress, signature } = req.body;

    if (!walletAddress || typeof walletAddress !== 'string' || !walletAddress.trim()) {
      logger.warn('verifySignatureHandler: Missing or invalid walletAddress in body', { body: req.body });
      throw new ApiError('walletAddress is required in request body', 400);
    }
    if (!signature || typeof signature !== 'string' || !signature.trim()) {
      logger.warn('verifySignatureHandler: Missing or invalid signature in body', { body: req.body });
      throw new ApiError('signature is required in request body', 400);
    }

    logger.info('verifySignatureHandler: Verifying signature', { walletAddress });

    // Normalize wallet address to lowercase before verification for consistency
    const normalizedWallet = walletAddress.toLowerCase();

    const { token, user } = await authService.verifySignature(normalizedWallet, signature);

    res.json({ token, user });
    logger.info('verifySignatureHandler: Signature verified successfully', { walletAddress });
  } catch (err) {
    logger.error('verifySignatureHandler: Signature verification failed', { error: err, body: req.body });
    next(err);
  }
}