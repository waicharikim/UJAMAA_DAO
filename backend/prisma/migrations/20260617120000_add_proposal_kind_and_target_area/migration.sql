-- Proposal POLICY vs PROJECT distinction + explicit target area for COMMUNITY
-- proposals. Idempotent so it is safe on databases that may already have these
-- objects from an earlier `db push`.

DO $$ BEGIN
  CREATE TYPE "ProposalKind" AS ENUM ('POLICY', 'PROJECT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Proposal"
  ADD COLUMN IF NOT EXISTS "kind" "ProposalKind" NOT NULL DEFAULT 'PROJECT',
  ADD COLUMN IF NOT EXISTS "targetWardId" UUID,
  ADD COLUMN IF NOT EXISTS "targetConstituencyId" UUID,
  ADD COLUMN IF NOT EXISTS "targetCountyId" UUID;
