/**
 * @file userPrivacy.controller.ts
 * @description Controller for managing user privacy settings and compliance operations (anonymization).
 * Enforces ownership and Super Admin roles for sensitive actions.
 */

import type { Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { AuthRequest } from '../types/ujamaadao.types.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import * as privacyService from '../services/userPrivacy.service.js';
import { resolveOwnerId } from '../utils/ownership.js'; // Assuming this utility exists

/**
 * Get the authenticated user's own privacy settings.
 */
export const getMyPrivacySettingsHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError('Authentication context missing.', 401);

    const settings = await privacyService.getUserPrivacySettings(userId);
    
    // Return the raw settings object for the user to view/edit
    res.json({ userId: userId, settings: settings.settings });
});

/**
 * Update the authenticated user's own privacy settings.
 */
export const updateMyPrivacySettingsHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError('Authentication context missing.', 401);
    
    // Zod validation in middleware ensures req.body.settings is present
    const newSettings = req.body.settings as Record<string, string>;

    const updatedSettings = await privacyService.updateUserPrivacySettings(
        userId, 
        newSettings, 
        userId // The user is the actor/changedById
    );

    res.json({ message: 'Privacy settings updated successfully.', settings: updatedSettings.settings });
});


/**
 * Retrieves the privacy settings for a specific user.
 * NOTE: Access to this endpoint is restricted by RBAC middleware in the router.
 */
export const getUserPrivacySettingsHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
    const targetUserId = req.params.userId;
    const actorId = req.user?.userId;

    if (!actorId) throw new ApiError('Authentication context missing.', 401);

    // This route is protected by RBAC in the router to only allow admins/auditors.
    const settings = await privacyService.getUserPrivacySettings(targetUserId);
    
    res.json({ userId: targetUserId, settings: settings.settings });
});


/**
 * Anonymizes a user's sensitive PII data (Right to Erasure).
 * CRITICAL: Restricted to system:super_admin role via route middleware in the router.
 */
export const anonymizeUserSensitiveDataHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
    const targetUserId = req.params.userId;
    const actorId = req.user?.userId;
    
    if (!actorId) throw new ApiError('Authentication context missing.', 401);

    // The RBAC middleware ensures the actorId has the required super_admin role.
    await privacyService.anonymizeUserSensitiveData(targetUserId, actorId);

    res.status(200).json({ 
        message: `User ${targetUserId} sensitive data has been permanently anonymized and the account disabled.` 
    });
});
