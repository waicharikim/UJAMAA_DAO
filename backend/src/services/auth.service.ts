/**
 * @file auth.service.ts
 * * @description
 * UJAMAADAO Enhanced Wallet Authentication Service (Updated for Email Verification)
 * * Comprehensive authentication service for the UJAMAADAO platform that handles:
 * - Wallet-based authentication with nonce challenges
 * - Progressive verification status integration (Now including Email)
 * - Geographic identity validation and context establishment
 * - Economic system initialization and voting weight calculation
 * - JWT token issuance with comprehensive UJAMAADAO claims
 * - Session management with geographic context
 * * UJAMAADAO SPECIFIC ENHANCEMENTS:
 * - Email verification is now the first step in the progressive verification flow.
 * - All existing features maintained and adapted.
 */

import prisma from '../prismaClient.js';
import { randomBytes } from 'crypto';
import { ApiError } from '../utils/ApiError.js';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import logger from '../utils/logger.js';

// JWT configuration for UJAMAADAO platform
const JWT_SECRET = process.env.JWT_SECRET ?? 'your_jwt_secret_here';
const JWT_EXPIRY = process.env.JWT_EXPIRY ?? '1h';
const SESSION_REFRESH_BUFFER = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * UJAMAADAO Session Interface
 * * Comprehensive session data for the community governance platform
 * including geographic context, verification status, and economic data.
 */
interface UjamaadaoSession {
  expiresAt: Date;
  geographicContext?: {
    primaryWardId: string;
    constituencyId?: string;
    countyId?: string;
    locationScope: 'WARD' | 'CONSTITUENCY' | 'COUNTY' | 'NATIONAL';
  };
  verificationRequired: boolean;
  geographicSetupRequired: boolean;
  economicOnboardingRequired: boolean;
}

/**
 * UJAMAADAO Authentication Response
 * * Enhanced authentication response with comprehensive platform context
 */
interface UjamaadaoAuthResponse {
  token: string;
  user: any;
  geographicContext?: {
    primaryWardId: string;
    constituencyId?: string;
    countyId?: string;
    locationScope: 'WARD' | 'CONSTITUENCY' | 'COUNTY' | 'NATIONAL';
  };
  session: UjamaadaoSession;
}

/**
 * UJAMAADAO Signature Verification Options
 * * Additional context for enhanced authentication processing
 */
interface VerifySignatureOptions {
  ipAddress?: string;
  userAgent?: string;
  geographicData?: {
    primaryWardId?: string;
    constituencyId?: string;
    countyId?: string;
  };
}

/**
 * UJAMAADAO Enhanced Nonce Generation Service
 * * Retrieves existing user by wallet address and generates a fresh nonce for authentication.
 * Includes comprehensive validation of user registration status and geographic context.
 */
export async function getNonce(walletAddress: string): Promise<string> {
  // Normalize wallet address for consistent lookup
  const normalizedWallet = String(walletAddress).toLowerCase();

  // UJAMAADAO VALIDATION: Basic wallet address format check
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!ethAddressRegex.test(normalizedWallet)) {
    throw new ApiError(
      'Invalid wallet address format', 
      400,
      {
        code: 'INVALID_WALLET_FORMAT',
        details: 'Please provide a valid Ethereum address (0x...)',
        userMessage: 'The wallet address format is invalid. Please check and try again.'
      }
    );
  }

  // UJAMAADAO REQUIREMENT: User must exist via registration flow first
  let user = await prisma.user.findUnique({ 
    where: { walletAddress: normalizedWallet },
    include: {
      primaryWard: {
        include: {
          constituency: {
            include: {
              county: true
            }
          }
        }
      }
    }
  });

  if (!user) {
    // UJAMAADAO SECURITY: No auto-creation of users during auth
    throw new ApiError(
      'Please complete user registration with geographic data before authentication', 
      400,
      {
        code: 'REGISTRATION_REQUIRED',
        details: 'Users must complete geographic registration before wallet authentication',
        nextStep: '/api/users/register',
        userMessage: 'Please complete your registration with geographic information first.'
      }
    );
  }

  // UJAMAADAO VALIDATION: Ensure user has required geographic context
  validateUserGeographicContext(user);

  // UJAMAADAO SECURITY: Generate fresh nonce for each authentication attempt
  const nonce = randomBytes(16).toString('hex');
  
  // Update user with new nonce for next authentication
  await prisma.user.update({
    where: { walletAddress: normalizedWallet },
    data: { nonce }
  });

  logger.info('UJAMAADAO Auth: Nonce generated successfully', {
    walletAddress: normalizedWallet,
    hasGeographicContext: !!user.primaryWardId,
    verificationLevel: calculateVerificationLevel(user)
  });

  return nonce;
}

