/**
 * @file consent.validation.ts
 *
 * @description
 * Defines Zod validation schema for recording user consents.
 * Validates required policyType and version fields.
 */

import { z } from 'zod';

export const recordConsentSchema = z.object({
  policyType: z.string().min(1, 'Policy type is required'),
  version: z.string().min(1, 'Version is required'),
});