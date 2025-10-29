/**
 * @file user.service.ts
 *
 * @description
 * UJAMAADAO Enhanced Domain Service for User Management (Updated for Email Verification)
 * * Comprehensive user management service for the UJAMAADAO platform that handles:
 * - User creation with geographic hierarchy integration (ward → constituency → county)
 * - Progressive verification system management (EMAIL → phone → community → location)
 * - Three-tier economic system operations (Impact Points, Utility Tokens, Participation Rights)
 * - Community governance role assignments and geographic scoping
 * - Location-based operations with geographic validation
 * - Economic transactions and voting weight calculations
 * * UJAMAADAO SPECIFIC ENHANCEMENTS:
 * - Integration of Email Verification as the foundational verification step.
 * - Updated progressive verification workflow management.
 * - All existing features maintained.
 */

import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { logUserAudit } from '../utils/audit.util.js';
import { UserRepository } from '../repositories/user.repository.js';
import { EventBus } from '../events/eventBus.js';
import type { CreateUserInput, UpdateUserInput, VerificationInput, TokenTransferInput } from '../validation/user.validation.js';

const SERVICE_SOURCE = 'USER_SERVICE';

/**
 * UJAMAADAO User Creation Context
 * * Additional context for user creation in the community governance platform
 */
interface UjamaadaoUserContext {
  ipAddress?: string;
  userAgent?: string;
  geographicData?: {
    primaryWardId?: string;
    constituencyId?: string;
    countyId?: string;
  };
  userId?: string; // Added for audit logging context in update function
}

/**
 * UJAMAADAO Verification Context
 * * Context for verification operations in the progressive verification system
 */
interface VerificationContext {
  verificationType: 'PHONE' | 'COMMUNITY' | 'LOCATION' | 'EMAIL'; // Added 'EMAIL'
  verificationData: any;
  context: UjamaadaoUserContext;
}

/**
 * UJAMAADAO Economic Transfer Context
 * * Context for economic system operations and token transfers
 */
interface EconomicTransferContext {
  userId: string;
  recipientWalletAddress: string;
  amount: number;
  memo?: string;
  context: UjamaadaoUserContext;
}

/**
 * Validate UJAMAADAO Geographic Hierarchy
 * * Enhanced geographic validation that ensures ward → constituency → county
 * hierarchy consistency for the community governance platform.
 */
async function validateUjamaadaoGeographicHierarchy(input: CreateUserInput | UpdateUserInput) {
  const { primaryWardId, constituencyId, countyId } = input;

  // Validate primary ward exists and get its hierarchy
  if (primaryWardId) {
    const primaryWard = await prisma.ward.findUnique({
      where: { id: primaryWardId },
      include: {
        constituency: {
          include: {
            county: true
          }
        }
      }
    });

    if (!primaryWard) {
      throw new ApiError(`Invalid primary ward: ${primaryWardId}`, 400, {
        code: 'INVALID_PRIMARY_WARD',
        details: { message: 'The specified primary ward does not exist' }
      });
    }

    // Validate constituency consistency if provided
    if (constituencyId && primaryWard.constituencyId !== constituencyId) {
      throw new ApiError(
        `Primary ward ${primaryWardId} does not belong to constituency ${constituencyId}`,
        400,
        { code: 'GEOGRAPHIC_HIERARCHY_MISMATCH' }
      );
    }

    // Validate county consistency if provided
    if (countyId && primaryWard.constituency?.countyId !== countyId) {
      throw new ApiError(
        `Primary ward ${primaryWardId} does not belong to county ${countyId}`,
        400,
        { code: 'GEOGRAPHIC_HIERARCHY_MISMATCH' }
      );
    }
  }

  // Validate secondary ward if provided
  if (input.secondaryWardId) {
    const secondaryWard = await prisma.ward.findUnique({
      where: { id: input.secondaryWardId }
    });

    if (!secondaryWard) {
      throw new ApiError(`Invalid secondary ward: ${input.secondaryWardId}`, 400, {
        code: 'INVALID_SECONDARY_WARD'
      });
    }
  }
}

