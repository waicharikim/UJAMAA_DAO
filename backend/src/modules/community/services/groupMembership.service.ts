/**
 * @file src/modules/community/services/groupMembership.service.ts
 * @description
 * Group Membership Service — System Group Auto-Enrollment
 *
 * UPDATED: Now uses proper foreign key relations instead of composite IDs
 * Works with the better Group schema (progressive enhancement design)
 *
 * Version: 2.2 — January 2026
 */

import { prisma } from "../../../core/database/client.js";
import { logger } from "../../../core/logger/logger.js";
import { ApiError } from "../../../core/errors/ApiError.js";

// Import Prisma enums (auto-generated)
import { LocationScope, GroupRole, AssignmentMethod, GroupType, GroupStatus } from "@prisma/client";

class GroupMembershipService {
  /**
   * Enroll user in system groups based on primary and secondary wards.
   * 
   * Groups created (up to 7):
   * - Primary Ward + Constituency + County
   * - Secondary Ward + Constituency + County (if different)
   * - National (all users)
   * 
   * @param userId - User ID
   * @param primaryWardId - Primary residence ward
   * @param secondaryWardId - Secondary residence ward (origin)
   */
  async enrollInSystemGroups(
    userId: string,
    primaryWardId: string,
    secondaryWardId: string
  ): Promise<void> {
    try {
      // Fetch ward hierarchies with proper includes
      const [primaryWard, secondaryWard] = await Promise.all([
        prisma.ward.findUnique({
          where: { id: primaryWardId },
          select: {
            id: true,
            name: true,
            constituencyId: true,
            constituency: {
              select: {
                id: true,
                name: true,
                countyId: true,
                county: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        }),
        prisma.ward.findUnique({
          where: { id: secondaryWardId },
          select: {
            id: true,
            name: true,
            constituencyId: true,
            constituency: {
              select: {
                id: true,
                name: true,
                countyId: true,
                county: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        }),
      ]);

      if (!primaryWard || !secondaryWard) {
        throw ApiError.notFound(
          "Ward",
          !primaryWard ? primaryWardId : secondaryWardId
        );
      }

      // Execute all enrollments in transaction
      await prisma.$transaction(async (tx) => {
        const enrollmentPromises = [];

        // Primary Ward Group
        enrollmentPromises.push(
          this.ensureSystemGroupAndEnroll(
            tx,
            userId,
            primaryWard.id,
            LocationScope.WARD,
            `${primaryWard.name} Community`,
            true // isPrimary
          )
        );

        // Primary Constituency Group
        enrollmentPromises.push(
          this.ensureSystemGroupAndEnroll(
            tx,
            userId,
            primaryWard.constituency.id,
            LocationScope.CONSTITUENCY,
            `${primaryWard.constituency.name} Community`,
            true
          )
        );

        // Primary County Group
        enrollmentPromises.push(
          this.ensureSystemGroupAndEnroll(
            tx,
            userId,
            primaryWard.constituency.county.id,
            LocationScope.COUNTY,
            `${primaryWard.constituency.county.name} Community`,
            true
          )
        );

        // Secondary Ward Group
        enrollmentPromises.push(
          this.ensureSystemGroupAndEnroll(
            tx,
            userId,
            secondaryWard.id,
            LocationScope.WARD,
            `${secondaryWard.name} Community`,
            false // not primary
          )
        );

        // Secondary Constituency Group (if different from primary)
        if (primaryWard.constituency.id !== secondaryWard.constituency.id) {
          enrollmentPromises.push(
            this.ensureSystemGroupAndEnroll(
              tx,
              userId,
              secondaryWard.constituency.id,
              LocationScope.CONSTITUENCY,
              `${secondaryWard.constituency.name} Community`,
              false
            )
          );
        }

        // Secondary County Group (if different from primary)
        if (
          primaryWard.constituency.county.id !==
          secondaryWard.constituency.county.id
        ) {
          enrollmentPromises.push(
            this.ensureSystemGroupAndEnroll(
              tx,
              userId,
              secondaryWard.constituency.county.id,
              LocationScope.COUNTY,
              `${secondaryWard.constituency.county.name} Community`,
              false
            )
          );
        }

        // National Group (all users)
        enrollmentPromises.push(
          this.ensureNationalGroupAndEnroll(tx, userId)
        );

        await Promise.all(enrollmentPromises);
      });

      logger.info(
        {
          operationType: "COMMUNITY",
          userId,
          metadata: { primaryWardId, secondaryWardId },
        },
        "User enrolled in system groups"
      );
    } catch (error) {
      logger.error(
        {
          operationType: "COMMUNITY",
          userId,
          metadata: {
            primaryWardId,
            secondaryWardId,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        "Failed to enroll user in system groups"
      );

      if (error instanceof ApiError) throw error;

      throw ApiError.systemError(
        "Failed to enroll in system groups",
        { reason: "enrollment_failed" }
      );
    }
  }

  /**
   * PRIVATE: Ensure system group exists and enroll user.
   * Uses proper foreign key relations with unique constraint.
   */
  private async ensureSystemGroupAndEnroll(
    tx: any,
    userId: string,
    locationId: string,
    locationScope: LocationScope,
    groupName: string,
    isPrimary: boolean
  ): Promise<void> {
    // Build where clause for unique constraint
    const whereClause: any = {
      locationScope,
      wardId: locationScope === LocationScope.WARD ? locationId : null,
      constituencyId: locationScope === LocationScope.CONSTITUENCY ? locationId : null,
      countyId: locationScope === LocationScope.COUNTY ? locationId : null,
    };

    // Build create data
    const createData: any = {
      name: groupName,
      description: `Official ${locationScope.toLowerCase()} community group`,
      locationScope,
      isSystemGroup: true,
      groupType: this.getGroupType(locationScope),
      status: GroupStatus.ACTIVE,
      wardId: locationScope === LocationScope.WARD ? locationId : null,
      constituencyId: locationScope === LocationScope.CONSTITUENCY ? locationId : null,
      countyId: locationScope === LocationScope.COUNTY ? locationId : null,
    };

    // Ensure group exists (create if missing)
    const group = await tx.group.upsert({
      where: {
        unique_system_group: whereClause,
      },
      create: createData,
      update: {
        lastActivity: new Date(), // Update activity timestamp
      },
      select: { id: true, memberCount: true },
    });

    // Check if user is already a member
    const existingMembership = await tx.groupMember.findUnique({
      where: {
        unique_member_per_group: {
          userId,
          groupId: group.id,
        },
      },
    });

    // Enroll user (upsert to handle re-enrollments)
    await tx.groupMember.upsert({
      where: {
        unique_member_per_group: {
          userId,
          groupId: group.id,
        },
      },
      create: {
        userId,
        groupId: group.id,
        role: GroupRole.MEMBER,
        assignmentMethod: AssignmentMethod.AUTO_ENROLLED,
        active: true,
        joinedAt: new Date(),
      },
      update: {
        active: true, // Reactivate if previously left
        leftAt: null,
      },
    });

    // Update member count (only if new member)
    if (!existingMembership || !existingMembership.active) {
      await tx.group.update({
        where: { id: group.id },
        data: {
          memberCount: {
            increment: 1,
          },
        },
      });
    }
  }

  /**
   * PRIVATE: Handle national group enrollment (special case - no location ID)
   */
  private async ensureNationalGroupAndEnroll(
    tx: any,
    userId: string
  ): Promise<void> {
    // National group has no specific location
    const whereClause = {
      locationScope: LocationScope.NATIONAL,
      wardId: null,
      constituencyId: null,
      countyId: null,
    };

    const createData = {
      name: "Kenya National Community",
      description: "Official national community group for all citizens",
      locationScope: LocationScope.NATIONAL,
      isSystemGroup: true,
      groupType: GroupType.NATIONAL_COMMUNITY,
      status: GroupStatus.ACTIVE,
    };

    const group = await tx.group.upsert({
      where: {
        unique_system_group: whereClause,
      },
      create: createData,
      update: {
        lastActivity: new Date(),
      },
      select: { id: true },
    });

    // Check existing membership
    const existingMembership = await tx.groupMember.findUnique({
      where: {
        unique_member_per_group: {
          userId,
          groupId: group.id,
        },
      },
    });

    // Enroll user
    await tx.groupMember.upsert({
      where: {
        unique_member_per_group: {
          userId,
          groupId: group.id,
        },
      },
      create: {
        userId,
        groupId: group.id,
        role: GroupRole.MEMBER,
        assignmentMethod: AssignmentMethod.AUTO_ENROLLED,
        active: true,
        joinedAt: new Date(),
      },
      update: {
        active: true,
        leftAt: null,
      },
    });

    // Update member count
    if (!existingMembership || !existingMembership.active) {
      await tx.group.update({
        where: { id: group.id },
        data: {
          memberCount: {
            increment: 1,
          },
        },
      });
    }
  }

  /**
   * PRIVATE: Map LocationScope to GroupType
   */
  private getGroupType(scope: LocationScope): GroupType {
    switch (scope) {
      case LocationScope.WARD:
        return GroupType.WARD_COMMUNITY;
      case LocationScope.CONSTITUENCY:
        return GroupType.CONSTITUENCY_COMMUNITY;
      case LocationScope.COUNTY:
        return GroupType.COUNTY_COMMUNITY;
      case LocationScope.NATIONAL:
        return GroupType.NATIONAL_COMMUNITY;
      default:
        return GroupType.WARD_COMMUNITY;
    }
  }

  /**
   * Update user's group memberships when residence changes.
   * 
   * @param userId - User ID
   * @param newPrimaryWardId - New primary ward
   * @param newSecondaryWardId - New secondary ward (optional)
   */
  async updateResidenceGroups(
    userId: string,
    newPrimaryWardId: string,
    newSecondaryWardId?: string
  ): Promise<void> {
    try {
      // Get user's current secondary ward if not provided
      if (!newSecondaryWardId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { secondaryWardId: true },
        });

        if (!user || !user.secondaryWardId) {
          throw ApiError.notFound("User or secondary ward not found");
        }

        newSecondaryWardId = user.secondaryWardId;
      }

      // Mark old primary groups as inactive (but keep secondary/origin groups)
      await prisma.groupMember.updateMany({
        where: {
          userId,
          assignmentMethod: AssignmentMethod.AUTO_ENROLLED,
          // Only deactivate, don't delete (keep history)
        },
        data: {
          active: false,
          leftAt: new Date(),
        },
      });

      // Re-enroll in new groups
      await this.enrollInSystemGroups(
        userId,
        newPrimaryWardId,
        newSecondaryWardId
      );

      logger.info(
        {
          operationType: "COMMUNITY",
          userId,
          metadata: { newPrimaryWardId, newSecondaryWardId },
        },
        "Updated user's system group memberships after residence change"
      );
    } catch (error) {
      logger.error(
        {
          operationType: "COMMUNITY",
          userId,
          metadata: {
            newPrimaryWardId,
            newSecondaryWardId,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        "Failed to update residence groups"
      );

      if (error instanceof ApiError) throw error;

      throw ApiError.systemError(
        "Failed to update residence groups",
        { reason: "update_failed" }
      );
    }
  }

  /**
   * Get user's group memberships.
   * 
   * @param userId - User ID
   * @param includeSystem - Include system groups (default true)
   * @param includeVoluntary - Include voluntary groups (default true)
   */
  async getUserGroups(
    userId: string,
    includeSystem: boolean = true,
    includeVoluntary: boolean = true
  ) {
    const memberships = await prisma.groupMember.findMany({
      where: {
        userId,
        active: true,
        group: {
          isSystemGroup: 
            includeSystem && !includeVoluntary ? true : 
            includeVoluntary && !includeSystem ? false : 
            undefined,
        },
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            isSystemGroup: true,
            locationScope: true,
            groupType: true,
            status: true,
            memberCount: true,
            ward: { select: { id: true, name: true } },
            constituency: { select: { id: true, name: true } },
            county: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    return memberships.map((m: any) => ({
      groupId: m.group.id,
      groupName: m.group.name,
      groupType: m.group.groupType,
      isSystem: m.group.isSystemGroup,
      locationScope: m.group.locationScope,
      role: m.role,
      joinedAt: m.joinedAt,
      memberCount: m.group.memberCount,
      ward: m.group.ward,
      constituency: m.group.constituency,
      county: m.group.county,
    }));
  }

  /**
   * Get group members.
   * 
   * @param groupId - Group ID
   * @param limit - Max members to return
   * @param offset - Pagination offset
   */
  async getGroupMembers(
    groupId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    const memberships = await prisma.groupMember.findMany({
      where: { groupId, active: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            verificationLevel: true,
            participationRights: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
      take: limit,
      skip: offset,
    });

    return memberships.map((m: any) => ({
      userId: m.user.id,
      userName: m.user.name,
      avatarUrl: m.user.avatarUrl,
      verificationLevel: m.user.verificationLevel,
      participationRights: m.user.participationRights,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }
}

export const groupMembershipService = new GroupMembershipService();