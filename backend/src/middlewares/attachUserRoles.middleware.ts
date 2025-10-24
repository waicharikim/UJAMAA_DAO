import type { NextFunction, Response } from 'express';
import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import {
  normalizeRole,
  parseRoleInput,
  isValidRole,
  isSystemRole,
  roleKey,
} from '../constants/roles.js';
import type { AuthRequest } from './auth.middleware.js';
import {
  attachUserRolesDbErrors,
  attachUserRolesJwtRejected,
  attachUserRolesDuration,
} from '../utils/metrics.js';

type RoleScope = { role: string; scope?: string };

/* Cache config */
const CACHE_TTL_MS = Number(process.env.ROLE_CACHE_TTL_MS ?? 0); // 0 = disabled
const ROLE_CACHE_MAX_ENTRIES = Number(process.env.ROLE_CACHE_MAX_ENTRIES ?? 5000);

/* Simple bounded Map cache with FIFO eviction (sufficient for moderate load).
   Evicts oldest insertion when size > ROLE_CACHE_MAX_ENTRIES.
*/
const userRolesCache = new Map<string, { roles: RoleScope[]; expiresAt: number }>();

export function clearUserRolesCache(userId: string) {
  userRolesCache.delete(String(userId));
}
export function clearAllUserRolesCache() {
  userRolesCache.clear();
}

