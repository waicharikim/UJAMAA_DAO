/**
 * @file userActivity.service.ts
 * * @description
 * UJAMAADAO User Activity Service
 * * Tracks and analyzes user activity across the platform including:
 * - Activity logging and analytics
 * - Engagement metrics
 * - Behavioral patterns
 * - Activity-based rewards
 */

import { Prisma } from '@prisma/client';
import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { EventBus } from '../events/eventBus.js';

/**
 * Activity Types (FIXED: Aligned with granular verification)
 */
export type ActivityType = 
  | 'LOGIN'
  | 'LOGOUT' // Added for completeness, if not used elsewhere
  | 'ACCOUNT_CREATED' // Added
  | 'PROFILE_UPDATED' // Added
  | 'PASSWORD_CHANGED' // Added
  | 'PHONE_VERIFIED' // Added
  | 'EMAIL_VERIFIED' // Added
  | 'LOCATION_VERIFIED' // Added
  | 'PROPOSAL_CREATED'
  | 'PROPOSAL_VOTED'
  | 'PROJECT_JOINED'
  | 'PROJECT_COMPLETED'
  | 'GROUP_JOINED'
  | 'GROUP_CREATED'
  | 'MARKETPLACE_TRANSACTION'
  | 'EDUCATIONAL_PROGRESS'
  | 'COMMUNITY_VERIFICATION_VOTE'
  | 'PHYSICAL_WORK_LOGGED'
  | 'WORK_VERIFIED';
  // Removed: 'VERIFICATION_COMPLETED'

/**
 * Activity Metrics
 */
export interface ActivityMetrics {
  totalActivities: number;
  activitiesByType: Record<ActivityType, number>;
  dailyAverage: number;
  streak: number; // Consecutive days with activity
  lastActivityDate: Date;
  engagementScore: number; // 0-100
}

/**
 * Activity Timeline
 */
export interface ActivityTimeline {
  date: string;
  activities: number;
  types: ActivityType[];
  impactPoints: number;
}

/**
 * Engagement Analytics
 */
export interface EngagementAnalytics {
  userId: string;
  period: '7d' | '30d' | '90d' | '1y';
  totalActivities: number;
  activityTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
  mostActiveType: ActivityType;
  peakHours: number[]; // Hours of day when most active
  recommendations: string[];
}

/**
 * UJAMAADAO User Activity Service
 */
