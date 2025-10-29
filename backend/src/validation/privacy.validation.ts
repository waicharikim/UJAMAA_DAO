/**
 * @file privacy.validation.ts
 * @description Zod validation schemas for User Privacy Controller endpoints.
 * Ensures privacy settings updates are well-formed and restricted to allowed values.
 */

import { z } from 'zod';

/**
 * Valid privacy visibility settings for fields like email, phone number, etc.
 * 'public': Visible to everyone.
 * 'group': Visible to users who share a common group role (e.g., same ward/group).
 * 'private': Only visible to the user themselves and Super Admins.
 */
const privacySettingSchema = z.enum(['public', 'group', 'private'], {
    required_error: "Privacy setting must be 'public', 'group', or 'private'",
    invalid_type_error: "Invalid privacy setting value",
});

/**
 * Schema for updating multiple privacy settings at once.
 * Note: Only includes fields the user can set privacy on.
 */
export const updatePrivacySettingsSchema = z.object({
    body: z.object({
        settings: z.object({
            // Personal Contact/Identifier Data
            email: privacySettingSchema.optional(),
            phoneNumber: privacySettingSchema.optional(),
            walletAddress: privacySettingSchema.optional(),

            // Geographic Data
            countyLive: privacySettingSchema.optional(),
            constituencyLive: privacySettingSchema.optional(),
            countyOrigin: privacySettingSchema.optional(),
            constituencyOrigin: privacySettingSchema.optional(),

            // Future: Add other sensitive fields here
        })
        .partial()
        .refine(data => Object.keys(data).length > 0, {
            message: 'At least one privacy setting must be provided for update.',
        }),
    }),
});

/**
 * Schema for retrieving another user's privacy settings (requires admin roles).
 */
export const getUserSettingsSchema = z.object({
    params: z.object({
        userId: z.string().uuid('User ID must be a valid UUID.'),
    }),
});

/**
 * Schema for anonymizing a user's data (requires super_admin role).
 */
export const anonymizeUserSchema = z.object({
    params: z.object({
        userId: z.string().uuid('User ID must be a valid UUID.'),
    }),
});
