/**
 * @file src/core/blockchain/erc1271.ts
 * @description
 * Smart-account signature verification — EOA, ERC-1271, and ERC-6492.
 *
 * EOA wallets sign with a recoverable ECDSA signature. Smart accounts (e.g.
 * Coinbase Smart Wallet, controlled by a device passkey) have no recoverable
 * signer; the account contract decides validity via ERC-1271. And a brand-new
 * smart account is COUNTERFACTUAL (not yet deployed) until its first on-chain
 * action — its signatures are wrapped per ERC-6492, which a verifier can check
 * without deploying anything.
 *
 * viem's `verifyMessage` handles all three transparently (it runs the ERC-6492
 * "deploy-and-verify" simulation via eth_call), so a fresh Coinbase Smart Wallet
 * can link its address with NO prior deploy transaction — removing a wallet
 * popup from the user flow.
 */

import { createPublicClient, http, type Address, type Hex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { logger } from '../logger/logger.js';

function makeClient() {
  const rpcUrl = process.env.BASE_RPC_URL;
  if (!rpcUrl) return null;
  // TODO(mainnet): select chain from env when we deploy to Base mainnet.
  return createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
}

// Typed from the factory's own return so the chain-specific client assigns cleanly.
let client: ReturnType<typeof makeClient> = null;

function getClient() {
  if (client === null) client = makeClient();
  return client;
}

/**
 * Verify that `signature` over `message` proves control of `address`, covering
 * EOA, ERC-1271 (deployed smart account), and ERC-6492 (counterfactual smart
 * account). Returns false (never throws) on any failure.
 *
 * @param address   Wallet / smart-account address.
 * @param message   The plaintext personal_sign message that was signed.
 * @param signature The signature bytes (hex) — may be ERC-6492-wrapped.
 */
export async function verifyErc1271Signature(
  address: string,
  message: string,
  signature: string
): Promise<boolean> {
  const c = getClient();
  if (!c) return false;

  try {
    return await c.verifyMessage({
      address: address as Address,
      message,
      signature: signature as Hex,
    });
  } catch (err) {
    logger.warn(
      { err, address },
      '[signature] smart-account verification failed'
    );
    return false;
  }
}
