/**
 * @file validateRequest.ts
 * @description
 * Middleware to validate request body (or params/query) using a Zod schema.
 * Usage:
 *  router.post('/', validateRequest(createUserSchema), controllerFn)
 */

import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError.js';

export function validateRequest(schema: ZodSchema, target: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[target]);
      // write normalized/parsed data back (useful when schema transforms)
      req[target] = parsed;
      next();
    } catch (err: any) {
      // Zod error or other validation error
      if (err?.issues) {
        // Zod error
        return next(new ApiError('Invalid request data', 400, { details: err.issues }));
      }
      return next(new ApiError(err?.message ?? 'Invalid request', 400));
    }
  };
}