/**
 * @file geographic.controller.ts
 * * @description
 * UJAMAADAO Geographic Controller
 * * Handles HTTP requests for geographic operations including:
 * - Geographic hierarchy management
 * - Location-based user grouping
 * - Geographic context establishment
 * - Location search and validation
 */

import { Request, Response } from 'express';
import { geographicService } from '../services/geographic.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import logger from '../utils/logger.js';
// NOTE: We assume 'Request' interface in express is extended to include 'user' (req.user)

/**
 * Geographic Controller
 */
export class GeographicController {
  
  // NOTE: Validation for wardId existence and format should now happen in the routes layer 
  // via validation middleware (using the assumed schemas above).

  /**
   * Get geographic hierarchy from ward ID
   */
  getHierarchy = asyncHandler(async (req: Request, res: Response) => {
    const { wardId } = req.params; // Expecting wardId is guaranteed to be present and valid UUID by middleware

    const hierarchy = await geographicService.getGeographicHierarchy(wardId);

    res.status(200).json({
      success: true,
      data: hierarchy,
      message: 'Geographic hierarchy retrieved successfully'
    });
  });

  /**
   * Establish geographic context for user
   */
  establishContext = asyncHandler(async (req: Request, res: Response) => {
    const { primaryWardId } = req.body; // Expecting primaryWardId to be valid UUID
    const userId = req.user?.userId;

    if (!userId) { // CRITICAL: Only check for authentication here
      throw new ApiError('User authentication required', 401, { code: 'UNAUTHENTICATED' });
    }

    // primaryWardId validity checked by validation middleware
    const context = await geographicService.establishGeographicContext(primaryWardId, userId);

    res.status(200).json({
      success: true,
      data: context,
      message: 'Geographic context established successfully'
    });
  });

  /**
   * Get users by geographic location
   */
  getUsersByLocation = asyncHandler(async (req: Request, res: Response) => {
    // locationId and locationType are guaranteed valid by middleware
    const { locationId, locationType } = req.params as { locationId: string, locationType: 'WARD' | 'CONSTITUENCY' | 'COUNTY' }; 

    const userGroup = await geographicService.getUsersByLocation(
      locationId, 
      locationType
    );

    res.status(200).json({
      success: true,
      data: userGroup,
      message: `Users retrieved for ${locationType.toLowerCase()} location`
    });
  });

  /**
   * Validate geographic hierarchy
   */
  validateHierarchy = asyncHandler(async (req: Request, res: Response) => {
    const { wardId, constituencyId, countyId } = req.body; // Guaranteed valid by middleware

    const isValid = await geographicService.validateHierarchy(wardId, constituencyId, countyId);

    res.status(200).json({
      success: true,
      data: { isValid },
      message: 'Geographic hierarchy validation completed'
    });
  });

  /**
   * Get wards by constituency
   */
  getWardsByConstituency = asyncHandler(async (req: Request, res: Response) => {
    const { constituencyId } = req.params; // Guaranteed valid by middleware

    const wards = await geographicService.getWardsByConstituency(constituencyId);

    res.status(200).json({
      success: true,
      data: wards,
      message: 'Wards retrieved successfully'
    });
  });

  /**
   * Get constituencies by county
   */
  getConstituenciesByCounty = asyncHandler(async (req: Request, res: Response) => {
    const { countyId } = req.params; // Guaranteed valid by middleware

    const constituencies = await geographicService.getConstituenciesByCounty(countyId);

    res.status(200).json({
      success: true,
      data: constituencies,
      message: 'Constituencies retrieved successfully'
    });
  });

  /**
   * Get all counties
   */
  getAllCounties = asyncHandler(async (req: Request, res: Response) => {
    const counties = await geographicService.getAllCounties();

    res.status(200).json({
      success: true,
      data: counties,
      message: 'Counties retrieved successfully'
    });
  });

  /**
   * Search geographic locations
   */
  searchLocations = asyncHandler(async (req: Request, res: Response) => {
    // Guaranteed valid by middleware (query exists, is string, type is optional enum)
    const { query, type } = req.query as { query: string, type?: 'WARD' | 'CONSTITUENCY' | 'COUNTY' }; 

    const results = await geographicService.searchLocations(query, type);

    res.status(200).json({
      success: true,
      data: results,
      message: 'Location search completed successfully'
    });
  });

  /**
   * Get user's current geographic context
   */
  getCurrentContext = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const user = req.user;

    if (!userId || !user) {
      throw new ApiError('User authentication required', 401, { code: 'UNAUTHENTICATED' });
    }

    if (!user.primaryWardId) {
      // This is a business rule check that belongs in the controller/service
      throw new ApiError('User does not have a primary ward assigned', 400, {
        code: 'NO_PRIMARY_WARD'
      });
    }

    const hierarchy = await geographicService.getGeographicHierarchy(user.primaryWardId);

    const context = {
      primaryWardId: user.primaryWardId,
      constituencyId: hierarchy.constituency.id,
      countyId: hierarchy.county.id,
      locationScope: 'WARD' as const,
      hierarchy: {
        ward: hierarchy.ward,
        constituency: hierarchy.constituency,
        county: hierarchy.county
      }
    };

    res.status(200).json({
      success: true,
      data: context,
      message: 'Current geographic context retrieved successfully'
    });
  });
}

// Export controller instance
export const geographicController = new GeographicController();