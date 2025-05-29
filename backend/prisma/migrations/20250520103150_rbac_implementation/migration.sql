-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('COMMUNITY', 'COMPANY', 'COUNTY', 'HIGH_SCHOOL', 'CHURCH');

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('SUPER_ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER', 'SUPPORT_STAFF');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GroupRole" ADD VALUE 'TREASURER';
ALTER TYPE "GroupRole" ADD VALUE 'AUDITOR';

-- AlterEnum
ALTER TYPE "ParticipantRole" ADD VALUE 'MILESTONE_VERIFIER';

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "groupType" "GroupType" NOT NULL DEFAULT 'COMMUNITY';

-- CreateTable
CREATE TABLE "UserRole" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "SystemRole" NOT NULL,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserRole_userId_role_scope_idx" ON "UserRole"("userId", "role", "scope");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_role_idx" ON "GroupMember"("groupId", "role");

-- CreateIndex
CREATE INDEX "ProjectParticipant_projectId_role_idx" ON "ProjectParticipant"("projectId", "role");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
