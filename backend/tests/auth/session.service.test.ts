// tests/auth/session.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sessionService } from '../../src/modules/auth/services/session.service.js';
import { prisma } from '../../src/core/database/client.js';
import { seedLocation, createTestUser } from './helpers.js';

// Prevent eventBus from triggering listeners that might require Redis
vi.mock('../../src/core/utils/eventBus.js', () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() },
}));
vi.mock('../../src/core/utils/email.service.js');

describe('SessionService', () => {
  beforeEach(seedLocation);

  // ── 1. createSession ──────────────────────────────────────────────────────
  it('creates a session in the DB and returns session + token with correct userId', async () => {
    const user = await createTestUser('session-create@ujamaa.test');

    const result = await sessionService.createSession(user.id, {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    });

    expect(result.session).toBeTruthy();
    expect(result.session.id).toBeTruthy();
    expect(result.token).toBeTruthy();
    expect(result.token.length).toBeGreaterThan(0);

    const dbSession = await prisma.session.findUnique({
      where: { id: result.session.id },
    });
    expect(dbSession).toBeTruthy();
    expect(dbSession!.userId).toBe(user.id);
    expect(dbSession!.revoked).toBe(false);
  });

  // ── 2. validateSession (active) ───────────────────────────────────────────
  it('returns true for an active, non-revoked session', async () => {
    const user = await createTestUser('session-validate@ujamaa.test');
    const { session } = await sessionService.createSession(user.id);

    const isValid = await sessionService.validateSession(session.id);
    expect(isValid).toBe(true);
  });

  // ── 3. validateSession (revoked) ──────────────────────────────────────────
  it('returns false for a revoked session', async () => {
    const user = await createTestUser('session-revoked@ujamaa.test');
    const { session } = await sessionService.createSession(user.id);

    // Directly mark as revoked in DB
    await prisma.session.update({
      where: { id: session.id },
      data: { revoked: true },
    });

    const isValid = await sessionService.validateSession(session.id);
    expect(isValid).toBe(false);
  });

  // ── 4. validateSession (non-existent) ────────────────────────────────────
  it('returns false for a non-existent sessionId', async () => {
    const isValid = await sessionService.validateSession(
      'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee'
    );
    expect(isValid).toBe(false);
  });

  // ── 5. revokeSession ──────────────────────────────────────────────────────
  it('marks session as revoked and throws 404 if userId does not match', async () => {
    const user1 = await createTestUser('session-revoke1@ujamaa.test');
    const user2 = await createTestUser('session-revoke2@ujamaa.test');

    const { session } = await sessionService.createSession(user1.id);

    // Revoke with correct owner → should succeed
    await sessionService.revokeSession(session.id, user1.id);

    const dbSession = await prisma.session.findUnique({
      where: { id: session.id },
    });
    expect(dbSession!.revoked).toBe(true);

    // Attempting to revoke with wrong userId → should throw 404
    const { session: session2 } = await sessionService.createSession(user1.id);
    await expect(
      sessionService.revokeSession(session2.id, user2.id)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // ── 6. revokeAllUserSessions ──────────────────────────────────────────────
  it('revokes all sessions except exceptSessionId and returns correct count', async () => {
    const user = await createTestUser('session-revoke-all@ujamaa.test');

    const { session: s1 } = await sessionService.createSession(user.id);
    const { session: s2 } = await sessionService.createSession(user.id);
    const { session: s3 } = await sessionService.createSession(user.id);

    // Revoke all except s2
    const count = await sessionService.revokeAllUserSessions(user.id, s2.id);

    // s1 and s3 revoked → count = 2
    expect(count).toBe(2);

    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    const revokedIds = sessions.filter((s) => s.revoked).map((s) => s.id);
    expect(revokedIds).toContain(s1.id);
    expect(revokedIds).toContain(s3.id);
    expect(revokedIds).not.toContain(s2.id);
  });

  // ── 7. getUserSessions ────────────────────────────────────────────────────
  it('returns all active sessions for a user', async () => {
    const user = await createTestUser('session-list@ujamaa.test');

    await sessionService.createSession(user.id);
    await sessionService.createSession(user.id);

    const sessions = await sessionService.getUserSessions(user.id);

    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.revoked === false)).toBe(true);
  });

  // ── 8. cleanupExpiredSessions ─────────────────────────────────────────────
  it('deletes sessions past expiresAt, leaves valid sessions intact', async () => {
    const user = await createTestUser('session-cleanup@ujamaa.test');

    // Create an already-expired session directly in DB
    await prisma.session.create({
      data: {
        userId: user.id,
        token: 'deadbeef1234567890abcdef' + '0'.repeat(72), // 96 chars
        expiresAt: new Date(Date.now() - 1000),
        lastActive: new Date(),
        revoked: false,
      },
    });

    // Create a valid future session
    const { session: valid } = await sessionService.createSession(user.id);

    const deleted = await sessionService.cleanupExpiredSessions();
    expect(deleted).toBeGreaterThanOrEqual(1);

    const remaining = await prisma.session.findUnique({
      where: { id: valid.id },
    });
    expect(remaining).toBeTruthy();
    expect(remaining!.revoked).toBe(false);
  });
});
