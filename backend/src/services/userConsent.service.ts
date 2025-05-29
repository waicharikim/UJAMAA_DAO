/**
 * @file userConsent.service.ts
 *
 * @description
 * Service for recording, retrieving, and checking user consents to policies.
 */

import prisma from '../prismaClient.js';

/**
 * Records a user's consent to a specific policy and version,
 * along with optional metadata such as IP address and user agent.
 *
 * @param userId - ID of the user giving consent
 * @param policyType - Type/name of the policy (e.g., "terms_of_service")
 * @param version - Version of the policy agreed upon
 * @param ipAddress - Optional IP address of the user
 * @param userAgent - Optional User-Agent header string
 * @returns The created user consent record
 */
export async function recordUserConsent(
  userId: string,
  policyType: string,
  version: string,
  ipAddress?: string,
  userAgent?: string
) {
  return prisma.userConsent.create({
    data: {
      userId,
      policyType,
      version,
      consentedAt: new Date(),
      ipAddress,
      userAgent,
    },
  });
}

/**
 * Retrieves all consents given by a user, ordered newest first.
 *
 * @param userId - ID of the user
 * @returns Array of user consent records
 */
export async function getUserConsents(userId: string) {
  return prisma.userConsent.findMany({
    where: { userId },
    orderBy: { consentedAt: 'desc' },
  });
}

/**
 * Checks if a user has consented to a specific policy version.
 *
 * @param userId - ID of the user
 * @param policyType - Type/name of the policy
 * @param version - Version string
 * @returns True if consent record exists, else false
 */
export async function hasUserConsentedToPolicy(userId: string, policyType: string, version: string) {
  const consent = await prisma.userConsent.findFirst({
    where: {
      userId,
      policyType,
      version,
    },
  });
  return consent !== null;
}