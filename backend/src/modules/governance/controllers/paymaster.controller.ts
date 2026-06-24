/**
 * @file src/modules/governance/controllers/paymaster.controller.ts
 * @description
 * ERC-7677 paymaster proxy HTTP handler. Always responds 200 with a JSON-RPC
 * envelope (result or error) — the Coinbase Smart Wallet SDK expects JSON-RPC,
 * not HTTP error codes. Unauthenticated by design; access control is the
 * castVote-only allowlist enforced in the service.
 */

import type { Request, Response } from 'express';
import { handlePaymasterRpc } from '../services/paymaster.service.js';

export async function paymasterProxy(req: Request, res: Response): Promise<void> {
  const result = await handlePaymasterRpc(req.body);
  res.status(200).json(result);
}
