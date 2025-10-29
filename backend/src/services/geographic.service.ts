/**
 * @file geographic.service.ts
 * * @description
 * UJAMAADAO Geographic Service
 * * Core service for managing geographic hierarchy and location-based operations
 * in the UJAMAADAO platform. Handles ward → constituency → county hierarchy,
 * location validation, and geographic context establishment.
 * * UJAMAADAO SPECIFIC FEATURES:
 * - Geographic hierarchy management (ward → constituency → county)
 * - Location validation and consistency checks
 * - Automatic geographic role assignments
 * - Location-based user grouping and discovery
 * - Geographic boundary enforcement
 * - Location scope calculations
 */

import { Prisma } from '@prisma/client';
import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { EventBus } from '../events/eventBus.js';
// Import canonical types via namespace import
import type * as UjamaadaoTypes from '../types/ujamaadao.types.js';

/**
 * Geographic Hierarchy Result (Local Definition)
 */
interface GeographicHierarchy {
  ward: { id: string; name: string; code?: string };
  constituency: { id: string; name: string; code?: string };
  county: { id: string; name: string; code: string };
}

/**
 * Location-based User Group (Local Definition)
 */
interface LocationUserGroup {
  locationId: string;
  locationType: 'WARD' | 'CONSTITUENCY' | 'COUNTY';
  users: Array<{
    id: string;
    name: string;
    verificationLevel: string;
    globalImpactPoints: number;
  }>;
  userCount: number;
  statistics: {
    totalImpactPoints: number;
    averageVerificationLevel: number;
    activeUsers: number;
  };
}

/**
 * UJAMAADAO Geographic Service
 */
export class GeographicService {

  /**
   * Internal simulation of GeoIP lookup for demo purposes.
   * In a real app, this would call an external service (MaxMind, Google Geo etc.)
   * and resolve the location to an actual UJAMAADAO Ward ID.
   */
  private async mockGeoIPLookup(ipAddress: string): Promise<Partial<UjamaadaoTypes.GeographicContext> | null> {
    // Mock logic: Always default to a hardcoded county/constituency for non-local IPs
    if (ipAddress.startsWith('192.168.') || ipAddress === '::1' || ipAddress === '127.0.0.1') {
      return { locationScope: 'NATIONAL', latitude: undefined, longitude: undefined };
    }

    // Simulate successful lookup to a specific County (e.g., Nairobi County)
    return {
      countyId: 'county_nairobi_047',
      locationScope: 'COUNTY',
      latitude: -1.286389,
      longitude: 36.817223,
    };
  }

  /**
   * Determines the user's comprehensive geographic context based on authentication status and IP.
   *
   * Priority:
   * 1. Authenticated User's primaryWardId (most accurate).
   * 2. GeoIP lookup (for unauthenticated users or initial location check).
   *
   * @param userId Authenticated user ID (optional).
   * @param ipAddress Request IP address.
   * @param headers Request headers (optional).
   * @returns The determined GeographicContext.
   */
  async determineContextFromRequest(
    userId?: string,
    ipAddress?: string,
    headers?: Record<string, any>
  ): Promise<UjamaadaoTypes.GeographicContext> {
    // Initialize with default (NATIONAL) scope
    let context: UjamaadaoTypes.GeographicContext = {
      primaryWardId: undefined,
      constituencyId: undefined,
      countyId: undefined,
      locationScope: 'NATIONAL',
      latitude: undefined,
      longitude: undefined,
    } as UjamaadaoTypes.GeographicContext;

    // --- Priority 1: Authenticated User's Stored Location ---
    if (userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { primaryWardId: true }
        });