export class UserActivityService {
  /**
   * Log user activity
   */
  async logActivity(
    userId: string, 
    eventType: string, 
    eventData?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await prisma.userActivityLog.create({
        data: {
          userId,
          eventType,
          eventData,
          ipAddress,
          userAgent
        }
      });

      // Update user's last activity timestamp (NOTE: this should ideally be conditional for 'LOGIN' only)
      await prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() }
      });

      // Emit activity event
      EventBus.publish('user.activity.logged', {
        userId,
        eventType,
        timestamp: new Date()
      });

      logger.debug('UJAMAADAO Activity: User activity logged', {
        userId,
        eventType
      });

    } catch (error) {
      logger.error('UJAMAADAO Activity: Failed to log user activity', {
        userId,
        eventType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get user activity metrics
   */
  async getUserActivityMetrics(userId: string, period: '7d' | '30d' | '90d' | '1y' = '30d'): Promise<ActivityMetrics> {
    const dateRange = this.getDateRange(period);
    
    const activities = await prisma.userActivityLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const activitiesByType = activities.reduce((acc, activity) => {
      acc[activity.eventType as ActivityType] = (acc[activity.eventType as ActivityType] || 0) + 1;
      return acc;
    }, {} as Record<ActivityType, number>);

    const totalActivities = activities.length;
    const daysInPeriod = this.getDaysInPeriod(period);
    const dailyAverage = totalActivities / daysInPeriod;

    const streak = await this.calculateActivityStreak(userId);
    const lastActivity = activities[activities.length - 1];
    const engagementScore = this.calculateEngagementScore(activities, period);

    return {
      totalActivities,
      activitiesByType,
      dailyAverage: Math.round(dailyAverage * 100) / 100,
      streak,
      lastActivityDate: lastActivity?.createdAt || new Date(),
      engagementScore
    };
  }

  /**
   * Get activity timeline
   */
  async getActivityTimeline(
    userId: string, 
    period: '7d' | '30d' | '90d' | '1y' = '30d'
  ): Promise<ActivityTimeline[]> {
    const dateRange = this.getDateRange(period);
    
    const activities = await prisma.userActivityLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end
        }
      },
      include: {
        user: {
          select: {
            globalImpactPoints: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group activities by date
    const timelineMap = new Map<string, ActivityTimeline>();

    activities.forEach(activity => {
      const date = activity.createdAt.toISOString().split('T')[0];
      
      if (!timelineMap.has(date)) {
        timelineMap.set(date, {
          date,
          activities: 0,
          types: [],
          impactPoints: 0
        });
      }

      const dayData = timelineMap.get(date)!;
      dayData.activities++;
      
      if (!dayData.types.includes(activity.eventType as ActivityType)) {
        dayData.types.push(activity.eventType as ActivityType);
      }

      // Estimate IP earned
      dayData.impactPoints += this.estimateIPEarned(activity.eventType);
    });

    return Array.from(timelineMap.values());
  }

  /**
   * Get engagement analytics
   */
  async getEngagementAnalytics(
    userId: string, 
    period: '7d' | '30d' | '90d' | '1y' = '30d'
  ): Promise<EngagementAnalytics> {
    const currentMetrics = await this.getUserActivityMetrics(userId, period);
    const previousMetrics = await this.getUserActivityMetrics(userId, this.getPreviousPeriod(period));

    const activityTrend = this.calculateActivityTrend(currentMetrics.totalActivities, previousMetrics.totalActivities);
    
    const mostActiveType = Object.entries(currentMetrics.activitiesByType)
      .reduce((a, b) => a[1] > b[1] ? a : b)[0] as ActivityType;

    const peakHours = await this.calculatePeakHours(userId, period);
    const recommendations = this.generateRecommendations(currentMetrics, activityTrend);

    return {
      userId,
      period,
      totalActivities: currentMetrics.totalActivities,
      activityTrend,
      mostActiveType,
      peakHours,
      recommendations
    };
  }

  /**
   * Get community activity heatmap
   */
  async getCommunityActivityHeatmap(
    locationId: string,
    locationType: 'WARD' | 'CONSTITUENCY' | 'COUNTY',
    period: '7d' | '30d' | '90d' = '30d'
  ): Promise<{ date: string; hour: number; activityCount: number }[]> {
    let userIds: string[] = [];

    // NOTE: This logic relies heavily on the GeographicService's logic for user grouping.
    // Ideally, this could be refactored to use a helper or the GeographicService itself.
    switch (locationType) {
      case 'WARD':
        const wardUsers = await prisma.user.findMany({
          where: { primaryWardId: locationId },
          select: { id: true }
        });
        userIds = wardUsers.map(user => user.id);
        break;

      case 'CONSTITUENCY':
        const constituencyWards = await prisma.ward.findMany({
          where: { constituencyId: locationId },
          select: { id: true }
        });
        const constituencyUsers = await prisma.user.findMany({
          where: { primaryWardId: { in: constituencyWards.map(w => w.id) } },
          select: { id: true }
        });
        userIds = constituencyUsers.map(user => user.id);
        break;

      case 'COUNTY':
        const countyConstituencies = await prisma.constituency.findMany({
          where: { countyId: locationId },
          select: { id: true }
        });
        const countyWards = await prisma.ward.findMany({
          where: { constituencyId: { in: countyConstituencies.map(c => c.id) } },
          select: { id: true }
        });
        const countyUsers = await prisma.user.findMany({
          where: { primaryWardId: { in: countyWards.map(w => w.id) } },
          select: { id: true }
        });
        userIds = countyUsers.map(user => user.id);
        break;
    }

    const dateRange = this.getDateRange(period);
    
    const activities = await prisma.userActivityLog.findMany({
      where: {
        userId: { in: userIds },
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end
        }
      },
      select: {
        createdAt: true
      }
    });

    // Group activities by date and hour
    const heatmapData: Map<string, Map<number, number>> = new Map();

    activities.forEach(activity => {
      const date = activity.createdAt.toISOString().split('T')[0];
      const hour = activity.createdAt.getHours();

      if (!heatmapData.has(date)) {
        heatmapData.set(date, new Map());
      }

      const dayData = heatmapData.get(date)!;
      dayData.set(hour, (dayData.get(hour) || 0) + 1);
    });

    // Convert to array format
    const result: { date: string; hour: number; activityCount: number }[] = [];
    
    heatmapData.forEach((hours, date) => {
      hours.forEach((count, hour) => {
        result.push({ date, hour, activityCount: count });
      });
    });

    return result;
  }

  /**
   * Calculate activity streak
   */
  private async calculateActivityStreak(userId: string): Promise<number> {
    const activities = await prisma.userActivityLog.findMany({
      where: { userId },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      distinct: ['createdAt']
    });

    let streak = 0;
    let currentDate = new Date();
    
    // Check consecutive days with activity
    for (let i = 0; i < activities.length; i++) {
      const activityDate = new Date(activities[i].createdAt);
      activityDate.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);

      const diffTime = currentDate.getTime() - activityDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === streak) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Calculate engagement score (0-100)
   */
  private calculateEngagementScore(activities: any[], period: '7d' | '30d' | '90d' | '1y'): number {
    if (activities.length === 0) return 0;

    const weights = {
      'PROPOSAL_CREATED': 3,
      'PROPOSAL_VOTED': 2,
      'PROJECT_JOINED': 2,
      'PROJECT_COMPLETED': 4,
      'GROUP_CREATED': 3,
      'PHYSICAL_WORK_LOGGED': 2,
      'WORK_VERIFIED': 1,
      'COMMUNITY_VERIFICATION_VOTE': 2,
      'EDUCATIONAL_PROGRESS': 1.5,
      'LOGIN': 0.5
      // NOTE: Verification events are generally considered completion milestones, not recurring engagement, 
      // but could be weighted here if desired.
    };

    const totalWeight = activities.reduce((sum, activity) => {
      return sum + (weights[activity.eventType as keyof typeof weights] || 1);
    }, 0);

    const maxPossibleWeight = this.getMaxPossibleWeight(period);
    const score = (totalWeight / maxPossibleWeight) * 100;

    return Math.min(Math.round(score), 100);
  }

  /**
   * Calculate peak activity hours
   */
  private async calculatePeakHours(userId: string, period: '7d' | '30d' | '90d' | '1y'): Promise<number[]> {
    const dateRange = this.getDateRange(period);
    
    const activities = await prisma.userActivityLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end
        }
      },
      select: {
        createdAt: true
      }
    });

    const hourCounts = new Array(24).fill(0);
    
    activities.forEach(activity => {
      const hour = activity.createdAt.getHours();
      hourCounts[hour]++;
    });

    // Return top 3 hours
    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour);
  }

  /**
   * Generate engagement recommendations
   */
  private generateRecommendations(metrics: ActivityMetrics, trend: 'INCREASING' | 'DECREASING' | 'STABLE'): string[] {
    const recommendations: string[] = [];

    if (metrics.dailyAverage < 1) {
      recommendations.push('Try to engage with at least one activity daily to maintain your streak');
    }

    if (!metrics.activitiesByType.PROPOSAL_VOTED) {
      recommendations.push('Participate in community voting to have your voice heard');
    }

    if (!metrics.activitiesByType.PROJECT_JOINED) {
      recommendations.push('Join a community project to collaborate with others');
    }

    if (trend === 'DECREASING') {
      recommendations.push('Your activity has decreased recently. Consider exploring new features');
    }

    if (metrics.streak >= 7) {
      recommendations.push(`Great job! You have a ${metrics.streak}-day activity streak. Keep it up!`);
    }

    return recommendations.slice(0, 3); // Limit to 3 recommendations
  }

  /**
   * Estimate IP earned from activity type (FIXED: Added Verification IP)
   */
  private estimateIPEarned(eventType: string): number {
    const ipEstimates: Record<string, number> = {
      // High-value milestones
      'ACCOUNT_CREATED': 5,
      'EMAIL_VERIFIED': 5,
      'PHONE_VERIFIED': 10,
      'LOCATION_VERIFIED': 15,
      'COMMUNITY_VERIFIED': 20,
      
      // Recurring activities
      'PROPOSAL_CREATED': 10,
      'PROPOSAL_VOTED': 5,
      'PROJECT_COMPLETED': 25,
      'GROUP_CREATED': 20,
      'PHYSICAL_WORK_LOGGED': 15,
      'COMMUNITY_VERIFICATION_VOTE': 5,
      'EDUCATIONAL_PROGRESS': 10,
      'WORK_VERIFIED': 5,
    };

    return ipEstimates[eventType] || 0;
  }

  /**
   * Get date range for period
   */
  private getDateRange(period: '7d' | '30d' | '90d' | '1y'): { start: Date; end: Date } {
    const end = new Date();
    let start = new Date();

    switch (period) {
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(end.getFullYear() - 1);
        break;
    }

    return { start, end };
  }

  /**
   * Get days in period
   */
  private getDaysInPeriod(period: '7d' | '30d' | '90d' | '1y'): number {
    const days = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    return days[period];
  }

  /**
   * Get previous period
   */
  private getPreviousPeriod(period: '7d' | '30d' | '90d' | '1y'): '7d' | '30d' | '90d' | '1y' {
    return period; // Simplified - could implement proper previous period calculation
  }

  /**
   * Calculate activity trend
   */
  private calculateActivityTrend(current: number, previous: number): 'INCREASING' | 'DECREASING' | 'STABLE' {
    if (current > previous * 1.1) return 'INCREASING';
    if (current < previous * 0.9) return 'DECREASING';
    return 'STABLE';
  }

  /**
   * Get max possible weight for period
   */
  private getMaxPossibleWeight(period: '7d' | '30d' | '90d' | '1y'): number {
    const days = this.getDaysInPeriod(period);
    return days * 10; // Simplified maximum
  }
}

// Export singleton instance
export const userActivityService = new UserActivityService();