/**
 * UJAMAADAO Enhanced Signature Verification Service
 * * Verifies wallet signature against stored nonce and issues JWT with comprehensive UJAMAADAO claims.
 * Includes geographic context establishment, economic system integration, and session management.
 */
export async function verifySignature(
  walletAddress: string, 
  signature: string,
  options: VerifySignatureOptions = {}
): Promise<UjamaadaoAuthResponse> {
  const normalizedWallet = String(walletAddress).toLowerCase();

  // UJAMAADAO ENHANCEMENT: Fetch comprehensive user data for JWT claims
  const user = await prisma.user.findUnique({ 
    where: { walletAddress: normalizedWallet },
    include: {
      // Include geographic hierarchy for location-based operations
      primaryWard: {
        include: {
          constituency: {
            include: {
              county: true
            }
          }
        }
      },
      // Include roles for permission-based access
      userRoles: {
        include: {
          role: true
        }
      },
      // Include economic data for three-tier system
      tokenBalances: true
    }
  });

  if (!user) {
    throw new ApiError(
      'User not found. Please complete registration first.', 
      404,
      {
        code: 'USER_NOT_FOUND',
        details: 'No user found with this wallet address. Registration required.',
        nextStep: '/api/users/register'
      }
    );
  }

  // UJAMAADAO VALIDATION: Ensure user has required geographic context
  validateUserGeographicContext(user);

  // UJAMAADAO SECURITY: Construct the exact message that should be signed
  const message = `UJAMAADAO Login Nonce: ${user.nonce}`;

  let recoveredAddress;
  try {
    // Verify signature using ethers.js - returns the signing address
    recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
  } catch (err) {
    // Cryptographic verification failed - invalid signature format
    logger.warn('UJAMAADAO Auth: Signature verification failed', {
      walletAddress: normalizedWallet,
      error: err instanceof Error ? err.message : String(err),
      ipAddress: options.ipAddress
    });
    
    throw new ApiError(
      'Invalid signature format', 
      401,
      {
        code: 'INVALID_SIGNATURE_FORMAT',
        details: 'The provided signature could not be verified.',
        userMessage: 'The signature verification failed. Please try again.'
      }
    );
  }

  // UJAMAADAO SECURITY: Ensure signature matches expected wallet address
  if (recoveredAddress !== normalizedWallet) {
    logger.warn('UJAMAADAO Auth: Signature address mismatch', {
      expected: normalizedWallet,
      recovered: recoveredAddress,
      ipAddress: options.ipAddress
    });
    
    throw new ApiError(
      'Signature does not match wallet address', 
      401,
      {
        code: 'SIGNATURE_MISMATCH',
        details: 'The signature does not correspond to the provided wallet address.',
        userMessage: 'Signature verification failed. Please ensure you are signing with the correct wallet.'
      }
    );
  }

  /**
   * UJAMAADAO SECURITY: Nonce Rotation
   * * Critical security measure to prevent replay attacks
   */
  const newNonce = randomBytes(16).toString('hex');
  await prisma.user.update({
    where: { walletAddress: normalizedWallet },
    data: { nonce: newNonce },
  });

  /**
   * UJAMAADAO ENHANCEMENT: Calculate Verification Level
   */
  const verificationLevel = calculateVerificationLevel(user);

  /**
   * UJAMAADAO ENHANCEMENT: Calculate Voting Weight
   */
  const votingWeight = calculateVotingWeight(user);

  /**
   * UJAMAADAO ENHANCEMENT: Build Geographic Context
   */
  const geographicContext = buildGeographicContext(user);

  /**
   * UJAMAADAO ENHANCEMENT: Economic Status Calculation
   */
  const economicStatus = calculateEconomicStatus(user, verificationLevel);

  /**
   * UJAMAADAO ENHANCEMENT: JWT Token with Comprehensive Platform Claims
   */
  const tokenPayload = {
    walletAddress: normalizedWallet,
    userId: user.id,
    // UJAMAADAO GEOGRAPHIC CONTEXT
    primaryWardId: user.primaryWardId,
    constituencyId: user.primaryWard?.constituency?.id,
    countyId: user.primaryWard?.constituency?.county?.id,
    // UJAMAADAO VERIFICATION STATUS
    emailVerified: user.emailVerified, // NEW: Added to JWT claims
    phoneVerified: user.phoneVerified,
    communityVerified: user.communityVerified,
    locationVerified: user.locationVerified,
    verificationLevel: verificationLevel,
    // UJAMAADAO ECONOMIC SYSTEM
    globalImpactPoints: user.globalImpactPoints,
    utilityTokens: user.utilityTokens,
    participationRights: user.participationRights,
    // UJAMAADAO COMPUTED PROPERTIES
    votingWeight: votingWeight,
    canParticipateEconomically: economicStatus.canParticipateEconomically,
    canParticipateGovernance: economicStatus.canParticipateGovernance,
    // UJAMAADAO ROLES AND PERMISSIONS
    roles: user.userRoles.map(ur => ({
      role: ur.role.name,
      scope: ur.scope
    }))
  };

  const token = jwt.sign(
    tokenPayload,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  /**
   * UJAMAADAO ENHANCEMENT: Session Management
   */
  const session = createSession(user, geographicContext);

  /**
   * UJAMAADAO RESPONSE: Safe User Object with Enhanced Context
   */
  const { nonce: _nonce, passwordHash: _passwordHash, ...userSafe } = user;
  
  // Add computed properties to response
  (userSafe as any).verificationLevel = verificationLevel;
  (userSafe as any).votingWeight = votingWeight;
  (userSafe as any).canParticipateEconomically = economicStatus.canParticipateEconomically;
  (userSafe as any).canParticipateGovernance = economicStatus.canParticipateGovernance;
  (userSafe as any).emailVerified = user.emailVerified; // NEW: Added to safe user object

  logger.info('UJAMAADAO Auth: Signature verified successfully', {
    userId: user.id,
    walletAddress: normalizedWallet,
    verificationLevel,
    hasGeographicContext: !!geographicContext,
    economicStatus
  });

  return {
    token,
    user: userSafe,
    geographicContext,
    session
  };
}

/**
 * UJAMAADAO Session Refresh Service
 * * Validates existing user session and issues new token with updated context.
 * Refreshes geographic, verification, and economic data for current session.
 */
export async function refreshSession(userId: string): Promise<UjamaadaoAuthResponse> {
  // Fetch latest user data with comprehensive context
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      primaryWard: {
        include: {
          constituency: {
            include: {
              county: true
            }
          }
        }
      },
      userRoles: {
        include: {
          role: true
        }
      },
      tokenBalances: true
    }
  });

  if (!user) {
    throw new ApiError(
      'User not found during session refresh', 
      404,
      { code: 'USER_NOT_FOUND' }
    );
  }

  if (!user.isActive) {
    throw new ApiError(
      'User account is inactive', 
      401,
      { code: 'ACCOUNT_INACTIVE' }
    );
  }

  // UJAMAADAO VALIDATION: Ensure geographic context is still valid
  validateUserGeographicContext(user);

  // Recalculate all dynamic properties
  const verificationLevel = calculateVerificationLevel(user);
  const votingWeight = calculateVotingWeight(user);
  const geographicContext = buildGeographicContext(user);
  const economicStatus = calculateEconomicStatus(user, verificationLevel);

  // Create new token with updated claims
  const tokenPayload = {
    walletAddress: user.walletAddress,
    userId: user.id,
    primaryWardId: user.primaryWardId,
    constituencyId: user.primaryWard?.constituency?.id,
    countyId: user.primaryWard?.constituency?.county?.id,
    emailVerified: user.emailVerified, // NEW: Added to JWT claims
    phoneVerified: user.phoneVerified,
    communityVerified: user.communityVerified,
    locationVerified: user.locationVerified,
    verificationLevel: verificationLevel,
    globalImpactPoints: user.globalImpactPoints,
    utilityTokens: user.utilityTokens,
    participationRights: user.participationRights,
    votingWeight: votingWeight,
    canParticipateEconomically: economicStatus.canParticipateEconomically,
    canParticipateGovernance: economicStatus.canParticipateGovernance,
    roles: user.userRoles.map(ur => ({
      role: ur.role.name,
      scope: ur.scope
    }))
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

  // Create updated session
  const session = createSession(user, geographicContext);

  // Prepare safe user object
  const { nonce: _nonce, passwordHash: _passwordHash, ...userSafe } = user;
  (userSafe as any).verificationLevel = verificationLevel;
  (userSafe as any).votingWeight = votingWeight;
  (userSafe as any).canParticipateEconomically = economicStatus.canParticipateEconomically;
  (userSafe as any).canParticipateGovernance = economicStatus.canParticipateGovernance;
  (userSafe as any).emailVerified = user.emailVerified; // NEW: Added to safe user object

  logger.info('UJAMAADAO Auth: Session refreshed successfully', {
    userId,
    verificationLevel,
    economicStatus
  });

  return {
    token,
    user: userSafe,
    geographicContext,
    session
  };
}

