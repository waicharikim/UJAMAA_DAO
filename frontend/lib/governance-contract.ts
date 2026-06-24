// GovernanceVoting — minimal client-side binding for user-signed on-chain votes.
//
// Votes are cast by the user's OWN Coinbase Smart Wallet (msg.sender = voter),
// so the platform can never forge them. This file holds only what the frontend
// needs to encode a castVote call; the full ABI lives with the contracts.
//
// CRITICAL: proposalIdToBytes32 MUST match the backend derivation exactly
// (ethers.keccak256(ethers.toUtf8Bytes(proposalId)) — see
// proposal-voting.service.ts / proposal.jobs.ts). If they diverge, the user's
// vote and the platform's open/close/result reference different on-chain ids.

import { keccak256, stringToBytes } from "viem"

export const GOVERNANCE_VOTING_ADDRESS = (
  process.env.NEXT_PUBLIC_GOVERNANCE_VOTING_ADDRESS ?? ""
) as `0x${string}`

export const GOVERNANCE_VOTING_ABI = [
  {
    name: "castVote",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "bytes32" },
      { name: "option", type: "uint8" },
    ],
    outputs: [],
  },
] as const

export type VoteOptionLabel = "YES" | "NO" | "ABSTAIN"

/** keccak256 of the UTF-8 proposal id — matches ethers.toUtf8Bytes on the backend. */
export function proposalIdToBytes32(proposalId: string): `0x${string}` {
  return keccak256(stringToBytes(proposalId))
}

/** Contract enum: YES=0, NO=1, ABSTAIN=2 (must match GovernanceVoting.sol). */
export function voteOptionToUint8(option: VoteOptionLabel): number {
  switch (option) {
    case "YES":
      return 0
    case "NO":
      return 1
    case "ABSTAIN":
      return 2
  }
}

/** True only when a real contract address is configured (40 hex chars). */
export function isGovernanceConfigured(): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(GOVERNANCE_VOTING_ADDRESS)
}