export async function attachUserRoles(req: AuthRequest, _res: Response, next: NextFunction) {
  const timer = attachUserRolesDuration.startTimer();
  const userId = req.user?.userId;
  if (!userId) {
    req.userRoles = [];
    timer();
    return next();
  }

  try {
    // check cache
    if (CACHE_TTL_MS > 0) {
      const c = userRolesCache.get(String(userId));
      if (c && c.expiresAt > Date.now()) {
        req.userRoles = c.roles;
        timer();
        return next();
      }
    }

    // Run independent queries in parallel
    const [groupRows, projectRows, userRoleRows] = await Promise.all([
      prisma.groupMember.findMany({
        where: { userId, active: true },
        select: { groupId: true, role: true },
      }),
      prisma.projectParticipant.findMany({
        where: { userId },
        select: { projectId: true, role: true },
      }),
      // If your schema uses roleId relation, consider selecting role: { select: { name: true } }
      prisma.userRole.findMany({
        where: { userId },
        select: { scope: true, role: true, roleId: true, role: { select: { name: true } } as any },
      }),
    ]);

    const rolesFromDb: RoleScope[] = [];

    for (const g of groupRows) {
      const dbRole = String((g as any).role ?? '').toUpperCase();
      const rname =
        dbRole === 'ADMIN'
          ? 'group:admin'
          : dbRole === 'TREASURER'
          ? 'group:treasurer'
          : 'group:member';
      rolesFromDb.push({ role: normalizeRole(rname), scope: String((g as any).groupId) });
    }

    for (const p of projectRows) {
      const dbRole = String((p as any).role ?? '').toUpperCase();
      const rname = dbRole === 'ADMIN' ? 'project:admin' : 'project:member';
      rolesFromDb.push({ role: normalizeRole(rname), scope: String((p as any).projectId) });
    }

    for (const s of userRoleRows) {
      let roleName = '';
      if (s && (s as any).role && typeof (s as any).role === 'object') {
        roleName = normalizeRole((s as any).role.name);
      } else {
        roleName = normalizeRole((s as any).role ?? '');
      }
      if (!roleName) continue;
      rolesFromDb.push({ role: roleName, scope: (s as any).scope ?? undefined });
    }

    // Build DB key set for conservative merging (authoritative keys)
    const dbKeySet = new Set<string>();
    for (const r of rolesFromDb) dbKeySet.add(roleKey(r));

    // Normalize any roles supplied in JWT (req.userRoles may contain strings or objects)
    const jwtRaw = req.userRoles ?? [];
    const jwtArr = Array.isArray(jwtRaw) ? jwtRaw : [];

    const jwtParsed = jwtArr
      .map((r: any) => parseRoleInput(r))
      .filter((rs): rs is RoleScope => !!rs && !!rs.role);

    // whitelist jwt roles, count rejections (first drop unknown role names)
    const jwtNameValidated = jwtParsed.filter((rs) => {
      const ok = isValidRole(rs.role);
      if (!ok) attachUserRolesJwtRejected.inc();
      return ok;
    });

    // Conservative merging: accept JWT role only if exact role+scope key exists in DB (so JWT can't add privileges)
    const jwtAccepted: RoleScope[] = [];
    for (const jr of jwtNameValidated) {
      const k = roleKey(jr);
      if (dbKeySet.has(k)) {
        jwtAccepted.push(jr);
      } else {
        // Do not accept JWT role that isn't present in DB for same role+scope.
        attachUserRolesJwtRejected.inc();
        logger.debug('attachUserRoles: rejecting jwt role not present in DB', { role: jr.role, scope: jr.scope, path: req.path });
      }
    }

    // Merge and dedupe: DB roles first (authoritative), then accepted JWT roles (only duplicates possible)
    const map = new Map<string, RoleScope>();
    const push = (rs: RoleScope) => {
      if (!rs || !rs.role) return;
      const k = roleKey(rs);
      if (!map.has(k)) map.set(k, rs);
    };

    rolesFromDb.forEach(push);
    jwtAccepted.forEach(push);

    const merged = Array.from(map.values());
    req.userRoles = merged;

    // cache (bounded)
    if (CACHE_TTL_MS > 0) {
      // Evict oldest when exceeding max entries
      if (userRolesCache.size >= ROLE_CACHE_MAX_ENTRIES) {
        const oldestKey = userRolesCache.keys().next().value;
        if (oldestKey) userRolesCache.delete(oldestKey);
      }
      userRolesCache.set(String(userId), { roles: merged, expiresAt: Date.now() + CACHE_TTL_MS });
    }

    timer();
    return next();
  } catch (err) {
    attachUserRolesDbErrors.inc();
    logger.error('attachUserRoles failed', {
      error: (err as any)?.stack ?? (err as any)?.message ?? err,
      path: req.path,
      userId,
    });

    // fallback behavior controlled by env; make fallback conservative: allow only scopeless system roles
    const fallback = (process.env.ROLE_FALLBACK_TO_JWT ?? 'false') === 'true';
    if (fallback) {
      try {
        const jwtRaw = req.userRoles ?? [];
        const jwtArr = Array.isArray(jwtRaw) ? jwtRaw : [];
        const jwtParsed = jwtArr
          .map((r: any) => parseRoleInput(r))
          .filter((rs): rs is RoleScope => !!rs && !!rs.role)
          .filter((rs) => {
            // role name must be valid
            const ok = isValidRole(rs.role);
            if (!ok) attachUserRolesJwtRejected.inc();
            return ok;
          });

        // In fallback mode we only accept scopeless system roles to reduce risk.
        const jwtAccepted: RoleScope[] = [];
        for (const rs of jwtParsed) {
          if (!rs.scope && isSystemRole(rs.role)) {
            jwtAccepted.push(rs);
          } else {
            attachUserRolesJwtRejected.inc();
            logger.warn('attachUserRoles fallback: rejecting jwt role (not scopeless system)', { role: rs.role, scope: rs.scope, path: req.path });
          }
        }

        // Deduplicate jwtAccepted
        const map = new Map<string, RoleScope>();
        jwtAccepted.forEach((rs) => {
          const k = roleKey(rs);
          if (!map.has(k)) map.set(k, rs);
        });
        const merged = Array.from(map.values());
        req.userRoles = merged;
        timer();
        return next();
      } catch (inner) {
        logger.error('attachUserRoles fallback failed', { error: inner });
        timer();
        return next(err);
      }
    }

    timer();
    return next(err);
  }
}