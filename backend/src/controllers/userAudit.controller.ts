/**
 * @file userAudit.controller.ts
 *
 * @description
 * Controller for retrieving user audit logs. Enforces strict RBAC for read access.
 */

import type { Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { authorize } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { getAuditLogsValidation } from '../validation/audit.validation.js';
import * as userAuditService from '../services/userAudit.service.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';

/**
 * GET /api/audit/logs/:userId?
 * Retrieves audit logs for a specific user (or the authenticated user).
 * Requires strict ownership or auditor role.
 */
export const getUserAuditLogsHandler = [
  // 1. RBAC Check: Allows self-service ('*') for authenticated users to view their own profile,
  //    or specific roles (Auditor/Admin) to view others.
  authorize({
    allowedRoles: ['economic:auditor', 'system:super_admin', '*'], 
    requiredVerificationLevel: 'COMMUNITY_VERIFIED'
  }),
  // 2. Zod Validation: Validates params (userId) and query (limit/offset)
  validateRequest(getAuditLogsValidation),
  // 3. Controller Logic
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const requestedUserId = req.params.userId;
    const authenticatedUserId = req.user?.userId;
    const { limit, offset } = req.query as { limit: number, offset: number };

    if (!authenticatedUserId) {
        // Should be caught by authorize, but defensive check
        throw new ApiError('Authentication required to view audit logs.', 401);
    }

    const isOwner = requestedUserId === authenticatedUserId || !requestedUserId;
    const isAdminOrAuditor = req.userRoles?.some(role => 
        role.role === 'economic:auditor' || role.role === 'system:super_admin'
    );
    
    // Determine the target user ID for the query
    let targetUserId: string;

    if (isOwner) {
        // If they requested their own (or no ID specified), target is the authenticated user
        targetUserId = authenticatedUserId;
    } else if (isAdminOrAuditor) {
        // If they requested someone else and have the rights, target is the requested ID
        targetUserId = requestedUserId!;
    } else {
        // Requested someone else, but lack permissions
        logger.warn('Unauthorized attempt to view another user\'s audit logs', {
            requestedUserId,
            authenticatedUserId,
        });
        throw new ApiError('Insufficient permissions to view requested user\'s audit logs.', 403, { code: 'UNAUTHORIZED_AUDIT_ACCESS' });
    }
    
    logger.info('Audit: Fetching user audit logs', { targetUserId, authenticatedUserId, limit, offset });

    const logs = await userAuditService.getUserAuditLogs(targetUserId, limit, offset);

    res.json({
        data: logs.map(log => ({
            id: log.id,
            field: log.field,
            oldValue: log.oldValue,
            newValue: log.newValue,
            changedBy: log.changedBy,
            timestamp: log.timestamp.toISOString(),
            metadata: log.metadata, // Included metadata
        })),
        meta: {
            targetUserId: targetUserId,
            viewerId: authenticatedUserId,
            pagination: { limit, offset, count: logs.length },
        }
    });
  })
];
