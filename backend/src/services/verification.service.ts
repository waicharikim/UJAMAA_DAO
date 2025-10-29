/**
 * @file src/services/verification.service.ts
 * @description
 * UJAMAADAO Verification Service - Handles all verification workflows.
 * The core hashing functions are exported for module mocking in tests.
 */

import bcrypt from 'bcryptjs';
import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { EventBus, UserEventPayload, VerificationEventPayload } from '../events/eventBus.js'; // Import VerificationEventPayload
import { SMSProvider } from './smsProvider.js';

// ---------------------------------------------------------------------
// CORE SECURITY FUNCTIONS (EXPOSED FOR MOCKING IN UNIT TESTS)
// ---------------------------------------------------------------------

/**
 * Hashes the raw verification code before storing it in the database.
 * **CRITICAL**: Must be EXPORTED for successful module mocking in Vitest.
 */
export const hashVerificationCode = async (code: string): Promise<string> => {
    // Production implementation using bcryptjs
    return bcrypt.hash(code, 10);
};

/**
 * Verifies code against hash using secure comparison.
 * **CRITICAL**: Must be EXPORTED for successful module mocking in Vitest.
 */
export const verifyCode = async (code: string, hash: string): Promise<boolean> => {
    // Production implementation using bcryptjs
    return bcrypt.compare(code, hash);
};

// ---------------------------------------------------------------------
// TYPES AND INTERFACES
// ---------------------------------------------------------------------

export type VerificationType = 'EMAIL' | 'PHONE' | 'COMMUNITY' | 'LOCATION' | 'EXPERT';

export interface VerificationStatus {
  emailVerified: boolean;
  phoneVerified: boolean;
  communityVerified: boolean;
  locationVerified: boolean;
  expertVerified: boolean;
  // CRITICAL FIX: Changed 'FULLY_VERIFIED' to 'FULL_VERIFIED' to match AuthUser type
  overallLevel: 'UNVERIFIED' | 'BASIC' | 'COMMUNITY' | 'FULL_VERIFIED';
  verificationScore: number;
}

interface LocationVerificationData {
  userId: string;
  coordinates: { latitude: number; longitude: number };
  wardId: string;
  timestamp: Date;
  evidence?: string;
}

// ---------------------------------------------------------------------
// VERIFICATION SERVICE CLASS
// ---------------------------------------------------------------------

export class VerificationService {
  private smsProvider: SMSProvider;
  private static readonly MAX_CODE_ATTEMPTS = 5; // Security: Limit attempts
  private readonly source = 'VerificationService';

  constructor() {
    this.smsProvider = new SMSProvider();
  }

