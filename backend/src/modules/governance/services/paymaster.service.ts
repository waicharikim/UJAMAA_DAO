/**
 * @file src/modules/governance/services/paymaster.service.ts
 * @description
 * ERC-7677 paymaster PROXY for gasless, user-signed on-chain governance votes.
 *
 * Why this exists (Phase 5 security pass — pre-mainnet):
 *   The frontend used to call Pimlico directly with NEXT_PUBLIC_PIMLICO_API_KEY,
 *   exposing the sponsorship key in the browser. On a TESTNET that only wastes
 *   test gas; on MAINNET it lets anyone drain the sponsorship balance (real ETH).
 *   This proxy keeps the key server-side and only sponsors a strict allowlist:
 *   a `castVote(bytes32,uint8)` call to the configured GovernanceVoting contract.
 *   Anything else is rejected before it ever reaches Pimlico. A Pimlico-dashboard
 *   sponsorship policy (spend/rate caps via PIMLICO_SPONSORSHIP_POLICY_ID) is the
 *   defense-in-depth backstop.
 *
 * The wallet (Coinbase Smart Wallet) speaks ERC-7677 JSON-RPC to this endpoint:
 *   pm_getPaymasterStubData / pm_getPaymasterData
 *   params = [userOperation, entryPoint, chainId, context?]
 * It is unauthenticated by necessity (the SDK does not carry our JWT) — the
 * callData allowlist is the access control.
 */

import {
  decodeFunctionData,
  getAddress,
  toFunctionSelector,
  type Hex,
} from 'viem';
import { logger } from '../../../core/logger/logger.js';

// ── Config (server-side only) ────────────────────────────────────────────────
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;
const SPONSORSHIP_POLICY_ID = process.env.PIMLICO_SPONSORSHIP_POLICY_ID;

/** Only these ERC-7677 methods may be proxied. */
const ALLOWED_METHODS = new Set([
  'pm_getPaymasterStubData',
  'pm_getPaymasterData',
]);

/** The only contract function we will sponsor. */
const CAST_VOTE_SELECTOR = toFunctionSelector('castVote(bytes32,uint8)');

/** Map an EVM chainId to the Pimlico RPC path segment. */
const CHAIN_SLUG: Record<number, string> = {
  8453: 'base',
  84532: 'base-sepolia',
};

// Coinbase Smart Wallet batch/single execution entrypoints. The userOp.callData
// is one of these; we decode it to inspect the inner call(s).
const SMART_ACCOUNT_EXEC_ABI = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'executeBatch',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
] as const;

export class PaymasterPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymasterPolicyError';
  }
}

interface InnerCall {
  target: string;
  data: Hex;
}

/** True only when sponsorship can be served (key + governance contract set). */
export function isPaymasterConfigured(): boolean {
  return (
    Boolean(PIMLICO_API_KEY) && Boolean(process.env.GOVERNANCE_VOTING_ADDRESS)
  );
}

/**
 * Flatten a Coinbase Smart Wallet userOp.callData into its inner calls.
 * Throws PaymasterPolicyError if the callData is not a recognised exec wrapper.
 */
function decodeInnerCalls(callData: Hex): InnerCall[] {
  let decoded;
  try {
    decoded = decodeFunctionData({
      abi: SMART_ACCOUNT_EXEC_ABI,
      data: callData,
    });
  } catch {
    throw new PaymasterPolicyError(
      'Unrecognised account call (not execute/executeBatch)'
    );
  }

  if (decoded.functionName === 'execute') {
    const [target, , data] = decoded.args as [string, bigint, Hex];
    return [{ target, data }];
  }
  // executeBatch
  const [calls] = decoded.args as [
    readonly { target: string; value: bigint; data: Hex }[],
  ];
  return calls.map((c) => ({ target: c.target, data: c.data }));
}

/**
 * Enforce the sponsorship allowlist on a userOperation's callData: every inner
 * call must be `castVote(...)` to the configured GovernanceVoting contract.
 * Throws PaymasterPolicyError on any violation.
 */
