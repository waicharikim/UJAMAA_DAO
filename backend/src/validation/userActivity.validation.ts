/**
 * @file userActivity.validation.ts
 *
 * @description
 * UJAMAADAO User Activity Validation Schemas
 *
 * Validation schemas for user activity operations including:
 * - Activity logging
 * - Analytics queries
 * - Heatmap data
 * - Engagement metrics
 */

import { z } from 'zod';

// List of all allowed activity types for RBAC and auditing compliance
const ALLOWED_ACTIVITY_TYPES = [
  'LOGIN',
  'LOGOUT',
  'ACCOUNT_CREATED',
  'PROFILE_UPDATED',
  'PASSWORD_CHANGED',

  // Verification Events (Granular)
  'PHONE_VERIFIED',
  'EMAIL_VERIFIED',
  'LOCATION_VERIFIED',
  'COMMUNITY_VERIFIED',

  // Governance/Community Events
  'PROPOSAL_CREATED',
  'PROPOSAL_VOTED',
  'PROJECT_JOINED',
  'PROJECT_COMPLETED',
  'GROUP_JOINED',
  'GROUP_CREATED',
  'COMMUNITY_VERIFICATION_VOTE',

  // Economic/Work Events
  'MARKETPLACE_TRANSACTION',
  'PHYSICAL_WORK_LOGGED',
  'WORK_VERIFIED',

  // Education Events
  'EDUCATIONAL_PROGRESS'
] as const; // Using 'as const' makes this array a constant tuple, enabling Zod inference.


/**
 * Activity Logging Validation
 */
export const activityLoggingSchema = {
  logActivity: z.object({
    body: z.object({
      // CRITICAL CHANGE: Use enum for strict type checking and validation
      eventType: z.enum(ALLOWED_ACTIVITY_TYPES, {
        required_error: 'Event type is required',
        invalid_type_error: `Event type must be one of: ${ALLOWED_ACTIVITY_TYPES.join(', ')}`,
      }),
      // eventData can be any JSON structure
      eventData: z.record(z.any()).or(z.null()).optional(), 
    })
  })
};


/**
 * Activity Analytics Validation
 */
export const activityAnalyticsSchema = {
  getUserActivityMetrics: z.object({
    query: z.object({
      period: z.enum(['7d', '30d', '90d', '1y']).default('30d').optional() // Make optional to allow default
    })
  }),

  getActivityTimeline: z.object({
    query: z.object({
      period: z.enum(['7d', '30d', '90d', '1y']).default('30d').optional()
    })
  }),

  getEngagementAnalytics: z.object({
    query: z.object({
      period: z.enum(['7d', '30d', '90d', '1y']).default('30d').optional()
    })
  })
};

/**
 * Community Activity Validation
 */
export const communityActivitySchema = {
  getCommunityActivityHeatmap: z.object({
    params: z.object({
      locationId: z.string().min(1, 'Location ID is required'), // Assuming non-UUID format is possible for IDs
      locationType: z.enum(['WARD', 'CONSTITUENCY', 'COUNTY'])
    }),
    query: z.object({
      period: z.enum(['7d', '30d', '90d']).default('30d').optional()
    })
  })
};

/**
 * Admin Activity Validation
 */
export const adminActivitySchema = {
  getUserActivityForAdmin: z.object({
    params: z.object({
      // We will assume a strong UUID check is needed here
      userId: z.string().uuid('Invalid user ID format')
    }),
    query: z.object({
      period: z.enum(['7d', '30d', '90d', '1y']).default('30d').optional()
    })
  }),

  getPlatformActivityStats: z.object({
    query: z.object({
      period: z.enum(['7d', '30d', '90d']).default('30d').optional()
    })
  })
};

/**
 * Combined validation schemas
 */
export const userActivityValidations = {
  ...activityLoggingSchema,
  ...activityAnalyticsSchema,
  ...communityActivitySchema,
  ...adminActivitySchema
};

// Removed custom validator exports as they are now integrated or best handled elsewhere.

export default userActivityValidations;