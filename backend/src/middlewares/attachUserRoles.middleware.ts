/**
 * @file attachUserRoles.middleware.ts
 *
 * @description
 * Middleware to attach user roles from the database to the request object.
 * Combines group roles, project roles, and system roles into a unified role list.
 * Merges roles obtained from JWT token with those fetched from the database.
 */

import type { Request, Response, NextFunction } from 'express';
import prisma from '../prismaClient.js';

interface RoleScope {
  role: string;
  scope?: string;
}

export async function attachUserRoles(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.userId;

  if (!userId) {
    req.userRoles = [];
    return next();
  }

  try {
    // Fetch roles from groups where user is active member
    const groupRoles = await prisma.groupMember.findMany({
      where: { userId, active: true },
      select: { groupId: true, role: true },
    });

    // Fetch roles from project participation
    const projectRoles = await prisma.projectParticipant.findMany({
      where: { userId },
      select: { projectId: true, role: true },
    });

    // Fetch global/system roles
    const systemRoles = await prisma.userRole.findMany({
      where: { userId },
    });

    const roles: RoleScope[] = [];

    for (const gr of groupRoles) {
      roles.push({
        role: gr.role === 'ADMIN' ? 'group:admin' : 'group:member',
        scope: gr.groupId,
      });
    }

    for (const pr of projectRoles) {
      roles.push({
        role: pr.role === 'ADMIN' ? 'project:admin' : 'project:member',
        scope: pr.projectId,
      });
    }

    for (const sr of systemRoles) {
      roles.push({
        role: `system:${sr.role.toLowerCase()}`,
        scope: sr.scope || undefined,
      });
    }

    // Merge any existing roles from JWT token payload if present
    if (req.userRoles && req.userRoles.length > 0) {
      const existing = req.userRoles;
      for (const er of existing) {
        if (!roles.find(r => r.role === er.role && r.scope === er.scope)) {
          roles.push(er);
        }
      }
    }

    req.userRoles = roles;

    next();
  } catch (err) {
    next(err);
  }
}