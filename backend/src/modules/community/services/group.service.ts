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
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';
import { Prisma } from '@prisma/client';

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

    await auditService.log(
      userId,
      AuditAction.GROUP_CREATED,
      'Group',
      group.id,
      { type: dto.voluntaryType, name: dto.name, wardId: group.wardId ?? null }
    );

    // Generate and store the Ward Declaration as the genesis document
    await groupService.generateDeclaration(group.id, dto.name, group.createdAt);

    return group;
  }

  /**
   * Generate and persist the Ward Declaration genesis document.
   * Called on group creation. Also called explicitly for system groups by seed.
   */
  async generateDeclaration(
    groupId: string,
    wardName: string,
    registeredAt: Date
  ) {
    const dateStr = registeredAt.toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const shortId = groupId.split('-')[0].toUpperCase();

    const declarationText = `You have always been the government.

The word means: the people who make collective decisions about collective life. That is you. That has always been you.

The infrastructure that was supposed to carry that fact was captured. Not lost. Captured. By people who understood that whoever controls the infrastructure of governance controls the outcomes of governance. They were right about the infrastructure. They were wrong about the people.

This platform is returning that infrastructure to its original owner.

${wardName} is now a governance unit. Not symbolically. Constitutionally. What you propose here is real. What you vote on here is binding. What you fund here belongs to your ward.

Every transaction is on-chain. Every vote is permanent. Every participation record belongs to the person who earned it and cannot be taken away.

Nobody controls this treasury alone.

Not the ward admin. Not the platform. Not any funder, government, or external institution. The ward governs itself. That is the design. That is the point.

You are inheriting a broken system.

You are not obligated to maintain it.

You are not waiting for permission to replace it.

The people who captured governance were counting on you not knowing it was always yours. Now you know.

The borehole you fund, the school library you build, the generator your ward installs — these are not small things. They are demonstrations. Evidence. Proof that communities have always been capable of governing themselves when given infrastructure equal to their capacity.

Ujamaa.
Familyhood. Cooperative economics.
The principle that we rise or fall together.

This is not a new idea. This is the oldest true idea.

Welcome to your ward.

${wardName}  ·  ${dateStr}  ·  ${shortId}`;

    await prisma.wardDeclaration.upsert({
      where: { groupId },
      update: {},
      create: {
        groupId,
        wardName,
        registeredAt,
        declarationText,
      },
    });
  }

  /**
   * Dissolve a voluntary group.
   * Only the leader can dissolve. System groups cannot be dissolved.
   * Requires zero treasury balance (funds must be redistributed first).
   */
  async dissolveGroup(userId: string, groupId: string, reason: string) {
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership || membership.role !== 'LEADER') {
      throw ApiError.forbidden('Only the group leader can dissolve the group');
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        isSystemGroup: true,
        treasuryBalance: true,
        name: true,
        status: true,
      },
    });
    if (!group) throw ApiError.notFound('Group');
    if (group.isSystemGroup)
      throw ApiError.badRequest('System groups cannot be dissolved');
    if (group.status === 'DISSOLVED')
      throw ApiError.conflict('Group is already dissolved');
    if (new Prisma.Decimal(group.treasuryBalance).greaterThan(0)) {
      throw ApiError.badRequest(
        'Cannot dissolve a group with funds in treasury. Redistribute or withdraw all funds first.'
      );
    }

    // Mark dissolved + deactivate all memberships in a transaction
    await prisma.$transaction([
      prisma.group.update({
        where: { id: groupId },
        data: { status: 'DISSOLVED' },
      }),
      prisma.groupMember.updateMany({
        where: { groupId },
        data: { active: false },
      }),
    ]);

    logger.info({ userId, groupId }, 'Group dissolved');

    await auditService.log(
      userId,
      AuditAction.GROUP_DISSOLVED,
      'Group',
      groupId,
      { name: group.name, reason }
    );

    return { success: true, groupId, status: 'DISSOLVED' };
  }

  /**
   * Retrieve the Ward Declaration for a group.
   */
  async getDeclaration(groupId: string) {
    const declaration = await prisma.wardDeclaration.findUnique({
      where: { groupId },
    });
    if (!declaration) throw ApiError.notFound('Ward declaration');
    return declaration;
  }

  /**
   * Join voluntary group
   */
  async joinGroup(userId: string, groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { isSystemGroup: true, name: true },
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

    await auditService.log(userId, AuditAction.GROUP_JOINED, 'Group', groupId, {
      groupName: group.name,
    });

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

    await auditService.log(userId, AuditAction.GROUP_LEFT, 'Group', groupId);

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
