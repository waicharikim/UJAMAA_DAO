/**
 * @file user.validation.test.ts
 * @description Unit tests for user validation schemas
 */

import { describe, it, expect } from 'vitest';
import { createUserSchema } from '../../src/validation/user.validation.js';

describe('User Validation Schemas', () => {
  it('createUserSchema - should validate minimal payload (national user)', () => {
    const payload = {
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      email: 'test@ujamaa.co.ke',
      name: 'Test User'
    };

    const result = createUserSchema.parse(payload);

    expect(result.walletAddress).toBe(payload.walletAddress.toLowerCase());
    expect(result.email).toBe(payload.email);
    expect(result.name).toBe(payload.name);
  });

  it('createUserSchema - should reject missing walletAddress', () => {
    const payload = {
      email: 'test@ujamaa.co.ke',
      name: 'Test User'
    };

    expect(() => createUserSchema.parse(payload)).toThrow('walletAddress');
  });

  it('createUserSchema - should reject invalid email', () => {
    const payload = {
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      email: 'invalid-email',
      name: 'Test User'
    };

    expect(() => createUserSchema.parse(payload)).toThrow('email');
  });
});