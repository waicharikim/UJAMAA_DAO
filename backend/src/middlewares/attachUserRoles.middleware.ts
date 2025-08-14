/**
 * @file src/middlewares/attachUserRoles.middleware.ts
 *
 * @description
 * Load roles for an authenticated user from DB and merge them with any roles present in JWT.
 * Produces req.userRoles: RoleScope[] where RoleScope = { role: string, scope?: string }.
 *
 * Notes:
 * - Uses constants/roles.js helpers to normalize and validate role names.
 * - Runs DB queries in parallel for performance.
 * - Deduplicates roles robustly.
 */

import type { NextFunction, Response } from 'express';
import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import {
  normalizeRole,
  GROUP_ROLES,
  PROJECT_ROLES,
  SYSTEM_ROLES,
  WALLET_ROLES,
} from '../constants/roles.js';
import type { AuthRequest } from './auth.middleware.js';

type RoleScope = { role: string; scope?: string };

function keyForRole(r: RoleScope) {
  return `${normalizeRole(r.role)}::${r.scope ?? ''}`;
}

export async function attachUserRoles(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      req.userRoles = [];
      return next();
    }

    // Run independent queries in parallel
    const [groupRows, projectRows, systemRows] = await Promise.all([
      prisma.groupMember.findMany({
        where: { userId, active: true },
        select: { groupId: true, role: true },
      }),
      prisma.projectParticipant.findMany({
        where: { userId },
        select: { projectId: true, role: true },
      }),
      prisma.userRole.findMany({
        where: { userId },
        select: { role: true, scope: true },
      }),
    ]);

    const rolesFromDb: RoleScope[] = [];

    for (const g of groupRows) {
      // Map DB enum to namespaced role
      const rname = (g.role === 'ADMIN' ? 'group:admin' : g.role === 'TREASURER' ? 'group:treasurer' : 'group:member');
      rolesFromDb.push({ role: normalizeRole(rname), scope: String(g.groupId) });
    }

    for (const p of projectRows) {
      const rname = (p.role === 'ADMIN' ? 'project:admin' : 'project:member');
      rolesFromDb.push({ role: normalizeRole(rname), scope: String(p.projectId) });
    }

    for (const s of systemRows) {
      // system roles stored as enums in DB e.g., SUPER_ADMIN
      const rname = `system:${String(s.role).toLowerCase()}`;
      rolesFromDb.push({ role: normalizeRole(rname), scope: s.scope ?? undefined });
    }

    // Normalize any roles supplied in JWT (req.userRoles may contain strings or objects)
    const jwtRaw = req.userRoles ?? [];
    const jwtNormalized: RoleScope[] = (Array.isArray(jwtRaw) ? jwtRaw : []).map((r: any) => {
      if (!r) return null;
      if (typeof r === 'string') return { role: normalizeRole(r), scope: undefined };
      return { role: normalizeRole(r.role ?? ''), scope: r.scope ?? undefined };
    }).filter(Boolean) as RoleScope[];

    // Merge and deduplicate: use Map keyed by normalized role + scope
    const map = new Map<string, RoleScope>();
    const push = (rs: RoleScope) => {
      const k = keyForRole(rs);
      if (!map.has(k)) map.set(k, rs);
    };

    // Add DB roles first (authoritative)
    rolesFromDb.forEach(push);
    // Add jwt roles (only if they don't already exist)
    jwtNormalized.forEach(push);

    const merged = Array.from(map.values());
    req.userRoles = merged;

    return next();
  } catch (err) {
    logger.error('attachUserRoles failed', { error: (err as any)?.message ?? err, path: req.path });
    return next(err);
  }
}