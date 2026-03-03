/**
 * @file src/modules/community/services/groupMembership.service.ts
 * @description
 * Group Membership Service — System Group Auto-Enrollment
 *
 * UPDATED: Now uses proper foreign key relations instead of composite IDs
 * Works with the better Group schema (progressive enhancement design)
 *
 * Version: 2.3 — February 2026 — Aligned with actual Prisma schema
 */

import { prisma } from '../../../core/database/client.js';
import { Prisma } from '@prisma/client';
import { logger } from '../../../core/logger/logger.js';
import { ApiError } from '../../../core/errors/ApiError.js';

// Import Prisma enums (auto-generated from merged schema)
import {
  LocationScope,
  GroupRole,
  GroupStatus,
  SystemGroupType,
} from '@prisma/client';

class GroupMembershipService {
  /**
   * Enroll user in system groups based on primary and secondary wards.
   *
   * Groups created (up to 7):
   * - Primary Ward + Constituency + County
   * - Secondary Ward + Constituency + County (if different)
   * - National (all users)
   */
  async enrollInSystemGroups(
    userId: string,
    primaryWardId: string,
    secondaryWardId: string
  ): Promise<void> {
    try {
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
          'Ward',
          !primaryWard ? primaryWardId : secondaryWardId
        );
      }

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const enrollmentPromises = [];

        // Primary Ward Group
        enrollmentPromises.push(
          this.ensureSystemGroupAndEnroll(
            tx,
            userId,
            primaryWard.id,
            LocationScope.WARD,
            `${primaryWard.name} Community`
          )
        );

        // Primary Constituency Group
        enrollmentPromises.push(
          this.ensureSystemGroupAndEnroll(
            tx,
            userId,
            primaryWard.constituency.id,
            LocationScope.CONSTITUENCY,
            `${primaryWard.constituency.name} Community`
          )
        );

        // Primary County Group
        enrollmentPromises.push(
          this.ensureSystemGroupAndEnroll(
            tx,
            userId,
            primaryWard.constituency.county.id,
            LocationScope.COUNTY,
            `${primaryWard.constituency.county.name} Community`
          )
        );

