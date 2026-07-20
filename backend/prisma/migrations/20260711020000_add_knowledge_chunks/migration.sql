-- Shared knowledge layer (RAG): chunked, embedded corpus of platform docs +
-- verified education modules. Idempotent so it is safe to re-run.

CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
  "id" UUID NOT NULL,
  "source" TEXT NOT NULL,
  "sourceRef" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "embedding" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "knowledge_chunks_source_idx" ON "knowledge_chunks"("source");