/**
 * Validate UJAMAADAO User References
 * * Comprehensive reference validation for user creation and updates,
 * including geographic hierarchy and economic system references.
 */
async function validateUjamaadaoUserReferences(input: CreateUserInput | UpdateUserInput) {
  // Validate industry reference
  if (input.industryId) {
    const industry = await prisma.industry.findUnique({ where: { id: input.industryId } });
    if (!industry) {
      throw new ApiError(`Invalid industry: ${input.industryId}`, 400, {
        code: 'INVALID_INDUSTRY'
      });
    }
  }

  // Validate goods/services references
  if (input.goodsServices && input.goodsServices.length > 0) {
    const count = await prisma.goodsService.count({ 
      where: { id: { in: input.goodsServices } } 
    });
    if (count !== input.goodsServices.length) {
      throw new ApiError('One or more goods/services IDs are invalid', 400, {
        code: 'INVALID_GOODS_SERVICES'
      });
    }
  }

  // Validate geographic hierarchy
  await validateUjamaadaoGeographicHierarchy(input);
}

/**
 * Calculate UJAMAADAO Verification Level
 * * Determines user's platform access level based on progressive verification
 * status according to UJAMAADAO business rules.
 */
function calculateVerificationLevel(user: any): 'UNVERIFIED' | 'EMAIL_VERIFIED' | 'PHONE_VERIFIED' | 'COMMUNITY_VERIFIED' | 'FULL_VERIFIED' {
  if (user.locationVerified && user.communityVerified && user.phoneVerified) {
    return 'FULL_VERIFIED';
  } else if (user.phoneVerified && user.communityVerified) {
    return 'COMMUNITY_VERIFIED';
  } else if (user.phoneVerified) {
    return 'PHONE_VERIFIED';
  } else if (user.emailVerified) { // New intermediate level
    return 'EMAIL_VERIFIED';
  } else {
    return 'UNVERIFIED';
  }
}

/**
 * Calculate UJAMAADAO Voting Weight
 * * Computes voting weight based on impact points according to platform
 * governance rules and economic system design.
 */
function calculateVotingWeight(globalImpactPoints: number): number {
  if (globalImpactPoints >= 501) {
    return 2.0; // Tier 3: 2x voting weight
  } else if (globalImpactPoints >= 101) {
    return 1.5; // Tier 2: 1.5x voting weight  
  } else if (globalImpactPoints >= 1) {
    return 1.0; // Tier 1: 1x voting weight
  }
  
  return 1.0; // Default weight
}

/**
 * Assign UJAMAADAO Geographic Roles
 * * Automatically assigns geographic roles based on user's primary ward
 * hierarchy for community governance participation.
 */
async function assignUjamaadaoGeographicRoles(userId: string, primaryWardId: string, tx: Prisma.TransactionClient) {
  const rolesToAssign = ['system:general_user'];
  
  // Get the geographic hierarchy
  const primaryWard = await tx.ward.findUnique({
    where: { id: primaryWardId },
    include: {
      constituency: {
        include: {
          county: true
        }
      }
    }
  });

  if (primaryWard) {
    // Assign ward membership role
    rolesToAssign.push('ward:member');
    
    // Assign constituency membership if available
    if (primaryWard.constituencyId) {
      rolesToAssign.push('constituency:member');
    }
    
    // Assign county membership if available
    if (primaryWard.constituency?.countyId) {
      rolesToAssign.push('county:member');
    }
  } else {
    // Fallback to national membership
    rolesToAssign.push('national:member');
  }

  // Assign roles to user
  for (const roleName of rolesToAssign) {
    const role = await tx.role.findUnique({ where: { name: roleName } });
    if (role) {
      await tx.userRole.create({
        data: {
          userId,
          roleId: role.id,
          scope: roleName.startsWith('ward:') ? primaryWardId : 
                 roleName.startsWith('constituency:') ? primaryWard?.constituencyId :
                 roleName.startsWith('county:') ? primaryWard?.constituency?.countyId : null,
          assignedBy: null, // System assignment
          active: true
        }
      });
    }
  }

  return rolesToAssign;
}

