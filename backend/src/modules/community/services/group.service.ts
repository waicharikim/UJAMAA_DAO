/**
 * @file src/modules/community/services/group.service.ts
 * @description
 * Group Service — Voluntary Group Management
 *
 * Handles:
 * - Create voluntary group (spend PR)
 * - Join/leave group
 * - Basic admin (creator is leader)
 *
 * Version: 2.0 — December 2025
 */

import { prisma } from '../../../core/database/client.js';
import { participationRightsService } from '../../economy/services/participationRights.service.js';
import { ParticipationRightsReason } from '../../economy/types.js';
import { VoluntaryGroupType, LocationScope, GroupRole } from '@prisma/client';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { VOLUNTARY_GROUP_PR_COST } from '../types.js';
import { CreateVoluntaryGroupDto } from '@modules/community/types.js';

class GroupService {
  /**
   * Create voluntary group — spend PR
   */
  async createVoluntaryGroup(userId: string, dto: CreateVoluntaryGroupDto) {
    // Validate voluntaryType against the full Prisma enum
    const validTypes = Object.values(VoluntaryGroupType);

    if (!validTypes.includes(dto.voluntaryType as VoluntaryGroupType)) {
      throw ApiError.badRequest('Invalid voluntary group type');
    }

    await participationRightsService.spend(
      userId,
      VOLUNTARY_GROUP_PR_COST,
      ParticipationRightsReason.GROUP_CREATED,
      { groupType: dto.voluntaryType }
    );

    // Derive locationScope from whichever location ID is provided
    let locationScope: LocationScope = LocationScope.WARD;
    if (dto.countyId) locationScope = LocationScope.COUNTY;
    else if (dto.constituencyId) locationScope = LocationScope.CONSTITUENCY;
    else if (dto.wardId) locationScope = LocationScope.WARD;

    const group = await prisma.group.create({
      data: {
        name: dto.name,
        description: dto.description,
        isSystemGroup: false,
        locationScope,
        voluntaryType: dto.voluntaryType as VoluntaryGroupType,
        wardId: dto.wardId ?? null,
        constituencyId: dto.constituencyId ?? null,
        countyId: dto.countyId ?? null,
      },
    });

    // Creator is first member + leader
    await prisma.groupMember.create({
      data: {
        userId,
        groupId: group.id,
        role: 'LEADER',
        autoEnrolled: false,
        canLeave: true,
        joinedAt: new Date(),
        active: true,
      },
    });

    await prisma.group.update({
      where: { id: group.id },
      data: { memberCount: 1 },
    });

    logger.info(
      { userId, groupId: group.id, type: dto.voluntaryType },
      'Voluntary group created'
    );

    return group;
  }

  /**
   * Join voluntary group
   */
  async joinGroup(userId: string, groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { isSystemGroup: true },
    });

    if (!group) throw ApiError.notFound('Group');
    if (group.isSystemGroup)
      throw ApiError.badRequest('Cannot manually join system group');

    const existing = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });

    if (existing) throw ApiError.conflict('Already a member');

    const membership = await prisma.groupMember.create({
      data: {
        userId,
        groupId,
        role: 'MEMBER',
        autoEnrolled: false,
        canLeave: true,
        joinedAt: new Date(),
        active: true,
      },
    });

    await prisma.group.update({
      where: { id: groupId },
      data: { memberCount: { increment: 1 } },
    });

    await prisma.onboardingProgress
      .updateMany({
        where: { userId },
        data: { joinedVoluntaryGroup: true },
      })
      .catch(() => {
        /* non-critical */
      });

    logger.info({ userId, groupId }, 'Joined voluntary group');

    return membership;
  }

  /**
   * Leave voluntary group
   */
  async leaveGroup(userId: string, groupId: string) {
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });

    if (!membership) throw ApiError.notFound('Membership');
    if (!membership.canLeave)
      throw ApiError.forbidden('Cannot leave this group');

    await prisma.groupMember.delete({
      where: { userId_groupId: { userId, groupId } },
    });

    await prisma.group.update({
      where: { id: groupId },
      data: { memberCount: { decrement: 1 } },
    });

    logger.info({ userId, groupId }, 'Left voluntary group');

    return { success: true };
  }

  async updateGroupSettings(
    userId: string,
    groupId: string,
    dto: { name?: string; description?: string }
  ) {
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership || membership.role !== 'LEADER') {
      throw ApiError.forbidden('Only the group leader can update settings');
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw ApiError.notFound('Group');
    if (group.isSystemGroup) {
      throw ApiError.badRequest('System group settings cannot be changed');
    }

    return prisma.group.update({
      where: { id: groupId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      select: { id: true, name: true, description: true },
    });
  }

  async changeMemberRole(
    actorId: string,
    groupId: string,
    targetUserId: string,
    newRole: string
  ) {
    const actor = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: actorId, groupId } },
    });
    if (!actor || actor.role !== 'LEADER') {
      throw ApiError.forbidden('Only the group leader can change member roles');
    }
    if (targetUserId === actorId) {
      throw ApiError.badRequest('Cannot change your own role');
    }

    const target = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });
    if (!target) throw ApiError.notFound('Membership');

    return prisma.groupMember.update({
      where: { userId_groupId: { userId: targetUserId, groupId } },
      data: { role: newRole as GroupRole },
      select: { userId: true, role: true },
    });
  }

  async removeMember(actorId: string, groupId: string, targetUserId: string) {
    const actor = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: actorId, groupId } },
    });
    if (!actor || actor.role !== 'LEADER') {
      throw ApiError.forbidden('Only the group leader can remove members');
    }
    if (targetUserId === actorId) {
      throw ApiError.badRequest('Cannot remove yourself — use leave instead');
    }

    const target = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });
    if (!target) throw ApiError.notFound('Membership');

    await prisma.groupMember.delete({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });

    await prisma.group.update({
      where: { id: groupId },
      data: { memberCount: { decrement: 1 } },
    });

    logger.info({ actorId, groupId, targetUserId }, 'Member removed by leader');

    return { success: true };
  }
}

export const groupService = new GroupService();
