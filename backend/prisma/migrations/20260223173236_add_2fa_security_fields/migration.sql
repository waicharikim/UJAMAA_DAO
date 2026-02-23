/*
  Warnings:

  - You are about to drop the column `details` on the `security_events` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "password_resets" ADD COLUMN     "ipAddress" VARCHAR(45),
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "security_events" DROP COLUMN "details",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "resolutionNotes" TEXT;

-- AlterTable
ALTER TABLE "two_factor_auth" ADD COLUMN     "failedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastFailedAttempt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "impact_point_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "scope" VARCHAR(50) NOT NULL,
    "scopedId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_point_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_location_impacts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "wardId" UUID NOT NULL,
    "impactPoints" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'NONE',
    "type" TEXT NOT NULL DEFAULT 'LOCATION_BASED',
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_location_impacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "impact_point_logs_userId_scope_idx" ON "impact_point_logs"("userId", "scope");

-- CreateIndex
CREATE INDEX "impact_point_logs_createdAt_idx" ON "impact_point_logs"("createdAt");

-- CreateIndex
CREATE INDEX "user_location_impacts_userId_idx" ON "user_location_impacts"("userId");

-- CreateIndex
CREATE INDEX "user_location_impacts_wardId_idx" ON "user_location_impacts"("wardId");

-- CreateIndex
CREATE UNIQUE INDEX "user_location_impacts_userId_wardId_key" ON "user_location_impacts"("userId", "wardId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "impact_point_logs" ADD CONSTRAINT "impact_point_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_location_impacts" ADD CONSTRAINT "user_location_impacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_location_impacts" ADD CONSTRAINT "user_location_impacts_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
