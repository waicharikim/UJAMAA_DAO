-- Education comprehension gate + once-ever reward tracking (Rule 5 — no farming).
-- Idempotent (ADD COLUMN IF NOT EXISTS) so it is safe on databases that may have
-- received these columns via an earlier `db push`.

ALTER TABLE "UserEducationalProgress"
  ADD COLUMN IF NOT EXISTS "rewardAwarded" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

-- Backfill: any module already marked COMPLETED has already paid out its IP/PR.
-- Mark it awarded so the new once-ever guard never re-awards a past completion.
UPDATE "UserEducationalProgress" SET "rewardAwarded" = true WHERE "status" = 'COMPLETED';
