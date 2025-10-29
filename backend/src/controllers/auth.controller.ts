/**
 * @file auth.controller.ts
 * @description UJAMAADAO Enhanced Authentication Controller (Updated for Email Verification)
 * * Comprehensive authentication system for the UJAMAADAO platform that includes:
 * - Wallet-based authentication with nonce challenges
 * - Progressive verification status initialization (now includes Email)
 * - Geographic context establishment (ward → constituency → county)
 * - Economic system integration (impact points, utility tokens)
 * - Community governance role assignment
 * - Enhanced security monitoring and audit logging
 */

import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { logUserActivity } from '../services/userActivity.service.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';

/**
 * UJAMAADAO Nonce Response
 * * Enhanced nonce response that includes platform context and verification requirements
 */
interface UjamaadaoNonceResponse {
  nonce: string;
  platformContext: {
    name: string;
    version: string;
    verificationRequirements: {
      email: boolean; // NEW: Added email verification requirement flag
      phone: boolean;
      community: boolean;
      location: boolean;
    };
    geographicSupport: boolean;
    economicSystem: boolean;
  };
  messageTemplate: string;
}

/**
 * UJAMAADAO Authentication Response
 * * Comprehensive authentication response with full platform context
 */
interface UjamaadaoAuthResponse {
  token: string;
  user: {
    id: string;
    walletAddress: string;
    email?: string;
    phoneNumber?: string;
    
    // UJAMAADAO GEOGRAPHIC IDENTITY
    primaryWardId?: string;
    secondaryWardId?: string;
    
    // UJAMAADAO PROGRESSIVE VERIFICATION
    emailVerified: boolean; // NEW: Added email verification status
    phoneVerified: boolean;
    communityVerified: boolean;
    locationVerified: boolean;
    // UPDATED: Added EMAIL_VERIFIED level
    verificationLevel: 'UNVERIFIED' | 'EMAIL_VERIFIED' | 'PHONE_VERIFIED' | 'COMMUNITY_VERIFIED' | 'FULLY_VERIFIED';
    
    // UJAMAADAO ECONOMIC SYSTEM
    globalImpactPoints: number;
    utilityTokens: number;
    participationRights: number;
    
    // UJAMAADAO COMPUTED PROPERTIES
    votingWeight: number;
    canParticipateEconomically: boolean;
    canParticipateGovernance: boolean;
    
    // UJAMAADAO GEOGRAPHIC CONTEXT
    geographicContext?: {
      primaryWardId: string;
      constituencyId?: string;
      countyId?: string;
      locationScope: 'WARD' | 'CONSTITUENCY' | 'COUNTY' | 'NATIONAL';
    };
  };
  session: {
    expiresAt: Date;
    verificationRequired: boolean;
    geographicSetupRequired: boolean;
    economicOnboardingRequired: boolean;
  };
}

/**
 * UJAMAADAO Enhanced Nonce Handler
 * * Generates authentication nonce with platform context for wallet signature challenges.
 * Includes UJAMAADAO-specific context about verification requirements and platform capabilities.
 */
