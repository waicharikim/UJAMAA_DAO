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

import { prisma } from "../../../core/database/client.js";
import { participationRightsService } from "../../economy/services/participationRights.service.js";
import { ApiError } from "../../../core/errors/ApiError.js";
import { logger } from "../../../core/logger/logger.js";
import { VOLUNTARY_GROUP_PR_COST } from "../types.js";
import { CreateVoluntaryGroupDto } from "@modules/community/types.js";

class GroupService {
  /**
   * Create voluntary group — spend PR
   */
  async createVoluntaryGroup(
    userId: string,
    dto: CreateVoluntaryGroupDto
  ) {
    // Validate voluntaryType exists in enum (from seed or config)
    const validTypes = [
      "BUSINESS_COLLECTIVE",
      "SAVINGS_CREDIT",
      "YOUTH_ORGANIZATION",
      "PROJECT_EXECUTION",
      "TECHNOLOGY_HUB",
      // ... 35+ from spec
    ];

    if (!validTypes.includes(dto.voluntaryType)) {
      throw ApiError.badRequest("Invalid voluntary group type");
    }

    await participationRightsService.spend(
      userId,
      VOLUNTARY_GROUP_PR_COST,
      "GROUP_CREATED",
      { groupType: dto.voluntaryType }
    );

    const group = await prisma.group.create({
      data: {
        name: dto.name,
        description: dto.description,
        avatarUrl: dto.avatarUrl,
        isSystemGroup: false,
        voluntaryType: dto.voluntaryType,
        creatorId: userId,
      },
    });

    // Creator is first member + leader
    await prisma.groupMember.create({
      data: {
        userId,
        groupId: group.id,
        role: "LEADER",
        autoEnrolled: false,
        canLeave: true,
        joinedAt: new Date(),
        active: true,
      },
    });

    logger.info({ userId, groupId: group.id, type: dto.voluntaryType }, "Voluntary group created");

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

    if (!group) throw ApiError.notFound("Group");
    if (group.isSystemGroup) throw ApiError.badRequest("Cannot manually join system group");

    const existing = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });

    if (existing) throw ApiError.conflict("Already a member");

    const membership = await prisma.groupMember.create({
      data: {
        userId,
        groupId,
        role: "MEMBER",
        autoEnrolled: false,
        canLeave: true,
        joinedAt: new Date(),
        active: true,
      },
    });

    logger.info({ userId, groupId }, "Joined voluntary group");

    return membership;
  }

  /**
   * Leave voluntary group
   */
  async leaveGroup(userId: string, groupId: string) {
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });

    if (!membership) throw ApiError.notFound("Membership");
    if (!membership.canLeave) throw ApiError.forbidden("Cannot leave this group");

    await prisma.groupMember.delete({
      where: { userId_groupId: { userId, groupId } },
    });

    logger.info({ userId, groupId }, "Left voluntary group");

    return { success: true };
  }
}

export const groupService = new GroupService();