export function assertSponsorableUserOp(userOp: unknown): void {
  const governanceAddress = process.env.GOVERNANCE_VOTING_ADDRESS;
  if (!governanceAddress) {
    throw new PaymasterPolicyError('Governance contract not configured');
  }
  const allowedTarget = getAddress(governanceAddress);

  const callData = (userOp as { callData?: unknown })?.callData;
  if (typeof callData !== 'string' || !callData.startsWith('0x')) {
    throw new PaymasterPolicyError('Missing userOperation callData');
  }

  const calls = decodeInnerCalls(callData as Hex);
  if (calls.length === 0) {
    throw new PaymasterPolicyError('Empty call batch');
  }

  for (const call of calls) {
    let target: string;
    try {
      target = getAddress(call.target);
    } catch {
      throw new PaymasterPolicyError('Invalid call target');
    }
    if (target !== allowedTarget) {
      throw new PaymasterPolicyError(
        'Only governance-contract calls are sponsored'
      );
    }
    const selector = call.data.slice(0, 10).toLowerCase();
    if (selector !== CAST_VOTE_SELECTOR.toLowerCase()) {
      throw new PaymasterPolicyError('Only castVote is sponsored');
    }
  }
}

/** Resolve the Pimlico RPC URL for a given chainId (from the RPC params). */
function pimlicoUrlForChain(chainIdRaw: unknown): string {
  let chainId: number | undefined;
  if (typeof chainIdRaw === 'string') {
    chainId = chainIdRaw.startsWith('0x')
      ? parseInt(chainIdRaw, 16)
      : Number(chainIdRaw);
  } else if (typeof chainIdRaw === 'number') {
    chainId = chainIdRaw;
  }
  const slug = chainId ? CHAIN_SLUG[chainId] : undefined;
  if (!slug) {
    throw new PaymasterPolicyError(
      `Unsupported chainId: ${String(chainIdRaw)}`
    );
  }
  return `https://api.pimlico.io/v2/${slug}/rpc?apikey=${PIMLICO_API_KEY}`;
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown[];
}

function rpcError(id: JsonRpcRequest['id'], code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

/**
 * Handle one ERC-7677 paymaster JSON-RPC request: validate method + allowlist,
 * inject the sponsorship policy, forward to Pimlico with the server-side key,
 * and return Pimlico's JSON-RPC response verbatim. Never throws — always returns
 * a JSON-RPC envelope (the wallet SDK expects that, not an HTTP error).
 */
export async function handlePaymasterRpc(
  body: JsonRpcRequest
): Promise<Record<string, unknown>> {
  const id = body?.id ?? null;

  if (!PIMLICO_API_KEY) {
    return rpcError(
      id,
      -32000,
      'Sponsorship unavailable: paymaster not configured'
    );
  }
  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return rpcError(id, -32600, 'Invalid JSON-RPC request');
  }
  if (!ALLOWED_METHODS.has(body.method)) {
    return rpcError(id, -32601, `Method not allowed: ${body.method}`);
  }

  const params = Array.isArray(body.params) ? [...body.params] : [];
  const userOp = params[0];

  try {
    assertSponsorableUserOp(userOp);
  } catch (err) {
    const message =
      err instanceof PaymasterPolicyError
        ? err.message
        : 'Sponsorship policy rejected';
    logger.warn(
      { method: body.method, message },
      '[Paymaster] rejected sponsorship request'
    );
    return rpcError(id, -32002, message);
  }

  // Inject the sponsorship policy into the ERC-7677 context (last param).
  if (SPONSORSHIP_POLICY_ID) {
    const ctx = (params[3] as Record<string, unknown> | undefined) ?? {};
    params[3] = { ...ctx, sponsorshipPolicyId: SPONSORSHIP_POLICY_ID };
  }

  let url: string;
  try {
    url = pimlicoUrlForChain(params[2]);
  } catch (err) {
    const message =
      err instanceof PaymasterPolicyError ? err.message : 'Unsupported chain';
    return rpcError(id, -32602, message);
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: body.method,
        params,
      }),
    });
    const json = (await upstream.json()) as Record<string, unknown>;
    return json;
  } catch (err) {
    logger.error({ err }, '[Paymaster] upstream Pimlico request failed');
    return rpcError(id, -32603, 'Paymaster upstream error');
  }
}
