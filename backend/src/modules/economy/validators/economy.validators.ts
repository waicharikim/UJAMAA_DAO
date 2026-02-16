/**
 * @file src/modules/economy/validators/economy.validators.ts
 * @description
 * Economy Module Validation Schemas
 * 
 * Version: 1.0 — January 2026
 */

import { z } from "zod";

// ============================================================================
// PARTICIPATION RIGHTS AWARD (admin or event-driven)
// ============================================================================

/**
 * Award PR Schema
 */
export const awardPRSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  amount: z.number().int().positive("Amount must be positive"),
  reason: z.string().min(1, "Reason is required"),
  metadata: z.record(z.any()).optional(),
});

// ============================================================================
// PARTICIPATION RIGHTS SPEND (user-initiated)
// ============================================================================

/**
 * Spend PR Schema
 */
export const spendPRSchema = z.object({
  amount: z.number().int().positive("Amount must be positive"),
  reason: z.string().min(1, "Reason is required"),
  metadata: z.record(z.any()).optional(),
});

// ============================================================================
// COMMITMENT CREATION (opt-in dues/role/project)
// ============================================================================

/**
 * Create Commitment Schema
 */
export const createCommitmentSchema = z.object({
  type: z.enum([
    "DUES",
    "PROJECT_CONTRIBUTION",
    "GROUP_ROLE",
    "EVENT_ATTENDANCE",
  ], { message: "Invalid commitment type" }),
  targetId: z.string().uuid().optional(), // Group ID, Project ID, etc.
  amountKes: z.number().int().nonnegative().optional(),
  amountPR: z.number().int().nonnegative().optional(),
  frequency: z.enum(["MONTHLY", "ONE_TIME", "WEEKLY"]).optional(),
  durationMonths: z.number().int().positive().optional(),
});

// ============================================================================
// COMMITMENT STATUS RESPONSE (for profile/dashboard)
// ============================================================================

export const commitmentStatusSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  status: z.string(),
  amountKes: z.number().optional(),
  amountPR: z.number().optional(),
  frequency: z.string().optional(),
  missedCount: z.number(),
  startDate: z.date(),
  endDate: z.date().nullable(),
});