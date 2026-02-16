/**
 * @file src/modules/admin/types/admin.types.ts
 * @description
 * Admin Module Type Definitions and DTOs
 * 
 * Version: 1.0 — January 2026
 */

import { z } from "zod";

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

/**
 * Approve Residence Change Schema
 */
export const ApproveResidenceChangeSchema = z.object({
  requestId: z.string().uuid(),
  approved: z.boolean(),
  reason: z.string().max(500).optional(),
});

/**
 * Verify Milestone Schema (admin override)
 */
export const VerifyMilestoneSchema = z.object({
  milestoneId: z.string().uuid(),
  approved: z.boolean(),
  feedback: z.string().max(500).optional(),
});

/**
 * Update System Config Schema
 */
export const UpdateSystemConfigSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
});

// ============================================================================
// TYPESCRIPT TYPES (inferred from Zod)
// ============================================================================

export type ApproveResidenceChangeDto = z.infer<typeof ApproveResidenceChangeSchema>;
export type VerifyMilestoneDto = z.infer<typeof VerifyMilestoneSchema>;
export type UpdateSystemConfigDto = z.infer<typeof UpdateSystemConfigSchema>;

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Generic admin action response
 */
export interface AdminActionResponse {
  success: boolean;
  message: string;
  data?: any;
}