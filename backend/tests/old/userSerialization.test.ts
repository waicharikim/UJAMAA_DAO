/**
 * @file userSerialization.test.ts
 * @description Unit tests for user serialization (privacy levels)
 */

import { describe, it, expect } from 'vitest';
import { serializeUser } from '../../src/utils/userSerialization.js';

const mockUser = {
  id: 'test-id',
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  email: 'test@ujamaa.co.ke',
  name: 'Test User',
  phoneNumber: '0712345678',
  impactPoints: 50,
  roles: ['system:general_user'],
  holdings: ['Kibra Ward']
};

describe('User Serialization', () => {
  it('serializeUser() - public view hides email/phone', () => {
    const result = serializeUser(mockUser, 'public');

    expect(result).toHaveProperty('name', 'Test User');
    expect(result).toHaveProperty('impactPoints', 50);
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('phoneNumber');
  });

  it('serializeUser() - owner view shows all fields', () => {
    const result = serializeUser(mockUser, 'owner');

    expect(result).toHaveProperty('email', 'test@ujamaa.co.ke');
    expect(result).toHaveProperty('phoneNumber', '0712345678');
  });

  it('serializeUser() - admin view shows all fields', () => {
    const result = serializeUser(mockUser, 'admin');

    expect(result).toHaveProperty('email', 'test@ujamaa.co.ke');
    expect(result).toHaveProperty('phoneNumber', '0712345678');
  });

  it('serializeUser() - should sum impact points correctly', () => {
    const userWithPoints = { ...mockUser, impactPoints: [25, 25] };
    const result = serializeUser(userWithPoints, 'public');

    expect(result).toHaveProperty('impactPoints', 50);
  });

  it('serializeUser() - should format roles array', () => {
    const result = serializeUser(mockUser, 'public');

    expect(result).toHaveProperty('roles', ['system:general_user']);
  });

  it('serializeUser() - should format holdings array', () => {
    const result = serializeUser(mockUser, 'public');

    expect(result).toHaveProperty('holdings', ['Kibra Ward']);
  });
});