/**
 * @file userActivity.controller.ts
 * * @description
 * UJAMAADAO User Activity Controller
 * * Handles HTTP requests for user activity tracking and analytics including:
 * - Activity logging
 * - Engagement metrics
 * - Activity timelines
 * - Community activity heatmaps
 */

import { Request, Response } from 'express';
import { userActivityService } from '../services/userActivity.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import logger from '../utils/logger.js';

/**
 * User Activity Controller
 */
export class UserActivityController {
  /**
   * Log user activity
   */
  logActivity = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    // eventType and eventData are guaranteed by validation middleware
    const { eventType, eventData } = req.body; 
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    if (!userId) { // CRITICAL: Only check for authentication here
      throw new ApiError('User authentication required', 401, { code: 'UNAUTHENTICATED' });
    }

    // Manual eventType check removed as it's covered by Zod schema and custom validator
    await userActivityService.logActivity(
      userId,
      eventType,
      eventData,
      ipAddress,
      userAgent
    );

    res.status(200).json({
      success: true,
      message: 'Activity logged successfully'
    });
  });

  /**
   * Get user activity metrics
   */
  getUserActivityMetrics = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    // period is guaranteed valid by validation middleware
    const { period } = req.query as { period?: '7d' | '30d' | '90d' | '1y' }; 

    if (!userId) {
      throw new ApiError('User authentication required', 401, { code: 'UNAUTHENTICATED' });
    }

    // Manual period validation removed
    const analyticsPeriod = period || '30d';

    const metrics = await userActivityService.getUserActivityMetrics(userId, analyticsPeriod);

    res.status(200).json({
      success: true,
      data: metrics,
      message: 'User activity metrics retrieved successfully'
    });
  });

  /**
   * Get activity timeline
   */
  getActivityTimeline = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { period } = req.query as { period?: '7d' | '30d' | '90d' | '1y' }; 

    if (!userId) {
      throw new ApiError('User authentication required', 401, { code: 'UNAUTHENTICATED' });
    }

    // Manual period validation removed
    const analyticsPeriod = period || '30d';

    const timeline = await userActivityService.getActivityTimeline(userId, analyticsPeriod);

    res.status(200).json({
      success: true,
      data: timeline,
      message: 'Activity timeline retrieved successfully'
    });
  });

  /**
   * Get engagement analytics
   */
  getEngagementAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { period } = req.query as { period?: '7d' | '30d' | '90d' | '1y' }; 

    if (!userId) {
      throw new ApiError('User authentication required', 401, { code: 'UNAUTHENTICATED' });
    }

    // Manual period validation removed
    const analyticsPeriod = period || '30d';

    const analytics = await userActivityService.getEngagementAnalytics(userId, analyticsPeriod);

    res.status(200).json({
      success: true,
      data: analytics,
      message: 'Engagement analytics retrieved successfully'
    });
  });

  /**
   * Get community activity heatmap
   */
  getCommunityActivityHeatmap = asyncHandler(async (req: Request, res: Response) => {
    // locationId, locationType, and period are guaranteed valid by validation middleware
    const { locationId, locationType } = req.params as { locationId: string, locationType: 'WARD' | 'CONSTITUENCY' | 'COUNTY' };
    const { period } = req.query as { period?: '7d' | '30d' | '90d' };

    // All manual parameter checks removed
    const analyticsPeriod = period || '30d';

    const heatmap = await userActivityService.getCommunityActivityHeatmap(
      locationId,
      locationType,
      analyticsPeriod
    );

    res.status(200).json({
      success: true,
      data: heatmap,
      message: 'Community activity heatmap retrieved successfully'
    });
  });

  /**
   * Get user activity for admin (admin only)
   */
  getUserActivityForAdmin = asyncHandler(async (req: Request, res: Response) => {
    // userId and period are guaranteed valid by validation middleware
    const { userId } = req.params as { userId: string };
    const { period } = req.query as { period?: '7d' | '30d' | '90d' | '1y' };

    // Manual checks removed
    const analyticsPeriod = period || '30d';

    const [metrics, timeline, analytics] = await Promise.all([
      userActivityService.getUserActivityMetrics(userId, analyticsPeriod),
      userActivityService.getActivityTimeline(userId, analyticsPeriod),
      userActivityService.getEngagementAnalytics(userId, analyticsPeriod)
    ]);

    res.status(200).json({
      success: true,
      data: {
        metrics,
        timeline,
        analytics
      },
      message: 'User activity data retrieved successfully'
    });
  });

  /**
   * Get platform-wide activity stats (admin only)
   */
  getPlatformActivityStats = asyncHandler(async (req: Request, res: Response) => {
    // period is guaranteed valid by validation middleware
    const { period } = req.query as { period?: '7d' | '30d' | '90d' };

    // Manual checks removed
    const analyticsPeriod = period || '30d';

    // This would be implemented with platform-wide analytics
    // For now, return mock data
    res.status(200).json({
      success: true,
      data: {
        period: analyticsPeriod,
        totalActivities: 45678, 
        activeUsers: 9876, 
        activityByType: { 'LOGIN': 5000, 'PROPOSAL_VOTED': 3000, 'EMAIL_VERIFIED': 500 }, 
        growthRate: 15.2 
      },
      message: 'Platform activity stats retrieved successfully'
    });
  });
}

// Export controller instance
export const userActivityController = new UserActivityController();