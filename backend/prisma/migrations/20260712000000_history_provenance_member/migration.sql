-- Community curation: members can propose local timeline entries (pending
-- ratification). Add the MEMBER provenance value. Idempotent.
ALTER TYPE "HistoryProvenance" ADD VALUE IF NOT EXISTS 'MEMBER';
