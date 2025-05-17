import { describe, it, expect } from 'vitest';
import { createTestUser } from './testHelpers';

describe('Authentication flow minimum test', () => {
  it('creates user and gets JWT token', async () => {
    const user = await createTestUser();
    expect(user.jwtToken).toMatch(/^Bearer\s.+/);
    console.log('Test user JWT:', user.jwtToken);
  });
});