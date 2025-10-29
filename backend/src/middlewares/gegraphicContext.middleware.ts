/**
 * @file geographicContext.middleware.ts
 *
 * @description
 * UJAMAADAO Geographic Context Middleware
 *
 * This middleware determines the user's geographic context, prioritizing:
 * 1. Authenticated user's stored primaryWardId/location.
 * 2. GeoIP lookup based on the request's IP address (for unauthenticated or initial requests).
 *
 * It attaches the result as a canonical UjamaadaoTypes.GeographicContext object to the request.
 *
 * It relies on the GeographicService for the actual lookup and resolution of GeoIP data
 * to UJAMAADAO's internal ward/constituency IDs.
 */

import type { Response, NextFunction } from 'express';
// Import types via namespace import to ensure stable type resolution
import type * as UjamaadaoTypes from '../types/ujamaadao.types.js';
import logger from '../utils/logger.js';
// Import the singleton service instance from the correct path/name
import { geographicService } from '../services/geographic.service.js';

/**
 * Geographic Context Middleware
 * Determines and attaches GeographicContext to the request object.
 * This should run immediately after authentication (if authentication is used).
 */
export const geographicContextMiddleware = async (
  req: UjamaadaoTypes.AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Use the IP address provided by Express, which handles X-Forwarded-For if configured
  const ipAddress = req.ip;
  // userId is available if Auth middleware has run before this
  const userId = req.user?.userId;

  try {
    // 1. Use the service to determine the context.
    const geographicContext: UjamaadaoTypes.GeographicContext = await geographicService.determineContextFromRequest(
      userId,
      ipAddress,
      req.headers
    );

    // 2. Attach the canonical context object to the request.
    req.geographicContext = geographicContext;

    // 3. Log the successful context establishment.
    logger.debug('Geographic Context Established', {
      userId,
      ip: ipAddress,
      locationScope: geographicContext.locationScope,
      primaryWardId: geographicContext.primaryWardId,
      operation: 'GEOGRAPHIC_SETUP'
    } as UjamaadaoTypes.UjamaadaoLogContext);

    next();
  } catch (error) {
    // If geo-context lookup fails (e.g., GeoService error, bad IP data),
    // we log the error but allow the request to proceed with a default/empty context.
    const emptyContext: UjamaadaoTypes.GeographicContext = {
      primaryWardId: undefined,
      constituencyId: undefined,
      countyId: undefined,
      locationScope: 'NATIONAL', // Default to National scope if specific location cannot be determined
      latitude: undefined,
      longitude: undefined
    } as UjamaadaoTypes.GeographicContext;

    req.geographicContext = emptyContext;

    logger.warn('Failed to determine geographic context. Proceeding with default/NATIONAL context.', {
      userId,
      ip: ipAddress,
      error: error instanceof Error ? error.message : 'Unknown error',
      securityEvent: {
        type: 'GEOGRAPHIC_VIOLATION',
        severity: 'LOW',
        details: 'Geo lookup failed, request allowed to continue without verified location.'
      },
      operation: 'GEOGRAPHIC_SETUP'
    } as UjamaadaoTypes.UjamaadaoLogContext);

    next();
  }
};
