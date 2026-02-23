/**
 * @file src/modules/user/handlers/reference.handlers.ts
 * @description
 * Handlers for reference/lookup data: geography + industries + goods-services + ward members
 *
 * Version: 1.0 — February 2026
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { userService } from '../services/user.service.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { ApiError } from '../../../core/errors/ApiError.js';

/**
 * GET /users/reference/counties
 * List all 47 Kenya counties
 */
export async function getCounties(req: AuthRequest, res: Response) {
  const counties = await userService.getCounties();
  sendSuccess(res, counties, 'Counties retrieved', 200);
}

/**
 * GET /users/reference/constituencies?countyId=
 * List constituencies, optionally filtered by county
 */
export async function getConstituencies(req: AuthRequest, res: Response) {
  const { countyId } = req.query as { countyId?: string };
  const constituencies = await userService.getConstituencies(countyId);
  sendSuccess(res, constituencies, 'Constituencies retrieved', 200);
}

/**
 * GET /users/reference/wards?constituencyId=&countyId=
 * List wards, optionally filtered by constituency or county
 */
export async function getWards(req: AuthRequest, res: Response) {
  const { constituencyId, countyId } = req.query as {
    constituencyId?: string;
    countyId?: string;
  };
  const wards = await userService.getWards(constituencyId, countyId);
  sendSuccess(res, wards, 'Wards retrieved', 200);
}

/**
 * GET /users/reference/industries
 * List all available industries
 */
export async function getIndustries(req: AuthRequest, res: Response) {
  const industries = await userService.getIndustries();
  sendSuccess(res, industries, 'Industries retrieved', 200);
}

/**
 * GET /users/reference/goods-services?industryId=
 * List goods/services, optionally filtered by industry
 */
export async function getGoodsServices(req: AuthRequest, res: Response) {
  const { industryId } = req.query as { industryId?: string };
  const goods = await userService.getGoodsServices(industryId);
  sendSuccess(res, goods, 'Goods/services retrieved', 200);
}

/**
 * GET /users/wards/:wardId/members
 * Browse COMMUNITY_VERIFIED users in a ward (for vouching discovery)
 */
export async function getWardMembers(req: AuthRequest, res: Response) {
  const { wardId } = req.params;
  const requesterId = req.user!.userId;

  if (!wardId) throw ApiError.badRequest('wardId is required');

  const members = await userService.getWardMembers(wardId, requesterId);
  sendSuccess(res, members, 'Ward members retrieved', 200);
}
