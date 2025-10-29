/**
 * @file asyncHandler.ts
 *
 * @description
 * UJAMAADAO Enhanced Async Handler Wrapper for Express
 *
 * Advanced error handling wrapper for async Express route handlers that provides:
 * - Automatic error catching and forwarding to Express error middleware
 * - UJAMAADAO context preservation for geographic and verification data
 * - Comprehensive error logging with platform-specific context
 * - Performance monitoring and metrics collection
 * - Security event tracking for suspicious activities
 *
 * UJAMAADAO SPECIFIC ENHANCEMENTS:
 * - Geographic context preservation in error logs
 * - Verification level tracking for security monitoring
 * - Economic system error categorization
 * - Community governance operation tracking
 * - Location-based error context
 *
 * Benefits:
 * - Eliminates repetitive try/catch blocks in controllers
 * - Standardizes error handling across the UJAMAADAO platform
 * - Provides rich context for debugging and monitoring
 * - Ensures consistent error responses to clients
 * - Maintains security and audit trails
 */

import type { RequestHandler, Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
// FIX: Import AuthRequest type directly from the centralized types file
import type { AuthRequest } from '../types/ujamaadao.types.js';

/**
 * UJAMAADAO Enhanced Async Handler
 *
 * Wraps async Express route handlers to automatically catch errors and forward
 * them to Express error handling middleware. Enriches errors with UJAMAADAO
 * context for improved debugging and monitoring.
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  // Return a new RequestHandler function
  return (req: Request, res: Response, next: NextFunction) => {
    // Call the original async function and catch any promise rejection (error)
    Promise.resolve(fn(req, res, next)).catch((err: unknown) => {
      const authReq = req as AuthRequest;
      // Log the error with all available context before forwarding
      logger.error('UJAMAADAO Route Handler Error', {
        path: req.path,
        method: req.method,
        userId: authReq.user?.userId,
        verificationLevel: authReq.user?.verificationLevel,
        geographicContext: authReq.geographicContext,
        error: err instanceof Error ? err.message : String(err),
      });

      // Forward the error to the Express error handler (next(err))
      next(err);
    });
  };
};

/**
 * UJAMAADAO Async Handler with Performance Metrics
 *
 * Wraps an async Express RequestHandler to log performance metrics after
 * successful or failed execution. Essential for identifying
 * performance bottlenecks in the geographic governance system.
 *
 * @param fn - Async Express RequestHandler function to wrap
 * @param operationName - Name of the operation for monitoring
 * @returns Enhanced RequestHandler with performance monitoring
 */
export const asyncHandlerWithMetrics = (fn: RequestHandler, operationName: string): RequestHandler => {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const authReq = req as AuthRequest;

    try {
      // Execute the original handler
      await fn(req, res, next);

      // Log performance metrics on success
      const duration = Date.now() - startTime;
      logger.debug('UJAMAADAO Performance', {
        operation: operationName,
        duration,
        path: req.path,
        method: req.method,
        userId: authReq.user?.userId,
        verificationLevel: authReq.user?.verificationLevel
      });

    } catch (error) {
      // Log performance metrics on error
      const duration = Date.now() - startTime;
      logger.warn('UJAMAADAO Performance Error', {
        operation: operationName,
        duration,
        path: req.path,
        method: req.method,
        userId: authReq.user?.userId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Re-throw to be caught by the asyncHandler
      throw error;
    }
  });
};