/**
 * Initialize UJAMAADAO Economic System
 * * Sets up the three-tier economic system for new users with initial
 * impact points, utility tokens, and participation rights.
 */
async function initializeUjamaadaoEconomicSystem(userId: string, hasGeographicContext: boolean, tx: Prisma.TransactionClient) {
  const initialData = {
    globalImpactPoints: hasGeographicContext ? 25 : 10, // Bonus for geographic setup
    utilityTokens: 0, // Start with zero, earned through participation
    participationRights: 10, // Monthly governance participation allowance
    lastPRReset: new Date()
  };

  // Update user with initial economic data
  await tx.user.update({
    where: { id: userId },
    data: initialData
  });

  // Create initial impact point transaction record
  if (initialData.globalImpactPoints > 0) {
    await tx.impactPoint.create({
      data: {
        id: randomBytes(16).toString('hex'),
        holderType: 'USER',
        userId: userId,
        points: initialData.globalImpactPoints,
        locationScope: hasGeographicContext ? 'LOCAL' : 'NATIONAL',
        description: hasGeographicContext 
          ? 'Welcome to UJAMAADAO! Geographic setup bonus (+25 IP)'
          : 'Welcome to UJAMAADAO! Platform access granted (+10 IP)',
        transactionType: 'INITIAL_GRANT',
        relatedEntityId: userId,
        relatedEntityType: 'USER'
      }
    });
  }

  return initialData;
}

/**
 * UJAMAADAO Enhanced User Creation Service
 * * Creates a new user with comprehensive UJAMAADAO platform context including
 * geographic hierarchy, progressive verification, and economic system setup.
 */
