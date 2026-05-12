/**
 * @file src/core/blockchain/client.ts
 * @description
 * Blockchain client — ethers v6 wrappers for PrToken and UtToken contracts.
 *
 * Returns null (no crash) when any of these are true:
 *   - MINTER_PRIVATE_KEY is not set or is the dev zero-key placeholder (0x0000…)
 *   - BASE_RPC_URL is not set
 *   - PR_TOKEN_ADDRESS / UT_TOKEN_ADDRESS is not set or empty
 *
 * This triple-guard means:
 *   - All existing backend tests pass unchanged (NODE_ENV=test guard is in the caller)
 *   - Users without linked wallets are unaffected
 *   - Off-chain operations are never blocked by on-chain failures
 */

import { ethers } from 'ethers';
import { createRequire } from 'module';
import { logger } from '../logger/logger.js';

const require = createRequire(import.meta.url);

// ── ABI loading ─────────────────────────────────────────────────────────────
// Compiled by `forge build` — committed under contracts/out/
let prAbi: any[] | null = null;
let utAbi: any[] | null = null;

function loadAbis(): void {
  if (prAbi && utAbi) return;
  try {
    const prArtifact = require('./abis/PrToken.json');
    const utArtifact = require('./abis/UtToken.json');
    prAbi = prArtifact.abi;
    utAbi = utArtifact.abi;
  } catch (err) {
    logger.warn(
      { err },
      '[Blockchain] ABI artifacts not found — run `forge build` in contracts/'
    );
  }
}

// ── Null-guard helper ────────────────────────────────────────────────────────
function isPlaceholderKey(key: string): boolean {
  // Dev placeholder: 0x followed by all zeros
  return /^0x0{62,64}$/.test(key);
}

// ── Provider + signer (singleton per process) ────────────────────────────────
let provider: ethers.JsonRpcProvider | null = null;
let signer: ethers.Wallet | null = null;

function getSignerAndProvider(): {
  provider: ethers.JsonRpcProvider;
  signer: ethers.Wallet;
} | null {
  if (provider && signer) return { provider, signer };

  const rpcUrl = process.env.BASE_RPC_URL;
  const privateKey = process.env.MINTER_PRIVATE_KEY;

  if (!rpcUrl || !privateKey) return null;
  if (isPlaceholderKey(privateKey)) return null;

  try {
    provider = new ethers.JsonRpcProvider(rpcUrl);
    signer = new ethers.Wallet(privateKey, provider);
    return { provider, signer };
  } catch (err) {
    logger.warn({ err }, '[Blockchain] Failed to initialise provider/signer');
    return null;
  }
}

// ── Public contract getters ──────────────────────────────────────────────────

/**
 * Returns a connected PrToken contract instance, or null if not configured.
 */
export function getPrContract(): ethers.Contract | null {
  loadAbis();
  if (!prAbi) return null;

  const prAddress = process.env.PR_TOKEN_ADDRESS;
  if (!prAddress) return null;

  const connection = getSignerAndProvider();
  if (!connection) return null;

  try {
    return new ethers.Contract(prAddress, prAbi, connection.signer);
  } catch (err) {
    logger.warn({ err }, '[Blockchain] Failed to instantiate PrToken contract');
    return null;
  }
}

/**
 * Returns a connected UtToken contract instance, or null if not configured.
 */
export function getUtContract(): ethers.Contract | null {
  loadAbis();
  if (!utAbi) return null;

  const utAddress = process.env.UT_TOKEN_ADDRESS;
  if (!utAddress) return null;

  const connection = getSignerAndProvider();
  if (!connection) return null;

  try {
    return new ethers.Contract(utAddress, utAbi, connection.signer);
  } catch (err) {
    logger.warn({ err }, '[Blockchain] Failed to instantiate UtToken contract');
    return null;
  }
}
