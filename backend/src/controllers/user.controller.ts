/**
 * @file user.controller.ts
 *
 * @description
 * Thin HTTP controllers for User endpoints.
 * **ENHANCED**: Returns impact points, roles, and holdings in create response.
 * Controllers:
 *  - validate requests using validateRequest middleware (Zod)
 *  - call domain services (user.service)
 *  - serialize responses using serializeUser(...)
 *  - return canonical envelope { data: ... }
 *
 * For owner-specific endpoints (/me), this controller passes isOwner=true so the
 * serializer reveals private fields to the owner.
 */

import type { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { createUserSchema, updateUserSchema } from '../validation/user.validation.js';
import * as UserService from '../services/user.service.js';
import { serializeUser } from '../utils/userSerialization.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Normalize requesterRoles values into string array.
 * Input may be array of strings or objects like { role, scope }.
 */
function extractRoles(rawRoles: any): string[] {
  if (!rawRoles) return [];
  return rawRoles.map((r: any) => (typeof r === 'string' ? r : r.role)).filter(Boolean);
}

/**
 * POST /api/users
 * **ENHANCED**: Create a new user with location, roles, and impact points.
 * Returns canonical { data: user, meta: { affiliations, welcomePoints, assignedRoles } }
 */
export const createUserHandler = [
  validateRequest(createUserSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body;
    const { user, holdings, impactPoints, assignedRoles } = await UserService.createUser(input);
    
    // Serialize with assigned roles (for accurate role display)
    const serialized = serializeUser(user, user.userRoles?.map(ur => ur.role.name) || []);
    
    return res.status(201).json({ 
      data: serialized,
      meta: {
        affiliations: holdings,
        welcomePoints: impactPoints,
        assignedRoles
      }
    });
  }),
];

/**
 * GET /api/users/me
 * Return the current authenticated user's profile (owner view).
 * **ENHANCED**: Includes impact points, roles, and holdings.
 */
export const getCurrentUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const roles = extractRoles(req.userRoles);
  
  // **ENHANCED**: Fetch with relations for points, roles, holdings
  const raw = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: { include: { role: true } },
      userHoldings: { include: { holding: true } },
      privacySettings: true,
      _count: { select: { impactPoints: true } }
    }
  });
  
  if (!raw) return res.status(404).json({ error: 'User not found' });
  
  const serialized = serializeUser(raw, roles, { isOwner: true });
  return res.json({ data: serialized });
});

/**
 * PATCH /api/users/me
 * Update current user and return owner view.
 */
export const updateUserHandler = [
  validateRequest(updateUserSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const input = req.body;
    const changedBy = userId;
    const updatedRaw = await UserService.updateUser(userId, input, changedBy);
    const roles = extractRoles(req.userRoles);

    const serialized = serializeUser(updatedRaw, roles, { isOwner: true });
    return res.json({ data: serialized });
  }),
];

/**
 * POST /api/users/me/avatar
 * Upload avatar — expects multer upload middleware before this handler.
 * Returns the canonical envelope with serialized user (owner view).
 */
export const uploadAvatarHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;

  const changedBy = userId;
  const updatedRaw = await UserService.updateUser(userId, { avatarUrl }, changedBy);
  const roles = extractRoles(req.userRoles);
  const serialized = serializeUser(updatedRaw, roles, { isOwner: true });

  return res.json({ data: serialized });
});

/**
 * GET /api/users/wallet/:walletAddress
 * Public lookup by wallet address, returns canonical envelope with serialized user.
 * isOwner=false by default (unless roles indicate ownership).
 */
export const getUserByWalletHandler = asyncHandler(async (req: Request, res: Response) => {
  const wallet = req.params.walletAddress;
  if (!wallet) return res.status(400).json({ error: 'walletAddress is required' });

  const roles = extractRoles(req.userRoles);
  const raw = await UserService.getUserByWallet(wallet);
  
  // **ENHANCED**: Ensure relations are included for public view
  const rawWithRelations = await prisma.user.findUnique({
    where: { walletAddress: wallet },
    include: {
      userRoles: { include: { role: true } },
      userHoldings: { include: { holding: true } },
      privacySettings: true,
      _count: { select: { impactPoints: true } }
    }
  });
  
  if (!rawWithRelations) return res.status(404).json({ error: 'User not found' });
  
  const serialized = serializeUser(rawWithRelations, roles, { isOwner: false });
  return res.json({ data: serialized });
});