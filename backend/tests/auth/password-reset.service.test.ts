// tests/auth/password-reset.service.test.ts
//
// hashPassword is mocked with a fast, deterministic stub so that argon2's ~300 ms
// cost doesn't make this suite slow.  The stub is bijective so requestReset →
// verifyResetToken flows still work correctly.

vi.mock('../../src/core/utils/crypto.js', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    hashPassword: vi.fn(async (value: string) => `mock-hash::${value}`),
  };
});

vi.mock('../../src/core/utils/email.service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendLoginEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/core/logger/logger.js', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return { ...actual, logSecurityEvent: vi.fn() };
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendEmail } from '../../src/core/utils/email.service.js';
import { passwordResetService } from '../../src/modules/auth/services/password-reset.service.js';
import { prisma } from '../../src/core/database/client.js';
import { seedLocation, createTestUser, createTestAdmin } from './helpers.js';

// 64-char hex tokens for API compliance
const VALID_TOKEN = 'a'.repeat(64);
const OTHER_TOKEN = 'b'.repeat(64);

describe('PasswordResetService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await seedLocation();
  });

  // ── 1. requestReset (valid admin user) → creates PasswordReset, sends email
  it('creates PasswordReset row and sends email for an admin with passwordHash', async () => {
    const admin = await createTestAdmin('admin-reset@ujamaa.test');

    await passwordResetService.requestReset(admin.email!);

    // Should have created a PasswordReset row
    const resets = await prisma.passwordReset.findMany({
      where: { userId: admin.id },
    });
    expect(resets).toHaveLength(1);
    expect(resets[0].used).toBe(false);

    // Should have called sendEmail
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  // ── 2. requestReset (non-existent email) → resolves silently, no email sent
  it('resolves silently for a non-existent email (enumeration protection)', async () => {
    await expect(
      passwordResetService.requestReset('ghost@ujamaa.test')
    ).resolves.toBeUndefined();

    expect(sendEmail).not.toHaveBeenCalled();
  });

  // ── 3. requestReset (non-admin user) → resolves silently, no email sent
  it('resolves silently for a non-admin user (admin-only feature)', async () => {
    const user = await createTestUser('regular-user@ujamaa.test');

    await expect(
      passwordResetService.requestReset(user.email!)
    ).resolves.toBeUndefined();

    expect(sendEmail).not.toHaveBeenCalled();
  });

  // ── 4. verifyResetToken (valid) → returns userId ──────────────────────────
  it('returns userId for a valid, unused, non-expired reset token', async () => {
    const admin = await createTestAdmin('admin-verify@ujamaa.test');

    // Insert a PasswordReset with the hash that mockHashPassword would produce
    await prisma.passwordReset.create({
      data: {
        userId: admin.id,
        tokenHash: `mock-hash::${VALID_TOKEN}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        used: false,
      },
    });

    const userId = await passwordResetService.verifyResetToken(VALID_TOKEN);
    expect(userId).toBe(admin.id);
  });

  // ── 5. verifyResetToken (expired token) → throws ──────────────────────────
  it('throws for an expired reset token', async () => {
    const admin = await createTestAdmin('admin-expired@ujamaa.test');

    await prisma.passwordReset.create({
      data: {
        userId: admin.id,
        tokenHash: `mock-hash::${'c'.repeat(64)}`,
        expiresAt: new Date(Date.now() - 1000), // already expired
        used: false,
      },
    });

    await expect(
      passwordResetService.verifyResetToken('c'.repeat(64))
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  // ── 6. verifyResetToken (invalid/non-existent token) → throws ─────────────
  it('throws for a token that has no matching DB row', async () => {
    await expect(
      passwordResetService.verifyResetToken(OTHER_TOKEN)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  // ── 7. resetPassword → updates passwordHash, revokes all sessions ─────────
  it('updates User.passwordHash and revokes all sessions on successful reset', async () => {
    const admin = await createTestAdmin('admin-pw-reset@ujamaa.test');

    await prisma.passwordReset.create({
      data: {
        userId: admin.id,
        tokenHash: `mock-hash::${VALID_TOKEN}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        used: false,
      },
    });

    // Create a session for the user so we can verify it gets revoked
    await prisma.session.create({
      data: {
        userId: admin.id,
        token: 'session-token-' + '0'.repeat(82),
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        lastActive: new Date(),
        revoked: false,
      },
    });

    await passwordResetService.resetPassword(VALID_TOKEN, 'Str0ng!Pass@word2024');

    // Password should be updated (non-null)
    const updated = await prisma.user.findUnique({ where: { id: admin.id } });
    expect(updated!.passwordHash).not.toBeNull();
    expect(updated!.passwordHash).not.toBe('$argon2id$v=19$m=16,t=2,p=1$dGVzdA$dGVzdA');

    // All sessions should be revoked
    const sessions = await prisma.session.findMany({ where: { userId: admin.id } });
    expect(sessions.every((s) => s.revoked)).toBe(true);

    // Reset token should be marked as used
    const reset = await prisma.passwordReset.findFirst({
      where: { userId: admin.id },
    });
    expect(reset!.used).toBe(true);
  });
});
