/**
 * @file user.repository.ts
 * @description
 * UJAMAADAO Enhanced User Repository
 * 
 * Encapsulates Prisma DB access for User-related queries with comprehensive
 * UJAMAADAO platform context including geographic hierarchy, economic system,
 * and progressive verification data.
 * 
 * Enhanced Features:
 * - Geographic hierarchy queries (ward → constituency → county)
 * - Economic system data access (IP, UT, PR three-tier system)
 * - Progressive verification status queries
 * - Community governance role and membership queries
 * - Location-based user operations and filtering
 * 
 * UJAMAADAO SPECIFIC ENHANCEMENTS:
 * - Geographic context inclusion in all user queries
 * - Economic system data with transaction history
 * - Verification status and progression tracking
 * - Community role assignments with geographic scoping
 * - Location-based filtering and aggregation
 * 
 * Repository Methods:
 * - Core CRUD operations with UJAMAADAO context
 * - Geographic hierarchy navigation and filtering
 * - Economic system data access and updates
 * - Verification status management
 * - Community governance role queries
 * - Location-based user discovery
 * 
 * Transaction Support:
 * - All methods accept optional transactional client (`tx`)
 * - Supports Prisma transactions for atomic operations
 * - Maintains data consistency across geographic and economic operations
 */

import prisma from '../prismaClient.js';
import type { Prisma, User, Ward, Constituency, County, UserRole, Role } from '@prisma/client';

type TxClient = Prisma.TransactionClient | typeof prisma;

/**
 * UJAMAADAO Enhanced User Include Type
 * 
 * Comprehensive include type for user queries with all platform context
 */
type UjamaadaoUserInclude = Prisma.UserInclude & {
  primaryWard?: boolean | { include: { constituency?: { include: { county?: boolean } } } };
  secondaryWard?: boolean;
  userRoles?: boolean | { include: { role?: boolean } };
  privacySettings?: boolean;
  goodsServices?: boolean;
  industry?: boolean;
  tokenBalances?: boolean;
  impactPoints?: boolean;
};

/**
 * UJAMAADAO User Repository
 * 
 * Enhanced repository with comprehensive platform context for all user operations
 */
