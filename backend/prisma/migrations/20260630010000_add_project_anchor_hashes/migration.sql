-- On-chain anchor tx hashes for project lifecycle events (ProjectRegistry.sol mirror).
-- Null until anchored; the whole path stays dormant until PROJECT_REGISTRY_ADDRESS +
-- a real MINTER_PRIVATE_KEY are set on the worker. Idempotent.

ALTER TABLE "Project"     ADD COLUMN IF NOT EXISTS "anchorTxHash" VARCHAR(66);
ALTER TABLE "Milestone"   ADD COLUMN IF NOT EXISTS "anchorTxHash" VARCHAR(66);
ALTER TABLE "WorkSession" ADD COLUMN IF NOT EXISTS "anchorTxHash" VARCHAR(66);
