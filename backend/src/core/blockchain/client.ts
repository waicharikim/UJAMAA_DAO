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
let prAbi: any[] | null = null;
let utAbi: any[] | null = null;
let govAbi: any[] | null = null;
let treasuryAbi: any[] | null = null;
let projectRegistryAbi: any[] | null = null;

function loadAbis(): void {
  if (prAbi && utAbi && govAbi && treasuryAbi && projectRegistryAbi) return;
  try {
    prAbi = require('./abis/PrToken.json').abi;
    utAbi = require('./abis/UtToken.json').abi;
    govAbi = require('./abis/GovernanceVoting.json').abi;
    treasuryAbi = require('./abis/GroupTreasury.json').abi;
    projectRegistryAbi = require('./abis/ProjectRegistry.json').abi;
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

/**
 * Read-only provider for on-chain reads that don't need the minter key
 * (e.g. ERC-1271 smart-account signature verification). Only requires
 * BASE_RPC_URL. Returns null when no RPC is configured.
 */
let readProvider: ethers.JsonRpcProvider | null = null;
export function getReadProvider(): ethers.JsonRpcProvider | null {
  if (readProvider) return readProvider;
  if (provider) {
    readProvider = provider;
    return readProvider;
  }
  const rpcUrl = process.env.BASE_RPC_URL;
  if (!rpcUrl) return null;
  try {
    readProvider = new ethers.JsonRpcProvider(rpcUrl);
    return readProvider;
  } catch (err) {
    logger.warn({ err }, '[Blockchain] Failed to initialise read provider');
    return null;
  }
}

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

/**
 * Returns a connected GovernanceVoting contract instance, or null if not configured.
 */
export function getGovernanceContract(): ethers.Contract | null {
  loadAbis();
  if (!govAbi) return null;

  const govAddress = process.env.GOVERNANCE_VOTING_ADDRESS;
  if (!govAddress) return null;

  const connection = getSignerAndProvider();
  if (!connection) return null;

  try {
    return new ethers.Contract(govAddress, govAbi, connection.signer);
  } catch (err) {
    logger.warn(
      { err },
      '[Blockchain] Failed to instantiate GovernanceVoting contract'
    );
    return null;
  }
}

/**
 * Returns a connected GroupTreasury (anchor) contract instance, or null if not
 * configured. Dormant until TREASURY_CONTRACT_ADDRESS + a real MINTER_PRIVATE_KEY
 * are set on the worker — exactly like getGovernanceContract.
 */
export function getTreasuryContract(): ethers.Contract | null {
  loadAbis();
  if (!treasuryAbi) return null;

  const treasuryAddress = process.env.TREASURY_CONTRACT_ADDRESS;
  if (!treasuryAddress) return null;

  const connection = getSignerAndProvider();
  if (!connection) return null;

  try {
    return new ethers.Contract(treasuryAddress, treasuryAbi, connection.signer);
  } catch (err) {
    logger.warn(
      { err },
      '[Blockchain] Failed to instantiate GroupTreasury contract'
    );
    return null;
  }
}

/**
 * Returns a connected ProjectRegistry (anchor) contract instance, or null if not
 * configured. Dormant until PROJECT_REGISTRY_ADDRESS + a real MINTER_PRIVATE_KEY
 * are set on the worker — exactly like getTreasuryContract / getGovernanceContract.
 */
export function getProjectRegistryContract(): ethers.Contract | null {
  loadAbis();
  if (!projectRegistryAbi) return null;

  const address = process.env.PROJECT_REGISTRY_ADDRESS;
  if (!address) return null;

  const connection = getSignerAndProvider();
  if (!connection) return null;

  try {
    return new ethers.Contract(address, projectRegistryAbi, connection.signer);
  } catch (err) {
    logger.warn(
      { err },
      '[Blockchain] Failed to instantiate ProjectRegistry contract'
    );
    return null;
  }
}
