-- CreateEnum
CREATE TYPE "LocationScope" AS ENUM ('WARD', 'CONSTITUENCY', 'COUNTY', 'NATIONAL');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('FORMING', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'DISSOLVED', 'MERGED');

-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('MEMBER', 'LEADER', 'TREASURER', 'SECRETARY', 'AUDITOR', 'FACILITATOR', 'MENTOR', 'MODERATOR');

-- CreateEnum
CREATE TYPE "HolderType" AS ENUM ('USER', 'GROUP', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ResidenceChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('PEER', 'SUPERVISOR', 'COMMUNITY_WITNESS', 'DIGITAL_EVIDENCE', 'EXPERT_REVIEW');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "DuesTier" AS ENUM ('ORDINARY', 'SUPPORTER', 'SPONSOR');

-- CreateEnum
CREATE TYPE "SystemGroupType" AS ENUM ('WARD', 'CONSTITUENCY', 'COUNTY', 'NATIONAL');

-- CreateEnum
CREATE TYPE "VoluntaryGroupType" AS ENUM ('BUSINESS_COLLECTIVE', 'SAVINGS_CREDIT', 'AGRICULTURE_COOPERATIVE', 'TRADE_ASSOCIATION', 'PROJECT_EXECUTION', 'INFRASTRUCTURE_COMMITTEE', 'CONSTRUCTION_TEAM', 'NON_PROFIT', 'COMMUNITY_WELFARE', 'POVERTY_ALLEVIATION', 'PROFESSIONAL_NETWORK', 'EXPERT_PANEL', 'QUALITY_ASSURANCE', 'ACADEMIC_RESEARCH', 'EMERGENCY_RESPONSE', 'FIRST_RESPONDERS', 'SECURITY_WATCH', 'CRISIS_MANAGEMENT', 'YOUTH_ORGANIZATION', 'WOMEN_EMPOWERMENT', 'ELDERLY_SUPPORT', 'DISABILITY_ADVOCACY', 'HEALTH_INITIATIVE', 'EDUCATION_INITIATIVE', 'ENVIRONMENTAL_GROUP', 'TECHNOLOGY_HUB', 'ARTS_CULTURE', 'SPORTS_RECREATION', 'RELIGIOUS_ORGANIZATION', 'CULTURAL_PRESERVATION', 'INTERFAITH_DIALOGUE', 'ADVOCACY_GROUP', 'CIVIC_EDUCATION', 'POLICY_RESEARCH', 'TRANSPARENCY_WATCHDOG', 'SPECIAL_INTEREST', 'SOCIAL_CLUB', 'ALUMNI_NETWORK', 'NEIGHBORHOOD_ASSOCIATION');

-- CreateEnum
CREATE TYPE "ProposalType" AS ENUM ('COMMUNITY_INITIATIVE', 'MAJOR_PROJECT', 'STRATEGIC_DECISION', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'VOTING', 'APPROVED', 'REJECTED', 'EXECUTING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('LEAD', 'MANAGER', 'CONTRIBUTOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'AWAITING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('PENDING', 'HELD', 'RELEASED', 'DISPUTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TreasuryAction" AS ENUM ('ALLOCATE', 'FUND_RELEASE', 'REFUND', 'ADJUSTMENT', 'FEE');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'REMOVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MarketplaceTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "EducationalContentLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "EmergencyType" AS ENUM ('NATURAL_DISASTER', 'HEALTH_CRISIS', 'CONFLICT', 'INFRASTRUCTURE_FAILURE', 'ENVIRONMENTAL');

-- CreateEnum
CREATE TYPE "EmergencySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'PROPOSAL', 'VERIFICATION', 'ECONOMIC');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "counties" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constituencies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "countyId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "constituencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wards" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "constituencyId" UUID NOT NULL,
    "countyId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industries" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_services" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "industryId" UUID NOT NULL,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "phoneNumber" TEXT,
    "walletAddress" TEXT,
    "passwordHash" TEXT,
    "avatarUrl" TEXT,
    "primaryWardId" UUID,
    "secondaryWardId" UUID,
    "currentLocationId" UUID,
    "currentLocationUntil" TIMESTAMP(3),
    "verificationLevel" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "communityVerified" BOOLEAN NOT NULL DEFAULT false,
    "locationVerified" BOOLEAN NOT NULL DEFAULT false,
    "participationRights" INTEGER NOT NULL DEFAULT 0,
    "utilityTokens" INTEGER NOT NULL DEFAULT 0,
    "globalImpactPoints" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onboardingCompletedAt" TIMESTAMP(3),
    "lastResidenceChangeAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" UUID,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configuration" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "dataType" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "deviceName" VARCHAR(100),
    "deviceInfo" VARCHAR(500),
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "tokenType" TEXT,
    "scope" TEXT,
    "idToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_requests" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recoveryMethod" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "location" TEXT,
    "successful" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_verifications" (
    "id" UUID NOT NULL,
    "phoneNumber" VARCHAR(15) NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "userId" UUID,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_auth" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "backupCodesEncrypted" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "two_factor_auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webauthn_credentials" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "credentialName" VARCHAR(100),
    "aaguid" VARCHAR(36),
    "transports" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_link_tokens" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_recovery" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "recoveryCodesEncrypted" TEXT[],
    "trustedContactEmails" TEXT[],
    "recoveryEmail" VARCHAR(255),
    "recoveryEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_recovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "userId" UUID,
    "eventType" VARCHAR(50) NOT NULL,
    "severity" VARCHAR(20) NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "location" VARCHAR(100),
    "details" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResidenceChangeRequest" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "oldWardId" UUID,
    "newPrimaryWardId" UUID NOT NULL,
    "reason" TEXT,
    "proofUrl" TEXT NOT NULL,
    "status" "ResidenceChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResidenceChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIndustry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "industryId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserIndustry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGoodsService" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "goodsServiceId" UUID NOT NULL,
    "canProvide" BOOLEAN NOT NULL DEFAULT false,
    "canRequest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGoodsService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPrivacySettings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "profileVisibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "showEmail" BOOLEAN NOT NULL DEFAULT false,
    "showPhone" BOOLEAN NOT NULL DEFAULT false,
    "showWallet" BOOLEAN NOT NULL DEFAULT false,
    "showImpactPoints" BOOLEAN NOT NULL DEFAULT true,
    "allowDirectMessages" BOOLEAN NOT NULL DEFAULT true,
    "allowMarketplace" BOOLEAN NOT NULL DEFAULT true,
    "dataProcessingConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPrivacySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAccessibility" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "visualImpairment" BOOLEAN NOT NULL DEFAULT false,
    "hearingImpairment" BOOLEAN NOT NULL DEFAULT false,
    "motorImpairment" BOOLEAN NOT NULL DEFAULT false,
    "cognitiveImpairment" BOOLEAN NOT NULL DEFAULT false,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "screenReaderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "fontSize" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccessibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipationRightsLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParticipationRightsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "industriesSelected" BOOLEAN NOT NULL DEFAULT false,
    "goodsServicesSelected" BOOLEAN NOT NULL DEFAULT false,
    "privacyConfigured" BOOLEAN NOT NULL DEFAULT false,
    "platformIntroCompleted" BOOLEAN NOT NULL DEFAULT false,
    "governanceTutorialCompleted" BOOLEAN NOT NULL DEFAULT false,
    "marketplaceTutorialCompleted" BOOLEAN NOT NULL DEFAULT false,
    "projectsTutorialCompleted" BOOLEAN NOT NULL DEFAULT false,
    "groupsTutorialCompleted" BOOLEAN NOT NULL DEFAULT false,
    "joinedWardGroup" BOOLEAN NOT NULL DEFAULT false,
    "joinedVoluntaryGroup" BOOLEAN NOT NULL DEFAULT false,
    "castFirstVote" BOOLEAN NOT NULL DEFAULT false,
    "completedFirstModule" BOOLEAN NOT NULL DEFAULT false,
    "attendedFirstEvent" BOOLEAN NOT NULL DEFAULT false,
    "createdFirstListing" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "communityVerified" BOOLEAN NOT NULL DEFAULT false,
    "locationVerified" BOOLEAN NOT NULL DEFAULT false,
    "walletConnected" BOOLEAN NOT NULL DEFAULT false,
    "paidFirstDues" BOOLEAN NOT NULL DEFAULT false,
    "currentStep" TEXT NOT NULL DEFAULT 'EMAIL_VERIFICATION',
    "lastActiveStep" TEXT,
    "totalIPEarned" INTEGER NOT NULL DEFAULT 0,
    "totalPREarned" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTutorial" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "requiredFor" TEXT,
    "ipReward" INTEGER NOT NULL DEFAULT 0,
    "prReward" INTEGER NOT NULL DEFAULT 0,
    "isOptional" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTutorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTutorialCompletion" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tutorialId" UUID NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "ipEarned" INTEGER NOT NULL DEFAULT 0,
    "prEarned" INTEGER NOT NULL DEFAULT 0,
    "quizScore" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTutorialCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingMilestone" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "milestoneKey" TEXT NOT NULL,
    "achieved" BOOLEAN NOT NULL DEFAULT true,
    "ipEarned" INTEGER NOT NULL,
    "prEarned" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuesPayment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "tier" "DuesTier" NOT NULL,
    "period" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "mpesaReceipt" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DuesPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuesAllocation" (
    "id" UUID NOT NULL,
    "duesPaymentId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "treasuryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuesAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NationalContribution" (
    "id" UUID NOT NULL,
    "fromGroupId" UUID NOT NULL,
    "toNationalId" UUID NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "period" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NationalContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalWorkLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "projectId" UUID,
    "milestoneId" UUID,
    "workType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "location" JSONB,
    "photoUrls" TEXT[],
    "witnessIds" UUID[],
    "baseIP" INTEGER NOT NULL DEFAULT 0,
    "qualityMultiplier" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "totalIPEarned" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicalWorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkVerification" (
    "id" UUID NOT NULL,
    "workLogId" UUID NOT NULL,
    "verifierId" UUID NOT NULL,
    "method" "VerificationMethod" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "evidence" TEXT[],
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitments" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" UUID,
    "amountKes" INTEGER,
    "amountPR" INTEGER,
    "frequency" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "missedCount" INTEGER NOT NULL DEFAULT 0,
    "totalPaidKes" INTEGER NOT NULL DEFAULT 0,
    "totalPaidPR" INTEGER NOT NULL DEFAULT 0,
    "breachReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "walletAddress" TEXT,
    "isSystemGroup" BOOLEAN NOT NULL DEFAULT false,
    "systemType" "SystemGroupType",
    "voluntaryType" "VoluntaryGroupType",
    "canBeDeleted" BOOLEAN NOT NULL DEFAULT true,
    "canBeRenamed" BOOLEAN NOT NULL DEFAULT true,
    "locationScope" "LocationScope" NOT NULL,
    "wardId" UUID,
    "constituencyId" UUID,
    "countyId" UUID,
    "industryFocusId" UUID,
    "status" "GroupStatus" NOT NULL DEFAULT 'FORMING',
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "treasuryBalance" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contributesToNational" BOOLEAN NOT NULL DEFAULT false,
    "nationalContributionRate" DECIMAL(3,2) NOT NULL DEFAULT 0.01,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
    "autoEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "canLeave" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictCase" (
    "id" UUID NOT NULL,
    "complainantId" UUID NOT NULL,
    "respondentId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "mediatorId" UUID,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConflictCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "actorType" "HolderType" NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" UUID,
    "scope" "LocationScope",
    "locationId" UUID,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" UUID,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "organizerId" UUID NOT NULL,
    "groupId" UUID,
    "scope" "LocationScope" NOT NULL,
    "locationId" UUID NOT NULL,
    "venue" TEXT,
    "virtualUrl" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "attendeeCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAttendee" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "checkedInAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEngagementMetric" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "proposalsVoted" INTEGER NOT NULL DEFAULT 0,
    "eventsAttended" INTEGER NOT NULL DEFAULT 0,
    "commentsPosted" INTEGER NOT NULL DEFAULT 0,
    "timeSpentMinutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserEngagementMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_vouches" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "voucherId" UUID NOT NULL,
    "wardId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_vouches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "proposalType" "ProposalType" NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "groupId" UUID,
    "creatorId" UUID NOT NULL,
    "budget" DECIMAL(20,2),
    "fundingSource" TEXT,
    "problem" TEXT,
    "solution" TEXT,
    "keyMetrics" JSONB,
    "uniqueValue" TEXT,
    "unfairAdvantage" TEXT,
    "customerSegments" JSONB,
    "channels" JSONB,
    "costStructure" JSONB,
    "revenueStreams" JSONB,
    "timeline" JSONB,
    "team" JSONB,
    "dependencies" JSONB,
    "risks" JSONB,
    "votesFor" INTEGER NOT NULL DEFAULT 0,
    "votesAgainst" INTEGER NOT NULL DEFAULT 0,
    "quorum" INTEGER NOT NULL DEFAULT 0,
    "approvalThreshold" INTEGER NOT NULL DEFAULT 0,
    "votingStartsAt" TIMESTAMP(3),
    "votingEndsAt" TIMESTAMP(3),
    "documents" TEXT[],
    "images" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalMilestone" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deliverables" JSONB NOT NULL,
    "budgetAmount" DECIMAL(20,2) NOT NULL,
    "laborHours" INTEGER,
    "materials" JSONB,
    "startOffset" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "dependencies" UUID[],
    "verificationMethod" TEXT NOT NULL,
    "verifiersNeeded" INTEGER NOT NULL DEFAULT 1,
    "verificationCriteria" JSONB NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMemberVote" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "vote" BOOLEAN NOT NULL,
    "voteWeight" INTEGER NOT NULL DEFAULT 1,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMemberVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "ownerGroupId" UUID,
    "ownerUserId" UUID,
    "proposalId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "proposalMilestoneId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'CONTRIBUTOR',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" UUID,
    "milestoneId" UUID NOT NULL,
    "assignedToId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneVerifier" (
    "id" TEXT NOT NULL,
    "milestoneId" UUID NOT NULL,
    "projectId" UUID,
    "verifierId" UUID NOT NULL,
    "assignedById" UUID NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilestoneVerifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupTreasury" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "balance" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "tokenBalance" INTEGER DEFAULT 0,
    "multiSigPolicy" JSONB,
    "spendingLimits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupTreasury_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escrow" (
    "id" UUID NOT NULL,
    "treasuryId" UUID,
    "amount" DECIMAL(20,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" "EscrowStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" UUID,
    "releaseToId" UUID,
    "releaseToType" "HolderType",
    "releaseReason" TEXT,
    "relatedProposalId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "disputeNotes" TEXT,

    CONSTRAINT "Escrow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowRelease" (
    "id" UUID NOT NULL,
    "escrowId" UUID NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "releasedById" UUID,
    "recipientId" UUID,
    "recipientType" "HolderType",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryPolicy" (
    "id" UUID NOT NULL,
    "groupId" UUID,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryAudit" (
    "id" UUID NOT NULL,
    "transactionId" UUID,
    "escrowId" UUID,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "actorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "treasuryId" UUID NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "transactionType" TEXT NOT NULL,
    "description" TEXT,
    "referenceType" TEXT,
    "proposalId" UUID,
    "projectId" UUID,
    "initiatedById" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
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
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
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
    "status" "MarketplaceTransactionStatus" NOT NULL DEFAULT 'PENDING',
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
    "listingId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "reviewedId" UUID NOT NULL,
    "reviewedType" "HolderType" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "verifiedPurchase" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceReview_pkey" PRIMARY KEY ("id")
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
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "actionUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAudit" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConsent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "policyKey" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformFeedback" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rating" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "counties_code_key" ON "counties"("code");

-- CreateIndex
CREATE UNIQUE INDEX "counties_name_key" ON "counties"("name");

-- CreateIndex
CREATE INDEX "constituencies_countyId_idx" ON "constituencies"("countyId");

-- CreateIndex
CREATE UNIQUE INDEX "constituencies_name_countyId_key" ON "constituencies"("name", "countyId");

-- CreateIndex
CREATE UNIQUE INDEX "wards_code_key" ON "wards"("code");

-- CreateIndex
CREATE INDEX "wards_constituencyId_idx" ON "wards"("constituencyId");

-- CreateIndex
CREATE INDEX "wards_countyId_idx" ON "wards"("countyId");

-- CreateIndex
CREATE UNIQUE INDEX "industries_name_key" ON "industries"("name");

-- CreateIndex
CREATE INDEX "goods_services_industryId_idx" ON "goods_services"("industryId");

-- CreateIndex
CREATE INDEX "goods_services_industryId_active_idx" ON "goods_services"("industryId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "goods_services_name_industryId_key" ON "goods_services"("name", "industryId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_walletAddress_idx" ON "users"("walletAddress");

-- CreateIndex
CREATE INDEX "users_phoneNumber_idx" ON "users"("phoneNumber");

-- CreateIndex
CREATE INDEX "users_primaryWardId_idx" ON "users"("primaryWardId");

-- CreateIndex
CREATE INDEX "users_verificationLevel_idx" ON "users"("verificationLevel");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "user_roles_userId_active_idx" ON "user_roles"("userId", "active");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "system_configuration_key_key" ON "system_configuration"("key");

-- CreateIndex
CREATE INDEX "system_configuration_category_idx" ON "system_configuration"("category");

-- CreateIndex
CREATE INDEX "system_configuration_isPublic_idx" ON "system_configuration"("isPublic");

-- CreateIndex
CREATE INDEX "system_configuration_dataType_idx" ON "system_configuration"("dataType");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_key" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_userId_idx" ON "email_verification_tokens"("userId");

-- CreateIndex
CREATE INDEX "email_verification_tokens_token_idx" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_expiresAt_idx" ON "email_verification_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_userId_revoked_idx" ON "sessions"("userId", "revoked");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "sessions_lastActive_idx" ON "sessions"("lastActive");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_requests_verificationCode_key" ON "recovery_requests"("verificationCode");

-- CreateIndex
CREATE INDEX "recovery_requests_userId_idx" ON "recovery_requests"("userId");

-- CreateIndex
CREATE INDEX "recovery_requests_userId_status_idx" ON "recovery_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "recovery_requests_verificationCode_idx" ON "recovery_requests"("verificationCode");

-- CreateIndex
CREATE INDEX "recovery_requests_expiresAt_idx" ON "recovery_requests"("expiresAt");

-- CreateIndex
CREATE INDEX "login_events_userId_idx" ON "login_events"("userId");

-- CreateIndex
CREATE INDEX "login_events_userId_createdAt_idx" ON "login_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "login_events_successful_idx" ON "login_events"("successful");

-- CreateIndex
CREATE INDEX "login_events_createdAt_idx" ON "login_events"("createdAt");

-- CreateIndex
CREATE INDEX "phone_verifications_phoneNumber_idx" ON "phone_verifications"("phoneNumber");

-- CreateIndex
CREATE INDEX "phone_verifications_verified_idx" ON "phone_verifications"("verified");

-- CreateIndex
CREATE INDEX "phone_verifications_expiresAt_idx" ON "phone_verifications"("expiresAt");

-- CreateIndex
CREATE INDEX "phone_verifications_userId_idx" ON "phone_verifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "phone_verifications_phoneNumber_verified_key" ON "phone_verifications"("phoneNumber", "verified");

-- CreateIndex
CREATE INDEX "password_resets_tokenHash_used_expiresAt_idx" ON "password_resets"("tokenHash", "used", "expiresAt");

-- CreateIndex
CREATE INDEX "password_resets_userId_idx" ON "password_resets"("userId");

-- CreateIndex
CREATE INDEX "password_resets_expiresAt_idx" ON "password_resets"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_auth_userId_key" ON "two_factor_auth"("userId");

-- CreateIndex
CREATE INDEX "two_factor_auth_userId_enabled_idx" ON "two_factor_auth"("userId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "webauthn_credentials_credentialId_key" ON "webauthn_credentials"("credentialId");

-- CreateIndex
CREATE INDEX "webauthn_credentials_userId_idx" ON "webauthn_credentials"("userId");

-- CreateIndex
CREATE INDEX "webauthn_credentials_credentialId_idx" ON "webauthn_credentials"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "magic_link_tokens_tokenHash_key" ON "magic_link_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "magic_link_tokens_tokenHash_used_expiresAt_idx" ON "magic_link_tokens"("tokenHash", "used", "expiresAt");

-- CreateIndex
CREATE INDEX "magic_link_tokens_email_idx" ON "magic_link_tokens"("email");

-- CreateIndex
CREATE INDEX "magic_link_tokens_expiresAt_idx" ON "magic_link_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "account_recovery_userId_key" ON "account_recovery"("userId");

-- CreateIndex
CREATE INDEX "account_recovery_userId_idx" ON "account_recovery"("userId");

-- CreateIndex
CREATE INDEX "security_events_userId_createdAt_idx" ON "security_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "security_events_eventType_severity_idx" ON "security_events"("eventType", "severity");

-- CreateIndex
CREATE INDEX "security_events_createdAt_idx" ON "security_events"("createdAt");

-- CreateIndex
CREATE INDEX "ResidenceChangeRequest_userId_status_idx" ON "ResidenceChangeRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "ResidenceChangeRequest_status_expiresAt_idx" ON "ResidenceChangeRequest"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "UserIndustry_userId_idx" ON "UserIndustry"("userId");

-- CreateIndex
CREATE INDEX "UserIndustry_industryId_idx" ON "UserIndustry"("industryId");

-- CreateIndex
CREATE UNIQUE INDEX "UserIndustry_userId_industryId_key" ON "UserIndustry"("userId", "industryId");

-- CreateIndex
CREATE INDEX "UserGoodsService_userId_idx" ON "UserGoodsService"("userId");

-- CreateIndex
CREATE INDEX "UserGoodsService_goodsServiceId_idx" ON "UserGoodsService"("goodsServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGoodsService_userId_goodsServiceId_key" ON "UserGoodsService"("userId", "goodsServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPrivacySettings_userId_key" ON "UserPrivacySettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccessibility_userId_key" ON "UserAccessibility"("userId");

-- CreateIndex
CREATE INDEX "ParticipationRightsLog_userId_createdAt_idx" ON "ParticipationRightsLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ParticipationRightsLog_reason_idx" ON "ParticipationRightsLog"("reason");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingProgress_userId_key" ON "OnboardingProgress"("userId");

-- CreateIndex
CREATE INDEX "OnboardingProgress_currentStep_idx" ON "OnboardingProgress"("currentStep");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingTutorial_key_key" ON "OnboardingTutorial"("key");

-- CreateIndex
CREATE INDEX "OnboardingTutorial_category_order_idx" ON "OnboardingTutorial"("category", "order");

-- CreateIndex
CREATE INDEX "OnboardingTutorial_active_idx" ON "OnboardingTutorial"("active");

-- CreateIndex
CREATE INDEX "UserTutorialCompletion_userId_completed_idx" ON "UserTutorialCompletion"("userId", "completed");

-- CreateIndex
CREATE INDEX "UserTutorialCompletion_tutorialId_completed_idx" ON "UserTutorialCompletion"("tutorialId", "completed");

-- CreateIndex
CREATE UNIQUE INDEX "UserTutorialCompletion_userId_tutorialId_key" ON "UserTutorialCompletion"("userId", "tutorialId");

-- CreateIndex
CREATE INDEX "OnboardingMilestone_userId_achievedAt_idx" ON "OnboardingMilestone"("userId", "achievedAt");

-- CreateIndex
CREATE INDEX "OnboardingMilestone_milestoneKey_idx" ON "OnboardingMilestone"("milestoneKey");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingMilestone_userId_milestoneKey_key" ON "OnboardingMilestone"("userId", "milestoneKey");

-- CreateIndex
CREATE INDEX "DuesPayment_userId_status_idx" ON "DuesPayment"("userId", "status");

-- CreateIndex
CREATE INDEX "DuesPayment_period_status_idx" ON "DuesPayment"("period", "status");

-- CreateIndex
CREATE INDEX "DuesPayment_paidAt_idx" ON "DuesPayment"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "DuesPayment_userId_period_key" ON "DuesPayment"("userId", "period");

-- CreateIndex
CREATE INDEX "DuesAllocation_duesPaymentId_idx" ON "DuesAllocation"("duesPaymentId");

-- CreateIndex
CREATE INDEX "DuesAllocation_groupId_idx" ON "DuesAllocation"("groupId");

-- CreateIndex
CREATE INDEX "DuesAllocation_treasuryId_idx" ON "DuesAllocation"("treasuryId");

-- CreateIndex
CREATE INDEX "NationalContribution_fromGroupId_idx" ON "NationalContribution"("fromGroupId");

-- CreateIndex
CREATE INDEX "NationalContribution_period_idx" ON "NationalContribution"("period");

-- CreateIndex
CREATE INDEX "NationalContribution_createdAt_idx" ON "NationalContribution"("createdAt");

-- CreateIndex
CREATE INDEX "PhysicalWorkLog_userId_createdAt_idx" ON "PhysicalWorkLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PhysicalWorkLog_projectId_idx" ON "PhysicalWorkLog"("projectId");

-- CreateIndex
CREATE INDEX "PhysicalWorkLog_milestoneId_idx" ON "PhysicalWorkLog"("milestoneId");

-- CreateIndex
CREATE INDEX "PhysicalWorkLog_verifiedAt_idx" ON "PhysicalWorkLog"("verifiedAt");

-- CreateIndex
CREATE INDEX "WorkVerification_verifierId_idx" ON "WorkVerification"("verifierId");

-- CreateIndex
CREATE INDEX "WorkVerification_status_idx" ON "WorkVerification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkVerification_workLogId_verifierId_key" ON "WorkVerification"("workLogId", "verifierId");

-- CreateIndex
CREATE INDEX "commitments_userId_type_status_idx" ON "commitments"("userId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Group_walletAddress_key" ON "Group"("walletAddress");

-- CreateIndex
CREATE INDEX "Group_isSystemGroup_systemType_idx" ON "Group"("isSystemGroup", "systemType");

-- CreateIndex
CREATE INDEX "Group_isSystemGroup_voluntaryType_idx" ON "Group"("isSystemGroup", "voluntaryType");

-- CreateIndex
CREATE INDEX "Group_locationScope_wardId_idx" ON "Group"("locationScope", "wardId");

-- CreateIndex
CREATE INDEX "Group_status_idx" ON "Group"("status");

-- CreateIndex
CREATE INDEX "Group_contributesToNational_idx" ON "Group"("contributesToNational");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_role_idx" ON "GroupMember"("groupId", "role");

-- CreateIndex
CREATE INDEX "GroupMember_userId_active_idx" ON "GroupMember"("userId", "active");

-- CreateIndex
CREATE INDEX "GroupMember_autoEnrolled_idx" ON "GroupMember"("autoEnrolled");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_userId_groupId_key" ON "GroupMember"("userId", "groupId");

-- CreateIndex
CREATE INDEX "CommunityAsset_wardId_idx" ON "CommunityAsset"("wardId");

-- CreateIndex
CREATE INDEX "CommunityAsset_ownerGroupId_idx" ON "CommunityAsset"("ownerGroupId");

-- CreateIndex
CREATE INDEX "CommunityAsset_status_idx" ON "CommunityAsset"("status");

-- CreateIndex
CREATE INDEX "ConflictCase_complainantId_idx" ON "ConflictCase"("complainantId");

-- CreateIndex
CREATE INDEX "ConflictCase_respondentId_idx" ON "ConflictCase"("respondentId");

-- CreateIndex
CREATE INDEX "ConflictCase_status_idx" ON "ConflictCase"("status");

-- CreateIndex
CREATE INDEX "Activity_actorId_createdAt_idx" ON "Activity"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_scope_locationId_createdAt_idx" ON "Activity"("scope", "locationId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_entityType_entityId_idx" ON "Activity"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Comment_entityType_entityId_createdAt_idx" ON "Comment"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- CreateIndex
CREATE INDEX "Event_scope_locationId_startTime_idx" ON "Event"("scope", "locationId", "startTime");

-- CreateIndex
CREATE INDEX "Event_status_startTime_idx" ON "Event"("status", "startTime");

-- CreateIndex
CREATE INDEX "Event_organizerId_idx" ON "Event"("organizerId");

-- CreateIndex
CREATE INDEX "EventAttendee_userId_idx" ON "EventAttendee"("userId");

-- CreateIndex
CREATE INDEX "EventAttendee_eventId_status_idx" ON "EventAttendee"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EventAttendee_eventId_userId_key" ON "EventAttendee"("eventId", "userId");

-- CreateIndex
CREATE INDEX "UserEngagementMetric_date_idx" ON "UserEngagementMetric"("date");

-- CreateIndex
CREATE UNIQUE INDEX "UserEngagementMetric_userId_date_key" ON "UserEngagementMetric"("userId", "date");

-- CreateIndex
CREATE INDEX "verification_requests_userId_status_idx" ON "verification_requests"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "verification_requests_userId_type_key" ON "verification_requests"("userId", "type");

-- CreateIndex
CREATE INDEX "community_vouches_userId_idx" ON "community_vouches"("userId");

-- CreateIndex
CREATE INDEX "community_vouches_voucherId_idx" ON "community_vouches"("voucherId");

-- CreateIndex
CREATE INDEX "community_vouches_wardId_idx" ON "community_vouches"("wardId");

-- CreateIndex
CREATE UNIQUE INDEX "community_vouches_userId_voucherId_key" ON "community_vouches"("userId", "voucherId");

-- CreateIndex
CREATE INDEX "Proposal_groupId_status_idx" ON "Proposal"("groupId", "status");

-- CreateIndex
CREATE INDEX "Proposal_creatorId_idx" ON "Proposal"("creatorId");

-- CreateIndex
CREATE INDEX "Proposal_status_votingEndsAt_idx" ON "Proposal"("status", "votingEndsAt");

-- CreateIndex
CREATE INDEX "Proposal_proposalType_idx" ON "Proposal"("proposalType");

-- CreateIndex
CREATE INDEX "ProposalMilestone_proposalId_idx" ON "ProposalMilestone"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalMilestone_orderIndex_idx" ON "ProposalMilestone"("orderIndex");

-- CreateIndex
CREATE INDEX "GroupMemberVote_proposalId_idx" ON "GroupMemberVote"("proposalId");

-- CreateIndex
CREATE INDEX "GroupMemberVote_memberId_idx" ON "GroupMemberVote"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMemberVote_groupId_memberId_proposalId_key" ON "GroupMemberVote"("groupId", "memberId", "proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_proposalId_key" ON "Project"("proposalId");

-- CreateIndex
CREATE INDEX "Project_ownerGroupId_idx" ON "Project"("ownerGroupId");

-- CreateIndex
CREATE INDEX "Project_ownerUserId_idx" ON "Project"("ownerUserId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_proposalId_idx" ON "Project"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_proposalMilestoneId_key" ON "Milestone"("proposalMilestoneId");

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

-- CreateIndex
CREATE INDEX "Milestone_status_idx" ON "Milestone"("status");

-- CreateIndex
CREATE INDEX "Milestone_proposalMilestoneId_idx" ON "Milestone"("proposalMilestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "MilestoneVerifier_milestoneId_idx" ON "MilestoneVerifier"("milestoneId");

-- CreateIndex
CREATE INDEX "MilestoneVerifier_verifierId_idx" ON "MilestoneVerifier"("verifierId");

-- CreateIndex
CREATE INDEX "MilestoneVerifier_assignedById_idx" ON "MilestoneVerifier"("assignedById");

-- CreateIndex
CREATE INDEX "MilestoneVerifier_status_idx" ON "MilestoneVerifier"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneVerifier_milestoneId_verifierId_key" ON "MilestoneVerifier"("milestoneId", "verifierId");

-- CreateIndex
CREATE INDEX "GroupTreasury_groupId_idx" ON "GroupTreasury"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupTreasury_groupId_key" ON "GroupTreasury"("groupId");

-- CreateIndex
CREATE INDEX "Escrow_treasuryId_idx" ON "Escrow"("treasuryId");

-- CreateIndex
CREATE INDEX "Escrow_relatedProposalId_idx" ON "Escrow"("relatedProposalId");

-- CreateIndex
CREATE INDEX "Escrow_status_idx" ON "Escrow"("status");

-- CreateIndex
CREATE INDEX "EscrowRelease_escrowId_idx" ON "EscrowRelease"("escrowId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryPolicy_groupId_key_key" ON "TreasuryPolicy"("groupId", "key");

-- CreateIndex
CREATE INDEX "TreasuryAudit_transactionId_idx" ON "TreasuryAudit"("transactionId");

-- CreateIndex
CREATE INDEX "TreasuryAudit_escrowId_idx" ON "TreasuryAudit"("escrowId");

-- CreateIndex
CREATE INDEX "wallet_transactions_treasuryId_createdAt_idx" ON "wallet_transactions"("treasuryId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_transactions_proposalId_idx" ON "wallet_transactions"("proposalId");

-- CreateIndex
CREATE INDEX "wallet_transactions_projectId_idx" ON "wallet_transactions"("projectId");

-- CreateIndex
CREATE INDEX "wallet_transactions_createdAt_idx" ON "wallet_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceListing_wardId_status_idx" ON "MarketplaceListing"("wardId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceListing_sellerUserId_idx" ON "MarketplaceListing"("sellerUserId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_sellerGroupId_idx" ON "MarketplaceListing"("sellerGroupId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_idx" ON "MarketplaceListing"("status");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_buyerId_idx" ON "MarketplaceTransaction"("buyerId");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_listingId_idx" ON "MarketplaceTransaction"("listingId");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_status_idx" ON "MarketplaceTransaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceReview_transactionId_key" ON "MarketplaceReview"("transactionId");

-- CreateIndex
CREATE INDEX "MarketplaceReview_reviewedId_reviewedType_idx" ON "MarketplaceReview"("reviewedId", "reviewedType");

-- CreateIndex
CREATE INDEX "MarketplaceReview_reviewerId_idx" ON "MarketplaceReview"("reviewerId");

-- CreateIndex
CREATE INDEX "MarketplaceReview_listingId_idx" ON "MarketplaceReview"("listingId");

-- CreateIndex
CREATE INDEX "EducationalModule_creatorId_idx" ON "EducationalModule"("creatorId");

-- CreateIndex
CREATE INDEX "EducationalModule_category_verified_idx" ON "EducationalModule"("category", "verified");

-- CreateIndex
CREATE INDEX "EducationalModule_difficulty_idx" ON "EducationalModule"("difficulty");

-- CreateIndex
CREATE INDEX "UserEducationalProgress_userId_idx" ON "UserEducationalProgress"("userId");

-- CreateIndex
CREATE INDEX "UserEducationalProgress_moduleId_status_idx" ON "UserEducationalProgress"("moduleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserEducationalProgress_userId_moduleId_key" ON "UserEducationalProgress"("userId", "moduleId");

-- CreateIndex
CREATE INDEX "EducationalAssessment_moduleId_idx" ON "EducationalAssessment"("moduleId");

-- CreateIndex
CREATE INDEX "EducationalReview_moduleId_idx" ON "EducationalReview"("moduleId");

-- CreateIndex
CREATE INDEX "EducationalReview_userId_idx" ON "EducationalReview"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EducationalReview_userId_moduleId_key" ON "EducationalReview"("userId", "moduleId");

-- CreateIndex
CREATE INDEX "EmergencyAlert_reporterId_idx" ON "EmergencyAlert"("reporterId");

-- CreateIndex
CREATE INDEX "EmergencyAlert_assignedGroupId_idx" ON "EmergencyAlert"("assignedGroupId");

-- CreateIndex
CREATE INDEX "EmergencyAlert_severity_status_idx" ON "EmergencyAlert"("severity", "status");

-- CreateIndex
CREATE INDEX "EmergencyResponse_userId_idx" ON "EmergencyResponse"("userId");

-- CreateIndex
CREATE INDEX "EmergencyResponse_emergencyId_status_idx" ON "EmergencyResponse"("emergencyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyResponse_emergencyId_userId_key" ON "EmergencyResponse"("emergencyId", "userId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_priority_read_idx" ON "Notification"("priority", "read");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_channel_category_key" ON "NotificationPreference"("userId", "channel", "category");

-- CreateIndex
CREATE INDEX "UserAudit_userId_action_idx" ON "UserAudit"("userId", "action");

-- CreateIndex
CREATE INDEX "UserAudit_createdAt_idx" ON "UserAudit"("createdAt");

-- CreateIndex
CREATE INDEX "UserConsent_userId_accepted_idx" ON "UserConsent"("userId", "accepted");

-- CreateIndex
CREATE UNIQUE INDEX "UserConsent_userId_policyKey_key" ON "UserConsent"("userId", "policyKey");

-- CreateIndex
CREATE INDEX "PlatformFeedback_category_status_idx" ON "PlatformFeedback"("category", "status");

-- CreateIndex
CREATE INDEX "PlatformFeedback_userId_idx" ON "PlatformFeedback"("userId");

-- CreateIndex
CREATE INDEX "SystemLog_level_createdAt_idx" ON "SystemLog"("level", "createdAt");

-- AddForeignKey
ALTER TABLE "constituencies" ADD CONSTRAINT "constituencies_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "counties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "constituencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "counties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_services" ADD CONSTRAINT "goods_services_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "industries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_primaryWardId_fkey" FOREIGN KEY ("primaryWardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_secondaryWardId_fkey" FOREIGN KEY ("secondaryWardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_configuration" ADD CONSTRAINT "system_configuration_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_requests" ADD CONSTRAINT "recovery_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_auth" ADD CONSTRAINT "two_factor_auth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_recovery" ADD CONSTRAINT "account_recovery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidenceChangeRequest" ADD CONSTRAINT "ResidenceChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidenceChangeRequest" ADD CONSTRAINT "ResidenceChangeRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidenceChangeRequest" ADD CONSTRAINT "ResidenceChangeRequest_newPrimaryWardId_fkey" FOREIGN KEY ("newPrimaryWardId") REFERENCES "wards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidenceChangeRequest" ADD CONSTRAINT "ResidenceChangeRequest_oldWardId_fkey" FOREIGN KEY ("oldWardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIndustry" ADD CONSTRAINT "UserIndustry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIndustry" ADD CONSTRAINT "UserIndustry_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "industries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGoodsService" ADD CONSTRAINT "UserGoodsService_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGoodsService" ADD CONSTRAINT "UserGoodsService_goodsServiceId_fkey" FOREIGN KEY ("goodsServiceId") REFERENCES "goods_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPrivacySettings" ADD CONSTRAINT "UserPrivacySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessibility" ADD CONSTRAINT "UserAccessibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationRightsLog" ADD CONSTRAINT "ParticipationRightsLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTutorialCompletion" ADD CONSTRAINT "UserTutorialCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTutorialCompletion" ADD CONSTRAINT "UserTutorialCompletion_tutorialId_fkey" FOREIGN KEY ("tutorialId") REFERENCES "OnboardingTutorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingMilestone" ADD CONSTRAINT "OnboardingMilestone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesPayment" ADD CONSTRAINT "DuesPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesAllocation" ADD CONSTRAINT "DuesAllocation_duesPaymentId_fkey" FOREIGN KEY ("duesPaymentId") REFERENCES "DuesPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesAllocation" ADD CONSTRAINT "DuesAllocation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesAllocation" ADD CONSTRAINT "DuesAllocation_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "GroupTreasury"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NationalContribution" ADD CONSTRAINT "NationalContribution_fromGroupId_fkey" FOREIGN KEY ("fromGroupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalWorkLog" ADD CONSTRAINT "PhysicalWorkLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalWorkLog" ADD CONSTRAINT "PhysicalWorkLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalWorkLog" ADD CONSTRAINT "PhysicalWorkLog_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkVerification" ADD CONSTRAINT "WorkVerification_workLogId_fkey" FOREIGN KEY ("workLogId") REFERENCES "PhysicalWorkLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkVerification" ADD CONSTRAINT "WorkVerification_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "constituencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "counties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAsset" ADD CONSTRAINT "CommunityAsset_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAsset" ADD CONSTRAINT "CommunityAsset_ownerGroupId_fkey" FOREIGN KEY ("ownerGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictCase" ADD CONSTRAINT "ConflictCase_complainantId_fkey" FOREIGN KEY ("complainantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictCase" ADD CONSTRAINT "ConflictCase_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "comment_proposal_fk" FOREIGN KEY ("entityId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "comment_project_fk" FOREIGN KEY ("entityId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "comment_milestone_fk" FOREIGN KEY ("entityId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEngagementMetric" ADD CONSTRAINT "UserEngagementMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_vouches" ADD CONSTRAINT "community_vouches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_vouches" ADD CONSTRAINT "community_vouches_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_vouches" ADD CONSTRAINT "community_vouches_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalMilestone" ADD CONSTRAINT "ProposalMilestone_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMemberVote" ADD CONSTRAINT "GroupMemberVote_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMemberVote" ADD CONSTRAINT "GroupMemberVote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMemberVote" ADD CONSTRAINT "GroupMemberVote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerGroupId_fkey" FOREIGN KEY ("ownerGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_proposalMilestoneId_fkey" FOREIGN KEY ("proposalMilestoneId") REFERENCES "ProposalMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneVerifier" ADD CONSTRAINT "MilestoneVerifier_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneVerifier" ADD CONSTRAINT "MilestoneVerifier_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneVerifier" ADD CONSTRAINT "MilestoneVerifier_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneVerifier" ADD CONSTRAINT "MilestoneVerifier_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTreasury" ADD CONSTRAINT "GroupTreasury_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "GroupTreasury"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_relatedProposalId_fkey" FOREIGN KEY ("relatedProposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowRelease" ADD CONSTRAINT "EscrowRelease_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "Escrow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowRelease" ADD CONSTRAINT "EscrowRelease_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryPolicy" ADD CONSTRAINT "TreasuryPolicy_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAudit" ADD CONSTRAINT "TreasuryAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "GroupTreasury"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerGroupId_fkey" FOREIGN KEY ("sellerGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "MarketplaceTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationalModule" ADD CONSTRAINT "EducationalModule_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEducationalProgress" ADD CONSTRAINT "UserEducationalProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEducationalProgress" ADD CONSTRAINT "UserEducationalProgress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "EducationalModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationalAssessment" ADD CONSTRAINT "EducationalAssessment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "EducationalModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationalReview" ADD CONSTRAINT "EducationalReview_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "EducationalModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationalReview" ADD CONSTRAINT "EducationalReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_assignedGroupId_fkey" FOREIGN KEY ("assignedGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyResponse" ADD CONSTRAINT "EmergencyResponse_emergencyId_fkey" FOREIGN KEY ("emergencyId") REFERENCES "EmergencyAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyResponse" ADD CONSTRAINT "EmergencyResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAudit" ADD CONSTRAINT "UserAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformFeedback" ADD CONSTRAINT "PlatformFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
