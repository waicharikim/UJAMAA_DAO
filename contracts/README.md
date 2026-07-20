# UjamaaDAO Smart Contracts

Foundry project for the UjamaaDAO on-chain layer. Targets Base L2 (Base Sepolia testnet → Base Mainnet).

See `ai_workflows/DECISIONS.md` ADR-008, ADR-018, ADR-019, ADR-020 for architecture rationale.

---

## Architecture

### What Goes On-Chain vs Off-Chain (ADR-002)

| Layer | On-chain | Off-chain |
|---|---|---|
| PR Token | Soulbound ERC-20 on Base — `PrToken.sol` | Balance mirrored in `ParticipationRightsLog` for fast reads |
| UT Token | Standard ERC-20 on Base — `UtToken.sol` | Balance tracked in `User.utilityTokens` |
| Governance votes | Optional Phase 2 — on-chain vote record | Primary tally in `GroupMemberVote` table |
| Treasury | Out of scope Phase 1 | `WalletTransaction` + `Escrow` tables |
| User identity | Wallet address only | All profile data off-chain |
| M-Pesa payments | Never on-chain (Non-negotiable Rule 2) | DuesPayment + M-Pesa webhooks |

### Contracts to Write (next blockchain session)

1. **`PrToken.sol`** — Soulbound ERC-20
   - Inherits OpenZeppelin `ERC20` + `AccessControl`
   - Overrides `transfer()`, `transferFrom()`, `approve()`, `allowance()` → always revert `"PR: non-transferable"`
   - Role: `PR_MINTER_ROLE` (backend hot wallet, see ADR-020)
   - Functions: `mint(address, uint256)`, `burn(address, uint256)`
   - Events: `ParticipationRightsAwarded(address indexed user, uint256 amount)`

2. **`UtToken.sol`** — Standard ERC-20
   - OpenZeppelin `ERC20` + `AccessControl`
   - Role: `UT_MINTER_ROLE` (backend hot wallet)
   - No cash-out enforcement at contract level (ADR-004 is a platform policy)

3. **`UjamaaDAO.sol`** (Phase 2) — Governance coordinator
   - Records finalized off-chain votes on-chain for tamper-proof audit
   - Called only after off-chain quorum is reached

### Minter Wallet Pattern (ADR-020)

The backend uses a dedicated EOA (`MINTER_PRIVATE_KEY` env var on the worker process) to call
`mint()` on PR and UT contracts. This is **not** a user wallet — user wallets are Privy-managed
embedded wallets. The minter wallet holds `PR_MINTER_ROLE` and `UT_MINTER_ROLE`.

```
Backend award() flow:
1. Off-chain: append to ParticipationRightsLog (existing)
2. On-chain: prToken.mint(user.walletAddress, amount) via minter wallet
3. Guard: skip on-chain call if user.walletAddress is null
```

---

## Local Dev

Requires [Foundry](https://book.getfoundry.sh/getting-started/installation) installed.

```bash
# Install OpenZeppelin (once)
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# Build
forge build

# Test
forge test

# Local Anvil fork of Base Sepolia
anvil --fork-url https://sepolia.base.org --chain-id 84532
```

The Docker Compose `anvil` service (to be added in next blockchain session):
```yaml
anvil:
  image: ghcr.io/foundry-rs/foundry:latest
  command: anvil --fork-url https://sepolia.base.org --chain-id 84532
  ports:
    - "8545:8545"
```

---

## Directory Structure

```
contracts/
├── foundry.toml          # Foundry config (solc version, optimizer, RPC endpoints)
├── README.md             # This file
├── src/
│   ├── PrToken.sol       # Soulbound ERC-20 (PR) — TODO next blockchain session
│   └── UtToken.sol       # Standard ERC-20 (UT) — TODO next blockchain session
├── test/
│   ├── PrToken.t.sol     # Soulbound transfer revert tests — TODO
│   └── UtToken.t.sol     # Mint / burn tests — TODO
├── script/
│   └── Deploy.s.sol      # Foundry deploy script — TODO
└── out/                  # Generated ABIs + bytecode (committed for backend bindings)
```

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `MINTER_PRIVATE_KEY` | worker container | Backend minter EOA private key — signs mint() calls |
| `PR_TOKEN_ADDRESS` | web + worker | Deployed PrToken contract address |
| `UT_TOKEN_ADDRESS` | web + worker | Deployed UtToken contract address |
| `BASESCAN_API_KEY` | CI / deploy | Contract verification on Basescan |
| `BASE_RPC_URL` | worker | Base Sepolia (testnet) or Base Mainnet RPC endpoint |

**Security**: `MINTER_PRIVATE_KEY` must never be in source control. Use a hardware wallet or KMS for production.

---

## Status

**Current**: Scaffold only — no Solidity code yet. Architecture documented. ADR-009 (Privy), ADR-018 (Foundry), ADR-019 (contracts/ at root), ADR-020 (minter wallet) all decided.

**Next blockchain session**: Write `PrToken.sol` + `UtToken.sol`, Solidity tests, deploy to Base Sepolia, wire `participationRights.service.ts` to call `prToken.mint()` on award.
