/**
 * @file privacySettings.validation.ts
 *
 * @description
 * Defines Zod validation schema for user privacy settings updates.
 * Ensures only allowed fields and visibility values are accepted.
 */

import { z } from 'zod';

const allowedFields = [
  'email',
  'phoneNumber',
  'walletAddress',
  'countyLive',
  'constituencyLive',
  'countyOrigin',
  'constituencyOrigin',
];

const allowedValues = ['public', 'group', 'private'] as const;

export const privacySettingsSchema = z.object(
  allowedFields.reduce((acc, field) => {
    acc[field] = z.enum(allowedValues).optional();
    return acc;
  }, {} as Record<string, unknown>)
);