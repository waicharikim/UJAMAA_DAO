-- AlterTable: Add Ward Memory Layer fields to Proposal
ALTER TABLE "Proposal"
  ADD COLUMN "rationale"          TEXT,
  ADD COLUMN "alternatives"       TEXT,
  ADD COLUMN "outcome"            TEXT,
  ADD COLUMN "outcomeRecordedAt"  TIMESTAMP(3);
