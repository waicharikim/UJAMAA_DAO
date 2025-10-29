/**
 * @file ../middlewares/authenticate.ts
 * * @description
 * Wrapper for the core UJAMAADAO authentication middleware.
 * This file allows the use of 'authenticate' in routes files for clarity
 * while maintaining the core logic in auth.middleware.ts.
 */

import { authMiddleware } from './auth.middleware.js';

/**
 * The standard authentication middleware used in all route definitions.
 * It ensures the request has a valid JWT and populates req.user.
 */
export const authenticate = authMiddleware;

// Note: You can optionally add other common authentication helpers here if needed.