export async function createUjamaadaoUser(input: CreateUserInput, context: UjamaadaoUserContext) {
  // LOG FIX: Use metadata for non-standard context fields
  logger.info('UJAMAADAO User Service: Initiating user creation', {
    walletAddress: input.walletAddress,
    operationType: 'AUTHENTICATION',
    metadata: {
      hasGeographicData: !!input.primaryWardId,
      operation: 'USER_REGISTRATION'
    }
  });

  // Validate all references including geographic hierarchy
  await validateUjamaadaoUserReferences(input);

  // Check for existing user with same wallet or email
  const existing = await UserRepository.findByEmailOrWallet(input.email, input.walletAddress);
  if (existing) {
    throw new ApiError('User with this email or wallet address already exists', 409, {
      code: 'USER_ALREADY_EXISTS',
      details: 'A user with this email or wallet address is already registered'
    });
  }

  try {
    const result = await prisma.$transaction(async (tx: { user: { update: (arg0: { where: { id: any; }; data: { goodsServices: { connect: any; }; }; }) => any; }; }) => {
      // 1. CREATE USER WITH UJAMAADAO FIELDS
      const user = await UserRepository.create({
        walletAddress: input.walletAddress,
        email: input.email,
        passwordHash: '', // Will be set during wallet auth
        name: input.name,
        phoneNumber: input.phoneNumber,
        
        // UJAMAADAO GEOGRAPHIC IDENTITY
        primaryWardId: input.primaryWardId,
        secondaryWardId: input.secondaryWardId,
        
        // UJAMAADAO PROGRESSIVE VERIFICATION (all false initially)
        phoneVerified: false,
        communityVerified: false,
        locationVerified: false,
        
        // BASIC FIELDS
        industryId: input.industryId,
        nonce: randomBytes(16).toString('hex'), // For wallet auth
        avatarUrl: input.avatarUrl,
        
        // UJAMAADAO ECONOMIC SYSTEM (initialized separately)
        globalImpactPoints: 0,
        utilityTokens: 0,
        participationRights: 0,
        lastPRReset: new Date(),
        
        // SYSTEM FIELDS
        isActive: true,
        emailVerified: false, // Explicitly false at creation
        tokenVersion: 0
      }, tx);

      // 2. ASSIGN UJAMAADAO GEOGRAPHIC ROLES
      const assignedRoles = await assignUjamaadaoGeographicRoles(
        user.id, 
        input.primaryWardId || 'default-ward-id', 
        tx
      );

      // 3. INITIALIZE UJAMAADAO ECONOMIC SYSTEM
      const economicSetup = await initializeUjamaadaoEconomicSystem(
        user.id, 
        !!input.primaryWardId, 
        tx
      );

      // 4. CONNECT GOODS/SERVICES IF PROVIDED
      if (input.goodsServices && input.goodsServices.length > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            goodsServices: {
              connect: input.goodsServices.map((id: any) => ({ id }))
            }
          }
        });
      }

      // 5. CREATE COMPREHENSIVE AUDIT ENTRY
      await logUserAudit({
        userId: user.id,
        field: 'created',
        oldValue: null,
        newValue: JSON.stringify({
          email: user.email,
          walletAddress: user.walletAddress,
          primaryWardId: user.primaryWardId,
          economicSetup,
          assignedRoles: assignedRoles.length
        }),
        changedBy: context.userId, // Use context.userId if available
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      }, tx);

      // 6. BUILD GEOGRAPHIC CONTEXT FOR RESPONSE
      const geographicContext = input.primaryWardId ? {
        primaryWardId: input.primaryWardId,
        constituencyId: input.constituencyId,
        countyId: input.countyId,
        locationScope: 'WARD' as const
      } : undefined;

      // 7. BUILD VERIFICATION STATUS
      const verificationStatus = {
        level: calculateVerificationLevel(user),
        progress: {
          stepsCompleted: 0,
          totalSteps: 4, // Updated total steps
          nextStep: 'EMAIL_VERIFICATION' as const // Updated starting step
        }
      };

      return {
        user,
        geographicContext,
        verificationStatus,
        economicSetup: {
          ...economicSetup,
          tier: economicSetup.globalImpactPoints >= 501 ? 'TIER_3' : 
                economicSetup.globalImpactPoints >= 101 ? 'TIER_2' : 'TIER_1',
          votingWeight: calculateVotingWeight(economicSetup.globalImpactPoints)
        },
        assignedRoles
      };
    });

    // EMIT DOMAIN EVENT FOR PLATFORM COORDINATION
    // FIX: Added 'source' property
    EventBus.publish('user.created', {
      userId: result.user.id,
      email: result.user.email,
      walletAddress: result.user.walletAddress,
      verificationLevel: result.verificationStatus.level,
      geographicContext: result.geographicContext,
      economicSetup: result.economicSetup,
      source: SERVICE_SOURCE, 
    });

    // LOG FIX: Use verificationLevel and economicTier from context
    logger.info('UJAMAADAO User Service: User created successfully', {
      userId: result.user.id,
      verificationLevel: result.verificationStatus.level,
      economicTier: result.economicSetup.tier,
      operationType: 'AUTHENTICATION'
    });

    return result;

  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError('User with this email or wallet address already exists', 409, {
        code: 'USER_ALREADY_EXISTS'
      });
    }
    
    // LOG FIX: Use metadata for error details and log structure
    logger.error('UJAMAADAO User Service: User creation failed', {
      walletAddress: input.walletAddress,
      operationType: 'AUTHENTICATION',
      metadata: {
        errorMessage: err instanceof Error ? err.message : String(err),
        errorCode: (err as ApiError).code || (err as any).code || 'UNKNOWN_ERROR'
      }
    });
    
    throw err;
  }
}

/**
 * UJAMAADAO Enhanced User Update Service
 * * Updates user profile with geographic context validation and
 * comprehensive audit logging for the community governance platform.
 */
