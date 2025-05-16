import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function getNonceHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { walletAddress } = req.query;
    if (typeof walletAddress !== 'string') {
      throw new ApiError('walletAddress query parameter is required', 400);
    }
    const nonce = await authService.getNonce(walletAddress);
    res.json({ nonce });
  } catch (err) {
    next(err);
  }
}

export async function verifySignatureHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { walletAddress, signature } = req.body;
    if (!walletAddress || !signature) {
      throw new ApiError('walletAddress and signature are required in body', 400);
    }
    const { token, user } = await authService.verifySignature(walletAddress, signature);
    res.json({ token, user });
  } catch (err) {
    next(err);
  }
}