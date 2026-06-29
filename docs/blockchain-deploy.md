# Blockchain Deploy Runbook — Base Mainnet

> **Status (updated 2026-06-25):** contracts compile + pass **39/39 Foundry tests** and are
> **deployed + device-tested on Base Sepolia** (user-signed gasless voting verified on-chain;
> proposal content-hash anchoring auditor-reproducible). **Base mainnet deploy is DEFERRED**
> (user decision) — gated on **(a) funds available** (~$10–20 ETH for deploy + ongoing minter
> gas + Pimlico balance) **AND (b) before the first real proposals enter the system**, so the
> permanent record captures all real governance from day one. The app can launch without mainnet
> (on-chain layer is null-guarded → off-chain DB is the source of truth). This runbook is the
> mainnet step when those conditions are met. See `project_wallet_rework` + `onchain-integrity-roadmap`.

---

## What gets deployed

`contracts/script/Deploy.s.sol` deploys four contracts, granting admin / minter /
recorder roles to `MINTER_WALLET_ADDRESS`:

| Contract | Purpose |
|---|---|
| `PrToken` | Soulbound (non-transferable) Participation Rights — governance weight |
| `UtToken` | Utility token (standard ERC-20) |
| `GovernanceVoting` | **User-signed** voting: `castVote(id, option)` (`msg.sender`=voter — platform can't forge), `openProposal(id, contentHash)` (anchors proposal content hash), `closeProposal`, `recordResult` (tally attestation), `recordOpinion` / `recordMemory`. Worker drives open/close/recordResult; gasless `castVote` via the Pimlico paymaster proxy |
| `GroupTreasury` | Treasury **anchor** (not custody): `recordTransaction(txId, groupId, dataHash, kind)` hashes each ledger movement for tamper-evidence. RECORDER_ROLE-gated, worker-driven. Real KES stays off-chain via M-Pesa (Rule 2). Dormant until `TREASURY_CONTRACT_ADDRESS` is wired. |

RPCs are pre-configured in `contracts/foundry.toml` (`base_sepolia`, `base_mainnet`).

## Why mainnet (and the risk calc)

Testnets get reset, so "permanent" would be misleading on Sepolia. Mainnet makes
the claim true. The financial risk is **bounded** because, per Rule 2, **real KES
lives off-chain** (M-Pesa → platform accounts). The contracts hold **no custody**:

- The backend's `fiatBackedUtBalance` (credited only by real M-Pesa) is the source
  of truth for withdrawals — minting on-chain UT does **not** let anyone pull KES.
- PR is soulbound; earned UT has no cash-out path.

So the on-chain layer is the **incorruptible record**, not the vault.

---

## Prerequisites

1. **A fresh deployer/minter wallet** — generate a brand-new one (not a personal
   wallet). Its private key becomes `MINTER_PRIVATE_KEY` and the admin/minter of
   all three contracts. Treat as sensitive.
2. **ETH on Base mainnet** for gas — Base is an L2, so gas is cheap; **~$10–20**
   covers deploy + early minting. Fund via a Coinbase withdrawal on the **Base
   network**, or bridge at <https://bridge.base.org>.
3. **A Basescan API key** (free, <https://basescan.org>) — enables `--verify`, so
   the contract source is publicly readable on-chain (backs the "verifiable" claim).

---

## Step 1 — Dry-run on Base Sepolia (free, recommended)

Rehearse the exact commands + wiring on testnet before spending real gas.

```bash
cd contracts && export PATH="$PATH:/home/mzizi/.foundry/bin"
export MINTER_WALLET_ADDRESS=0xYourDeployerAddress
forge script script/Deploy.s.sol --rpc-url base_sepolia \
  --private-key $MINTER_PRIVATE_KEY --broadcast
```

Three printed addresses = ready for mainnet.

## Step 2 — Mainnet deploy

```bash
cd contracts && export PATH="$PATH:/home/mzizi/.foundry/bin"
export MINTER_WALLET_ADDRESS=0xYourDeployerAddress
export BASESCAN_API_KEY=your_key
forge script script/Deploy.s.sol --rpc-url base_mainnet \
  --private-key $MINTER_PRIVATE_KEY --broadcast \
  --verify --etherscan-api-key $BASESCAN_API_KEY
```

Record the three printed addresses: `PrToken`, `UtToken`, `GovernanceVoting`.

## Step 3 — Wire into the app (on the droplet)

Add to `docker/.env`, then rebuild the worker (it does the on-chain mints/anchoring):

```
MINTER_PRIVATE_KEY=0x...                  # the real key (replaces the placeholder)
BASE_RPC_URL=https://mainnet.base.org
PR_TOKEN_ADDRESS=0x...
UT_TOKEN_ADDRESS=0x...
GOVERNANCE_VOTING_ADDRESS=0x...
TREASURY_CONTRACT_ADDRESS=0x...           # activates treasury ledger anchoring (was dormant)
```

```bash
uj-build-worker
```

The blockchain client (`backend/src/core/blockchain/client.ts`) returns null until
these addresses are set, so anchoring stays dormant until this step — then activates.

## Step 4 — Verify it's live

- Open each address on **basescan.org** → confirm verified source.
- Trigger one PR-earning action → the worker mints on-chain → confirm the tx on
  Basescan. That single confirmed transaction is the proof "on-chain" is real.

---

## Risk notes

1. **Unaudited** — 33 Foundry tests, no formal audit. Mitigated by off-chain custody
   (see "Why mainnet"). Still, deploy is irreversible — finalize any contract change
   first (a change = redeploy + new addresses).
2. **Key security** — `MINTER_PRIVATE_KEY` lives on the worker only (never web —
   see the secrets convention). Acceptable for launch given bounded blast radius;
   post-launch consider a dedicated signer / KMS rather than a raw key in `.env`.
3. **Deploy last** — after any final contract tweak, so the live addresses are stable.

## Related

- Contracts: `contracts/src/{PrToken,UtToken,GovernanceVoting}.sol`
- Deploy script: `contracts/script/Deploy.s.sol`
- Backend client: `backend/src/core/blockchain/client.ts` (null-guarded)
- Anchoring call sites: `participationRights.service.ts` (PR mint),
  `proposal-annotation.service.ts` (opinions), `proposal-lifecycle.service.ts`
  (results + ward memory + deliberation summary)
