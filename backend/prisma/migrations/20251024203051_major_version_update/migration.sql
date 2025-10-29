/*
  Warnings:

  - The values [ADMIN] on the enum `GroupRole` will be removed. If these variants are still used in the database, this will fail.
  - The values [PENDING,REJECTED] on the enum `GroupStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [BUSINESS,NON_PROFIT,BILL] on the enum `ProposalType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `constituency` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `county` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `affiliations` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `constituencyLive` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `constituencyOrigin` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `countyLive` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `countyOrigin` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `duesDestination` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `voteWeight` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `DuesPayment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Holding` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ImpactPoint` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserHolding` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[phoneNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[primaryWardId,secondaryWardId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `locationScope` to the `Group` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requiredApproval` to the `Proposal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requiredQuorum` to the `Proposal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `primaryWardId` to the `User` table without a default value. This is not possible if the table is not empty.
  - Made the column `phoneNumber` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `type` on the `WalletTransaction` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "IPTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3');

-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('MANUAL_LABOR', 'SKILLED_WORK', 'COMMUNITY_SERVICE', 'SUPERVISION', 'TRAINING');

-- CreateEnum
CREATE TYPE "WorkVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISPUTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WorkVerificationMethod" AS ENUM ('PEER', 'SUPERVISOR', 'COMMUNITY_WITNESS', 'DIGITAL_EVIDENCE');

-- CreateEnum
CREATE TYPE "EducationalContentLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CERTIFIED');

-- CreateEnum
CREATE TYPE "EmergencyType" AS ENUM ('NATURAL_DISASTER', 'HEALTH_CRISIS', 'CONFLICT', 'INFRASTRUCTURE_FAILURE', 'ENVIRONMENTAL');

-- CreateEnum
CREATE TYPE "EmergencySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterEnum
BEGIN;
CREATE TYPE "GroupRole_new" AS ENUM ('MEMBER', 'LEADER', 'TREASURER', 'AUDITOR', 'FACILITATOR', 'MENTOR');
ALTER TABLE "GroupMember" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "GroupMember" ALTER COLUMN "role" TYPE "GroupRole_new" USING ("role"::text::"GroupRole_new");
ALTER TYPE "GroupRole" RENAME TO "GroupRole_old";
ALTER TYPE "GroupRole_new" RENAME TO "GroupRole";
DROP TYPE "GroupRole_old";
ALTER TABLE "GroupMember" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "GroupStatus_new" AS ENUM ('FORMING', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'DISSOLVED', 'MERGED');
ALTER TABLE "Group" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Group" ALTER COLUMN "status" TYPE "GroupStatus_new" USING ("status"::text::"GroupStatus_new");
ALTER TYPE "GroupStatus" RENAME TO "GroupStatus_old";
ALTER TYPE "GroupStatus_new" RENAME TO "GroupStatus";
DROP TYPE "GroupStatus_old";
ALTER TABLE "Group" ALTER COLUMN "status" SET DEFAULT 'FORMING';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GroupType" ADD VALUE 'TECHNICAL_ADVISORY';
ALTER TYPE "GroupType" ADD VALUE 'QUALITY_ASSURANCE';
ALTER TYPE "GroupType" ADD VALUE 'PROFESSIONAL_NETWORK';
ALTER TYPE "GroupType" ADD VALUE 'EXPERT_PANEL';
ALTER TYPE "GroupType" ADD VALUE 'EMERGENCY_RESPONSE';
ALTER TYPE "GroupType" ADD VALUE 'DISASTER_MANAGEMENT';
ALTER TYPE "GroupType" ADD VALUE 'ENVIRONMENTAL';
ALTER TYPE "GroupType" ADD VALUE 'CULTURAL';
ALTER TYPE "GroupType" ADD VALUE 'INFRASTRUCTURE';
ALTER TYPE "GroupType" ADD VALUE 'SAVINGS_CREDIT';
ALTER TYPE "GroupType" ADD VALUE 'SELF_HELP';

-- AlterEnum
ALTER TYPE "ParticipantRole" ADD VALUE 'QUALITY_CONTROLLER';

-- AlterEnum
BEGIN;
CREATE TYPE "ProposalType_new" AS ENUM ('COMMUNITY_INITIATIVE', 'MAJOR_PROJECT', 'STRATEGIC_DECISION', 'EMERGENCY');
ALTER TABLE "Proposal" ALTER COLUMN "proposalType" TYPE "ProposalType_new" USING ("proposalType"::text::"ProposalType_new");
ALTER TYPE "ProposalType" RENAME TO "ProposalType_old";
ALTER TYPE "ProposalType_new" RENAME TO "ProposalType";
DROP TYPE "ProposalType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "SystemRole" ADD VALUE 'governor_admin';

-- DropForeignKey
ALTER TABLE "DuesPayment" DROP CONSTRAINT "DuesPayment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Holding" DROP CONSTRAINT "Holding_constituencyId_fkey";

-- DropForeignKey
ALTER TABLE "Holding" DROP CONSTRAINT "Holding_countyId_fkey";

-- DropForeignKey
ALTER TABLE "ImpactPoint" DROP CONSTRAINT "ImpactPoint_groupId_fkey";

-- DropForeignKey
ALTER TABLE "ImpactPoint" DROP CONSTRAINT "ImpactPoint_locationHoldingId_fkey";

-- DropForeignKey
ALTER TABLE "ImpactPoint" DROP CONSTRAINT "ImpactPoint_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserHolding" DROP CONSTRAINT "UserHolding_holding_id_fkey";

-- DropForeignKey
ALTER TABLE "UserHolding" DROP CONSTRAINT "UserHolding_userId_fkey";

-- AlterTable
ALTER TABLE "Group" DROP COLUMN "constituency",
DROP COLUMN "county",
ADD COLUMN     "amendmentProcess" JSONB,
ADD COLUMN     "constituencyId" UUID,
ADD COLUMN     "constitution" JSONB,
ADD COLUMN     "countyId" UUID,
ADD COLUMN     "dissolutionDate" TIMESTAMP(3),
ADD COLUMN     "dissolutionWarningSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "locationScope" "LocationScope" NOT NULL,
ADD COLUMN     "memberCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "memberSatisfaction" DECIMAL(3,2) NOT NULL DEFAULT 0,
ADD COLUMN     "multiSigThresholds" JSONB,
ADD COLUMN     "spendingLimits" JSONB,
ADD COLUMN     "successRate" DECIMAL(3,2) NOT NULL DEFAULT 0,
ADD COLUMN     "treasuryBalance" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "wardId" UUID,
ALTER COLUMN "status" SET DEFAULT 'FORMING',
ALTER COLUMN "groupType" SET DEFAULT 'WARD_COMMUNITY';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "assignedExperts" UUID[],
ADD COLUMN     "environmentalImpact" JSONB,
ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "projectComplexity" TEXT NOT NULL DEFAULT 'SIMPLE',
ADD COLUMN     "projectType" TEXT,
ADD COLUMN     "replicationGuide" JSONB,
ADD COLUMN     "requiredExpertise" TEXT[],
ADD COLUMN     "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
ADD COLUMN     "templateFor" TEXT,
ADD COLUMN     "wardId" UUID;

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "emergencyJustification" TEXT,
ADD COLUMN     "internalApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "internalVoteCount" JSONB,
ADD COLUMN     "isEmergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiredApproval" DECIMAL(3,2) NOT NULL,
ADD COLUMN     "requiredQuorum" DECIMAL(3,2) NOT NULL,
ADD COLUMN     "votingTier" TEXT NOT NULL DEFAULT 'COMMUNITY_INITIATIVE',
ADD COLUMN     "wardId" UUID,
ALTER COLUMN "proposalType" SET DEFAULT 'COMMUNITY_INITIATIVE',
ALTER COLUMN "funded" SET DEFAULT false;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "affiliations",
DROP COLUMN "constituencyLive",
DROP COLUMN "constituencyOrigin",
DROP COLUMN "countyLive",
DROP COLUMN "countyOrigin",
DROP COLUMN "duesDestination",
DROP COLUMN "voteWeight",
ADD COLUMN     "averageQualityRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "communityVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expertAreas" TEXT[],
ADD COLUMN     "expertTier" TEXT,
ADD COLUMN     "expertVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "financialHealthScore" INTEGER,
ADD COLUMN     "globalImpactPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "groupsCreatedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isExpert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isYouth" BOOLEAN DEFAULT false,
ADD COLUMN     "lastPRReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "locationVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "participationRights" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "primaryWardId" UUID NOT NULL,
ADD COLUMN     "riskAssessment" JSONB,
ADD COLUMN     "secondaryWardId" UUID,
ADD COLUMN     "totalHoursWorked" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "utilityTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workReliabilityScore" INTEGER NOT NULL DEFAULT 100,
ALTER COLUMN "phoneNumber" SET NOT NULL;

-- AlterTable
ALTER TABLE "WalletTransaction" DROP COLUMN "type",
ADD COLUMN     "type" "TransactionType" NOT NULL;

-- DropTable
DROP TABLE "DuesPayment";

-- DropTable
DROP TABLE "Holding";

-- DropTable
DROP TABLE "ImpactPoint";

-- DropTable
DROP TABLE "UserHolding";

-- CreateTable
CREATE TABLE "UserLocationImpact" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "wardId" UUID NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "tier" "IPTier" NOT NULL DEFAULT 'TIER_1',
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLocationImpact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ward" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "constituencyId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "countyId" UUID,

    CONSTRAINT "Ward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalWorkLog" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(4,2) NOT NULL,
    "workType" "WorkType" NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "status" "WorkVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMP(3),
    "photoUrls" TEXT[],
    "witnessIds" UUID[],
    "qualityRating" INTEGER,
    "notes" TEXT,
    "baseIP" INTEGER NOT NULL,
    "qualityMultiplier" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "totalIPEarned" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicalWorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkVerification" (
    "id" UUID NOT NULL,
    "workLogId" UUID NOT NULL,
    "verifierId" UUID NOT NULL,
    "method" "WorkVerificationMethod" NOT NULL,
    "status" "WorkVerificationStatus" NOT NULL,
    "comments" TEXT,
    "evidence" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationalModule" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaUrls" TEXT[],
    "duration" INTEGER NOT NULL,
    "difficulty" "EducationalContentLevel" NOT NULL,
    "category" TEXT NOT NULL,
    "creatorId" UUID NOT NULL,
    "groupId" UUID,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expertApproved" BOOLEAN NOT NULL DEFAULT false,
    "completionIP" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EducationalModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEducationalProgress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "score" INTEGER,

    CONSTRAINT "UserEducationalProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationalAssessment" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "questions" JSONB NOT NULL,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EducationalAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationalReview" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EducationalReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyAlert" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "emergencyType" "EmergencyType" NOT NULL,
    "severity" "EmergencySeverity" NOT NULL,
    "location" TEXT NOT NULL,
    "reporterId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "assignedGroupId" UUID,
    "neededResources" JSONB NOT NULL,
    "availableResources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyResponse" (
    "id" UUID NOT NULL,
    "emergencyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "skills" TEXT[],
    "location" TEXT,
    "notes" TEXT,

    CONSTRAINT "EmergencyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAccessibility" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "literacyLevel" TEXT NOT NULL DEFAULT 'LITERATE',
    "visualImpairment" BOOLEAN NOT NULL DEFAULT false,
    "hearingImpairment" BOOLEAN NOT NULL DEFAULT false,
    "motorImpairment" BOOLEAN NOT NULL DEFAULT false,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'sw',
    "interfaceSize" TEXT NOT NULL DEFAULT 'NORMAL',
    "audioInterface" BOOLEAN NOT NULL DEFAULT false,
    "simpleMode" BOOLEAN NOT NULL DEFAULT false,
    "helperUserId" UUID,

    CONSTRAINT "UserAccessibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictCase" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "complainantId" UUID NOT NULL,
    "respondentId" UUID NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DIRECT_MEDIATION',
    "evidence" JSONB NOT NULL,
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConflictCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediationSession" (
    "id" UUID NOT NULL,
    "conflictId" UUID NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "mediators" UUID[],
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "notes" TEXT,
    "agreements" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictRuling" (
    "id" UUID NOT NULL,
    "conflictId" UUID NOT NULL,
    "rulingBody" TEXT NOT NULL,
    "rulingText" TEXT NOT NULL,
    "binding" BOOLEAN NOT NULL DEFAULT false,
    "enforcementActions" JSONB NOT NULL,
    "complianceDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictRuling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(20,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "listingType" TEXT NOT NULL,
    "marketTier" TEXT NOT NULL DEFAULT 'LOCAL',
    "wardId" UUID,
    "sellerType" "HolderType" NOT NULL,
    "sellerUserId" UUID,
    "sellerGroupId" UUID,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "qualityRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceTransaction" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "sellerType" "HolderType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalPrice" DECIMAL(20,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "escrowRelease" BOOLEAN NOT NULL DEFAULT false,
    "deliveryDetails" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceReview" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "reviewedId" UUID NOT NULL,
    "reviewedType" "HolderType" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "verifiedPurchase" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marketplaceListingId" UUID,

    CONSTRAINT "MarketplaceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityAsset" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "ownerType" "HolderType" NOT NULL,
    "ownerUserId" UUID,
    "ownerGroupId" UUID,
    "wardId" UUID NOT NULL,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "rentalCostUT" INTEGER,
    "depositUT" INTEGER,
    "maintenanceSchedule" JSONB NOT NULL,
    "lastMaintenance" TIMESTAMP(3),
    "nextMaintenance" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetBooking" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "totalCostUT" INTEGER,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "depositRefunded" BOOLEAN NOT NULL DEFAULT false,
    "purpose" TEXT,
    "conditionBefore" JSONB,
    "conditionAfter" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetMaintenanceLog" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "maintenanceType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "costUT" INTEGER,
    "performedBy" UUID NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "nextMaintenanceDue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetMaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformFeedback" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "assignedTo" UUID,
    "resolution" TEXT,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackComment" (
    "id" UUID NOT NULL,
    "feedbackId" UUID NOT NULL,
    "commenterId" UUID NOT NULL,
    "comment" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityDashboard" (
    "id" UUID NOT NULL,
    "wardId" UUID NOT NULL,
    "metrics" JSONB NOT NULL,
    "trends" JSONB NOT NULL,
    "comparisons" JSONB NOT NULL,
    "customMetrics" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityDashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfiguration" (
    "id" UUID NOT NULL,
    "configKey" TEXT NOT NULL,
    "configValue" JSONB NOT NULL,
    "description" TEXT,
    "updatedBy" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EducationalModuleToProject" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_EducationalModuleToProject_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "UserLocationImpact_wardId_points_idx" ON "UserLocationImpact"("wardId", "points");

-- CreateIndex
CREATE INDEX "UserLocationImpact_userId_lastActivity_idx" ON "UserLocationImpact"("userId", "lastActivity");

-- CreateIndex
CREATE UNIQUE INDEX "UserLocationImpact_userId_wardId_key" ON "UserLocationImpact"("userId", "wardId");

-- CreateIndex
CREATE UNIQUE INDEX "Ward_code_key" ON "Ward"("code");

-- CreateIndex
CREATE INDEX "PhysicalWorkLog_projectId_workDate_idx" ON "PhysicalWorkLog"("projectId", "workDate");

-- CreateIndex
CREATE INDEX "PhysicalWorkLog_userId_status_idx" ON "PhysicalWorkLog"("userId", "status");

-- CreateIndex
CREATE INDEX "PhysicalWorkLog_workType_status_idx" ON "PhysicalWorkLog"("workType", "status");

-- CreateIndex
CREATE INDEX "WorkVerification_verifierId_createdAt_idx" ON "WorkVerification"("verifierId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkVerification_workLogId_verifierId_key" ON "WorkVerification"("workLogId", "verifierId");

-- CreateIndex
CREATE UNIQUE INDEX "UserEducationalProgress_userId_moduleId_key" ON "UserEducationalProgress"("userId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "EducationalReview_userId_moduleId_key" ON "EducationalReview"("userId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyResponse_emergencyId_userId_key" ON "EmergencyResponse"("emergencyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccessibility_userId_key" ON "UserAccessibility"("userId");

-- CreateIndex
CREATE INDEX "AssetMaintenanceLog_assetId_performedAt_idx" ON "AssetMaintenanceLog"("assetId", "performedAt");

-- CreateIndex
CREATE INDEX "FeedbackComment_feedbackId_createdAt_idx" ON "FeedbackComment"("feedbackId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfiguration_configKey_key" ON "SystemConfiguration"("configKey");

-- CreateIndex
CREATE INDEX "_EducationalModuleToProject_B_index" ON "_EducationalModuleToProject"("B");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_primaryWardId_secondaryWardId_key" ON "User"("primaryWardId", "secondaryWardId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_primaryWardId_fkey" FOREIGN KEY ("primaryWardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_secondaryWardId_fkey" FOREIGN KEY ("secondaryWardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLocationImpact" ADD CONSTRAINT "UserLocationImpact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLocationImpact" ADD CONSTRAINT "UserLocationImpact_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ward" ADD CONSTRAINT "Ward_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ward" ADD CONSTRAINT "Ward_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "County"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "County"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalWorkLog" ADD CONSTRAINT "PhysicalWorkLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalWorkLog" ADD CONSTRAINT "PhysicalWorkLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkVerification" ADD CONSTRAINT "WorkVerification_workLogId_fkey" FOREIGN KEY ("workLogId") REFERENCES "PhysicalWorkLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkVerification" ADD CONSTRAINT "WorkVerification_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationalModule" ADD CONSTRAINT "EducationalModule_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationalModule" ADD CONSTRAINT "EducationalModule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEducationalProgress" ADD CONSTRAINT "UserEducationalProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEducationalProgress" ADD CONSTRAINT "UserEducationalProgress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "EducationalModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationalAssessment" ADD CONSTRAINT "EducationalAssessment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "EducationalModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationalReview" ADD CONSTRAINT "EducationalReview_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "EducationalModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationalReview" ADD CONSTRAINT "EducationalReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_assignedGroupId_fkey" FOREIGN KEY ("assignedGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyResponse" ADD CONSTRAINT "EmergencyResponse_emergencyId_fkey" FOREIGN KEY ("emergencyId") REFERENCES "EmergencyAlert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyResponse" ADD CONSTRAINT "EmergencyResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessibility" ADD CONSTRAINT "UserAccessibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessibility" ADD CONSTRAINT "UserAccessibility_helperUserId_fkey" FOREIGN KEY ("helperUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictCase" ADD CONSTRAINT "ConflictCase_complainantId_fkey" FOREIGN KEY ("complainantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictCase" ADD CONSTRAINT "ConflictCase_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediationSession" ADD CONSTRAINT "MediationSession_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "ConflictCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictRuling" ADD CONSTRAINT "ConflictRuling_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "ConflictCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerGroupId_fkey" FOREIGN KEY ("sellerGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "MarketplaceTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_marketplaceListingId_fkey" FOREIGN KEY ("marketplaceListingId") REFERENCES "MarketplaceListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAsset" ADD CONSTRAINT "CommunityAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAsset" ADD CONSTRAINT "CommunityAsset_ownerGroupId_fkey" FOREIGN KEY ("ownerGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAsset" ADD CONSTRAINT "CommunityAsset_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetBooking" ADD CONSTRAINT "AssetBooking_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CommunityAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetBooking" ADD CONSTRAINT "AssetBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMaintenanceLog" ADD CONSTRAINT "AssetMaintenanceLog_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CommunityAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformFeedback" ADD CONSTRAINT "PlatformFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackComment" ADD CONSTRAINT "FeedbackComment_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "PlatformFeedback"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackComment" ADD CONSTRAINT "FeedbackComment_commenterId_fkey" FOREIGN KEY ("commenterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityDashboard" ADD CONSTRAINT "CommunityDashboard_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemConfiguration" ADD CONSTRAINT "SystemConfiguration_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EducationalModuleToProject" ADD CONSTRAINT "_EducationalModuleToProject_A_fkey" FOREIGN KEY ("A") REFERENCES "EducationalModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EducationalModuleToProject" ADD CONSTRAINT "_EducationalModuleToProject_B_fkey" FOREIGN KEY ("B") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
