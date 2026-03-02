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

  static async getGroupMembers(req: AuthRequest, res: Response) {
    const { groupId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const members = await groupMembershipService.getGroupMembers(groupId, limit, offset);
    sendSuccess(res, members, 'Members retrieved');
  }
}
