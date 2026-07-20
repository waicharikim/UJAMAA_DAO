-- Project participation scope — closes the authorization hole where any
-- COMMUNITY_VERIFIED user could join/claim/complete tasks on a project belonging
-- to a group they were not a member of.
--
-- `participationScope` defaults to MEMBERS_ONLY so every existing row immediately
-- becomes members-only (the secure default). Voluntary-group leaders may widen a
-- project to WARD / CONSTITUENCY / COUNTY to invite the surrounding geography.
--
-- `IF NOT EXISTS` / `DO $$` guards keep this idempotent and safe on databases
-- where the type or column was already added via `db push` (dev/test).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectParticipation') THEN
    CREATE TYPE "ProjectParticipation" AS ENUM ('MEMBERS_ONLY', 'WARD', 'CONSTITUENCY', 'COUNTY');
  END IF;
END
$$;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "participationScope" "ProjectParticipation" NOT NULL DEFAULT 'MEMBERS_ONLY';
