/**
 * @file src/modules/auth/services/wallet.service.ts
 * @description
 * Wallet Authentication Service — MetaMask/Web3 Login
 * 
 * UPDATED: Fixed session token handling, added security tracking,
 * improved error handling, and Redis-ready nonce storage.
 * 
 * Version: 2.2 — January 2026
 */

import { ethers } from "ethers";
import { randomUUID } from "crypto";
import { prisma } from "../../../core/database/client.js";
import { ApiError } from "../../../core/errors/ApiError.js";
import { logger, logSecurityEvent } from "../../../core/logger/logger.js";
import { signJwtToken, JwtPayload } from "../../../core/utils/jwt.service.js";
import { generateRandomHex } from "../../../core/utils/crypto.js";
import { sessionService } from "./session.service.js";
import { groupMembershipService } from "../../community/services/groupMembership.service.js";
import { participationRightsService } from "../../economy/services/participationRights.service.js";
import { ParticipationRightsReason, PR_CONFIG } from "../../economy/types.js";
import { eventBus } from "../../../core/utils/eventBus.js";
import { VerificationLevel } from "../../../core/types/Ujamaadao.types.js";
import { 
  WalletAuthResult, 
  toUserResponse, 
  toSessionResponse, 
  getMissingFields 
} from "../types.js";

interface WalletLoginContext {
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
}

interface WalletNonce {
  walletAddress: string;
  nonce: string;
  expiresAt: Date;
}

// In-memory nonce storage (TODO: Replace with Redis for production multi-server setup)
const nonceStore = new Map<string, WalletNonce>();

// Brute force detection constants
const MAX_FAILED_WALLET_ATTEMPTS = 5;
const FAILED_ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

