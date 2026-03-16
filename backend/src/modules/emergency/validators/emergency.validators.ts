/**
 * @file src/modules/emergency/validators/emergency.validators.ts
 * @description Zod validation schemas for emergency module
 */

import { z } from 'zod';

export const reportEmergencySchema = z.object({
  type: z.enum(['FIRE', 'FLOOD', 'MEDICAL', 'SECURITY', 'ACCIDENT', 'OTHER']),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  locationWardId: z.string().uuid('locationWardId must be a valid UUID'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  photoUrl: z.string().url('photoUrl must be a valid URL').optional(),
});

export const respondToEmergencySchema = z.object({
  message: z.string().min(5, 'Message must be at least 5 characters'),
});

export const alertIdParamSchema = z.object({
  alertId: z.string().uuid('alertId must be a valid UUID'),
});

export const listAlertsSchema = z.object({
  wardId: z.string().uuid().optional(),
  status: z.string().optional(),
  type: z
    .enum(['FIRE', 'FLOOD', 'MEDICAL', 'SECURITY', 'ACCIDENT', 'OTHER'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
});