export async function updateUjamaadaoUser(id: string, input: UpdateUserInput, context: UjamaadaoUserContext) {
  const existing = await UserRepository.findById(id);
  if (!existing) {
    throw new ApiError('User not found', 404, { code: 'USER_NOT_FOUND' });
  }

  // Validate references including geographic hierarchy
  await validateUjamaadaoUserReferences(input);

  // Check for conflicts with other users
  const conflict = await UserRepository.findByEmailOrWallet(input.email, input.walletAddress);
  if (conflict && conflict.id !== id) {
    throw new ApiError('Email or wallet address already registered to another account', 409, {
      code: 'CONFLICTING_USER_DATA'
    });
  }

  const auditFields = [
    'email', 'phoneNumber', 'walletAddress', 'name',
    'primaryWardId', 'secondaryWardId', 'industryId'
  ];

  const oldValues = {} as Record<string, any>;
  for (const field of auditFields) {
    oldValues[field] = (existing as any)[field] ?? null;
  }

  const dataToUpdate: any = { ...input };
  
  // Handle goods/services connection
  if (input.goodsServices) {
    dataToUpdate.goodsServices = { 
      set: input.goodsServices.map((gid: string) => ({ id: gid })) 
    };
  }

  try {
    const updated = await prisma.$transaction(async (tx: any) => {
      const user = await UserRepository.update(id, dataToUpdate, tx);

      // Log comprehensive audit trail
      for (const field of auditFields) {
        const newValue = (user as any)[field] ?? null;
        const oldValue = oldValues[field];
        
        if (oldValue !== newValue) {
          await logUserAudit({
            userId: id,
            field,
            oldValue: oldValue !== null ? JSON.stringify(oldValue) : null,
            newValue: newValue !== null ? JSON.stringify(newValue) : null,
            changedBy: context.userId,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent
          }, tx);
        }
      }

      return user;
    });

    // Emit update event for platform coordination
    // FIX: Added 'source' property
    EventBus.publish('user.updated', {
      userId: updated.id,
      updatedFields: Object.keys(input),
      changedBy: context.userId,
      geographicContext: context.geographicData,
      source: SERVICE_SOURCE,
    });

    // LOG FIX: updatedFields is now in the log context
    logger.info('UJAMAADAO User Service: User updated successfully', {
      userId: id,
      updatedFields: Object.keys(input),
      operationType: 'GOVERNANCE' // Classify as a governance/profile operation
    });

    return updated;

  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError('Update conflicts with an existing record', 409, {
        code: 'UPDATE_CONFLICT'
      });
    }
    
    // LOG FIX: Use metadata for error details
    logger.error('UJAMAADAO User Service: User update failed', {
      userId: id,
      operationType: 'GOVERNANCE',
      metadata: {
        errorMessage: err instanceof Error ? err.message : String(err),
        errorCode: (err as ApiError).code || (err as any).code || 'UNKNOWN_ERROR'
      }
    });
    
    throw err;
  }
}

/**
 * UJAMAADAO Enhanced User Lookup by Wallet
 * * Retrieves user by wallet address with comprehensive UJAMAADAO context
 * for public profile viewing.
 */
export async function getUserByWalletWithPublicContext(walletAddress: string) {
  const user = await prisma.user.findUnique({
    where: { walletAddress },
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
      privacySettings: true
    }
  });

  if (!user) {
    throw new ApiError('User not found', 404, { code: 'USER_NOT_FOUND' });
  }

  return user;
}

/**
 * Get User with UJAMAADAO Context
 * * Retrieves user with comprehensive platform context including
 * geographic, verification, and economic data for owner views.
 */
export async function getUserWithUjamaadaoContext(userId: string) {
  return await prisma.user.findUnique({
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
      secondaryWard: true,
      userRoles: {
        include: {
          role: true
        }
      },
      privacySettings: true,
      goodsServices: true,
      industry: true
    }
  });
}

/**
 * UJAMAADAO Phone Verification Initiation
 * * Initiates the phone verification process as part of the progressive
 * verification system for economic participation.
 */
