-- CreateEnum
CREATE TYPE "MessagingPlatform" AS ENUM ('TELEGRAM', 'WHATSAPP', 'DISCORD');

-- AlterTable
ALTER TABLE "ResidenceChangeRequest" ALTER COLUMN "proofUrl" DROP NOT NULL;

-- CreateTable
CREATE TABLE "user_messaging_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "platform" "MessagingPlatform" NOT NULL,
    "handle" TEXT,
    "externalUserId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_messaging_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baraza_groups" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "platform" "MessagingPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteLink" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "registeredBy" UUID NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "baraza_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baraza_attendance" (
    "id" UUID NOT NULL,
    "barazaGroupId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionDate" TEXT NOT NULL,
    "prAwarded" BOOLEAN NOT NULL DEFAULT false,
    "prAmount" INTEGER NOT NULL DEFAULT 0,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedBy" TEXT,

    CONSTRAINT "baraza_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_messaging_profiles_platform_externalUserId_idx" ON "user_messaging_profiles"("platform", "externalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "user_messaging_profiles_userId_platform_key" ON "user_messaging_profiles"("userId", "platform");

-- CreateIndex
CREATE INDEX "baraza_groups_groupId_isActive_idx" ON "baraza_groups"("groupId", "isActive");

-- CreateIndex
CREATE INDEX "baraza_groups_platform_externalId_idx" ON "baraza_groups"("platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "baraza_groups_groupId_platform_externalId_key" ON "baraza_groups"("groupId", "platform", "externalId");

-- CreateIndex
CREATE INDEX "baraza_attendance_barazaGroupId_sessionDate_idx" ON "baraza_attendance"("barazaGroupId", "sessionDate");

-- CreateIndex
CREATE INDEX "baraza_attendance_userId_prAwarded_idx" ON "baraza_attendance"("userId", "prAwarded");

-- CreateIndex
CREATE UNIQUE INDEX "baraza_attendance_userId_barazaGroupId_sessionDate_key" ON "baraza_attendance"("userId", "barazaGroupId", "sessionDate");

-- AddForeignKey
ALTER TABLE "user_messaging_profiles" ADD CONSTRAINT "user_messaging_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baraza_groups" ADD CONSTRAINT "baraza_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baraza_attendance" ADD CONSTRAINT "baraza_attendance_barazaGroupId_fkey" FOREIGN KEY ("barazaGroupId") REFERENCES "baraza_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baraza_attendance" ADD CONSTRAINT "baraza_attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
