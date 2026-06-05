-- The EducationalModule model gained `submittedAt` and `rejectionReason` (the
-- author-review fields) after the original schema_alignment migration. They were
-- only ever applied to dev/test via `db push`, never captured in a migration, so
-- production (which runs `migrate deploy`) never received them — and it went
-- unnoticed because education modules were never seeded in prod until now.
--
-- Both columns are nullable: purely additive, no data loss. `IF NOT EXISTS` keeps
-- this idempotent and safe on any database where the columns were already added
-- (e.g. dev via db push, or a manual ALTER while unblocking prod).
ALTER TABLE "EducationalModule" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "EducationalModule" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
