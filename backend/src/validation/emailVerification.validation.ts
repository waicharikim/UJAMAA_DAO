/**
 * @file emailVerification.validation.ts
 *
 * @description
 * UJAMAADAO Zod Schemas for Email Verification
 *
 * Defines the validation rules for the data exchanged during the progressive
 * email verification process, ensuring data integrity and security compliance
 * for the UJAMAADAO platform.
 */

import { z } from 'zod';

// --- Email Verification Token Schema ---

/**
 * Zod schema for validating the incoming verification token.
 * The token is expected to be a URL-safe Base64 string (from randomBytes('base64url')).
 */
export const verifyTokenSchema = z.object({
  /**
   * The verification token itself.
   * It must be a non-empty string. We use string().min(1) for a basic check,
   * though the service layer performs the actual secure token lookup and validation.
   */
  token: z.string({
      required_error: 'The verification token is required.',
      invalid_type_error: 'The token must be a string value.'
    })
    .min(1, 'The verification token cannot be empty.')
    // UJAMAADAO Enhancement: Check if it resembles a base64url string (optional regex)
    .regex(/^[A-Za-z0-9_-]+$/, 'The token format is invalid. Ensure you copied the full link.')
    .max(256, 'The token is too long and appears malformed.'),
});

/**
 * UJAMAADAO Wrapper for Verify Email Request
 *
 * This schema wraps the token for use with `validateRequest({ target: 'body' })`
 * or `validateRequest({ target: 'query' })` depending on how the route is configured
 * to accept the token.
 *
 * In `emailVerification.routes.ts`, we typically check both query and body, but
 * the `validateRequest` middleware targets one. We'll define a body/query schema
 * that uses the token object.
 */
export const verifyEmailRequestSchema = z.object({
    // We expect the token to be sent in the body or query parameter named 'token'
    token: verifyTokenSchema.shape.token
});