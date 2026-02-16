// backend/src/modules/onboarding/seed.ts
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

export async function seedOnboardingFlows() {
  console.log("Seeding onboarding flows...");

  // Flow: Citizen (default soft/hybrid)
  const citizenFlow = await prisma.onboardingFlow.upsert({
    where: { key: "CITIZEN_DEFAULT" },
    update: { active: true, version: { increment: 0 } },
    create: {
      id: uuidv4(),
      key: "CITIZEN_DEFAULT",
      name: "Citizen onboarding (default)",
      description: "Basic onboarding for citizens. Soft gating for basic features.",
      type: "CITIZEN",
      version: 1,
      gatingMode: "HYBRID",
      active: true,
      steps: {
        create: [
          {
            id: uuidv4(),
            ordinal: 1,
            title: "Accept Terms of Service",
            actionType: "ACCEPT_TERMS",
            actionConfig: { required: true },
            successCriteria: { accepted: true },
            skippable: false,
          },
          {
            id: uuidv4(),
            ordinal: 2,
            title: "Verify Email",
            actionType: "VERIFY_EMAIL",
            actionConfig: { sendEmail: true, expireMinutes: 60 },
            successCriteria: { verified: true },
            skippable: false,
          },
          {
            id: uuidv4(),
            ordinal: 3,
            title: "Verify Phone",
            actionType: "VERIFY_PHONE",
            actionConfig: { smsProvider: "mpesa-sim", resendLimit: 3 },
            successCriteria: { verified: true },
            skippable: true,
            autoUnlock: true,
          },
          {
            id: uuidv4(),
            ordinal: 4,
            title: "Select Industries & Interests",
            actionType: "SELECT_INDUSTRIES",
            actionConfig: { minSelections: 1, maxSelections: 5 },
            successCriteria: { selectionsMin: 1 },
            skippable: true,
          },
        ],
      },
    },
  });

  // Flow: Creator
  const creatorFlow = await prisma.onboardingFlow.upsert({
    where: { key: "CREATOR_V1" },
    update: {},
    create: {
      id: uuidv4(),
      key: "CREATOR_V1",
      name: "Creator onboarding",
      description: "Onboarding for creators: profile, industries, wallet, listings setup.",
      type: "CREATOR",
      version: 1,
      gatingMode: "HYBRID",
      active: true,
      steps: {
        create: [
          {
            id: uuidv4(),
            ordinal: 1,
            title: "Accept Terms",
            actionType: "ACCEPT_TERMS",
            actionConfig: {},
            successCriteria: { accepted: true },
            skippable: false,
          },
          {
            id: uuidv4(),
            ordinal: 2,
            title: "Complete Profile",
            actionType: "COMPLETE_PROFILE",
            actionConfig: { requiredFields: ["name", "industryId", "avatarUrl"] },
            successCriteria: { requiredFieldsCompleted: true },
            skippable: false,
          },
          {
            id: uuidv4(),
            ordinal: 3,
            title: "Setup Wallet",
            actionType: "SETUP_WALLET",
            actionConfig: { walletRequired: true },
            successCriteria: { walletLinked: true },
            skippable: false,
          },
          {
            id: uuidv4(),
            ordinal: 4,
            title: "Create first Listing",
            actionType: "OTHER",
            actionConfig: { requireListing: true },
            successCriteria: { listingsMin: 1 },
            skippable: true,
          },
        ],
      },
    },
  });

  // Flow: Group Admin (hard gate for treasury & admin roles)
  const groupAdminFlow = await prisma.onboardingFlow.upsert({
    where: { key: "GROUP_ADMIN_V1" },
    update: {},
    create: {
      id: uuidv4(),
      key: "GROUP_ADMIN_V1",
      name: "Group Admin onboarding",
      description: "Strict onboarding for group admins (treasury, verification, multi-sig).",
      type: "GROUP_ADMIN",
      version: 1,
      gatingMode: "STRICT",
      active: true,
      steps: {
        create: [
          {
            id: uuidv4(),
            ordinal: 1,
            title: "Complete Profile",
            actionType: "COMPLETE_PROFILE",
            actionConfig: { requiredFields: ["name", "phoneNumber", "walletAddress"] },
            successCriteria: { requiredFieldsCompleted: true },
            skippable: false,
          },
          {
            id: uuidv4(),
            ordinal: 2,
            title: "Verify Phone",
            actionType: "VERIFY_PHONE",
            actionConfig: { smsProvider: "mpesa-sim" },
            successCriteria: { verified: true },
            skippable: false,
          },
          {
            id: uuidv4(),
            ordinal: 3,
            title: "Setup Treasury / MultiSig",
            actionType: "SETUP_TREASURY",
            actionConfig: { multisigRequired: true, signersMin: 2 },
            successCriteria: { treasuryLinked: true, multisigConfigured: true },
            skippable: false,
          },
          {
            id: uuidv4(),
            ordinal: 4,
            title: "Group Constitution & Rules",
            actionType: "OTHER",
            actionConfig: { requireConstitution: true },
            successCriteria: { constitutionUploaded: true },
            skippable: false,
          },
        ],
      },
    },
  });

  // Flow: Verifier (KYC/expert) - hard gate
  const verifierFlow = await prisma.onboardingFlow.upsert({
    where: { key: "VERIFIER_V1" },
    update: {},
    create: {
      id: uuidv4(),
      key: "VERIFIER_V1",
      name: "Verifier onboarding",
      description: "Strict onboarding for milestone/verifiers and experts (ID docs).",
      type: "VERIFIER",
      version: 1,
      gatingMode: "STRICT",
      active: true,
      steps: {
        create: [
          {
            id: uuidv4(),
            ordinal: 1,
            title: "Complete Profile & CV",
            actionType: "COMPLETE_PROFILE",
            actionConfig: { requireCV: true, requireExperienceYears: 3 },
            successCriteria: { profileComplete: true },
            skippable: false,
          },
          {
            id: uuidv4(),
            ordinal: 2,
            title: "Upload ID & Certifications",
            actionType: "UPLOAD_DOCUMENT",
            actionConfig: { requiredDocumentTypes: ["IDENTITY", "CERTIFICATION"] },
            successCriteria: { documentsVerified: true },
            skippable: false,
          },
          {
            id: uuidv4(),
            ordinal: 3,
            title: "Manual Review by Admin",
            actionType: "MANUAL_REVIEW",
            actionConfig: { reviewerRole: "system:auditor" },
            successCriteria: { adminApproved: true },
            skippable: false,
          },
        ],
      },
    },
  });

  // Role→flow mappings (example)
  await prisma.roleOnboardingRequirement.upsert({
    where: { roleName_flowId: { roleName: "group:admin", flowId: groupAdminFlow.id } },
    update: {},
    create: {
      id: uuidv4(),
      roleName: "group:admin",
      flowId: groupAdminFlow.id,
      mandatory: true,
    },
  });

  await prisma.roleOnboardingRequirement.upsert({
    where: { roleName_flowId: { roleName: "project:milestone_verifier", flowId: verifierFlow.id } },
    update: {},
    create: {
      id: uuidv4(),
      roleName: "project:milestone_verifier",
      flowId: verifierFlow.id,
      mandatory: true,
    },
  });

  console.log("Onboarding flows seeded.");
  return { citizenFlow, creatorFlow, groupAdminFlow, verifierFlow };
}