export const UserRepository = {
  // ==========================================================================
  // CORE USER OPERATIONS
  // ==========================================================================

  /**
   * Find user by ID with comprehensive UJAMAADAO context
   */
  async findById(id: string, include?: UjamaadaoUserInclude, tx?: TxClient) {
    const client = tx ?? prisma;
    const defaultInclude: UjamaadaoUserInclude = {
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
      industry: true,
      ...include
    };

    return client.user.findUnique({
      where: { id },
      include: defaultInclude,
    });
  },

  /**
   * Find user by email or wallet address with UJAMAADAO context
   */
  async findByEmailOrWallet(email?: string, walletAddress?: string, include?: UjamaadaoUserInclude, tx?: TxClient) {
    const client = tx ?? prisma;
    const defaultInclude: UjamaadaoUserInclude = {
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
      ...include
    };

    return client.user.findFirst({
      where: {
        OR: [
          email ? { email } : undefined,
          walletAddress ? { walletAddress } : undefined,
        ].filter(Boolean) as object[],
      },
      include: defaultInclude,
    });
  },

  /**
   * Create user with UJAMAADAO platform context
   */
  async create(data: Prisma.UserCreateInput, include?: UjamaadaoUserInclude, tx?: TxClient) {
    const client = tx ?? prisma;
    const defaultInclude: UjamaadaoUserInclude = {
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
      privacySettings: true,
      goodsServices: true,
      ...include
    };

    return client.user.create({
      data,
      include: defaultInclude,
    });
  },

  /**
   * Update user with UJAMAADAO context preservation
   */
  async update(id: string, data: Prisma.UserUpdateInput, include?: UjamaadaoUserInclude, tx?: TxClient) {
    const client = tx ?? prisma;
    const defaultInclude: UjamaadaoUserInclude = {
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
      privacySettings: true,
      goodsServices: true,
      ...include
    };

    return client.user.update({
      where: { id },
      data,
      include: defaultInclude,
    });
  },

  /**
   * Find user by wallet address with comprehensive UJAMAADAO context
   */
  async findByWalletAddress(walletAddress: string, include?: UjamaadaoUserInclude, tx?: TxClient) {
    const client = tx ?? prisma;
    const defaultInclude: UjamaadaoUserInclude = {
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
      privacySettings: true,
      goodsServices: true,
      ...include
    };

    return client.user.findUnique({
      where: { walletAddress },
      include: defaultInclude,
    });
  },

  // ==========================================================================
  // GEOGRAPHIC OPERATIONS
  // ==========================================================================

  /**
   * Find users by primary ward with geographic context
   */
  async findByPrimaryWard(wardId: string, include?: UjamaadaoUserInclude, tx?: TxClient) {
    const client = tx ?? prisma;
    const defaultInclude: UjamaadaoUserInclude = {
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
      ...include
    };

    return client.user.findMany({
      where: { primaryWardId: wardId },
      include: defaultInclude,
      orderBy: { name: 'asc' }
    });
  },

  /**
   * Find users by constituency through ward hierarchy
   */
  async findByConstituency(constituencyId: string, include?: UjamaadaoUserInclude, tx?: TxClient) {
    const client = tx ?? prisma;
    const defaultInclude: UjamaadaoUserInclude = {
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
      ...include
    };

    // Get all wards in the constituency, then find users in those wards
    const wards = await client.ward.findMany({
      where: { constituencyId },
      select: { id: true }
    });

    const wardIds = wards.map((ward: { id: any; }) => ward.id);

    return client.user.findMany({
      where: { primaryWardId: { in: wardIds } },
      include: defaultInclude,
      orderBy: { name: 'asc' }
    });
  },

  /**
   * Find users by county through constituency and ward hierarchy
   */
  async findByCounty(countyId: string, include?: UjamaadaoUserInclude, tx?: TxClient) {
    const client = tx ?? prisma;
    const defaultInclude: UjamaadaoUserInclude = {
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
      ...include
    };

    // Get all constituencies in the county
    const constituencies = await client.constituency.findMany({
      where: { countyId },
      select: { id: true }
    });

    const constituencyIds = constituencies.map((constituency: { id: any; }) => constituency.id);

    // Get all wards in those constituencies
    const wards = await client.ward.findMany({
      where: { constituencyId: { in: constituencyIds } },
      select: { id: true }
    });

    const wardIds = wards.map((ward: { id: any; }) => ward.id);

    return client.user.findMany({
      where: { primaryWardId: { in: wardIds } },
      include: defaultInclude,
      orderBy: { name: 'asc' }
    });
  },

  /**
   * Find users with geographic context by verification level
   */
  async findByVerificationLevel(level: string, include?: UjamaadaoUserInclude, tx?: TxClient) {
    const client = tx ?? prisma;
    const defaultInclude: UjamaadaoUserInclude = {
      primaryWard: {
        include: {
          constituency: {
            include: {
              county: true
            }
          }
        }
      },
      ...include
    };

    // Build query based on verification level
    let whereClause: Prisma.UserWhereInput = {};

    switch (level) {
      case 'FULL_VERIFIED':
        whereClause = {
          phoneVerified: true,
          communityVerified: true,
          locationVerified: true
        };
        break;
      case 'COMMUNITY_VERIFIED':
        whereClause = {
          phoneVerified: true,
          communityVerified: true,
          locationVerified: false
        };
        break;
      case 'PHONE_VERIFIED':
        whereClause = {
          phoneVerified: true,
          communityVerified: false,
          locationVerified: false
        };
        break;
      case 'UNVERIFIED':
        whereClause = {
          phoneVerified: false,
          communityVerified: false,
          locationVerified: false
        };
        break;
    }

    return client.user.findMany({
      where: whereClause,
      include: defaultInclude,
      orderBy: { name: 'asc' }
    });
  },

  // ==========================================================================
  // ECONOMIC SYSTEM OPERATIONS
  // ==========================================================================

  /**
   * Find users by economic tier (based on impact points)
   */
  async findByEconomicTier(tier: 'TIER_1' | 'TIER_2' | 'TIER_3', include?: UjamaadaoUserInclude, tx?: TxClient) {
    const client = tx ?? prisma;
    const defaultInclude: UjamaadaoUserInclude = {
      primaryWard: true,
      userRoles: {
        include: {
          role: true
        }
      },
      ...include
    };

    let pointsRange: { gte?: number; lte?: number } = {};

    switch (tier) {
      case 'TIER_3':
        pointsRange = { gte: 501 };
        break;
      case 'TIER_2':
        pointsRange = { gte: 101, lte: 500 };
        break;
      case 'TIER_1':
        pointsRange = { lte: 100 };
        break;
    }

    return client.user.findMany({
      where: { globalImpactPoints: pointsRange },
      include: defaultInclude,
      orderBy: { globalImpactPoints: 'desc' }
    });
  },

  /**
   * Update user economic data (IP, UT, PR) atomically
   */
  async updateEconomicData(
    userId: string, 
    data: {
      globalImpactPoints?: number | { increment: number };
      utilityTokens?: number | { increment: number };
      participationRights?: number | { increment: number };
    },
    tx?: TxClient
  ) {
    const client = tx ?? prisma;
    
    return client.user.update({
      where: { id: userId },
      data: {
        ...(data.globalImpactPoints !== undefined && { 
          globalImpactPoints: data.globalImpactPoints 
        }),
        ...(data.utilityTokens !== undefined && { 
          utilityTokens: data.utilityTokens 
        }),
        ...(data.participationRights !== undefined && { 
          participationRights: data.participationRights 
        }),
      },
      include: {
        primaryWard: true
      }
    });
  },

  /**
   * Get users with highest impact points (leaderboard)
   */
  async getImpactLeaders(limit: number = 10, include?: UjamaadaoUserInclude, tx?: TxClient) {
    const client = tx ?? prisma;
    const defaultInclude: UjamaadaoUserInclude = {
      primaryWard: {
        include: {
          constituency: {
            include: {
              county: true
            }
          }
        }
      },
      ...include
    };

    return client.user.findMany({
      where: {
        globalImpactPoints: { gt: 0 },
        isActive: true
      },
      include: defaultInclude,
      orderBy: { globalImpactPoints: 'desc' },
      take: limit
    });
  },

  // ==========================================================================
  // VERIFICATION SYSTEM OPERATIONS
  // ==========================================================================

  /**
   * Update user verification status
   */
  async updateVerificationStatus(
    userId: string,
    verificationData: {
      phoneVerified?: boolean;
      communityVerified?: boolean;
      locationVerified?: boolean;
    },
    tx?: TxClient
  ) {
    const client = tx ?? prisma;

    return client.user.update({
      where: { id: userId },
      data: verificationData,
      include: {
        primaryWard: true,
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });
  },

  /**
   * Find users requiring verification (for admin purposes)
   */
  async findUsersRequiringVerification(include?: UjamaadaoUserInclude, tx?: TxClient) {
    const client = tx ?? prisma;
    const defaultInclude: UjamaadaoUserInclude = {
      primaryWard: true,
      ...include
    };

    return client.user.findMany({
      where: {
        OR: [
          { phoneVerified: false },
          { communityVerified: false },
          { locationVerified: false }
        ]
      },
      include: defaultInclude,
      orderBy: { createdAt: 'asc' }
    });
  },

  // ==========================================================================
  // COMMUNITY GOVERNANCE OPERATIONS
  // ==========================================================================

  /**
   * Find users by role with geographic context
   */
  async findByRole(roleName: string, include?: UjamaadaoUserInclude, tx?: TxClient) {
    const client = tx ?? prisma;
    const defaultInclude: UjamaadaoUserInclude = {
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
      ...include
    };

    return client.user.findMany({
      where: {
        userRoles: {
          some: {
            role: {
              name: roleName
            },
            active: true
          }
        }
      },
      include: defaultInclude,
      orderBy: { name: 'asc' }
    });
  },

  /**
   * Find users with voting eligibility (based on verification and activity)
   */
  async findVotingEligibleUsers(include?: UjamaadaoUserInclude, tx?: TxClient) {
    const client = tx ?? prisma;
    const defaultInclude: UjamaadaoUserInclude = {
      primaryWard: {
        include: {
          constituency: {
            include: {
              county: true
            }
          }
        }
      },
      ...include
    };

    return client.user.findMany({
      where: {
        // Must have at least phone verification to vote
        phoneVerified: true,
        // Must be active
        isActive: true,
        // Must have geographic context
        primaryWardId: { not: null }
      },
      include: defaultInclude,
      orderBy: { name: 'asc' }
    });
  },

  // ==========================================================================
  // ADMINISTRATIVE OPERATIONS
  // ==========================================================================

  /**
   * Get user statistics for platform analytics
   */
  async getUserStatistics(tx?: TxClient) {
    const client = tx ?? prisma;

    const [
      totalUsers,
      activeUsers,
      verifiedUsers,
      economicTierStats,
      geographicStats
    ] = await Promise.all([
      // Total users count
      client.user.count(),
      
      // Active users count
      client.user.count({ where: { isActive: true } }),
      
      // Verified users breakdown
      client.user.count({ 
        where: { 
          phoneVerified: true,
          communityVerified: true,
          locationVerified: true
        } 
      }),
      
      // Economic tier statistics
      client.user.groupBy({
        by: ['id'], // We'll process this manually for tier calculation
        where: { isActive: true },
        _count: true
      }),
      
      // Geographic distribution
      client.user.groupBy({
        by: ['primaryWardId'],
        where: { primaryWardId: { not: null } },
        _count: true
      })
    ]);

    // Calculate economic tier distribution (simplified)
    // In practice, you'd want to query based on actual impact point ranges
    const tierDistribution = {
      TIER_1: 0,
      TIER_2: 0,
      TIER_3: 0
    };

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      verificationRate: totalUsers > 0 ? (verifiedUsers / totalUsers) * 100 : 0,
      economicTierDistribution: tierDistribution,
      geographicDistribution: geographicStats.length
    };
  },

  /**
   * Soft delete user (deactivate instead of hard delete)
   */
  async softDelete(userId: string, tx?: TxClient) {
    const client = tx ?? prisma;

    return client.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        email: `deleted_${Date.now()}@deleted.com`, // Anonymize email
        phoneNumber: null, // Remove phone number
        walletAddress: `deleted_${Date.now()}`, // Anonymize wallet
        updatedAt: new Date()
      }
    });
  }
};