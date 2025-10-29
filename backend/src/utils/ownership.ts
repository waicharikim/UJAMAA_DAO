/**
 * @file ownership.ts
 *
 * @description
 * Utility functions for resolving resource ownership within controller and service logic.
 * Primarily used to retrieve the authenticated user's ID for operations where
 * they are the implied owner of the resource being modified or accessed.
 */

import { AuthRequest } from '../middlewares/auth.middleware.js';
import ApiError from './ApiError.js';

/**
 * Extracts the authenticated user's ID from the request object.
 * This is used when the operation is an 'owner-only' action (e.g., updating 'me',
 * updating a resource the user created).
 *
 * @param req The AuthRequest object containing the authenticated user context.
 * @returns The user's ID (string).
 * @throws {ApiError} 401 if the authentication context is missing.
 */
export function resolveOwnerId(req: AuthRequest): string {
  const ownerId = req.user?.userId;
  
  if (!ownerId) {
    // This should theoretically not happen if the 'authenticate' middleware ran successfully,
    // but it serves as a robust defense-in-depth check.
    throw new ApiError('Authentication context missing. Cannot resolve resource owner.', 401);
  }
  
  return ownerId;
}

/**
 * Utility to resolve the ID of the entity that performed the change (the actor).
 * In most CRUD operations, this is the same as the owner, but it's kept separate
 * for clarity in audit logging contexts.
 *
 * @param req The AuthRequest object.
 * @returns The actor's ID (string).
 * @throws {ApiError} 401 if the authentication context is missing.
 */
export function resolveActorId(req: AuthRequest): string {
  return resolveOwnerId(req); // In this application, the actor is the authenticated user.
}
