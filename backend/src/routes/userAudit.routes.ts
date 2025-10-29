/**
 * @file userAudit.routes.ts
 *
 * @description
 * Express router for the UJAMAADAO User Audit system.
 * Handles read-only operations for fetching user change history.
 */

import { Router } from 'express';
import { getUserAuditLogsHandler } from '../controllers/userAudit.controller.js';
import { authenticate } from '../middlewares/authenticate.js'; // Assuming this exists

const auditRouter = Router();

// Middleware applied to all audit routes
auditRouter.use(authenticate);

/**
 * GET /api/audit/logs/:userId?
 * Fetches the audit log history for a user.
 * Access is restricted: only owners or specific audit roles can view.
 * Protected by RBAC (authorize) and input validation (validateRequest).
 */
auditRouter.get('/logs/:userId?', getUserAuditLogsHandler);

export default auditRouter;