export async function getNonceHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress } = req.query;

    // UJAMAADAO VALIDATION: Enhanced wallet address validation
    if (typeof walletAddress !== 'string' || !walletAddress.trim()) {
      logger.warn('UJAMAADAO Auth: Missing or invalid walletAddress query param', { 
        query: req.query,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      throw new ApiError('walletAddress query parameter is required', 400, {
        code: 'MISSING_WALLET_ADDRESS',
        details: 'Please provide a valid Ethereum wallet address'
      });
    }

    // UJAMAADAO SECURITY: Basic wallet address format validation
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(walletAddress)) {
      logger.warn('UJAMAADAO Auth: Invalid wallet address format', { 
        walletAddress,
        ip: req.ip 
      });
      throw new ApiError('Invalid wallet address format', 400, {
        code: 'INVALID_WALLET_FORMAT',
        details: 'Please provide a valid Ethereum address (0x...)'
      });
    }

    const normalizedWallet = walletAddress.toLowerCase();
    
    logger.info('UJAMAADAO Auth: Processing nonce request', { 
      walletAddress: normalizedWallet,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // UJAMAADAO ENHANCEMENT: Get nonce with platform context
    const nonce = await authService.getNonce(normalizedWallet);

    // UJAMAADAO RESPONSE: Enhanced nonce response with platform context
    const response: UjamaadaoNonceResponse = {
      nonce,
      platformContext: {
        name: 'UJAMAADAO',
        version: '1.0.0',
        verificationRequirements: {
          email: true, // Requires email verification
          phone: true,
          community: true,
          location: true
        },
        geographicSupport: true,
        economicSystem: true
      },
      messageTemplate: `Sign this message to authenticate with UJAMAADAO Community Governance Platform. This proves you control the wallet and agree to our terms. Nonce: ${nonce}`
    };

    res.json(response);

    logger.info('UJAMAADAO Auth: Nonce generated successfully', { 
      walletAddress: normalizedWallet,
      nonceLength: nonce.length
    });

  } catch (err) {
    logger.error('UJAMAADAO Auth: Nonce generation failed', { 
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      query: req.query,
      ip: req.ip
    });
    next(err);
  }
}

/**
 * UJAMAADAO Enhanced Signature Verification Handler
 * * Verifies wallet signatures and establishes comprehensive UJAMAADAO user session
 * with geographic context, verification status, and economic system integration.
 */
export async function verifySignatureHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress, signature } = req.body;

    // UJAMAADAO VALIDATION: Comprehensive input validation
    if (!walletAddress || typeof walletAddress !== 'string' || !walletAddress.trim()) {
      logger.warn('UJAMAADAO Auth: Missing or invalid walletAddress in body', { 
        body: { ...req.body, signature: signature ? '[REDACTED]' : undefined },
        ip: req.ip
      });
      throw new ApiError('walletAddress is required in request body', 400, {
        code: 'MISSING_WALLET_ADDRESS',
        details: 'Please provide your wallet address'
      });
    }

    if (!signature || typeof signature !== 'string' || !signature.trim()) {
      logger.warn('UJAMAADAO Auth: Missing or invalid signature in body', { 
        body: { ...req.body, signature: undefined },
        ip: req.ip
      });
      throw new ApiError('signature is required in request body', 400, {
        code: 'MISSING_SIGNATURE',
        details: 'Please provide the signed message signature'
      });
    }

    // UJAMAADAO SECURITY: Signature format validation
    const signatureRegex = /^0x[a-fA-F0-9]{130}$/;
    if (!signatureRegex.test(signature)) {
      logger.warn('UJAMAADAO Auth: Invalid signature format', { 
        walletAddress,
        signatureLength: signature.length,
        ip: req.ip
      });
      throw new ApiError('Invalid signature format', 400, {
        code: 'INVALID_SIGNATURE_FORMAT',
        details: 'Please provide a valid Ethereum signature'
      });
    }

    const normalizedWallet = walletAddress.toLowerCase();
    
    logger.info('UJAMAADAO Auth: Verifying signature', { 
      walletAddress: normalizedWallet,
      signatureLength: signature.length,
      ip: req.ip
    });

    // UJAMAADAO ENHANCEMENT: Verify signature with comprehensive context
    const { token, user, geographicContext, session } = await authService.verifySignature(
      normalizedWallet, 
      signature,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        geographicData: req.body.geographicData // Optional initial geographic setup
      }
    );

    // UJAMAADAO ACTIVITY LOGGING: Comprehensive authentication event
    await logUserActivity({
      userId: user.id,
      eventType: 'LOGIN_SUCCESS',
      eventData: {
        verificationLevel: user.verificationLevel,
        geographicContext: geographicContext ? {
          primaryWardId: geographicContext.primaryWardId,
          locationScope: geographicContext.locationScope
        } : undefined,
        economicStatus: {
          impactPoints: user.globalImpactPoints,
          utilityTokens: user.utilityTokens,
          participationRights: user.participationRights
        }
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || '',
    });

    // UJAMAADAO RESPONSE: Enhanced authentication response
    const response: UjamaadaoAuthResponse = {
      token,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        email: user.email,
        phoneNumber: user.phoneNumber,
        
        // Geographic Identity
        primaryWardId: user.primaryWardId,
        secondaryWardId: user.secondaryWardId,

        // Progressive Verification
        emailVerified: user.emailVerified, // NEW: Include email status
        phoneVerified: user.phoneVerified,
        communityVerified: user.communityVerified,
        locationVerified: user.locationVerified,
        verificationLevel: user.verificationLevel,
        
        // Economic System
        globalImpactPoints: user.globalImpactPoints,
        utilityTokens: user.utilityTokens,
        participationRights: user.participationRights,
        
        // Computed Properties
        votingWeight: calculateVotingWeight(user),
        // Economic participation requires at least phone and community
        canParticipateEconomically: user.communityVerified && user.phoneVerified, 
        // Governance participation requires at least email verification
        canParticipateGovernance: user.verificationLevel !== 'UNVERIFIED', 
        
        // Geographic Context
        geographicContext: geographicContext ? {
          primaryWardId: geographicContext.primaryWardId,
          constituencyId: geographicContext.constituencyId,
          countyId: geographicContext.countyId,
          locationScope: geographicContext.locationScope
        } : undefined
      },
      session: {
        expiresAt: session.expiresAt,
        // UPDATED: Check for email, then phone, then community, then location
        verificationRequired: !user.emailVerified || !user.phoneVerified || !user.communityVerified || !user.locationVerified,
        geographicSetupRequired: !user.primaryWardId,
        economicOnboardingRequired: user.globalImpactPoints === 0 && user.utilityTokens === 0
      }
    };

    res.json(response);

    logger.info('UJAMAADAO Auth: Signature verified successfully', { 
      walletAddress: normalizedWallet,
      userId: user.id,
      verificationLevel: user.verificationLevel,
      hasGeographicContext: !!geographicContext,
      economicStatus: {
        impactPoints: user.globalImpactPoints,
        utilityTokens: user.utilityTokens
      }
    });

  } catch (err) {
    // UJAMAADAO SECURITY: Log failed authentication attempts
    logger.error('UJAMAADAO Auth: Signature verification failed', { 
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      body: { ...req.body, signature: req.body.signature ? '[REDACTED]' : undefined },
      ip: req.ip
    });

    // UJAMAADAO ACTIVITY LOGGING: Failed authentication attempt
    if (req.body.walletAddress) {
      await logUserActivity({
        userId: 'unknown', // No user ID yet for failed auth
        eventType: 'LOGIN_FAILED',
        eventData: {
          walletAddress: req.body.walletAddress,
          error: err instanceof Error ? err.message : String(err)
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });
    }

    next(err);
  }
}

