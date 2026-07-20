-- CreateEnum
CREATE TYPE "BarazaDeliberationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "BarazaAgentKey" AS ENUM ('DAKTARI', 'LINDA', 'TAJIRI', 'FOREMAN', 'MWALIMU', 'MKURUGENZI', 'MWANANCHI', 'FUNDI', 'HUSTLER', 'SHAHIDI', 'MPELELEZI', 'MJAMAA');

-- CreateEnum
CREATE TYPE "HistoryProvenance" AS ENUM ('LLM_SEED', 'COLLECTOR', 'DELIBERATION', 'ADMIN');

-- CreateEnum
CREATE TYPE "HistoryVerification" AS ENUM ('UNVERIFIED', 'ADMIN_CONFIRMED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "BarazaTrigger" AS ENUM ('AUTHOR', 'ADMIN', 'AUTO');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "barazaAlertSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "deliberationSummary" JSONB,
ADD COLUMN     "deliberationSummaryAt" TIMESTAMP(3),
ADD COLUMN     "memoryAnchorTxHash" VARCHAR(66);

-- AlterTable
ALTER TABLE "project_updates" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "proposal_annotations" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "fieldKey" VARCHAR(50) NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "quotedText" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "anchorTxHash" VARCHAR(66),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_annotation_reactions" (
    "id" UUID NOT NULL,
    "annotationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" VARCHAR(4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_annotation_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "current_affairs" (
    "id" UUID NOT NULL,
    "indicator" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "asOf" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminOverride" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "current_affairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historical_events" (
    "id" UUID NOT NULL,
    "era" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "summary" TEXT NOT NULL,
    "causes" TEXT,
    "consequences" TEXT,
    "themes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "provenance" "HistoryProvenance" NOT NULL,
    "sourceRef" TEXT,
    "verification" "HistoryVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "supersededById" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historical_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baraza_deliberations" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "status" "BarazaDeliberationStatus" NOT NULL DEFAULT 'PENDING',
    "triggeredBy" "BarazaTrigger" NOT NULL DEFAULT 'AUTO',
    "readinessScore" INTEGER,
    "readinessBand" VARCHAR(30),
    "transcript" JSONB,
    "conflictMap" JSONB,
    "revisionSuggestions" JSONB,
    "agentMemorySnapshot" JSONB,
    "contextSnapshot" JSONB,
    "mkutanoConvergence" JSONB,
    "mkutanoContradictions" JSONB,
    "mkutanoFixability" TEXT,
    "errorLog" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "baraza_deliberations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baraza_agent_states" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "agentKey" "BarazaAgentKey" NOT NULL,
    "deliberationCount" INTEGER NOT NULL DEFAULT 0,
    "concessionCount" INTEGER NOT NULL DEFAULT 0,
    "allianceCount" INTEGER NOT NULL DEFAULT 0,
    "holdCount" INTEGER NOT NULL DEFAULT 0,
    "rigidityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "responsivenessScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "staticCore" JSONB,
    "episodicLog" JSONB,
    "relationalMap" JSONB,
    "premisePatterns" JSONB,
    "powerStructureMap" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "baraza_agent_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposal_annotations_proposalId_fieldKey_idx" ON "proposal_annotations"("proposalId", "fieldKey");

-- CreateIndex
CREATE INDEX "proposal_annotations_proposalId_createdAt_idx" ON "proposal_annotations"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "proposal_annotation_reactions_annotationId_idx" ON "proposal_annotation_reactions"("annotationId");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_annotation_reactions_annotationId_userId_key" ON "proposal_annotation_reactions"("annotationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "current_affairs_indicator_key" ON "current_affairs"("indicator");

-- CreateIndex
CREATE INDEX "current_affairs_active_idx" ON "current_affairs"("active");

-- CreateIndex
CREATE INDEX "historical_events_active_idx" ON "historical_events"("active");

-- CreateIndex
CREATE INDEX "historical_events_provenance_idx" ON "historical_events"("provenance");

-- CreateIndex
CREATE INDEX "baraza_deliberations_proposalId_status_idx" ON "baraza_deliberations"("proposalId", "status");

-- CreateIndex
CREATE INDEX "baraza_deliberations_groupId_createdAt_idx" ON "baraza_deliberations"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "baraza_deliberations_contentHash_status_idx" ON "baraza_deliberations"("contentHash", "status");

-- CreateIndex
CREATE INDEX "baraza_deliberations_status_createdAt_idx" ON "baraza_deliberations"("status", "createdAt");

-- CreateIndex
CREATE INDEX "baraza_agent_states_groupId_idx" ON "baraza_agent_states"("groupId");

-- CreateIndex
CREATE INDEX "baraza_agent_states_agentKey_idx" ON "baraza_agent_states"("agentKey");

-- CreateIndex
CREATE UNIQUE INDEX "baraza_agent_states_groupId_agentKey_key" ON "baraza_agent_states"("groupId", "agentKey");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "proposal_annotations" ADD CONSTRAINT "proposal_annotations_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_annotations" ADD CONSTRAINT "proposal_annotations_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_annotation_reactions" ADD CONSTRAINT "proposal_annotation_reactions_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "proposal_annotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_annotation_reactions" ADD CONSTRAINT "proposal_annotation_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baraza_deliberations" ADD CONSTRAINT "baraza_deliberations_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baraza_deliberations" ADD CONSTRAINT "baraza_deliberations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baraza_agent_states" ADD CONSTRAINT "baraza_agent_states_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

