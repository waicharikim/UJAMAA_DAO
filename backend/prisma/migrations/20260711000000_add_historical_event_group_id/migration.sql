-- Two-scale historian: HistoricalEvent gains an optional group scope.
--   groupId NULL  = shared / national timeline (every group sees it)
--   groupId set   = that group's own local history
-- Idempotent so it is safe to re-run against dev/test/prod.

ALTER TABLE "historical_events" ADD COLUMN IF NOT EXISTS "groupId" UUID;

CREATE INDEX IF NOT EXISTS "historical_events_groupId_idx" ON "historical_events"("groupId");