  /**
   * Initiate phone verification, including rate limiting and secure hashing.
   */
  async initiatePhoneVerification(userId: string, phoneNumber: string): Promise<{ verificationId: string }> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new ApiError('User not found', 404, { code: 'USER_NOT_FOUND' });
      }

      // 1. Rate Limiting Check: Reuse existing active token to prevent spam
      const activeToken = await prisma.authToken.findFirst({
        where: {
          userId,
          type: 'VERIFY_PHONE',
          used: false,
          expiresAt: { gt: new Date() }
        }
      });

      if (activeToken) {
        // --- LOGGING FIX: Wrap custom properties in metadata ---
        logger.warn('Verification: Active phone token reused', { 
            userId, 
            metadata: { verificationId: activeToken.id }
        });
        // --- END FIX ---
        return { verificationId: activeToken.id };
      }

      // 2. Generate and Hash Code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const tokenHash = await hashVerificationCode(verificationCode); // Uses exported function (bcrypt)
      
      // 3. Store verification attempt
      const verification = await prisma.authToken.create({
        data: {
          userId,
          tokenHash,
          type: 'VERIFY_PHONE',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
          userAgent: 'SMS_VERIFICATION',
          metadata: {
            phoneNumber,
            verificationType: 'PHONE',
            attempts: 0
          }
        }
      });

      // 4. Send SMS (Mocked in tests)
      await this.smsProvider.sendVerificationCode(phoneNumber, verificationCode);

      // --- LOGGING FIX: Wrap custom properties in metadata ---
      logger.info('UJAMAADAO Verification: Phone verification initiated', {
        userId,
        metadata: { verificationId: verification.id }
      });
      // --- END FIX ---

      return { verificationId: verification.id };

    } catch (error) {
      // --- LOGGING FIX: Wrap custom properties in metadata ---
      logger.error('UJAMAADAO Verification: Failed to initiate phone verification', {
        userId,
        metadata: {
            error: error instanceof Error ? error.message : String(error)
        }
      });
      // --- END FIX ---
      throw error;
    }
  }

  /**
   * Complete phone verification, check code, update attempts, mark user verified.
   */
  async completePhoneVerification(verificationId: string, code: string): Promise<boolean> {
    try {
      const verification = await prisma.authToken.findUnique({
        where: { id: verificationId }
      });

      if (!verification || verification.used || verification.type !== 'VERIFY_PHONE') {
        throw new ApiError('Invalid verification request', 400, { code: 'INVALID_VERIFICATION' });
      }

      if (verification.expiresAt < new Date()) {
        throw new ApiError('Verification code expired', 400, { code: 'VERIFICATION_EXPIRED' });
      }

      const currentAttempts = (verification.metadata as any)?.attempts || 0;
      const newAttempts = currentAttempts + 1;
      const userId = verification.userId;

      // Check if attempts exceeded *before* code check
      if (currentAttempts >= VerificationService.MAX_CODE_ATTEMPTS) {
        throw new ApiError('Verification attempts exceeded. Please restart the process.', 403, { code: 'ATTEMPTS_EXCEEDED' });
      }

      // Verify code using secure comparison (uses exported function)
      const isValid = await verifyCode(code, verification.tokenHash);
      
      if (!isValid) {
        // Increment attempts and update the 'used' status if max attempts is reached
        await prisma.authToken.update({
          where: { id: verificationId },
          data: {
            metadata: {
              ...verification.metadata,
              attempts: newAttempts
            },
            // CRITICAL: Mark as used if this attempt hits the limit
            used: newAttempts >= VerificationService.MAX_CODE_ATTEMPTS
          }
        });

        // --- LOGGING FIX: Wrap custom properties in metadata ---
        logger.warn('Verification: Invalid code attempt', { 
            userId, 
            metadata: { verificationId, attempts: newAttempts }
        });
        // --- END FIX ---
        throw new ApiError('Invalid verification code', 401, { code: 'INVALID_CODE' });
      }

      // SUCCESS: Mark as used and update user in a transaction
      await prisma.$transaction([
        prisma.authToken.update({
          where: { id: verificationId },
          data: { used: true, usedAt: new Date() }
        }),
        prisma.user.update({
          where: { id: userId },
          data: { phoneVerified: true }
        })
      ]);

      await this.awardVerificationIP(userId, 'PHONE');
      
      // --- EVENT BUS FIX: Use defined constants and the specialized helper ---
      EventBus.publishVerificationEvent(EventBus.DOMAIN_EVENTS.PHONE_VERIFICATION_COMPLETED, {
        userId,
        verificationType: 'PHONE',
        source: this.source,
        previousLevel: 'UNVERIFIED', // Assuming base level before phone
        newLevel: 'BASIC', // Assuming user becomes BASIC after phone verification
      } as VerificationEventPayload);
      // --- END FIX ---

      logger.info('UJAMAADAO Verification: Phone verification completed', { userId });
      return true;

    } catch (error) {
      // --- LOGGING FIX: Wrap custom properties in metadata ---
      logger.error('UJAMAADAO Verification: Failed to complete phone verification', {
        metadata: {
            verificationId,
            error: error instanceof Error ? error.message : String(error)
        }
      });
      // --- END FIX ---
      throw error;
    }
  }

  /**
   * Submit community verification vote, checks thresholds, and completes if necessary.
   */
  async submitCommunityVerificationVote(
    verificationId: string, 
    verifierId: string, 
    approve: boolean
  ): Promise<{ completed: boolean; result?: boolean }> {
    try {
      const verification = await prisma.userActivityLog.findUnique({
        where: { id: verificationId }
      });

      if (!verification || verification.eventType !== 'COMMUNITY_VERIFICATION_INITIATED') {
        throw new ApiError('Invalid verification request', 400, { code: 'INVALID_VERIFICATION' });
      }
      
      const eventData = verification.eventData as any;
      const userId = verification.userId;

      if (!eventData.verifierIds.includes(verifierId)) {
        throw new ApiError('Unauthorized: You are not designated to vote on this request.', 403, { code: 'UNAUTHORIZED_VERIFIER' });
      }
      
      if (eventData.status === 'COMPLETED' || eventData.status === 'APPROVED' || eventData.status === 'REJECTED') {
        throw new ApiError('Verification request already processed.', 400, { code: 'VERIFICATION_COMPLETED' });
      }

      if (eventData.approvals.includes(verifierId) || eventData.rejections.includes(verifierId)) {
        throw new ApiError('Verifier has already voted', 400, { code: 'ALREADY_VOTED' });
      }

      // Update votes
      const updatedData = {
        ...eventData,
        approvals: approve ? [...eventData.approvals, verifierId] : eventData.approvals,
        rejections: !approve ? [...eventData.rejections, verifierId] : eventData.rejections
      };

      const totalVotes = updatedData.approvals.length + updatedData.rejections.length;
      const requiredApprovals = updatedData.requiredApprovals;

      let completed = false;
      let result = false;

      // Determine if verification thresholds are met
      if (updatedData.approvals.length >= requiredApprovals || totalVotes === updatedData.verifierIds.length) {
        
        result = updatedData.approvals.length >= requiredApprovals;
        completed = true;
        updatedData.status = result ? 'APPROVED' : 'REJECTED';

        // Use transaction for updates
        await prisma.$transaction(async (tx: { userActivityLog: { update: (arg0: { where: { id: string; }; data: { eventData: any; status: any; }; }) => any; }; user: { update: (arg0: { where: { id: any; }; data: { communityVerified: boolean; }; }) => any; }; }) => {
            await tx.userActivityLog.update({
                where: { id: verificationId },
                data: { eventData: updatedData, status: updatedData.status }
            });

            if (result) {
                await tx.user.update({
                    where: { id: userId },
                    data: { communityVerified: true }
                });

                await this.awardVerificationIP(userId, 'COMMUNITY');
                await this.awardVerifierIP(updatedData.approvals);
            }
        });

        // --- EVENT BUS FIX: Use defined constants and the specialized helper ---
        EventBus.publishVerificationEvent(EventBus.DOMAIN_EVENTS.COMMUNITY_VERIFICATION_COMPLETED, {
            userId,
            verificationType: 'COMMUNITY',
            source: this.source,
            newLevel: result ? 'COMMUNITY' : eventData.newLevel || 'BASIC', // Update level if approved
            verificationData: { result, totalVotes, requiredApprovals }
        } as VerificationEventPayload);
        // --- END FIX ---
      } else {
        // If not complete, just update the log with the new vote
         await prisma.userActivityLog.update({
            where: { id: verificationId },
            data: { eventData: updatedData }
        });
      }

      // --- LOGGING FIX: Wrap custom properties in metadata ---
      logger.info('UJAMAADAO Verification: Community verification vote submitted', { 
        userId, 
        metadata: { verificationId, verifierId, completed }
      });
      // --- END FIX ---
      return { completed, result };

    } catch (error) {
      // --- LOGGING FIX: Wrap custom properties in metadata ---
      logger.error('UJAMAADAO Verification: Failed to submit community verification vote', { 
        metadata: { verificationId, error: error instanceof Error ? error.message : String(error) }
      });
      // --- END FIX ---
      throw error;
    }
  }

  /**
   * Verify user location against known ward boundaries.
   */
  async verifyLocation(data: LocationVerificationData): Promise<boolean> {
    try {
      const isInWard = await this.validateLocationInWard(data.coordinates, data.wardId);
      
      if (!isInWard) {
        throw new ApiError('Location does not match ward boundaries', 400, { code: 'LOCATION_MISMATCH' });
      }

      // Use transaction for atomicity
      await prisma.$transaction([
        prisma.user.update({
          where: { id: data.userId },
          data: { 
            locationVerified: true,
            primaryWardId: data.wardId 
          }
        }),
        prisma.userActivityLog.create({
          data: {
            userId: data.userId,
            eventType: 'LOCATION_VERIFIED',
            eventData: { ...data }
          }
        })
      ]);

      await this.awardVerificationIP(data.userId, 'LOCATION');
      
      // --- EVENT BUS FIX: Use defined constants and the specialized helper ---
      EventBus.publishVerificationEvent(EventBus.DOMAIN_EVENTS.LOCATION_VERIFICATION_COMPLETED, {
          userId: data.userId,
          verificationType: 'LOCATION',
          source: this.source,
          newLevel: 'COMMUNITY', // Assuming this verification level grants COMMUNITY access
          verificationData: { wardId: data.wardId }
      } as VerificationEventPayload);
      // --- END FIX ---

      logger.info('UJAMAADAO Verification: Location verification completed', { userId: data.userId });
      return true;

    } catch (error) {
      // --- LOGGING FIX: Wrap custom properties in metadata ---
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('UJAMAADAO Verification: Failed to verify location', { 
          userId: data.userId, 
          metadata: { error: errMsg }
      });
      // --- END FIX ---
      throw error;
    }
  }

  /**
   * Get user verification status using the central scoring function.
   */
  async getVerificationStatus(userId: string): Promise<VerificationStatus> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        emailVerified: true,
        phoneVerified: true,
        communityVerified: true,
        locationVerified: true,
        expertVerified: true
      }
    });

    if (!user) {
      throw new ApiError('User not found', 404, { code: 'USER_NOT_FOUND' });
    }

    // CRITICAL: Call the updated calculateVerificationStatus
    return calculateVerificationStatus(user);
  }
  
  // --- Private Helper Methods ---

  /**
   * Awards Impact Points (IP) to the user upon verification completion.
   */
  private async awardVerificationIP(userId: string, type: VerificationType): Promise<void> {
    const ipRewards: Record<VerificationType, number> = {
      'EMAIL': 5,
      'PHONE': 10,
      'COMMUNITY': 25,
      'LOCATION': 15,
      'EXPERT': 50
    };

    await prisma.user.update({
      where: { id: userId },
      data: { globalImpactPoints: { increment: ipRewards[type] } }
    });

    // Publish event for impact points awarded
    EventBus.publishEconomicEvent(EventBus.DOMAIN_EVENTS.IMPACT_POINTS_AWARDED, {
        transactionType: 'VERIFICATION_AWARD',
        amount: ipRewards[type],
        impactPoints: ipRewards[type],
        toUserId: userId,
        source: this.source,
        // eventId and timestamp handled by EventBus
    });
  }

  /**
   * Awards IP to verifiers for their service in community verification.
   */
  private async awardVerifierIP(verifierIds: string[]): Promise<void> {
    const rewardPerVerifier = 5;
    await prisma.user.updateMany({
      where: { id: { in: verifierIds } },
      data: { globalImpactPoints: { increment: rewardPerVerifier } } // 5 IP per successful verification
    });

    verifierIds.forEach(id => {
        // Publish event for each verifier
        EventBus.publishEconomicEvent(EventBus.DOMAIN_EVENTS.IMPACT_POINTS_AWARDED, {
            transactionType: 'VERIFIER_REWARD',
            amount: rewardPerVerifier,
            impactPoints: rewardPerVerifier,
            toUserId: id,
            source: this.source,
        });
    });
  }

  /**
   * Simplified mock of GIS validation: checks if a ward exists.
   */
  private async validateLocationInWard(coordinates: { latitude: number; longitude: number }, wardId: string): Promise<boolean> {
    const ward = await prisma.ward.findUnique({ where: { id: wardId } });
    return !!ward;
  }
}

