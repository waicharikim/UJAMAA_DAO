-- Community-memory decision record: an AI-consolidated (fail-open) summary of a
-- passed proposal's decision — { decided, why, alternatives, whatHappened }.
-- Derived/convenience; rationale/alternatives/outcome stay authoritative.
-- Idempotent so it is safe to re-run against dev/test/prod.

ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "decisionRecord" JSONB;
