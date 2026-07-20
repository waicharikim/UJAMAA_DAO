-- AlterTable
ALTER TABLE "baraza_attendance" ADD COLUMN     "barazaSessionId" UUID;

-- AlterTable
ALTER TABLE "election_candidates" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "election_votes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "elections" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "platform_config" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ut_withdrawals" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ward_declarations" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "baraza_sessions" (
    "id" UUID NOT NULL,
    "barazaGroupId" UUID NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdBy" UUID NOT NULL,
    "reminderJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baraza_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "baraza_sessions_barazaGroupId_scheduledAt_idx" ON "baraza_sessions"("barazaGroupId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "baraza_sessions" ADD CONSTRAINT "baraza_sessions_barazaGroupId_fkey" FOREIGN KEY ("barazaGroupId") REFERENCES "baraza_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baraza_attendance" ADD CONSTRAINT "baraza_attendance_barazaSessionId_fkey" FOREIGN KEY ("barazaSessionId") REFERENCES "baraza_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