/**
 * Calculate verification status and score (EXPORTED FOR REUSE/TESTING)
 */
export function calculateVerificationStatus(user: any): VerificationStatus {
  let score = 0;
  // CRITICAL FIX: Changed 'FULLY_VERIFIED' to 'FULL_VERIFIED'
  let level: VerificationStatus['overallLevel'] = 'UNVERIFIED';

  // Scoring weights (adjusted slightly from your previous version for rounder numbers)
  if (user.emailVerified) score += 10;
  if (user.phoneVerified) score += 20;
  if (user.communityVerified) score += 40; // Increased weight for community verification
  if (user.locationVerified) score += 30;
  if (user.expertVerified) score += 50;

  // Level determination based on cumulative score (Total max score is 150)
  // CRITICAL FIX: Changed 'FULLY_VERIFIED' to 'FULL_VERIFIED'
  if (score >= 120) level = 'FULL_VERIFIED';
  else if (score >= 70) level = 'COMMUNITY';
  else if (score >= 30) level = 'BASIC';
  else level = 'UNVERIFIED';

  return {
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    communityVerified: user.communityVerified,
    locationVerified: user.locationVerified,
    expertVerified: user.expertVerified,
    overallLevel: level,
    verificationScore: score
  };
}

// Export singleton instance (optional but common practice)
export const verificationService = new VerificationService();
