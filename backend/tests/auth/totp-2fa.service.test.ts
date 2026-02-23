// tests/auth/totp-2fa.service.test.ts
//
// crypto.encrypt/decrypt are mocked so tests don't need an ENCRYPTION_KEY env var.
// speakeasy runs for real so TOTP codes are genuinely verified.

vi.mock('../../src/core/utils/crypto.js', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    // Simple reversible stub — value identity preserved across store/retrieve
    encrypt: vi.fn((value: string) => `enc::${value}`),
    decrypt: vi.fn((value: string) => value.replace(/^enc::/, '')),
  };
});

vi.mock('../../src/core/utils/email.service.js');
vi.mock('../../src/core/utils/eventBus.js', () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn() },
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import speakeasy from 'speakeasy';
import { totp2FAService } from '../../src/modules/auth/services/totp-2fa.service.js';
import { prisma } from '../../src/core/database/client.js';
import { seedLocation, createTestUser } from './helpers.js';

describe('Totp2FAService', () => {
  beforeEach(seedLocation);

  // ── 1. enable → creates TwoFactorAuth row, returns QR data + backup codes ─
  it('creates TwoFactorAuth row and returns secret, qrCodeUrl, backupCodes', async () => {
    const user = await createTestUser('2fa-enable@ujamaa.test');

    const result = await totp2FAService.enable(user.id, user.email!);

    expect(result.secret).toBeTruthy();
    expect(result.qrCodeUrl).toMatch(/^data:image\//);
    expect(Array.isArray(result.backupCodes)).toBe(true);
    expect(result.backupCodes).toHaveLength(10);

    const record = await prisma.twoFactorAuth.findUnique({
      where: { userId: user.id },
    });
    expect(record).toBeTruthy();
    expect(record!.enabled).toBe(false); // not yet verified
    expect(record!.backupCodesEncrypted).toHaveLength(10);
  });

  // ── 2. verify (valid TOTP from speakeasy) → sets enabled=true ────────────
  it('enables 2FA after verifying a valid TOTP code', async () => {
    const user = await createTestUser('2fa-verify@ujamaa.test');
    const { secret } = await totp2FAService.enable(user.id, user.email!);

    const validCode = speakeasy.totp({ secret, encoding: 'base32' });
    const result = await totp2FAService.verify(user.id, validCode);

    expect(result).toBe(true);

    const record = await prisma.twoFactorAuth.findUnique({
      where: { userId: user.id },
    });
    expect(record!.enabled).toBe(true);
    expect(record!.failedAttempts).toBe(0);
  });

  // ── 3. verify (invalid code) → throws 400, increments failedAttempts ─────
  it('throws 400 for an invalid TOTP code and increments failedAttempts', async () => {
    const user = await createTestUser('2fa-invalid@ujamaa.test');
    await totp2FAService.enable(user.id, user.email!);

    await expect(
      totp2FAService.verify(user.id, '000000')
    ).rejects.toMatchObject({ statusCode: 400 });

    const record = await prisma.twoFactorAuth.findUnique({
      where: { userId: user.id },
    });
    expect(record!.failedAttempts).toBe(1);
  });

  // ── 4. verifyLogin with valid backup code → true, removes used code ───────
  it('accepts a valid backup code and removes it from the encrypted array', async () => {
    const user = await createTestUser('2fa-backup@ujamaa.test');
    const { secret, backupCodes } = await totp2FAService.enable(user.id, user.email!);

    // Enable 2FA first
    const totpCode = speakeasy.totp({ secret, encoding: 'base32' });
    await totp2FAService.verify(user.id, totpCode);

    const before = await prisma.twoFactorAuth.findUnique({
      where: { userId: user.id },
    });
    const initialCount = before!.backupCodesEncrypted.length;

    // Use the first backup code
    const isValid = await totp2FAService.verifyLogin(user.id, backupCodes[0]);
    expect(isValid).toBe(true);

    const after = await prisma.twoFactorAuth.findUnique({
      where: { userId: user.id },
    });
    expect(after!.backupCodesEncrypted.length).toBe(initialCount - 1);
  });

  // ── 5. disable (valid code) → sets enabled=false ─────────────────────────
  it('disables 2FA when a valid code is provided', async () => {
    const user = await createTestUser('2fa-disable@ujamaa.test');
    const { secret } = await totp2FAService.enable(user.id, user.email!);

    const code1 = speakeasy.totp({ secret, encoding: 'base32' });
    await totp2FAService.verify(user.id, code1);

    const code2 = speakeasy.totp({ secret, encoding: 'base32' });
    await totp2FAService.disable(user.id, code2);

    const record = await prisma.twoFactorAuth.findUnique({
      where: { userId: user.id },
    });
    expect(record!.enabled).toBe(false);
  });

  // ── 6. getStatus (enabled) → returns correct status ─────────────────────
  it('returns enabled=true and backup code count when 2FA is enabled', async () => {
    const user = await createTestUser('2fa-status-on@ujamaa.test');
    const { secret } = await totp2FAService.enable(user.id, user.email!);
    const code = speakeasy.totp({ secret, encoding: 'base32' });
    await totp2FAService.verify(user.id, code);

    const status = await totp2FAService.getStatus(user.id);

    expect(status.enabled).toBe(true);
    expect(status.backupCodesRemaining).toBe(10);
    expect(status.isLockedOut).toBe(false);
  });

  // ── 7. getStatus (not set up) → returns enabled=false ───────────────────
  it('returns enabled=false when 2FA has not been set up', async () => {
    const user = await createTestUser('2fa-status-off@ujamaa.test');

    const status = await totp2FAService.getStatus(user.id);

    expect(status.enabled).toBe(false);
    expect(status.backupCodesRemaining).toBe(0);
  });

  // ── 8. regenerateBackupCodes (valid code) → replaces backup codes array ──
  it('replaces backup codes when called with a valid TOTP code', async () => {
    const user = await createTestUser('2fa-regen@ujamaa.test');
    const { secret } = await totp2FAService.enable(user.id, user.email!);

    const code1 = speakeasy.totp({ secret, encoding: 'base32' });
    await totp2FAService.verify(user.id, code1);

    const before = await prisma.twoFactorAuth.findUnique({
      where: { userId: user.id },
    });
    const oldCodes = [...before!.backupCodesEncrypted];

    const code2 = speakeasy.totp({ secret, encoding: 'base32' });
    const newCodes = await totp2FAService.regenerateBackupCodes(user.id, code2);

    expect(Array.isArray(newCodes)).toBe(true);
    expect(newCodes).toHaveLength(10);

    const after = await prisma.twoFactorAuth.findUnique({
      where: { userId: user.id },
    });
    // Encrypted backup codes array should be different from the original
    expect(after!.backupCodesEncrypted).not.toEqual(oldCodes);
  });

  // ── 9. lockout after 5 failed attempts ───────────────────────────────────
  it('throws 429 when failedAttempts >= 5 and lockout has not expired', async () => {
    const user = await createTestUser('2fa-lockout@ujamaa.test');
    await totp2FAService.enable(user.id, user.email!);

    // Directly set lockout state in DB
    await prisma.twoFactorAuth.update({
      where: { userId: user.id },
      data: { failedAttempts: 5, lastFailedAttempt: new Date() },
    });

    await expect(
      totp2FAService.verify(user.id, '000000')
    ).rejects.toMatchObject({ statusCode: 429 });
  });
});