        // Secondary Ward Group
        enrollmentPromises.push(
          this.ensureSystemGroupAndEnroll(
            tx,
            userId,
            secondaryWard.id,
            LocationScope.WARD,
            `${secondaryWard.name} Community`
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
              `${secondaryWard.constituency.name} Community`
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
              `${secondaryWard.constituency.county.name} Community`
            )
          );
        }

        // National Group (all users)
        enrollmentPromises.push(this.ensureNationalGroupAndEnroll(tx, userId));

        await Promise.all(enrollmentPromises);
      });

      logger.info(
        {
          operationType: 'COMMUNITY',
          userId,
          metadata: { primaryWardId, secondaryWardId },
        },
        'User enrolled in system groups'
      );
    } catch (error) {
      logger.error(
        {
          operationType: 'COMMUNITY',
          userId,
          metadata: {
            primaryWardId,
            secondaryWardId,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'Failed to enroll user in system groups'
      );

      if (error instanceof ApiError) throw error;

      throw ApiError.systemError('Failed to enroll in system groups', {
        reason: 'enrollment_failed',
      });
    }
  }

  /**
   * PRIVATE: Ensure system group exists and enroll user.
   * Uses findFirst + create pattern since there is no named unique constraint
   * on the Group model for (locationScope, wardId, constituencyId, countyId).
   */
  private async ensureSystemGroupAndEnroll(
    tx: any,
    userId: string,
    locationId: string,
    locationScope: LocationScope,
    groupName: string
  ): Promise<void> {
    const whereClause = {
      isSystemGroup: true,
      locationScope,
      wardId: locationScope === LocationScope.WARD ? locationId : null,
      constituencyId:
        locationScope === LocationScope.CONSTITUENCY ? locationId : null,
      countyId: locationScope === LocationScope.COUNTY ? locationId : null,
    };

    // Find or create the system group (no named unique constraint exists)
    let group = await tx.group.findFirst({
      where: whereClause,
      select: { id: true, memberCount: true },
    });

    if (!group) {
      group = await tx.group.create({
        data: {
          name: groupName,
          description: `Official ${locationScope.toLowerCase()} community group`,
          locationScope,
          isSystemGroup: true,
          systemType: this.getSystemGroupType(locationScope),
          status: GroupStatus.ACTIVE,
          wardId: locationScope === LocationScope.WARD ? locationId : null,
          constituencyId:
            locationScope === LocationScope.CONSTITUENCY ? locationId : null,
          countyId: locationScope === LocationScope.COUNTY ? locationId : null,
        },
        select: { id: true, memberCount: true },
      });
    } else {
      await tx.group.update({
        where: { id: group.id },
        data: { lastActivity: new Date() },
      });
    }

    // Check if user is already a member
    const existingMembership = await tx.groupMember.findUnique({
      where: {
        userId_groupId: { userId, groupId: group.id },
      },
    });

    // Enroll user (upsert to handle re-enrollments)
    await tx.groupMember.upsert({
      where: {
        userId_groupId: { userId, groupId: group.id },
      },
      create: {
        userId,
        groupId: group.id,
        role: GroupRole.MEMBER,
        autoEnrolled: true,
        active: true,
        joinedAt: new Date(),
      },
      update: {
        active: true,
      },
    });

    // Update member count only if this is a new or reactivated membership
    if (!existingMembership || !existingMembership.active) {
      await tx.group.update({
        where: { id: group.id },
        data: { memberCount: { increment: 1 } },
      });
    }
  }

  /**
   * PRIVATE: Handle national group enrollment (special case — no location ID)
   */
  private async ensureNationalGroupAndEnroll(
    tx: any,
    userId: string
  ): Promise<void> {
    const whereClause = {
      isSystemGroup: true,
      locationScope: LocationScope.NATIONAL,
      wardId: null,
      constituencyId: null,
      countyId: null,
    };

    let group = await tx.group.findFirst({
      where: whereClause,
      select: { id: true, memberCount: true },
    });

    if (!group) {
      group = await tx.group.create({
        data: {
          name: 'Kenya National Community',
          description: 'Official national community group for all citizens',
          locationScope: LocationScope.NATIONAL,
          isSystemGroup: true,
          systemType: SystemGroupType.NATIONAL,
          status: GroupStatus.ACTIVE,
        },
        select: { id: true, memberCount: true },
      });
    } else {
      await tx.group.update({
        where: { id: group.id },
        data: { lastActivity: new Date() },
      });
    }

    const existingMembership = await tx.groupMember.findUnique({
      where: {
        userId_groupId: { userId, groupId: group.id },
      },
    });

    await tx.groupMember.upsert({
      where: {
        userId_groupId: { userId, groupId: group.id },
      },
      create: {
        userId,
        groupId: group.id,
        role: GroupRole.MEMBER,
        autoEnrolled: true,
        active: true,
        joinedAt: new Date(),
      },
      update: {
        active: true,
      },
    });

    if (!existingMembership || !existingMembership.active) {
      await tx.group.update({
        where: { id: group.id },
        data: { memberCount: { increment: 1 } },
      });
    }
  }

  /**
   * PRIVATE: Map LocationScope to SystemGroupType
   */
  private getSystemGroupType(scope: LocationScope): SystemGroupType {
    switch (scope) {
      case LocationScope.WARD:
        return SystemGroupType.WARD;
      case LocationScope.CONSTITUENCY:
        return SystemGroupType.CONSTITUENCY;
      case LocationScope.COUNTY:
        return SystemGroupType.COUNTY;
      case LocationScope.NATIONAL:
        return SystemGroupType.NATIONAL;
      default:
        return SystemGroupType.WARD;
    }
  }

  /**
   * Update user's group memberships when residence changes.
   */
  async updateResidenceGroups(
    userId: string,
    newPrimaryWardId: string,
    newSecondaryWardId?: string
  ): Promise<void> {
    try {
      if (!newSecondaryWardId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { secondaryWardId: true },
        });

        if (!user || !user.secondaryWardId) {
          throw ApiError.notFound('User or secondary ward not found');
        }

        newSecondaryWardId = user.secondaryWardId;
      }

      // Deactivate auto-enrolled group memberships
      await prisma.groupMember.updateMany({
        where: {
          userId,
          autoEnrolled: true,
        },
        data: {
          active: false,
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
          operationType: 'COMMUNITY',
          userId,
          metadata: { newPrimaryWardId, newSecondaryWardId },
        },
        "Updated user's system group memberships after residence change"
      );
    } catch (error) {
      logger.error(
        {
          operationType: 'COMMUNITY',
          userId,
          metadata: {
            newPrimaryWardId,
            newSecondaryWardId,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'Failed to update residence groups'
      );

      if (error instanceof ApiError) throw error;

      throw ApiError.systemError('Failed to update residence groups', {
        reason: 'update_failed',
      });
    }
  }

  /**
   * Get user's group memberships.
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
            includeSystem && !includeVoluntary
              ? true
              : includeVoluntary && !includeSystem
                ? false
                : undefined,
        },
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            isSystemGroup: true,
            systemType: true,
            voluntaryType: true,
            locationScope: true,
            status: true,
            memberCount: true,
            ward: { select: { id: true, name: true } },
            constituency: { select: { id: true, name: true } },
            county: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m: any) => ({
      groupId: m.group.id,
      groupName: m.group.name,
      systemType: m.group.systemType,
      voluntaryType: m.group.voluntaryType,
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
   * Get single group detail with the requesting user's membership role.
   */
  async getGroupById(groupId: string, userId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        description: true,
        isSystemGroup: true,
        systemType: true,
        voluntaryType: true,
        locationScope: true,
        status: true,
        memberCount: true,
        createdAt: true,
        ward: { select: { id: true, name: true } },
        constituency: { select: { id: true, name: true } },
        county: { select: { id: true, name: true } },
        members: {
          where: { userId, active: true },
          select: { role: true, joinedAt: true },
          take: 1,
        },
      },
    });

    if (!group) {
      throw ApiError.notFound('Group not found');
    }

    const userMembership = group.members[0] ?? null;
    return {
      groupId: group.id,
      groupName: group.name,
      description: group.description,
      isSystem: group.isSystemGroup,
      systemType: group.systemType,
      voluntaryType: group.voluntaryType,
      locationScope: group.locationScope,
      memberCount: group.memberCount,
      createdAt: group.createdAt.toISOString(),
      ward: group.ward,
      constituency: group.constituency,
      county: group.county,
      userRole: userMembership?.role ?? null,
      userJoinedAt: userMembership?.joinedAt?.toISOString() ?? null,
    };
  }

  /**
   * Get group members.
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
      orderBy: { joinedAt: 'asc' },
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