/**
 * UJAMAADAO Session Invalidation Service
 * * Performs any necessary cleanup when users log out or sessions expire.
 */
export async function invalidateSession(userId: string): Promise<void> {
  // Currently this is a placeholder for future session management features
  // In a production system, you might:
  // - Add session to a blocklist
  // - Update lastLogout timestamp
  // - Clear sensitive cached data
  
  logger.info('UJAMAADAO Auth: Session invalidated', { userId });
}

/**
 * UJAMAADAO Verification Level Calculator
 * * Determines user's platform access level based on progressive verification status.
 * * @param user - User object with verification status flags
 * @returns Verification level string
 */
function calculateVerificationLevel(user: any): 'UNVERIFIED' | 'EMAIL_VERIFIED' | 'PHONE_VERIFIED' | 'COMMUNITY_VERIFIED' | 'FULLY_VERIFIED' {
  // FULLY_VERIFIED: Complete geographic and community verification
  if (user.locationVerified && user.communityVerified && user.phoneVerified) {
    return 'FULLY_VERIFIED';
  }
  
  // COMMUNITY_VERIFIED: Economic participation enabled
  else if (user.phoneVerified && user.communityVerified) {
    return 'COMMUNITY_VERIFIED';
  }
  
  // PHONE_VERIFIED: Basic platform access, but before community
  else if (user.phoneVerified) {
    return 'PHONE_VERIFIED';
  }
  
  // EMAIL_VERIFIED: Minimum access level after initial email confirmation
  else if (user.emailVerified) {
    return 'EMAIL_VERIFIED';
  }

  // UNVERIFIED: Registration complete but no verification steps
  else {
    return 'UNVERIFIED';
  }
}

