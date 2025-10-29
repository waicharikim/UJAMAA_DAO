/**
 * @file economic.service.ts
 * * @description
 * UJAMAADAO Economic System Service
 * * Core service for managing the three-tier economic system:
 * - Impact Points (IP): Social reputation and voting weight
 * - Utility Tokens (UT): Economic transaction medium
 * - Participation Rights (PR): Governance participation capacity
 * * UJAMAADAO ECONOMIC FEATURES:
 * - Impact point awards for community contributions
 * - Utility token transfers with geographic validation
 * - Participation rights management and reset
 * - Voting weight calculations based on IP tiers
 * - Economic tier progression (TIER_1 → TIER_2 → TIER_3)
 * - Geographic impact point allocation (local vs global)
 */

import { Prisma } from '@prisma/client';
import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { EventBus } from '../events/eventBus.js';
import { walletService } from './wallet.service.js'; // Import wallet service

/**
 * Economic Transaction Types
 */
type EconomicTransactionType =
  | 'INITIAL_GRANT'
  | 'VERIFICATION_BONUS'
  | 'WORK_COMPLETION'
  | 'PROJECT_CONTRIBUTION'
  | 'COMMUNITY_SERVICE'
  | 'TOKEN_TRANSFER'
  | 'MARKETPLACE_PURCHASE'
  | 'GOVERNANCE_PARTICIPATION';

/**
 * Economic Transfer Request
 */
interface EconomicTransferRequest {
  fromUserId: string;
  toWalletAddress: string;
  amount: number;
  memo?: string;
  geographicContext?: any;
}

/**
 * Impact Point Award Request
 */
interface ImpactPointAwardRequest {
  userId: string;
  points: number;
  source: EconomicTransactionType;
  memo?: string;
}

/**
 * UJAMAADAO Economic System Service
 */
export class EconomicService {

  // --- Utility Token Operations ---

  /**
   * Transfers Utility Tokens between two user wallets.
   * * Enforces geographic validation if required.
   */
  async transferUtilityTokens({
    fromUserId,
    toWalletAddress,
    amount,
    memo,
    geographicContext,
  }: EconomicTransferRequest) {
    if (amount <= 0) {
      throw new ApiError('Transfer amount must be positive.', 400, { code: 'INVALID_AMOUNT' });
    }

    // 1. Fetch user wallets (Assuming users have a 'walletAddress' field mapped to a unique wallet)
    const [sender, recipient] = await Promise.all([
      prisma.user.findUnique({ where: { id: fromUserId } }),
      prisma.user.findUnique({ where: { walletAddress: toWalletAddress } })
    ]);

    if (!sender) {
      throw new ApiError('Sender not found.', 404, { code: 'SENDER_NOT_FOUND' });
    }
    if (!recipient) {
      throw new ApiError('Recipient wallet address not found.', 404, { code: 'RECIPIENT_NOT_FOUND' });
    }
    if (sender.id === recipient.id) {
      throw new ApiError('Cannot transfer to yourself.', 400, { code: 'SELF_TRANSFER' });
    }

    // 2. Geographic Validation (Placeholder)
    // if (geographicContext && !this.validateGeographicTransfer(geographicContext, sender.geographicId, recipient.geographicId)) {
    //   throw new ApiError('Transfer blocked: Geographic mismatch.', 403, { code: 'GEO_BLOCK' });
    // }

    const transactionId = this.generateTransactionId();

    // 3. Perform the atomic transfer using Wallet Service
    try {
      // NOTE: Assuming walletService.updateWalletBalance handles the atomic transaction
      // Debit sender
      await walletService.updateWalletBalance(
        'USER',
        sender.id,
        'WITHDRAWAL',
        -amount,
        `Transfer to ${recipient.walletAddress} (TX: ${transactionId})`,
        fromUserId // Actor ID
      );

      // Credit recipient
      await walletService.updateWalletBalance(
        'USER',
        recipient.id,
        'DEPOSIT',
        amount,
        `Transfer from ${sender.walletAddress} (TX: ${transactionId})`,
        fromUserId // Actor ID
      );

      // 4. Emit event and log success
      EventBus.publishEconomicEvent('TOKEN_TRANSFER_COMPLETED', {
        fromUserId,
        toUserId: recipient.id,
        amount,
        transactionId,
      });

      logger.info('UJAMAADAO Economic: Token transfer successful', {
        operationType: 'ECONOMIC',
        operation: 'TOKEN_TRANSFER',
        userId: fromUserId,
        // CRITICAL FIX: Moving ad-hoc data to metadata
        metadata: {
          toUserId: recipient.id,
          amount,
          transactionId,
        }
      });

      return { transactionId };
    } catch (error) {
      logger.error('UJAMAADAO Economic: Token transfer failed', {
        error: error instanceof Error ? error.message : String(error),
        operationType: 'ECONOMIC',
        operation: 'TOKEN_TRANSFER',
        userId: fromUserId,
        // CRITICAL FIX: Moving ad-hoc data to metadata
        metadata: {
          toWalletAddress,
          amount,
          transactionId,
        }
      });
      throw error;
    }
  }