        if (user?.primaryWardId) {
          const hierarchy = await this.getGeographicHierarchy(user.primaryWardId);

          context.primaryWardId = hierarchy.ward.id;
          context.constituencyId = hierarchy.constituency.id;
          context.countyId = hierarchy.county.id;
          context.locationScope = 'WARD'; // Highest resolution from user profile

          logger.debug('Context derived from Authenticated User Profile', { userId, wardId: user.primaryWardId });
          return context;
        }
      } catch (e) {
        logger.warn('Failed to retrieve user location from profile. Falling back to GeoIP.', { userId });
        // Fall through to GeoIP lookup if profile data fails
      }
    }

    // --- Priority 2: GeoIP Lookup ---
    if (ipAddress) {
      const geoIpResult = await this.mockGeoIPLookup(ipAddress);
      if (geoIpResult) {
        // If GeoIP provides a county, use that as the scope
        context = { ...context, ...geoIpResult };
      }
    }

    logger.debug('Context determined', { userId, scope: context.locationScope });
    return context;
  }
  
  /**
   * Get complete geographic hierarchy from ward ID
   */
  async getGeographicHierarchy(wardId: string): Promise<GeographicHierarchy> {
    try {
      const ward = await prisma.ward.findUnique({
        where: { id: wardId },
        include: {
          constituency: {
            include: {
              county: true
            }
          }
        }
      });

      if (!ward) {
        throw new ApiError(`Ward not found: ${wardId}`, 404, {
          code: 'WARD_NOT_FOUND'
        });
      }

      if (!ward.constituency) {
        throw new ApiError(`Ward ${wardId} has no constituency assignment`, 400, {
          code: 'INCOMPLETE_GEOGRAPHIC_HIERARCHY'
        });
      }

      if (!ward.constituency.county) {
        throw new ApiError(`Constituency ${ward.constituency.id} has no county assignment`, 400, {
          code: 'INCOMPLETE_GEOGRAPHIC_HIERARCHY'
        });
      }

      return {
        ward: {
          id: ward.id,
          name: ward.name,
          code: ward.code || undefined
        },
        constituency: {
          id: ward.constituency.id,
          name: ward.constituency.name,
          code: ward.constituency.code || undefined
        },
        county: {
          id: ward.constituency.county.id,
          name: ward.constituency.county.name,
          code: ward.constituency.county.code
        }
      };

    } catch (error) {
      logger.error('UJAMAADAO Geographic: Failed to get hierarchy', {
        wardId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Validate and establish geographic context for user
   */
  async establishGeographicContext(primaryWardId: string, userId: string): Promise<UjamaadaoTypes.GeographicContext> {
    try {
      const hierarchy = await this.getGeographicHierarchy(primaryWardId);

      const context: UjamaadaoTypes.GeographicContext = {
        primaryWardId,
        constituencyId: hierarchy.constituency.id,
        countyId: hierarchy.county.id,
        locationScope: 'WARD',
        hierarchy: {
          ward: hierarchy.ward,
          constituency: hierarchy.constituency,
          county: hierarchy.county
        }
      } as UjamaadaoTypes.GeographicContext;

      // Update user's primary ward assignment
      await prisma.user.update({
        where: { id: userId },
        data: {
          primaryWardId,
          // Constituency and county are derived and not stored directly on user
        }
      });

      // Assign geographic roles
      await this.assignGeographicRoles(userId, context);

      // Emit geographic context established event
      EventBus.publish('geographic.context.established', {
        userId,
        geographicContext: context,
        timestamp: new Date()
      });

      logger.info('UJAMAADAO Geographic: Context established', {
        userId,
        primaryWardId,
        constituencyId: context.constituencyId,
        countyId: context.countyId
      });

      return context;

    } catch (error) {
      logger.error('UJAMAADAO Geographic: Failed to establish context', {
        userId,
        primaryWardId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Assign geographic roles based on hierarchy
   */
  private async assignGeographicRoles(userId: string, context: UjamaadaoTypes.GeographicContext): Promise<void> {
    const rolesToAssign = [
      { name: 'ward:member', scope: context.primaryWardId },
      { name: 'constituency:member', scope: context.constituencyId },
      { name: 'county:member', scope: context.countyId }
    ];

    for (const roleAssignment of rolesToAssign) {
      if (roleAssignment.scope) {
        await this.assignRoleToUser(userId, roleAssignment.name, roleAssignment.scope);
      }
    }
  }

  /**
   * Assign a specific geographic role to user
   */
  private async assignRoleToUser(userId: string, roleName: string, scope: string): Promise<void> {
    const role = await prisma.role.findUnique({
      where: { name: roleName }
    });

    if (role) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId_scope: {
            userId,
            roleId: role.id,
            scope
          }
        },
        update: {
          active: true,
          updatedAt: new Date()
        },
        create: {
          userId,
          roleId: role.id,
          scope,
          assignedBy: null, // System assignment
          active: true
        }
      });
    }
  }

  /**
   * Get users by geographic location with statistics
   */
  async getUsersByLocation(locationId: string, locationType: 'WARD' | 'CONSTITUENCY' | 'COUNTY'): Promise<LocationUserGroup> {
    try {
      let users: any[] = [];

      // NOTE: Ensure your prisma.user query includes all verification flags: 
      // emailVerified, phoneVerified, communityVerified, locationVerified
      const userInclude = {
          primaryWard: true,
          userRoles: {
              include: { role: true }
          }
          // Assuming emailVerified, phoneVerified, etc. are standard columns on the User model
      };

      switch (locationType) {
        case 'WARD':
          users = await prisma.user.findMany({
            where: { primaryWardId: locationId, isActive: true },
            include: userInclude,
            orderBy: { globalImpactPoints: 'desc' }
          });
          break;

        case 'CONSTITUENCY':
          // Get all wards in constituency, then users in those wards
          const constituencyWards = await prisma.ward.findMany({
            where: { constituencyId: locationId },
            select: { id: true }
          });
          const wardIds = constituencyWards.map(ward => ward.id);
          
          users = await prisma.user.findMany({
            where: { 
              primaryWardId: { in: wardIds },
              isActive: true 
            },
            include: userInclude,
            orderBy: { globalImpactPoints: 'desc' }
          });
          break;

        case 'COUNTY':
          // Get all constituencies in county, then wards, then users
          const countyConstituencies = await prisma.constituency.findMany({
            where: { countyId: locationId },
            select: { id: true }
          });
          const constituencyIds = countyConstituencies.map(constituency => constituency.id);
          
          const countyWards = await prisma.ward.findMany({
            where: { constituencyId: { in: constituencyIds } },
            select: { id: true }
          });
          const countyWardIds = countyWards.map(ward => ward.id);
          
          users = await prisma.user.findMany({
            where: { 
              primaryWardId: { in: countyWardIds },
              isActive: true 
            },
            include: userInclude,
            orderBy: { globalImpactPoints: 'desc' }
          });
          break;
      }

      // Calculate statistics
      const statistics = {
        totalImpactPoints: users.reduce((sum, user) => sum + user.globalImpactPoints, 0),
        averageVerificationLevel: this.calculateAverageVerificationLevel(users),
        activeUsers: users.length
      };

      const userGroup: LocationUserGroup = {
        locationId,
        locationType,
        users: users.map(user => ({
          id: user.id,
          name: user.name,
          verificationLevel: this.calculateVerificationLevel(user), // FIX: Now uses updated logic
          globalImpactPoints: user.globalImpactPoints
        })),
        userCount: users.length,
        statistics
      };

      logger.debug('UJAMAADAO Geographic: Retrieved users by location', {
        locationId,
        locationType,
        userCount: users.length
      });

      return userGroup;

    } catch (error) {
      logger.error('UJAMAADAO Geographic: Failed to get users by location', {
        locationId,
        locationType,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Calculate verification level for user
   * * FIX: Aligned logic and return strings with the standardized hierarchy: UNVERIFIED, BASIC, COMMUNITY, FULLY_VERIFIED.
   * * FIX: Included the new `emailVerified` flag in the calculation.
   */
  private calculateVerificationLevel(user: any): string {
    const { emailVerified, phoneVerified, communityVerified, locationVerified } = user;
    
    // Level 3: All verification steps complete
    if (emailVerified && phoneVerified && communityVerified && locationVerified) {
      return 'FULLY_VERIFIED';
    } 
    
    // Level 2: Community Voted (Requires Basic + Community)
    if (emailVerified && phoneVerified && communityVerified) {
      return 'COMMUNITY'; 
    } 
    
    // Level 1: Basic Verification (Requires Email + Phone)
    if (emailVerified && phoneVerified) {
      return 'BASIC'; 
    } 
    
    // Level 0: Unverified
    return 'UNVERIFIED';
  }

  /**
   * Calculate average verification level for user group
   * * FIX: Updated mapping to use the standardized strings: BASIC, COMMUNITY.
   */
  private calculateAverageVerificationLevel(users: any[]): number {
    if (users.length === 0) return 0;

    const levelValues = {
      'UNVERIFIED': 0,
      'BASIC': 1,      
      'COMMUNITY': 2,  
      'FULLY_VERIFIED': 3
    };

    const total = users.reduce((sum, user) => {
      const level = this.calculateVerificationLevel(user);
      return sum + levelValues[level as keyof typeof levelValues];
    }, 0);

    return total / users.length;
  }

  /**
   * Validate geographic hierarchy consistency
   */
  async validateHierarchy(wardId: string, constituencyId?: string, countyId?: string): Promise<boolean> {
    try {
      const hierarchy = await this.getGeographicHierarchy(wardId);

      if (constituencyId && hierarchy.constituency.id !== constituencyId) {
        throw new ApiError(
          `Ward ${wardId} does not belong to constituency ${constituencyId}`,
          400,
          { code: 'HIERARCHY_VALIDATION_FAILED' }
        );
      }

      if (countyId && hierarchy.county.id !== countyId) {
        throw new ApiError(
          `Ward ${wardId} does not belong to county ${countyId}`,
          400,
          { code: 'HIERARCHY_VALIDATION_FAILED' }
        );
      }

      return true;

    } catch (error) {
      logger.error('UJAMAADAO Geographic: Hierarchy validation failed', {
        wardId,
        constituencyId,
        countyId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get all wards in a constituency
   */
  async getWardsByConstituency(constituencyId: string): Promise<Array<{ id: string; name: string; code?: string }>> {
    try {
      const wards = await prisma.ward.findMany({
        where: { constituencyId },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' }
      });

      return wards;

    } catch (error) {
      logger.error('UJAMAADAO Geographic: Failed to get wards by constituency', {
        constituencyId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get all constituencies in a county
   */
  async getConstituenciesByCounty(countyId: string): Promise<Array<{ id: string; name: string; code?: string }>> {
    try {
      const constituencies = await prisma.constituency.findMany({
        where: { countyId },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' }
      });

      return constituencies;

    } catch (error) {
      logger.error('UJAMAADAO Geographic: Failed to get constituencies by county', {
        countyId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get all counties with basic information
   */
  async getAllCounties(): Promise<Array<{ id: string; name: string; code: string }>> {
    try {
      const counties = await prisma.county.findMany({
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' }
      });

      return counties;

    } catch (error) {
      logger.error('UJAMAADAO Geographic: Failed to get all counties', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Search geographic locations by name
   */
  async searchLocations(query: string, type?: 'WARD' | 'CONSTITUENCY' | 'COUNTY'): Promise<{
    wards: Array<{ id: string; name: string; constituency: string; county: string }>;
    constituencies: Array<{ id: string; name: string; county: string }>;
    counties: Array<{ id: string; name: string; code: string }>;
  }> {
    try {
      const searchQuery = `%${query}%`;

      const [wards, constituencies, counties] = await Promise.all([
        // Search wards
        !type || type === 'WARD' ? prisma.ward.findMany({
          where: {
            name: { contains: query, mode: 'insensitive' }
          },
          include: {
            constituency: {
              include: {
                county: true
              }
            }
          },
          take: 10
        }) : [],

        // Search constituencies
        !type || type === 'CONSTITUENCY' ? prisma.constituency.findMany({
          where: {
            name: { contains: query, mode: 'insensitive' }
          },
          include: {
            county: true
          },
          take: 10
        }) : [],

        // Search counties
        !type || type === 'COUNTY' ? prisma.county.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { code: { contains: query, mode: 'insensitive' } }
            ]
          },
          take: 10
        }) : []
      ]);

      return {
        wards: wards.map(ward => ({
          id: ward.id,
          name: ward.name,
          constituency: ward.constituency.name,
          county: ward.constituency.county.name
        })),
        constituencies: constituencies.map(constituency => ({
          id: constituency.id,
          name: constituency.name,
          county: constituency.county.name
        })),
        counties: counties.map(county => ({
          id: county.id,
          name: county.name,
          code: county.code
        }))
      };

    } catch (error) {
      logger.error('UJAMAADAO Geographic: Location search failed', {
        query,
        type,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

// Export singleton instance
export const geographicService = new GeographicService();
