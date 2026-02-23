// tests/auth/token.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tokenService } from '../../src/modules/auth/services/token.service.js';
import { prisma } from '../../src/core/database/client.js';
import { seedLocation, createTestUser } from './helpers.js';

vi.mock('../../src/core/utils/email.service.js');
vi.mock('../../src/modules/economy/services/participationRights.service.js');
vi.mock('../../src/modules/community/services/groupMembership.service.js');

describe('TokenService', () => {
  beforeEach(seedLocation);

  // ── 1. createVerificationToken ────────────────────────────────────────────
  it('creates a 64-char hex verification token stored in DB with correct userId', async () => {
    const user = await createTestUser('token-create@ujamaa.test', 'UNVERIFIED');

    const token = await tokenService.createVerificationToken(user.id);

    expect(typeof token).toBe('string');
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/i.test(token)).toBe(true);

    const record = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });
    expect(record).toBeTruthy();
    expect(record!.userId).toBe(user.id);
    expect(record!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  // ── 2. validateVerificationToken (valid) ──────────────────────────────────
  it('validates token, returns user, and deletes token (one-time use)', async () => {
    const user = await createTestUser('token-validate@ujamaa.test', 'UNVERIFIED');
    const token = await tokenService.createVerificationToken(user.id);

    const result = await tokenService.validateVerificationToken(token);

    expect(result).toBeTruthy();
    expect(result!.id).toBe(user.id);

    // Token should be deleted after use (one-time use)
    const deleted = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });
    expect(deleted).toBeNull();
  });

  // ── 3. validateVerificationToken (non-existent) ───────────────────────────
  it('returns null for a non-existent token', async () => {
    const result = await tokenService.validateVerificationToken(
      'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
    );
    expect(result).toBeNull();
  });

  // ── 4. validateVerificationToken (expired) ───────────────────────────────
  it('returns null for an expired token', async () => {
    const user = await createTestUser('token-expired@ujamaa.test', 'UNVERIFIED');
    const expiredToken = 'aaaa0000bbbb1111cccc2222dddd3333aaaa0000bbbb1111cccc2222dddd3333';

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: expiredToken,
        expiresAt: new Date(Date.now() - 1000), // already expired
      },
    });

    const result = await tokenService.validateVerificationToken(expiredToken);
    expect(result).toBeNull();
  });

  // ── 5. cleanupExpiredVerificationTokens ──────────────────────────────────
  it('deletes only expired verification tokens, leaves valid ones intact', async () => {
    const user = await createTestUser('token-cleanup@ujamaa.test', 'UNVERIFIED');

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: 'eeee1111ffff2222aaaa3333bbbb4444cccc5555dddd6666eeee7777ffff8888',
        expiresAt: new Date(Date.now() - 5000), // expired
      },
    });
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: 'ffffffff1111111122222222333333334444444455555555666666667777777a',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // valid for 1 hour
      },
    });

    const deleted = await tokenService.cleanupExpiredVerificationTokens();
    expect(deleted).toBe(1);

    const remaining = await prisma.emailVerificationToken.findMany({
      where: { userId: user.id },
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  // ── 6. cleanupExpiredPasswordResetTokens ─────────────────────────────────
  it('deletes only expired PasswordReset rows, leaves valid ones', async () => {
    const user = await createTestUser('reset-cleanup@ujamaa.test', 'EMAIL_VERIFIED');

    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: 'hash-of-expired-token',
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: 'hash-of-valid-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const deleted = await tokenService.cleanupExpiredPasswordResetTokens();
    expect(deleted).toBe(1);

    const remaining = await prisma.passwordReset.findMany({
      where: { userId: user.id },
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].tokenHash).toBe('hash-of-valid-token');
  });

  // ── 7. generateSessionToken ───────────────────────────────────────────────
  it('returns a non-empty hex string session token', () => {
    const token = tokenService.generateSessionToken();

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(/^[0-9a-f]+$/i.test(token)).toBe(true);
  });
});
