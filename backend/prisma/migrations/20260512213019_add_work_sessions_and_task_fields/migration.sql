/*
  Warnings:

  - Made the column `vote` on table `GroupMemberVote` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "WorkSessionStatus" AS ENUM ('OPEN', 'APPROVED', 'FLAGGED');

-- AlterTable
ALTER TABLE "GroupMemberVote" ALTER COLUMN "vote" SET NOT NULL;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "maxAssignees" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "skillCategory" TEXT;

-- CreateTable
CREATE TABLE "WorkSession" (
    "id" UUID NOT NULL,
    "milestoneId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "qrSecret" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "WorkSessionStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closeJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkPresence" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "attestedById" UUID,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "ipAwarded" INTEGER NOT NULL DEFAULT 0,
    "awardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkPresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkSession_qrSecret_key" ON "WorkSession"("qrSecret");

-- CreateIndex
CREATE INDEX "WorkSession_milestoneId_idx" ON "WorkSession"("milestoneId");

-- CreateIndex
CREATE INDEX "WorkSession_projectId_idx" ON "WorkSession"("projectId");

-- CreateIndex
CREATE INDEX "WorkSession_status_idx" ON "WorkSession"("status");

-- CreateIndex
CREATE INDEX "WorkPresence_sessionId_idx" ON "WorkPresence"("sessionId");

-- CreateIndex
CREATE INDEX "WorkPresence_userId_idx" ON "WorkPresence"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPresence_sessionId_userId_key" ON "WorkPresence"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPresence" ADD CONSTRAINT "WorkPresence_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPresence" ADD CONSTRAINT "WorkPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPresence" ADD CONSTRAINT "WorkPresence_attestedById_fkey" FOREIGN KEY ("attestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