class WalletService {
  /**
   * Generate nonce for wallet signature.
   */
  async generateNonce(walletAddress: string, correlationId?: string): Promise<string> {
    if (!ethers.isAddress(walletAddress)) {
      throw ApiError.validationError("Invalid wallet address", undefined, correlationId);
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const nonce = generateRandomHex(32);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    nonceStore.set(normalizedAddress, {
      walletAddress: normalizedAddress,
      nonce,
      expiresAt,
    });

    logger.info(
      { operationType: "AUTH", metadata: { walletAddress: normalizedAddress, correlationId } },
      "Nonce generated for wallet authentication"
    );

    // Cleanup expired nonces
    this.cleanupExpiredNonces();

    return nonce;
  }

  /**
   * Verify wallet signature and login/create user.
   * Now uses sessionService for session creation with proper security tracking.
   */
  async verifyAndLogin(
    walletAddress: string,
    signature: string,
    context?: WalletLoginContext,
    correlationId?: string
  ): Promise<WalletAuthResult> {
    if (!ethers.isAddress(walletAddress)) {
      throw ApiError.validationError("Invalid wallet address", undefined, correlationId);
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const storedNonce = nonceStore.get(normalizedAddress);

    if (!storedNonce || storedNonce.expiresAt < new Date()) {
      nonceStore.delete(normalizedAddress);
      await this.trackWalletLoginEvent(null, normalizedAddress, false, "Invalid or expired nonce", context);
      throw ApiError.authenticationError("Invalid or expired nonce", undefined, correlationId);
    }

    // Verify signature
    const message = this.buildSignatureMessage(storedNonce.nonce);
    let recoveredAddress: string;
    
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (error) {
      await this.trackWalletLoginEvent(null, normalizedAddress, false, "Invalid signature format", context);
      throw ApiError.authenticationError("Invalid signature format", undefined, correlationId);
    }

    if (recoveredAddress.toLowerCase() !== normalizedAddress) {
      await this.trackWalletLoginEvent(null, normalizedAddress, false, "Signature mismatch", context);
      
      logSecurityEvent(
        "Wallet signature verification failed",
        "AUTH_FAILURE",
        "HIGH",
        "Signature does not match wallet address",
        {
          walletAddress: normalizedAddress,
          metadata: {
            recoveredAddress,
            ipAddress: context?.ipAddress,
            correlationId,
          },
        }
      );
      
      throw ApiError.authenticationError("Signature verification failed", undefined, correlationId);
    }

    // Remove used nonce (one-time use)
    nonceStore.delete(normalizedAddress);

    // Find existing user by wallet
    let user = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
      include: {
        primaryWard: { select: { id: true, constituencyId: true, countyId: true, name: true } },
        secondaryWard: { select: { id: true, constituencyId: true, countyId: true, name: true } },
        currentWard: { select: { id: true, constituencyId: true, countyId: true, name: true } },
        userRoles: {
          where: { active: true },
          include: { role: { select: { id: true, name: true } } },
        },
      },
    });

    const isNewUser = !user;

    if (!user) {
      // Create wallet-only user
      user = await prisma.user.create({
        data: {
          walletAddress: normalizedAddress,
          verificationLevel: "UNVERIFIED",
        },
        include: {
          primaryWard: { select: { id: true, constituencyId: true, countyId: true, name: true } },
          secondaryWard: { select: { id: true, constituencyId: true, countyId: true, name: true } },
          currentWard: { select: { id: true, constituencyId: true, countyId: true, name: true } },
          userRoles: {
            where: { active: true },
            include: { role: { select: { id: true, name: true } } },
          },
        },
      });

      logger.info(
        { operationType: "AUTH", userId: user.id, metadata: { walletAddress: normalizedAddress } },
        "New user created via wallet authentication"
      );

      eventBus.publish("user.created", { userId: user.id, walletAddress: normalizedAddress });
    }

    // Check if profile needs completion
    const needsProfileCompletion = !user.email || !user.primaryWardId || !user.secondaryWardId;

    if (needsProfileCompletion) {
      // Generate temporary token for profile completion (no session yet)
      const tempTokenId = randomUUID();
      
      const limitedJwt: JwtPayload = {
        sub: user.id,
        jti: tempTokenId, // Include JTI for tracking even temporary tokens
        walletAddress: normalizedAddress,
        verificationLevel: user.verificationLevel as VerificationLevel,
        roles: [],
        globalImpactPoints: 0,
        utilityTokens: 0,
        participationRights: 0,
        type: "temporary",
      };

      const tempToken = signJwtToken(limitedJwt, "1h");

      logger.info(
        { operationType: "AUTH", userId: user.id },
        "Wallet authenticated - profile completion required"
      );

      return {
        user: toUserResponse(user),
        sessionToken: tempToken,
        session: null as any, // No session for incomplete profiles
        needsProfileCompletion: true,
        missingFields: getMissingFields(user),
      };
    }

    // Complete onboarding for first-time wallet users with complete profile
    if (isNewUser || user.verificationLevel === "UNVERIFIED") {
      user = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: user!.id },
          data: {
            verificationLevel: "EMAIL_VERIFIED",
            onboardingCompletedAt: new Date(),
          },
          include: {
            primaryWard: { select: { id: true, constituencyId: true, countyId: true, name: true } },
            secondaryWard: { select: { id: true, constituencyId: true, countyId: true, name: true } },
            currentWard: { select: { id: true, constituencyId: true, countyId: true, name: true } },
            userRoles: {
              where: { active: true },
              include: { role: { select: { id: true, name: true } } },
            },
          },
        });

        // Enroll in system groups
        await groupMembershipService.enrollInSystemGroups(
          updatedUser.id, 
          updatedUser.primaryWardId!, 
          updatedUser.secondaryWardId!
        );

        // Award onboarding PR
        await participationRightsService.award(
          updatedUser.id,
          PR_CONFIG.ONBOARDING_BONUS,
          ParticipationRightsReason.ONBOARDING_COMPLETE
        );

        return updatedUser;
      });

      logger.info({ operationType: "AUTH", userId: user.id }, "User onboarded via wallet");
      eventBus.publish("user.onboarding.complete", { userId: user.id });
    }

    // Create session using sessionService
    const { session } = await sessionService.createSession(user.id, {
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      deviceInfo: context?.deviceInfo,
    });

    const roles = user.userRoles.map(ur => ur.role.name);

    // Build JWT access token with sessionId for validation
    const jwtPayload: JwtPayload = {
      sub: user.id,
      jti: session.id, // Use session ID as JWT ID for revocation
      email: user.email || undefined,
      phoneNumber: user.phoneNumber || undefined,
      walletAddress: user.walletAddress || undefined,
      primaryWardId: user.primaryWardId || undefined,
      secondaryWardId: user.secondaryWardId || undefined,
      currentLocationId: user.currentLocationId || undefined,
      currentLocationUntil: user.currentLocationUntil?.toISOString(),
      constituencyId: user.primaryWard?.constituencyId || undefined,
      countyId: user.primaryWard?.countyId || undefined,
      verificationLevel: user.verificationLevel as VerificationLevel,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      communityVerified: user.communityVerified,
      locationVerified: user.locationVerified,
      roles,
      globalImpactPoints: user.globalImpactPoints,
      utilityTokens: user.utilityTokens,
      participationRights: user.participationRights,
      type: "permanent",
      sessionId: session.id, // Include sessionId for session validation
    };

    const accessToken = signJwtToken(jwtPayload, "7d"); // 7 day access token

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Track successful login
    await this.trackWalletLoginEvent(user.id, normalizedAddress, true, null, context);

    logSecurityEvent(
      "Wallet authentication successful",
      "AUTH_SUCCESS",
      "LOW",
      "User logged in with wallet",
      {
        userId: user.id,
        ipAddress: context?.ipAddress,
        metadata: { 
          correlationId, 
          sessionId: session.id,
          walletAddress: normalizedAddress,
        },
      }
    );

    eventBus.publish("auth.login", {
      userId: user.id,
      method: "WALLET",
      sessionId: session.id,
    });

    return {
      user: toUserResponse(user),
      sessionToken: accessToken, // Return JWT access token
      session: toSessionResponse(session, true),
      needsProfileCompletion: false,
    };
  }

  /**
   * Link wallet to existing account.
   */
  async linkWallet(
    userId: string,
    walletAddress: string,
    signature: string,
    context?: WalletLoginContext,
    correlationId?: string
  ) {
    if (!ethers.isAddress(walletAddress)) {
      throw ApiError.validationError("Invalid wallet address", undefined, correlationId);
    }

    const normalizedAddress = walletAddress.toLowerCase();

    // Check if wallet is already linked to another account
    const existing = await prisma.user.findUnique({ 
      where: { walletAddress: normalizedAddress },
      select: { id: true, email: true, name: true }
    });
    
    if (existing && existing.id !== userId) {
      throw ApiError.conflict(
        "Wallet already linked to another account", 
        { existingUserId: existing.id },
        correlationId
      );
    }

    // Verify nonce
    const storedNonce = nonceStore.get(normalizedAddress);
    if (!storedNonce || storedNonce.expiresAt < new Date()) {
      nonceStore.delete(normalizedAddress);
      throw ApiError.authenticationError("Invalid or expired nonce", undefined, correlationId);
    }

    // Verify signature
    const message = this.buildSignatureMessage(storedNonce.nonce);
    let recovered: string;
    
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch (error) {
      throw ApiError.authenticationError("Invalid signature format", undefined, correlationId);
    }

    if (recovered.toLowerCase() !== normalizedAddress) {
      logSecurityEvent(
        "Wallet link signature verification failed",
        "AUTH_FAILURE",
        "MEDIUM",
        "Signature mismatch during wallet link",
        {
          userId,
          ipAddress: context?.ipAddress,
          metadata: {
            walletAddress: normalizedAddress,
            recoveredAddress: recovered,
            correlationId,
          },
        }
      );
      
      throw ApiError.authenticationError("Signature verification failed", undefined, correlationId);
    }

    // Remove used nonce
    nonceStore.delete(normalizedAddress);

    // Link wallet to user
    const user = await prisma.user.update({
      where: { id: userId },
      data: { walletAddress: normalizedAddress },
      select: { id: true, email: true, name: true, walletAddress: true },
    });

    logger.info(
      { operationType: "AUTH", userId, metadata: { walletAddress: normalizedAddress } },
      "Wallet linked to account"
    );

    logSecurityEvent(
      "Wallet linked",
      "AUTH_SUCCESS",
      "LOW",
      "User linked wallet to account",
      {
        userId,
        ipAddress: context?.ipAddress,
        metadata: {
          walletAddress: normalizedAddress,
          correlationId,
        },
      }
    );

    eventBus.publish("wallet.connected", { userId, walletAddress: normalizedAddress });

    return user;
  }

  /**
   * Disconnect wallet from account.
   */
  async disconnectWallet(userId: string, context?: WalletLoginContext, correlationId?: string) {
    const user = await prisma.user.findUnique({ 
      where: { id: userId }, 
      select: { walletAddress: true, email: true } 
    });
    
    if (!user?.walletAddress) {
      throw ApiError.notFound("No wallet connected", undefined, correlationId);
    }

    // Ensure user has alternative login method before disconnecting wallet
    if (!user.email) {
      throw ApiError.validationError(
        "Cannot disconnect wallet - no alternative login method available",
        { reason: "missing_email" },
        correlationId
      );
    }

    const walletAddress = user.walletAddress;

    await prisma.user.update({ 
      where: { id: userId }, 
      data: { walletAddress: null } 
    });

    logger.info({ operationType: "AUTH", userId }, "Wallet disconnected from account");

    logSecurityEvent(
      "Wallet disconnected",
      "AUTH_FAILURE",
      "MEDIUM",
      "User disconnected wallet from account",
      {
        userId,
        ipAddress: context?.ipAddress,
        metadata: {
          walletAddress,
          correlationId,
        },
      }
    );

    eventBus.publish("wallet.disconnected", { userId, walletAddress });

    return { success: true };
  }

  /**
   * Detect brute force wallet authentication attempts
   */
  private async detectWalletBruteForce(ipAddress: string): Promise<boolean> {
    try {
      const windowStart = new Date(Date.now() - FAILED_ATTEMPT_WINDOW_MS);
      
      const failedAttempts = await prisma.loginEvent.count({
        where: {
          method: "WALLET",
          ipAddress,
          successful: false,
          createdAt: { gte: windowStart },
        },
      });

      return failedAttempts >= MAX_FAILED_WALLET_ATTEMPTS;
    } catch (error) {
      logger.error({ operationType: "SECURITY", error }, "Failed to check wallet brute force");
      return false;
    }
  }

  /**
   * Track wallet login event with security monitoring
   */
  private async trackWalletLoginEvent(
    userId: string | null,
    walletAddress: string,
    successful: boolean,
    failureReason: string | null,
    context?: WalletLoginContext
  ) {
    try {
      const ipAddress = context?.ipAddress;
      const userAgent = context?.userAgent;

      // Check for brute force on failed attempts
      if (!successful && ipAddress) {
        const isBruteForce = await this.detectWalletBruteForce(ipAddress);
        
        if (isBruteForce) {
          logSecurityEvent(
            "Brute force wallet authentication detected",
            "BRUTE_FORCE",
            "CRITICAL",
            `${MAX_FAILED_WALLET_ATTEMPTS}+ failed wallet attempts from ${ipAddress}`,
            {
              userId: userId || undefined,
              ipAddress,
              metadata: {
                walletAddress,
                failureReason,
                userAgent,
              },
            }
          );
        }
      }

      // Only create database record if we have a userId
      if (userId) {
        await prisma.loginEvent.create({
          data: {
            userId,
            method: "WALLET",
            successful,
            failureReason,
            ipAddress,
            userAgent,
          },
        });
      } else {
        logger.warn(
          { 
            operationType: "AUTH",
            metadata: { walletAddress, failureReason, ipAddress, userAgent }
          },
          "Wallet authentication failed without user context"
        );
      }
    } catch (error) {
      logger.error({ operationType: "AUTH", userId, error }, "Failed to track wallet login event");
    }
  }

  /**
   * Build signature message for wallet authentication
   */
  private buildSignatureMessage(nonce: string): string {
    return `Welcome to UjamaaDAO!\n\nSign this message to authenticate.\n\nNonce: ${nonce}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;
  }

  /**
   * Cleanup expired nonces from memory store
   */
  public cleanupExpiredNonces(): void {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [address, nonce] of nonceStore.entries()) {
      if (nonce.expiresAt < now) {
        nonceStore.delete(address);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(
        { operationType: "AUTH", metadata: { cleanedCount } },
        "Cleaned up expired wallet nonces"
      );
    }
  }
}

export const walletService = new WalletService();

// Cleanup expired nonces every minute
setInterval(() => walletService.cleanupExpiredNonces(), 60 * 1000);