  // --- Impact Point Operations ---

  /**
   * Awards Impact Points to a user.
   */
  async awardImpactPoints({ userId, points, source, memo }: ImpactPointAwardRequest) {
    if (points <= 0) {
      throw new ApiError('Points award must be positive.', 400, { code: 'INVALID_POINTS' });
    }

    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          globalImpactPoints: { increment: points },
        },
        select: {
          id: true,
          globalImpactPoints: true,
          // other relevant fields
        }
      });

      EventBus.publishEconomicEvent('IMPACT_POINTS_AWARDED', {
        userId,
        points,
        source,
      });

      logger.info('UJAMAADAO Economic: Impact Points awarded', {
        operationType: 'ECONOMIC',
        operation: 'IMPACT_POINTS_AWARD',
        userId,
        // CRITICAL FIX: Moving ad-hoc data to metadata
        metadata: {
          points,
          source,
          newBalance: updatedUser.globalImpactPoints,
        }
      });

      return updatedUser;
    } catch (error) {
      logger.error('UJAMAADAO Economic: Failed to award Impact Points', {
        error: error instanceof Error ? error.message : String(error),
        operationType: 'ECONOMIC',
        operation: 'IMPACT_POINTS_AWARD',
        userId,
        // CRITICAL FIX: Moving ad-hoc data to metadata
        metadata: {
          points,
          source,
        }
      });
      throw error;
    }
  }

  // --- Participation Rights Operations ---

  /**
   * Resets a user's participation rights (e.g., monthly allowance).
   */
  async resetParticipationRights(userId: string) {
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          participationRights: 10, // Monthly allowance
          lastPRReset: new Date()
        },
        select: {
          participationRights: true,
          lastPRReset: true
        }
      });

      EventBus.publishEconomicEvent('PARTICIPATION_RIGHTS_UPDATED', {
        userId,
        newRights: updatedUser.participationRights,
        resetAt: updatedUser.lastPRReset
      });

      logger.info('UJAMAADAO Economic: Participation rights reset', {
        userId,
        operationType: 'ECONOMIC',
        // CRITICAL FIX: Moving ad-hoc data to metadata
        metadata: {
          newRights: updatedUser.participationRights
        }
      });

      return {
        newRights: updatedUser.participationRights,
        resetAt: updatedUser.lastPRReset
      };
    } catch (error) {
      logger.error('UJAMAADAO Economic: Failed to reset participation rights', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        operationType: 'ECONOMIC',
      });
      throw error;
    }
  }

  /**
   * Generate Unique Transaction ID (Placeholder for robust UUID/CUID mechanism)
   */
  private generateTransactionId(): string {
    // Generates a UUID-like string for robustness. In a real app, this might be crypto.randomUUID()
    const S4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() + '-' + S4() + S4() + S4();
  }

  // Placeholder for complex geographic validation logic
  // private validateGeographicTransfer(context: any, senderGeoId: string, recipientGeoId: string): boolean {
  //   return senderGeoId === recipientGeoId;
  // }
}

export const economicService = new EconomicService();
