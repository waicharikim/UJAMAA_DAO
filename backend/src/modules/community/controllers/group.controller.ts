/**
 * @file src/modules/community/controllers/group.controller.ts
 * @description
 * Group Controller — Voluntary Group Management
 * Version: 2.0 — December 2025
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { groupService } from '../services/group.service.js';
import { groupMembershipService } from '../services/groupMembership.service.js';
import { prisma } from '../../../core/database/client.js';

export class GroupController {
  static async createVoluntaryGroup(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const group = await groupService.createVoluntaryGroup(userId, dto);
    sendSuccess(res, group, 'Voluntary group created');
  }

  static async joinGroup(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { groupId } = req.body;
    const membership = await groupService.joinGroup(userId, groupId);
    sendSuccess(res, membership, 'Joined group');
  }

  static async leaveGroup(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { groupId } = req.body;
    await groupService.leaveGroup(userId, groupId);
    sendSuccess(res, null, 'Left group');
  }

  static async getMyGroups(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const groups = await groupMembershipService.getUserGroups(userId);
    sendSuccess(res, groups, 'Groups retrieved');
  }

  static async getMyRole(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { groupId } = req.params;
    const membership = await prisma.groupMember.findFirst({
      where: { userId, groupId, active: true },
      select: { role: true },
    });
    sendSuccess(res, membership ?? { role: null }, 'Membership role retrieved');
  }

  static async getGroupDetail(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { groupId } = req.params;
    const group = await groupMembershipService.getGroupById(groupId, userId);
    sendSuccess(res, group, 'Group retrieved');
  }

  static async getGroupMembers(req: AuthRequest, res: Response) {
    const { groupId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const members = await groupMembershipService.getGroupMembers(
      groupId,
      limit,
      offset
    );
    sendSuccess(res, members, 'Members retrieved');
  }

  static async getGroups(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { isSystem, voluntaryType, search, limit, offset } =
      req.query as Record<string, string>;
    const result = await groupMembershipService.getGroups(userId, {
      isSystem:
        isSystem === 'true' ? true : isSystem === 'false' ? false : undefined,
      voluntaryType,
      search,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
    sendSuccess(res, result, 'Groups retrieved');
  }

  static async updateGroupSettings(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { groupId } = req.params;
    const group = await groupService.updateGroupSettings(
      userId,
      groupId,
      req.body
    );
    sendSuccess(res, group, 'Group settings updated');
  }

  static async changeMemberRole(req: AuthRequest, res: Response) {
    const actorId = req.user!.userId;
    const { groupId, userId: targetUserId } = req.params;
    const { role } = req.body;
    const result = await groupService.changeMemberRole(
      actorId,
      groupId,
      targetUserId,
      role
    );
    sendSuccess(res, result, 'Member role updated');
  }

  static async removeMember(req: AuthRequest, res: Response) {
    const actorId = req.user!.userId;
    const { groupId, userId: targetUserId } = req.params;
    await groupService.removeMember(actorId, groupId, targetUserId);
    sendSuccess(res, null, 'Member removed');
  }

  static async getDeclaration(req: AuthRequest, res: Response) {
    const { groupId } = req.params;
    const declaration = await groupService.getDeclaration(groupId);
    sendSuccess(res, declaration, 'Declaration retrieved');
  }

  static async dissolveGroup(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { groupId } = req.params;
    const { reason } = req.body;
    const result = await groupService.dissolveGroup(
      userId,
      groupId,
      reason ?? ''
    );
    sendSuccess(res, result, 'Group dissolved');
  }
}
