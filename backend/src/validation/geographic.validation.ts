/**
 * @file geographic.validation.ts
 * 
 * @description
 * UJAMAADAO Geographic Validation Schemas
 * 
 * Validation schemas for geographic operations including:
 * - Hierarchy validation
 * - Location-based queries
 * - Geographic context operations
 * - Location search parameters
 */

import { z } from 'zod';

/**
 * Geographic Hierarchy Validation
 */
export const geographicHierarchySchema = {
  getHierarchy: z.object({
    params: z.object({
      wardId: z.string().uuid('Invalid ward ID format')
    })
  }),

  validateHierarchy: z.object({
    body: z.object({
      wardId: z.string().uuid('Invalid ward ID format'),
      constituencyId: z.string().uuid('Invalid constituency ID format').optional(),
      countyId: z.string().uuid('Invalid county ID format').optional()
    })
  })
};

/**
 * Geographic Context Validation
 */
export const geographicContextSchema = {
  establishContext: z.object({
    body: z.object({
      primaryWardId: z.string().uuid('Invalid ward ID format')
    })
  }),

  getCurrentContext: z.object({}) // No params/body needed, uses authenticated user
};

/**
 * Location-based Operations Validation
 */
export const locationOperationsSchema = {
  getUsersByLocation: z.object({
    params: z.object({
      locationType: z.enum(['WARD', 'CONSTITUENCY', 'COUNTY'], {
        errorMap: () => ({ message: 'Location type must be WARD, CONSTITUENCY, or COUNTY' })
      }),
      locationId: z.string().uuid('Invalid location ID format')
    })
  }),

  getWardsByConstituency: z.object({
    params: z.object({
      constituencyId: z.string().uuid('Invalid constituency ID format')
    })
  }),

  getConstituenciesByCounty: z.object({
    params: z.object({
      countyId: z.string().uuid('Invalid county ID format')
    })
  })
};

/**
 * Geographic Search Validation
 */
export const geographicSearchSchema = {
  searchLocations: z.object({
    query: z.object({
      query: z.string()
        .min(1, 'Search query cannot be empty')
        .max(100, 'Search query too long')
        .refine(
          (query) => !/[<>]/.test(query), 
          'Search query contains invalid characters'
        ),
      type: z.enum(['WARD', 'CONSTITUENCY', 'COUNTY']).optional()
    })
  }),

  getAllCounties: z.object({}) // No params/query needed
};

/**
 * Geographic Boundary Validation
 */
export const geographicBoundarySchema = {
  createWard: z.object({
    body: z.object({
      name: z.string()
        .min(2, 'Ward name must be at least 2 characters')
        .max(100, 'Ward name too long'),
      code: z.string()
        .min(1, 'Ward code is required')
        .max(10, 'Ward code too long')
        .optional(),
      constituencyId: z.string().uuid('Invalid constituency ID format')
    })
  }),

  createConstituency: z.object({
    body: z.object({
      name: z.string()
        .min(2, 'Constituency name must be at least 2 characters')
        .max(100, 'Constituency name too long'),
      code: z.string()
        .min(1, 'Constituency code is required')
        .max(10, 'Constituency code too long')
        .optional(),
      countyId: z.string().uuid('Invalid county ID format')
    })
  }),

  createCounty: z.object({
    body: z.object({
      name: z.string()
        .min(2, 'County name must be at least 2 characters')
        .max(100, 'County name too long'),
      code: z.string()
        .min(1, 'County code is required')
        .max(10, 'County code too long')
    })
  })
};

/**
 * Geographic Statistics Validation
 */
export const geographicStatisticsSchema = {
  getLocationStats: z.object({
    params: z.object({
      locationType: z.enum(['WARD', 'CONSTITUENCY', 'COUNTY']),
      locationId: z.string().uuid('Invalid location ID format')
    }),
    query: z.object({
      timeframe: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
      metrics: z.array(z.enum([
        'user_activity',
        'economic_activity', 
        'project_completion',
        'community_engagement'
      ])).default(['user_activity'])
    })
  }),

  compareLocations: z.object({
    body: z.object({
      locations: z.array(z.object({
        locationType: z.enum(['WARD', 'CONSTITUENCY', 'COUNTY']),
        locationId: z.string().uuid('Invalid location ID format')
      })).min(1, 'At least one location required').max(5, 'Maximum 5 locations allowed'),
      metrics: z.array(z.enum([
        'total_users',
        'active_users',
        'impact_points',
        'projects_completed',
        'economic_activity'
      ])).min(1, 'At least one metric required')
    })
  })
};

/**
 * Geographic Export Validation
 */
export const geographicExportSchema = {
  exportLocationData: z.object({
    params: z.object({
      locationType: z.enum(['WARD', 'CONSTITUENCY', 'COUNTY']),
      locationId: z.string().uuid('Invalid location ID format')
    }),
    query: z.object({
      format: z.enum(['json', 'csv', 'pdf']).default('json'),
      include: z.array(z.enum([
        'users',
        'projects',
        'economic_data',
        'governance_data'
      ])).default(['users']),
      timeframe: z.object({
        start: z.string().datetime('Invalid start date'),
        end: z.string().datetime('Invalid end date')
      }).optional()
    })
  })
};

/**
 * Combined validation schemas for easy import
 */
export const geographicValidations = {
  ...geographicHierarchySchema,
  ...geographicContextSchema,
  ...locationOperationsSchema,
  ...geographicSearchSchema,
  ...geographicBoundarySchema,
  ...geographicStatisticsSchema,
  ...geographicExportSchema
};

/**
 * Custom validators for geographic operations
 */
export const geographicValidators = {
  /**
   * Validate location scope consistency
   */
  validateLocationScope: (scope: string, locationType: string): boolean => {
    const validScopes = {
      'WARD': ['WARD'],
      'CONSTITUENCY': ['WARD', 'CONSTITUENCY'],
      'COUNTY': ['WARD', 'CONSTITUENCY', 'COUNTY'],
      'NATIONAL': ['WARD', 'CONSTITUENCY', 'COUNTY', 'NATIONAL']
    };

    return validScopes[locationType as keyof typeof validScopes]?.includes(scope) || false;
  },

  /**
   * Validate geographic hierarchy consistency
   */
  validateHierarchyConsistency: (wardId: string, constituencyId?: string, countyId?: string) => {
    // This would be implemented with actual database checks
    // For now, returns a validation function
    return z.object({}).refine(async () => {
      // Implementation would check database consistency
      return true;
    }, 'Geographic hierarchy validation failed');
  },

  /**
   * Sanitize location search query
   */
  sanitizeSearchQuery: (query: string): string => {
    return query
      .trim()
      .replace(/[<>]/g, '') // Remove potentially dangerous characters
      .substring(0, 100); // Limit length
  }
};

export default geographicValidations;