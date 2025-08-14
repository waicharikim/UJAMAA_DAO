/**
 * @file asyncHandler.ts
 * @description
 * Wraps async Express handlers to automatically catch errors and forward to next().
 * This keeps controllers thin and avoids repeated try/catch blocks.
 */

import type { RequestHandler } from 'express';

export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};