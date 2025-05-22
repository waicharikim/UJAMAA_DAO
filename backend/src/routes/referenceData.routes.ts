/**
 * @file referenceData.routes.ts
 *
 * @description
 * Defines API routes providing static enums and reference data.
 * - Public routes for counties, constituencies, industries, goods/services.
 * - Super admin protected routes for role and status enums.
 */

import express from 'express';
import * as referenceController from '../controllers/referenceData.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/rbac.middleware.js';

const router = express.Router();

// Public routes
router.get('/counties', referenceController.getCountiesHandler);
router.get('/constituencies', referenceController.getConstituenciesHandler);
router.get('/industries', referenceController.getIndustriesHandler);
router.get('/goods-services', referenceController.getGoodsServicesHandler);

// Super admin protected routes
router.get('/group-roles', authMiddleware, authorize(['system:super_admin']), referenceController.getGroupRolesHandler);
router.get('/system-roles', authMiddleware, authorize(['system:super_admin']), referenceController.getSystemRolesHandler);
router.get('/participant-roles', authMiddleware, authorize(['system:super_admin']), referenceController.getParticipantRolesHandler);
router.get('/proposal-types', authMiddleware, authorize(['system:super_admin']), referenceController.getProposalTypesHandler);
router.get('/proposal-statuses', authMiddleware, authorize(['system:super_admin']), referenceController.getProposalStatusesHandler);
router.get('/location-scopes', authMiddleware, authorize(['system:super_admin']), referenceController.getLocationScopesHandler);
router.get('/project-statuses', authMiddleware, authorize(['system:super_admin']), referenceController.getProjectStatusesHandler);
router.get('/milestone-statuses', authMiddleware, authorize(['system:super_admin']), referenceController.getMilestoneStatusesHandler);

export default router;