/**
 * UJAMAADAO Voting Weight Calculator
 * * Computes voting weight based on impact points according to governance rules.
 * * @param user - User object with impact points data
 * @returns Voting weight multiplier
 */
function calculateVotingWeight(user: any): number {
  const baseWeight = 1.0;
  const impactPoints = user.globalImpactPoints || 0;
  
  // Impact Point Tiers from business rules
  if (impactPoints >= 501) {
    return baseWeight * 2.0; // Tier 3: 2x voting weight
  } else if (impactPoints >= 101) {
    return baseWeight * 1.5; // Tier 2: 1.5x voting weight  
  } else if (impactPoints >= 1) {
    return baseWeight * 1.0; // Tier 1: 1x voting weight
  }
  
  return baseWeight; // Default weight for new users
}

/**
 * Build Geographic Context for UJAMAADAO User
 * * Constructs comprehensive geographic context from user's primary ward hierarchy.
 * * @param user - User object with geographic relationships
 * @returns Geographic context object
 */
function buildGeographicContext(user: any): { primaryWardId: string; constituencyId?: string; countyId?: string; locationScope: 'WARD' | 'CONSTITUENCY' | 'COUNTY' | 'NATIONAL' } | undefined {
  if (!user.primaryWard) return undefined;

  return {
    primaryWardId: user.primaryWard.id,
    constituencyId: user.primaryWard.constituency?.id,
    countyId: user.primaryWard.constituency?.county?.id,
    locationScope: 'WARD' // Default operating scope
  };
}

/**
 * Calculate Economic Status for UJAMAADAO User
 * * Determines user's economic participation capabilities based on verification and data.
 * * @param user - User object with economic data
 * @param verificationLevel - User's current verification level
 * @returns Economic status flags
 */
function calculateEconomicStatus(user: any, verificationLevel: string): { canParticipateEconomically: boolean; canParticipateGovernance: boolean } {
  return {
    // Economic participation requires COMMUNITY_VERIFIED (Phone + Community) or higher
    canParticipateEconomically: verificationLevel === 'COMMUNITY_VERIFIED' || verificationLevel === 'FULLY_VERIFIED',
    // Governance participation requires at least EMAIL_VERIFIED (no longer just UNVERIFIED)
    canParticipateGovernance: verificationLevel !== 'UNVERIFIED' 
  };
}

/**
 * Create UJAMAADAO Session Object
 * * Builds comprehensive session data for the community governance platform.
 * * @param user - User object with verification and economic data
 * @param geographicContext - User's geographic context
 * @returns Session object with platform requirements
 */
function createSession(user: any, geographicContext: any): UjamaadaoSession {
  // Check if any verification is incomplete (Email is the first gate)
  const verificationRequired = !user.emailVerified || !user.phoneVerified || !user.communityVerified || !user.locationVerified;
  
  return {
    expiresAt: new Date(Date.now() + (60 * 60 * 1000)), // 1 hour from now
    geographicContext,
    verificationRequired, // UPDATED to include email check
    geographicSetupRequired: !user.primaryWardId,
    economicOnboardingRequired: (user.globalImpactPoints === 0 && user.utilityTokens === 0)
  };
}