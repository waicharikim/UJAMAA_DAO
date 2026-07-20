-- On-chain anchor tx hash for treasury ledger movements (GroupTreasury.sol mirror).
-- Null until anchored; the whole anchoring path stays dormant until
-- TREASURY_CONTRACT_ADDRESS + a real MINTER_PRIVATE_KEY are set on the worker.
-- Idempotent so it is safe on databases that already have the column from db push.

ALTER TABLE "wallet_transactions"
  ADD COLUMN IF NOT EXISTS "anchorTxHash" VARCHAR(66);
