/**
 * @file tests/governance/paymaster.service.test.ts
 * @description Unit tests for the ERC-7677 paymaster allowlist. This is the
 * security boundary: the proxy must sponsor ONLY castVote() calls to the
 * configured GovernanceVoting contract, and reject everything else before any
 * request reaches Pimlico (and thus before any real gas is spent on mainnet).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { encodeFunctionData, getAddress, padHex, type Hex } from 'viem';
import {
  assertSponsorableUserOp,
  PaymasterPolicyError,
} from '../../src/modules/governance/services/paymaster.service.js';

const GOV = getAddress('0x27dd8dc84244f643a7c5904bBb61c21C387231e5');
const OTHER = getAddress('0x000000000000000000000000000000000000dEaD');
const PROPOSAL_ID = padHex('0x1234', { size: 32 });

const CAST_VOTE_ABI = [
  {
    type: 'function',
    name: 'castVote',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'bytes32' },
      { name: 'option', type: 'uint8' },
    ],
    outputs: [],
  },
] as const;

const TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

const EXEC_ABI = [
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

const castVoteData = (): Hex =>
  encodeFunctionData({ abi: CAST_VOTE_ABI, functionName: 'castVote', args: [PROPOSAL_ID, 0] });

const transferData = (): Hex =>
  encodeFunctionData({ abi: TRANSFER_ABI, functionName: 'transfer', args: [OTHER, 1n] });

const execute = (target: string, data: Hex): Hex =>
  encodeFunctionData({
    abi: EXEC_ABI,
    functionName: 'execute',
    args: [target as `0x${string}`, 0n, data],
  });

const executeBatch = (calls: { target: string; data: Hex }[]): Hex =>
  encodeFunctionData({
    abi: EXEC_ABI,
    functionName: 'executeBatch',
    args: [calls.map((c) => ({ target: c.target as `0x${string}`, value: 0n, data: c.data }))],
  });

describe('paymaster allowlist — assertSponsorableUserOp', () => {
  beforeEach(() => {
    process.env.GOVERNANCE_VOTING_ADDRESS = GOV;
  });

  it('allows execute(castVote → governance contract)', () => {
    expect(() => assertSponsorableUserOp({ callData: execute(GOV, castVoteData()) })).not.toThrow();
  });

  it('allows executeBatch of castVote calls to the governance contract', () => {
    const callData = executeBatch([
      { target: GOV, data: castVoteData() },
      { target: GOV, data: castVoteData() },
    ]);
    expect(() => assertSponsorableUserOp({ callData })).not.toThrow();
  });

  it('rejects castVote to a DIFFERENT contract', () => {
    expect(() => assertSponsorableUserOp({ callData: execute(OTHER, castVoteData()) })).toThrow(
      PaymasterPolicyError,
    );
  });

  it('rejects a non-castVote function on the governance contract', () => {
    expect(() => assertSponsorableUserOp({ callData: execute(GOV, transferData()) })).toThrow(
      /castVote/,
    );
  });

  it('rejects a mixed batch (one good, one bad target)', () => {
    const callData = executeBatch([
      { target: GOV, data: castVoteData() },
      { target: OTHER, data: castVoteData() },
    ]);
    expect(() => assertSponsorableUserOp({ callData })).toThrow(PaymasterPolicyError);
  });

  it('rejects callData that is not execute/executeBatch', () => {
    expect(() => assertSponsorableUserOp({ callData: transferData() })).toThrow(
      /Unrecognised account call/,
    );
  });

  it('rejects a missing or malformed callData', () => {
    expect(() => assertSponsorableUserOp({})).toThrow(/callData/);
    expect(() => assertSponsorableUserOp({ callData: 'nope' })).toThrow(/callData/);
  });

  it('rejects when the governance contract is not configured', () => {
    delete process.env.GOVERNANCE_VOTING_ADDRESS;
    expect(() => assertSponsorableUserOp({ callData: execute(GOV, castVoteData()) })).toThrow(
      /not configured/,
    );
  });
});