export async function initiatePhoneVerification(userId: string, context: UjamaadaoUserContext) {
  const user = await UserRepository.findById(userId);
  if (!user) {
    throw new ApiError('User not found', 404, { code: 'USER_NOT_FOUND' });
  }

  if (!user.emailVerified) {
    throw new ApiError('Prerequisite failed: Email must be verified before initiating phone verification.', 403, { code: 'EMAIL_VERIFICATION_REQUIRED' });
  }

  if (user.phoneVerified) {
    throw new ApiError('Phone already verified', 400, { code: 'PHONE_ALREADY_VERIFIED' });
  }

  // In a real implementation, this would:
  // 1. Generate verification code
  // 2. Send via SMS
  // 3. Store verification attempt with expiration

  const verificationId = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // LOG FIX: Use metadata for non-standard context fields
  logger.info('UJAMAADAO User Service: Phone verification initiated', {
    userId,
    operationType: 'VERIFICATION',
    verificationType: 'PHONE',
    metadata: {
      verificationId,
      expiresAt: expiresAt.toISOString()
    }
  });

  return {
    verificationId,
    method: 'SMS',
    expiresAt,
    nextStep: 'Enter verification code'
  };
}

/**
 * UJAMAADAO Verification Completion
 * * Completes verification steps and advances user verification level
 * with platform capability updates.
 */
export async function completeVerification(
  userId: string, 
  verificationType: string, 
  verificationData: any, 
  context: UjamaadaoUserContext
) {
  const user = await UserRepository.findById(userId);
  if (!user) {
    throw new ApiError('User not found', 404, { code: 'USER_NOT_FOUND' });
  }

  let updateData: any = {};
  let impactPointsAwarded = 0;

  switch (verificationType) {
    case 'EMAIL': // NEW CASE: Email Verification
      if (user.emailVerified) {
        throw new ApiError('Email already verified', 400, { code: 'EMAIL_ALREADY_VERIFIED' });
      }
      updateData.emailVerified = true;
      impactPointsAwarded = 5; // Small initial IP award
      break;
      
    case 'PHONE':
      if (!user.emailVerified) { // Updated Prerequisite
        throw new ApiError('Prerequisite failed: Email verification required first', 400, { code: 'EMAIL_VERIFICATION_REQUIRED' });
      }
      if (user.phoneVerified) {
        throw new ApiError('Phone already verified', 400, { code: 'PHONE_ALREADY_VERIFIED' });
      }
      updateData.phoneVerified = true;
      impactPointsAwarded = 10;
      break;

    case 'COMMUNITY':
      if (user.communityVerified) {
        throw new ApiError('Community already verified', 400, { code: 'COMMUNITY_ALREADY_VERIFIED' });
      }
      if (!user.phoneVerified) {
        throw new ApiError('Phone verification required first', 400, { code: 'PHONE_VERIFICATION_REQUIRED' });
      }
      updateData.communityVerified = true;
      impactPointsAwarded = 25;
      break;

    case 'LOCATION':
      if (user.locationVerified) {
        throw new ApiError('Location already verified', 400, { code: 'LOCATION_ALREADY_VERIFIED' });
      }
      if (!user.communityVerified) {
        throw new ApiError('Community verification required first', 400, { code: 'COMMUNITY_VERIFICATION_REQUIRED' });
      }
      updateData.locationVerified = true;
      impactPointsAwarded = 15;
      break;

    default:
      throw new ApiError('Invalid verification type', 400, { code: 'INVALID_VERIFICATION_TYPE' });
  }

  /**
 * Process Avatar Upload
 * Handles file upload, optimization, and storage for user avatars
 */
export async function processAvatarUpload(
  file: Express.Multer.File,
  context: any
): Promise<string> {
  // Implementation here
  // 1. Validate file type and size
  // 2. Optimize/resize image
  // 3. Upload to storage (S3/local)
  // 4. Return URL
  
  const avatarUrl = `/uploads/avatars/${file.filename}`;
  return avatarUrl;
}

/**
 * Get User Economic Profile
 * Returns comprehensive economic system data for user
 */
export async function getUserEconomicProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      globalImpactPoints: true,
      utilityTokens: true,
      participationRights: true,
      lastPRReset: true,
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      locationVerified: true,
    }
  });

  if (!user) {
    throw new ApiError('User not found', 404, { code: 'USER_NOT_FOUND' });
  }

  const verificationStatus = calculateVerificationStatus(user);
  const votingWeight = calculateVotingWeight(user.globalImpactPoints);
  const economicTier = determineEconomicTier(user.globalImpactPoints);

  return {
    id: user.id,
    name: user.name,
    verificationLevel: verificationStatus.overallLevel,
    impactPoints: user.globalImpactPoints,
    utilityTokens: user.utilityTokens,
    participationRights: user.participationRights,
    votingWeight,
    economicTier,
    lastPRReset: user.lastPRReset,
  };
}

