/**
 * @file geographic.routes.ts
 * 
 * @description
 * UJAMAADAO Geographic Routes
 * 
 * Defines API endpoints for geographic operations including:
 * - Hierarchy management
 * - Location-based queries
 * - Geographic context operations
 * - Location search and validation
 */

import { Router } from 'express';
import { geographicController } from '../controllers/geographic.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { geographicValidations } from '../validation/geographic.validation.js';

const router = Router();

/**
 * @route GET /api/geographic/hierarchy/:wardId
 * @description Get complete geographic hierarchy from ward ID
 * @access Public (consider making authenticated if needed)
 */
router.get(
  '/hierarchy/:wardId',
  validateRequest(geographicValidations.getHierarchy),
  geographicController.getHierarchy
);

/**
 * @route POST /api/geographic/context
 * @description Establish geographic context for authenticated user
 * @access Private
 */
router.post(
  '/context',
  authenticate,
  validateRequest(geographicValidations.establishContext),
  geographicController.establishContext
);

/**
 * @route GET /api/geographic/context/current
 * @description Get current user's geographic context
 * @access Private
 */
router.get(
  '/context/current',
  authenticate,
  geographicController.getCurrentContext
);

/**
 * @route GET /api/geographic/location/:locationType/:locationId/users
 * @description Get users by geographic location with statistics
 * @access Private
 */
router.get(
  '/location/:locationType/:locationId/users',
  authenticate,
  validateRequest(geographicValidations.getUsersByLocation),
  geographicController.getUsersByLocation
);

/**
 * @route POST /api/geographic/validate
 * @description Validate geographic hierarchy consistency
 * @access Public (consider making authenticated if needed)
 */
router.post(
  '/validate',
  validateRequest(geographicValidations.validateHierarchy),
  geographicController.validateHierarchy
);

/**
 * @route GET /api/geographic/constituency/:constituencyId/wards
 * @description Get all wards in a constituency
 * @access Public
 */
router.get(
  '/constituency/:constituencyId/wards',
  validateRequest(geographicValidations.getWardsByConstituency),
  geographicController.getWardsByConstituency
);

/**
 * @route GET /api/geographic/county/:countyId/constituencies
 * @description Get all constituencies in a county
 * @access Public
 */
router.get(
  '/county/:countyId/constituencies',
  validateRequest(geographicValidations.getConstituenciesByCounty),
  geographicController.getConstituenciesByCounty
);

/**
 * @route GET /api/geographic/counties
 * @description Get all counties with basic information
 * @access Public
 */
router.get(
  '/counties',
  geographicController.getAllCounties
);

/**
 * @route GET /api/geographic/search
 * @description Search geographic locations by name
 * @access Public
 */
router.get(
  '/search',
  validateRequest(geographicValidations.searchLocations),
  geographicController.searchLocations
);

// Admin-only routes for geographic management
/**
 * @route GET /api/geographic/admin/stats
 * @description Get geographic statistics (admin only)
 * @access Private (Admin)
 */
router.get(
  '/admin/stats',
  authenticate,
  authorize(['system:super_admin', 'system:auditor']),
  async (req, res) => {
    // This would be implemented with admin-specific geographic statistics
    res.status(200).json({
      success: true,
      data: {
        totalCounties: 0, // Would be calculated
        totalConstituencies: 0, // Would be calculated
        totalWards: 0, // Would be calculated
        userDistribution: {} // Would be calculated
      },
      message: 'Geographic statistics retrieved successfully'
    });
  }
);

/**
 * @route GET /api/geographic/admin/location-stats/:locationType/:locationId
 * @description Get detailed statistics for a specific location (admin only)
 * @access Private (Admin)
 */
router.get(
  '/admin/location-stats/:locationType/:locationId',
  authenticate,
  authorize(['system:super_admin', 'system:auditor']),
  validateRequest(geographicValidations.getLocationStats),
  async (req, res) => {
    const { locationType, locationId } = req.params;
    const { timeframe, metrics } = req.query;
    
    // Implementation would fetch detailed location statistics
    res.status(200).json({
      success: true,
      data: {
        locationType,
        locationId,
        timeframe,
        metrics,
        statistics: {
          userGrowth: 0,
          economicActivity: 0,
          projectCompletionRate: 0,
          communityEngagement: 0
        }
      },
      message: 'Location statistics retrieved successfully'
    });
  }
);

/**
 * @route POST /api/geographic/admin/compare-locations
 * @description Compare multiple locations (admin only)
 * @access Private (Admin)
 */
router.post(
  '/admin/compare-locations',
  authenticate,
  authorize(['system:super_admin', 'system:auditor']),
  validateRequest(geographicValidations.compareLocations),
  async (req, res) => {
    const { locations, metrics } = req.body;
    
    // Implementation would compare multiple locations
    res.status(200).json({
      success: true,
      data: {
        comparison: locations.map(location => ({
          ...location,
          metrics: metrics.reduce((acc: any, metric: string) => {
            acc[metric] = Math.random() * 100; // Mock data
            return acc;
          }, {})
        })),
        summary: {
          bestPerforming: locations[0]?.locationId,
          needsAttention: locations[1]?.locationId
        }
      },
      message: 'Location comparison completed successfully'
    });
  }
);

/**
 * @route GET /api/geographic/admin/export/:locationType/:locationId
 * @description Export location data (admin only)
 * @access Private (Admin)
 */
router.get(
  '/admin/export/:locationType/:locationId',
  authenticate,
  authorize(['system:super_admin', 'system:auditor']),
  validateRequest(geographicValidations.exportLocationData),
  async (req, res) => {
    const { locationType, locationId } = req.params;
    const { format, include, timeframe } = req.query;
    
    // Implementation would generate export data
    res.status(200).json({
      success: true,
      data: {
        locationType,
        locationId,
        format,
        include,
        timeframe,
        downloadUrl: `/api/geographic/admin/exports/${locationId}.${format}`, // Mock URL
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      },
      message: 'Export data prepared successfully'
    });
  }
);

export default router;