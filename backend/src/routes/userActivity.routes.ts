/**
 * @file userActivity.routes.ts
 * 
 * @description
 * UJAMAADAO User Activity Routes
 * 
 * Defines API endpoints for user activity tracking and analytics including:
 * - Activity logging
 * - Engagement metrics
 * - Activity timelines
 * - Community activity heatmaps
 */

import { Router } from 'express';
import { userActivityController } from '../controllers/userActivity.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { userActivityValidations } from '../validation/userActivity.validation.js';

const router = Router();

/**
 * @route POST /api/activity/log
 * @description Log user activity
 * @access Private
 */
router.post(
  '/log',
  authenticate,
  validateRequest(userActivityValidations.logActivity),
  userActivityController.logActivity
);

/**
 * @route GET /api/activity/metrics
 * @description Get user activity metrics
 * @access Private
 */
router.get(
  '/metrics',
  authenticate,
  validateRequest(userActivityValidations.getUserActivityMetrics),
  userActivityController.getUserActivityMetrics
);

/**
 * @route GET /api/activity/timeline
 * @description Get user activity timeline
 * @access Private
 */
router.get(
  '/timeline',
  authenticate,
  validateRequest(userActivityValidations.getActivityTimeline),
  userActivityController.getActivityTimeline
);

/**
 * @route GET /api/activity/analytics
 * @description Get user engagement analytics
 * @access Private
 */
router.get(
  '/analytics',
  authenticate,
  validateRequest(userActivityValidations.getEngagementAnalytics),
  userActivityController.getEngagementAnalytics
);

/**
 * @route GET /api/activity/community/:locationType/:locationId/heatmap
 * @description Get community activity heatmap
 * @access Public (consider making authenticated if needed)
 */
router.get(
  '/community/:locationType/:locationId/heatmap',
  validateRequest(userActivityValidations.getCommunityActivityHeatmap),
  userActivityController.getCommunityActivityHeatmap
);

// Admin-only routes
/**
 * @route GET /api/activity/admin/user/:userId
 * @description Get detailed activity data for a user (admin only)
 * @access Private (Admin)
 */
router.get(
  '/admin/user/:userId',
  authenticate,
  authorize(['system:super_admin', 'system:auditor']),
  validateRequest(userActivityValidations.getUserActivityForAdmin),
  userActivityController.getUserActivityForAdmin
);

/**
 * @route GET /api/activity/admin/platform/stats
 * @description Get platform-wide activity statistics (admin only)
 * @access Private (Admin)
 */
router.get(
  '/admin/platform/stats',
  authenticate,
  authorize(['system:super_admin', 'system:auditor']),
  validateRequest(userActivityValidations.getPlatformActivityStats),
  userActivityController.getPlatformActivityStats
);

/**
 * @route GET /api/activity/admin/export/:userId
 * @description Export user activity data (admin only)
 * @access Private (Admin)
 */
router.get(
  '/admin/export/:userId',
  authenticate,
  authorize(['system:super_admin', 'system:auditor']),
  async (req, res) => {
    const { userId } = req.params;
    const { format, period } = req.query;
    
    // Implementation would generate activity export
    res.status(200).json({
      success: true,
      data: {
        userId,
        format: format || 'json',
        period: period || '30d',
        downloadUrl: `/api/activity/admin/exports/${userId}.${format || 'json'}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      message: 'Activity export prepared successfully'
    });
  }
);

export default router;