/**
 * Transfer Utility Tokens
 * Handles token transfers between users with validation
 */
export async function transferUtilityTokens(
  userId: string,
  recipientWalletAddress: string,
  amount: number,
  memo: string | undefined,
  context: any
) {
  return await economicService.transferUtilityTokens({
    fromUserId: userId,
    toWalletAddress: recipientWalletAddress,
    amount,
    memo,
    geographicContext: context.geographicContext
  });
}

  const result = await prisma.$transaction(async (tx: { user: { update: (arg0: { where: { id: string; }; data: { globalImpactPoints: { increment: number; }; }; }) => any; }; impactPoint: { create: (arg0: { data: { id: string; holderType: string; userId: string; points: number; locationScope: string; description: string; transactionType: string; relatedEntityId: string; relatedEntityType: string; }; }) => any; }; }) => {
    // 1. Update verification status
    const updatedUser = await UserRepository.update(userId, updateData, tx);

    // 2. Award impact points for verification completion
    if (impactPointsAwarded > 0) {
      await tx.user.update({
        where: { id: userId },
        data: {
          globalImpactPoints: {
            increment: impactPointsAwarded
          }
        }
      });

      await tx.impactPoint.create({
        data: {
          id: randomBytes(16).toString('hex'),
          holderType: 'USER',
          userId: userId,
          points: impactPointsAwarded,
          locationScope: 'SYSTEM',
          description: `${verificationType.toLowerCase()} verification bonus`,
          transactionType: 'VERIFICATION_BONUS',
          relatedEntityId: userId,
          relatedEntityType: 'USER'
        }
      });
    }

    // 3. Log verification completion
    await logUserAudit({
      userId,
      field: `${verificationType.toLowerCase()}Verified`,
      oldValue: 'false',
      newValue: 'true',
      changedBy: context.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    }, tx);

    return updatedUser;
  });

  const newVerificationLevel = calculateVerificationLevel(result);
  const economicAccessGranted = newVerificationLevel === 'COMMUNITY_VERIFIED' || 
                               newVerificationLevel === 'FULL_VERIFIED';

  // Emit verification event
  // FIX: Added 'source' property and used 'newLevel' for clarity
  EventBus.publish('user.verified', {
    userId,
    verificationType: verificationType as 'PHONE' | 'COMMUNITY' | 'LOCATION' | 'EMAIL',
    newLevel: newVerificationLevel,
    economicAccessGranted,
    impactPointsAwarded,
    source: SERVICE_SOURCE,
  });

  // LOG FIX: Map fields to log context
  logger.info('UJAMAADAO User Service: Verification completed', {
    userId,
    verificationType: verificationType as 'PHONE' | 'COMMUNITY' | 'LOCATION' | 'EMAIL',
    verificationLevel: newVerificationLevel, // Mapping new level to the context field
    operationType: 'VERIFICATION',
    metadata: {
      impactPointsAwarded
    }
  });

  return {
    user: result,
    verificationResult: {
      newLevel: newVerificationLevel,
      economicAccessGranted,
      impactPointsAwarded
    }
  };
}

// Additional economic system methods would continue here...
// (transferUtilityTokens, getUserEconomicProfile, etc.)
