// tests/auth/refresh-token.service.test.ts

vi.mock('../../src/core/services/token-blacklist.service.js', () => ({
  tokenBlacklistService: {
    isRevoked: vi.fn().mockResolvedValue(false),
    revoke: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/core/utils/eventBus.js', () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn() },
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { refreshTokenService } from '../../src/modules/auth/services/refresh-token.service.js';
import { tokenBlacklistService } from '../../src/core/services/token-blacklist.service.js';
import { prisma } from '../../src/core/database/client.js';
import { signJwtToken } from '../../src/core/utils/jwt.service.js';
import { sessionService } from '../../src/modules/auth/services/session.service.js';
import { seedLocation, createTestUser, makeRefreshToken } from './helpers.js';

describe('RefreshTokenService', () => {
  beforeEach(async () => {
    await seedLocation();
    vi.mocked(tokenBlacklistService.isRevoked).mockResolvedValue(false);
    vi.mocked(tokenBlacklistService.revoke).mockResolvedValue(undefined);
  });

  // ── 1. refresh (valid token + active session) → returns new token pair ────
  it('returns new accessToken and refreshToken for a valid refresh token', async () => {
    const user = await createTestUser('refresh-valid@ujamaa.test');
    const { session } = await sessionService.createSession(user.id);
    const refreshToken = makeRefreshToken(user.id, session.id);

    const result = await refreshTokenService.refresh(refreshToken);

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  // ── 2. refresh (expired JWT) → throws ────────────────────────────────────
  it('throws for an expired refresh JWT', async () => {
    const user = await createTestUser('refresh-expired@ujamaa.test');
    const { session } = await sessionService.createSession(user.id);

    // signJwtToken with expiresIn=-1 produces an immediately-expired token
    const expiredToken = signJwtToken(
      {
        sub: user.id,
        sessionId: session.id,
        type: 'refresh',
        verificationLevel: 'EMAIL_VERIFIED',
        roles: [],
        globalImpactPoints: 0,
        utilityTokens: 0,
        participationRights: 0,
      },
      -1 // expires immediately
    );

    await expect(
      refreshTokenService.refresh(expiredToken)
    ).rejects.toBeDefined();
  });

  // ── 3. refresh (blacklisted token) → throws ───────────────────────────────
  it('throws when tokenBlacklistService reports the token as revoked', async () => {
    const user = await createTestUser('refresh-blacklisted@ujamaa.test');
    const { session } = await sessionService.createSession(user.id);
    const refreshToken = makeRefreshToken(user.id, session.id);

    vi.mocked(tokenBlacklistService.isRevoked).mockResolvedValue(true);

    await expect(
      refreshTokenService.refresh(refreshToken)
    ).rejects.toBeDefined();
  });

  // ── 4. refresh (session revoked in DB) → throws ───────────────────────────
  it('throws when the associated session has been revoked', async () => {
    const user = await createTestUser('refresh-revoked-session@ujamaa.test');
    const { session } = await sessionService.createSession(user.id);
    const refreshToken = makeRefreshToken(user.id, session.id);

    // Revoke the session in DB
    await prisma.session.update({
      where: { id: session.id },
      data: { revoked: true },
    });

    await expect(
      refreshTokenService.refresh(refreshToken)
    ).rejects.toBeDefined();
  });

  // ── 5. revokeAllForUser → sets all user sessions to revoked ───────────────
  it('revokes all sessions for a user', async () => {
    const user = await createTestUser('refresh-revoke-all@ujamaa.test');
    await sessionService.createSession(user.id);
    await sessionService.createSession(user.id);

    await refreshTokenService.revokeAllForUser(user.id);

    const sessions = await prisma.session.findMany({
      where: { userId: user.id },
    });
    expect(sessions.every((s) => s.revoked)).toBe(true);
  });

  // ── 6. refresh with different IP → succeeds but logs warning ─────────────
  it('succeeds even when IP differs from session origin (just logs warning)', async () => {
    const user = await createTestUser('refresh-ip-change@ujamaa.test');
    const { session } = await sessionService.createSession(user.id, {
      ipAddress: '10.0.0.1',
    });
    const refreshToken = makeRefreshToken(user.id, session.id);

    // Different IP in context — service warns but does not fail
    const result = await refreshTokenService.refresh(refreshToken, {
      ipAddress: '10.0.0.2',
    });

    expect(result.accessToken).toBeTruthy();
  });
});
