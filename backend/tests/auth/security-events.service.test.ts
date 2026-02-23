// tests/auth/security-events.service.test.ts

vi.mock('../../src/core/utils/eventBus.js', () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn() },
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventBus } from '../../src/core/utils/eventBus.js';
import { securityEventsService } from '../../src/modules/auth/services/security-events.service.js';
import { prisma } from '../../src/core/database/client.js';
import { seedLocation, createTestUser } from './helpers.js';

describe('SecurityEventsService', () => {
  beforeEach(async () => {
    await seedLocation();
    vi.clearAllMocks();
  });

  // ── 1. logEvent (LOW severity) → DB row, does NOT publish ─────────────────
  it('creates a SecurityEvent row for low severity without publishing to eventBus', async () => {
    const user = await createTestUser('sec-low@ujamaa.test');

    await securityEventsService.logEvent({
      userId: user.id,
      eventType: 'login_success',
      severity: 'low',
      ipAddress: '127.0.0.1',
    });

    const events = await prisma.securityEvent.findMany({
      where: { userId: user.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0].severity).toBe('low');

    expect(vi.mocked(eventBus.publish)).not.toHaveBeenCalled();
  });

  // ── 2. logEvent (HIGH severity) → DB row + publishes security.event ───────
  it('publishes security.event for high severity events', async () => {
    const user = await createTestUser('sec-high@ujamaa.test');

    await securityEventsService.logEvent({
      userId: user.id,
      eventType: 'login_failed',
      severity: 'high',
      ipAddress: '192.168.1.1',
    });

    const events = await prisma.securityEvent.findMany({
      where: { userId: user.id },
    });
    expect(events).toHaveLength(1);

    expect(vi.mocked(eventBus.publish)).toHaveBeenCalledWith(
      'security.event',
      expect.objectContaining({ eventType: 'login_failed' })
    );
  });

  // ── 3. logEvent (CRITICAL severity) → publishes security.event + security.alert
  it('publishes both security.event and security.alert for critical events', async () => {
    const user = await createTestUser('sec-critical@ujamaa.test');

    await securityEventsService.logEvent({
      userId: user.id,
      eventType: 'brute_force_detected',
      severity: 'critical',
      ipAddress: '10.0.0.1',
    });

    const publishCalls = vi.mocked(eventBus.publish).mock.calls.map(
      (c) => c[0]
    );
    expect(publishCalls).toContain('security.event');
    expect(publishCalls).toContain('security.alert');
  });

  // ── 4. detectBruteForce (< 5 failed attempts) → returns false ─────────────
  it('returns false when fewer than 5 failed login attempts in the window', async () => {
    const user = await createTestUser('bf-low@ujamaa.test');

    // Log 3 failed events
    for (let i = 0; i < 3; i++) {
      await securityEventsService.logEvent({
        userId: user.id,
        eventType: 'login_failed',
        severity: 'medium',
        ipAddress: '1.2.3.4',
      });
    }

    const result = await securityEventsService.detectBruteForce(
      user.email!,
      '1.2.3.4'
    );
    expect(result).toBe(false);
  });

  // ── 5. detectBruteForce (≥ 5 failed attempts) → returns true ──────────────
  it('returns true when 5+ failed login_failed events from the same IP in the window', async () => {
    const user = await createTestUser('bf-high@ujamaa.test');

    // Log 5 failed events from the same IP
    for (let i = 0; i < 5; i++) {
      await securityEventsService.logEvent({
        userId: user.id,
        eventType: 'login_failed',
        severity: 'medium',
        ipAddress: '5.6.7.8',
      });
    }
    vi.clearAllMocks(); // reset publish spy before the detectBruteForce call

    const result = await securityEventsService.detectBruteForce(
      user.email!,
      '5.6.7.8'
    );
    expect(result).toBe(true);
  });

  // ── 6. cleanupOldEvents → deletes old resolved events, leaves recent ───────
  it('deletes resolved events older than 90 days, leaves recent ones intact', async () => {
    const user = await createTestUser('sec-cleanup@ujamaa.test');

    // Create an old resolved event (> 90 days ago)
    await prisma.securityEvent.create({
      data: {
        userId: user.id,
        eventType: 'login_failed',
        severity: 'low',
        resolved: true,
        resolvedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
        metadata: {},
      },
    });

    // Create a recent resolved event (just now)
    await prisma.securityEvent.create({
      data: {
        userId: user.id,
        eventType: 'login_success',
        severity: 'low',
        resolved: true,
        resolvedAt: new Date(),
        metadata: {},
      },
    });

    // Create an unresolved event (should not be deleted)
    await prisma.securityEvent.create({
      data: {
        userId: user.id,
        eventType: 'suspicious_login',
        severity: 'high',
        resolved: false,
        metadata: {},
      },
    });

    const deleted = await securityEventsService.cleanupOldEvents();
    expect(deleted).toBe(1); // only the old resolved one

    const remaining = await prisma.securityEvent.findMany({
      where: { userId: user.id },
    });
    expect(remaining).toHaveLength(2); // recent resolved + unresolved
  });
});