/**
 * Calculate Voting Weight for UJAMAADAO User
 * * Computes voting weight based on impact points and verification level
 * according to UJAMAADAO governance rules.
 * * @param user - User object with impact points and verification data
 * @returns Voting weight multiplier
 */
function calculateVotingWeight(user: any): number {
  const baseWeight = 1.0;
  
  // Impact Point Tiers
  if (user.globalImpactPoints >= 501) {
    return baseWeight * 2.0; // Tier 3: 2x voting weight
  } else if (user.globalImpactPoints >= 101) {
    return baseWeight * 1.5; // Tier 2: 1.5x voting weight  
  } else if (user.globalImpactPoints >= 1) {
    return baseWeight * 1.0; // Tier 1: 1x voting weight
  }
  
  return baseWeight; // Default weight
}

/**
 * UJAMAADAO Session Refresh Handler
 * * Refreshes user session with updated geographic context, verification status,
 * and economic system data.
 */
export async function refreshSessionHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      throw new ApiError('Authentication required', 401);
    }

    logger.info('UJAMAADAO Auth: Refreshing session', { userId });

    // UJAMAADAO ENHANCEMENT: Refresh session with comprehensive context
    const { token, user, geographicContext, session } = await authService.refreshSession(userId);

    const response: UjamaadaoAuthResponse = {
      token,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        email: user.email,
        phoneNumber: user.phoneNumber,
        primaryWardId: user.primaryWardId,
        secondaryWardId: user.secondaryWardId,
        emailVerified: user.emailVerified, // NEW: Include email status
        phoneVerified: user.phoneVerified,
        communityVerified: user.communityVerified,
        locationVerified: user.locationVerified,
        verificationLevel: user.verificationLevel,
        globalImpactPoints: user.globalImpactPoints,
        utilityTokens: user.utilityTokens,
        participationRights: user.participationRights,
        votingWeight: calculateVotingWeight(user),
        canParticipateEconomically: user.communityVerified && user.phoneVerified,
        canParticipateGovernance: user.verificationLevel !== 'UNVERIFIED',
        geographicContext: geographicContext ? {
          primaryWardId: geographicContext.primaryWardId,
          constituencyId: geographicContext.constituencyId,
          countyId: geographicContext.countyId,
          locationScope: geographicContext.locationScope
        } : undefined
      },
      session: {
        expiresAt: session.expiresAt,
        // UPDATED: Check for email, then phone, then community, then location
        verificationRequired: !user.emailVerified || !user.phoneVerified || !user.communityVerified || !user.locationVerified,
        geographicSetupRequired: !user.primaryWardId,
        economicOnboardingRequired: user.globalImpactPoints === 0 && user.utilityTokens === 0
      }
    };

    res.json(response);

    logger.info('UJAMAADAO Auth: Session refreshed successfully', { 
      userId,
      verificationLevel: user.verificationLevel
    });

  } catch (err) {
    logger.error('UJAMAADAO Auth: Session refresh failed', { 
      error: err instanceof Error ? err.message : String(err),
      userId: req.user?.userId
    });
    next(err);
  }
}

/**
 * UJAMAADAO Logout Handler
 * * Handles user logout with comprehensive activity logging and session cleanup.
 */
export async function logoutHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      throw new ApiError('Authentication required', 401);
    }

    logger.info('UJAMAADAO Auth: Processing logout', { userId });

    // UJAMAADAO ACTIVITY LOGGING: Log logout event
    await logUserActivity({
      userId,
      eventType: 'LOGOUT',
      eventData: {
        verificationLevel: req.user?.verificationLevel,
        geographicContext: req.geographicContext
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || '',
    });

    // UJAMAADAO ENHANCEMENT: Perform any session cleanup
    await authService.invalidateSession(userId);

    res.json({ 
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });

    logger.info('UJAMAADAO Auth: Logout completed successfully', { userId });

  } catch (err) {
    logger.error('UJAMAADAO Auth: Logout failed', { 
      error: err instanceof Error ? err.message : String(err),
      userId: req.user?.userId
    });
    next(err);
  }
}