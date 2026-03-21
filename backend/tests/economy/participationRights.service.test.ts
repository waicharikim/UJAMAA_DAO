/**
 * @file tests/economy/participationRights.service.test.ts
 * @description Unit tests for ParticipationRightsService.
 *
 * Uses the singleton service instance against the postgres_test DB.
 * DATABASE_URL is set to postgres_test by vitest.config.ts env block.
 * Global TRUNCATE fires before each test (testSetup.ts), seed in beforeEach.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import {
  ParticipationRightsReason,
  PR_CONFIG,
} from '../../src/modules/economy/types.js';
import {
  participationRightsService,
} from '../../src/modules/economy/services/participationRights.service.js';
import { seedLocation, createEconomyTestUser } from './helpers.js';

beforeEach(async () => {
  await seedLocation();
});

// ─────────────────────────────────────────────────────────────────────────────
// getBalance
// ─────────────────────────────────────────────────────────────────────────────

describe('getBalance()', () => {
  it('returns 0 for a user with no logs', async () => {
    const user = await createEconomyTestUser('zero@example.com');
    const balance = await participationRightsService.getBalance(user.id);
    expect(balance).toBe(0);
  });

  it('sums all positive log entries', async () => {
    const user = await createEconomyTestUser('sum@example.com');

    // Seed logs directly to isolate getBalance from award() side effects
    await prisma.participationRightsLog.createMany({
      data: [
        { userId: user.id, amount: 50, balance: 50, reason: 'EMAIL_VERIFIED' },
        { userId: user.id, amount: 25, balance: 75, reason: 'WALLET_CONNECTED' },
      ],
    });

    const balance = await participationRightsService.getBalance(user.id);
    expect(balance).toBe(75);
  });

  it('handles negative amounts (spends) in the sum', async () => {
    const user = await createEconomyTestUser('netspend@example.com');

    await prisma.participationRightsLog.createMany({
      data: [
        { userId: user.id, amount: 100, balance: 100, reason: 'EMAIL_VERIFIED' },
        { userId: user.id, amount: -30, balance: 70, reason: 'VOTED' },
      ],
    });

    const balance = await participationRightsService.getBalance(user.id);
    expect(balance).toBe(70);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// award()
// ─────────────────────────────────────────────────────────────────────────────

describe('award()', () => {
  it('creates a log entry and updates user.participationRights', async () => {
    const user = await createEconomyTestUser('award@example.com');

    const log = await participationRightsService.award(
      user.id,
      PR_CONFIG.EMAIL_VERIFIED,
      ParticipationRightsReason.EMAIL_VERIFIED
    );

    expect(log.amount).toBe(PR_CONFIG.EMAIL_VERIFIED);
    expect(log.balance).toBe(PR_CONFIG.EMAIL_VERIFIED);
    expect(log.reason).toBe(ParticipationRightsReason.EMAIL_VERIFIED);

    // Confirm user denormalized field updated
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.participationRights).toBe(PR_CONFIG.EMAIL_VERIFIED);
  });

  it('caps balance at MAX_BALANCE', async () => {
    const user = await createEconomyTestUser('cap@example.com');

    // Pre-load user close to max
    await prisma.participationRightsLog.create({
      data: {
        userId: user.id,
        amount: PR_CONFIG.MAX_BALANCE - 10,
        balance: PR_CONFIG.MAX_BALANCE - 10,
        reason: 'EMAIL_VERIFIED',
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { participationRights: PR_CONFIG.MAX_BALANCE - 10 },
    });

    // Award 100 more — balance should stop at MAX_BALANCE (500), not 590
    const log = await participationRightsService.award(
      user.id,
      100,
      ParticipationRightsReason.MONTHLY_REGENERATION
    );

    expect(log.balance).toBe(PR_CONFIG.MAX_BALANCE);
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.participationRights).toBe(PR_CONFIG.MAX_BALANCE);
  });

  it('throws when amount is zero', async () => {
    const user = await createEconomyTestUser('zeroaward@example.com');

    await expect(
      participationRightsService.award(user.id, 0, ParticipationRightsReason.EMAIL_VERIFIED)
    ).rejects.toThrow('Award amount must be positive');
  });

  it('throws when amount is negative', async () => {
    const user = await createEconomyTestUser('negaward@example.com');

    await expect(
      participationRightsService.award(user.id, -10, ParticipationRightsReason.EMAIL_VERIFIED)
    ).rejects.toThrow('Award amount must be positive');
  });

  it('accumulates across multiple awards', async () => {
    const user = await createEconomyTestUser('multi@example.com');

    await participationRightsService.award(user.id, 50, ParticipationRightsReason.EMAIL_VERIFIED);
    await participationRightsService.award(user.id, 25, ParticipationRightsReason.WALLET_CONNECTED);
    await participationRightsService.award(user.id, 50, ParticipationRightsReason.PHONE_VERIFIED);

    const balance = await participationRightsService.getBalance(user.id);
    expect(balance).toBe(125);
  });

  it('stores optional metadata on the log', async () => {
    const user = await createEconomyTestUser('meta@example.com');
    const meta = { source: 'test', period: '2026-02' };

    const log = await participationRightsService.award(
      user.id,
      50,
      ParticipationRightsReason.DUES_ORDINARY,
      meta
    );

    expect(log.metadata).toMatchObject(meta);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// spend()
// ─────────────────────────────────────────────────────────────────────────────

describe('spend()', () => {
  it('creates a negative log entry and updates user.participationRights', async () => {
    const user = await createEconomyTestUser('spend@example.com');

    await participationRightsService.award(user.id, 100, ParticipationRightsReason.EMAIL_VERIFIED);

    const log = await participationRightsService.spend(
      user.id, 30, ParticipationRightsReason.VOTED
    );

    expect(log.amount).toBe(-30);
    expect(log.balance).toBe(70);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.participationRights).toBe(70);
  });

  it('throws ApiError (402) when balance is insufficient', async () => {
    const user = await createEconomyTestUser('broke@example.com');
    // Balance is 0
    await expect(
      participationRightsService.spend(user.id, 50, ParticipationRightsReason.VOTED)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws when amount is zero', async () => {
    const user = await createEconomyTestUser('zspend@example.com');

    await expect(
      participationRightsService.spend(user.id, 0, ParticipationRightsReason.VOTED)
    ).rejects.toThrow('Spend amount must be positive');
  });

  it('rejects spend that would exceed balance by 1', async () => {
    const user = await createEconomyTestUser('exceed@example.com');
    await participationRightsService.award(user.id, 50, ParticipationRightsReason.EMAIL_VERIFIED);

    await expect(
      participationRightsService.spend(user.id, 51, ParticipationRightsReason.VOTED)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows spending exactly the full balance', async () => {
    const user = await createEconomyTestUser('exact@example.com');
    await participationRightsService.award(user.id, 50, ParticipationRightsReason.EMAIL_VERIFIED);

    const log = await participationRightsService.spend(
      user.id, 50, ParticipationRightsReason.VOTED
    );
    expect(log.balance).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hasSufficient()
// ─────────────────────────────────────────────────────────────────────────────

describe('hasSufficient()', () => {
  it('returns false when user has no balance', async () => {
    const user = await createEconomyTestUser('hs-empty@example.com');
    expect(await participationRightsService.hasSufficient(user.id, 1)).toBe(false);
  });

  it('returns true when balance equals required', async () => {
    const user = await createEconomyTestUser('hs-exact@example.com');
    await participationRightsService.award(user.id, 50, ParticipationRightsReason.EMAIL_VERIFIED);
    expect(await participationRightsService.hasSufficient(user.id, 50)).toBe(true);
  });

  it('returns true when balance exceeds required', async () => {
    const user = await createEconomyTestUser('hs-over@example.com');
    await participationRightsService.award(user.id, 100, ParticipationRightsReason.EMAIL_VERIFIED);
    expect(await participationRightsService.hasSufficient(user.id, 50)).toBe(true);
  });

  it('returns false when balance is below required', async () => {
    const user = await createEconomyTestUser('hs-low@example.com');
    await participationRightsService.award(user.id, 30, ParticipationRightsReason.EMAIL_VERIFIED);
    expect(await participationRightsService.hasSufficient(user.id, 50)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyInactivityDecay()
// ─────────────────────────────────────────────────────────────────────────────

describe('applyInactivityDecay()', () => {
  const FLOOR = PR_CONFIG.INACTIVITY_DECAY_FLOOR;       // 100
  const THRESHOLD = PR_CONFIG.INACTIVITY_DECAY_THRESHOLD_DAYS; // 60
  const RATE = PR_CONFIG.INACTIVITY_DECAY_RATE;          // 0.05

  /** Create a user who last logged in `daysAgo` days ago */
  async function createInactiveUser(email: string, balance: number, daysAgo: number) {
    const user = await createEconomyTestUser(email);
    const lastLogin = new Date();
    lastLogin.setDate(lastLogin.getDate() - daysAgo);
    await prisma.user.update({
      where: { id: user.id },
      data: { participationRights: balance, lastLoginAt: lastLogin },
    });
    return user;
  }

  /** Create a user who last logged in today (active) */
  async function createActiveUser(email: string, balance: number) {
    const user = await createEconomyTestUser(email);
    await prisma.user.update({
      where: { id: user.id },
      data: { participationRights: balance, lastLoginAt: new Date() },
    });
    return user;
  }

  it('deducts 5% from an inactive user above the floor', async () => {
    const user = await createInactiveUser('decay-basic@example.com', 200, THRESHOLD + 1);

    await participationRightsService.applyInactivityDecay();

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const expected = Math.max(FLOOR, 200 - Math.floor(200 * RATE)); // 200 - 10 = 190
    expect(updated.participationRights).toBe(expected);
  });

  it('does not decay an active user (logged in recently)', async () => {
    const user = await createActiveUser('decay-active@example.com', 300);

    await participationRightsService.applyInactivityDecay();

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.participationRights).toBe(300);
  });

  it('does not decay a user at exactly the floor balance', async () => {
    const user = await createInactiveUser('decay-floor-exact@example.com', FLOOR, THRESHOLD + 1);

    await participationRightsService.applyInactivityDecay();

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.participationRights).toBe(FLOOR);
  });

  it('never drops a user below the floor', async () => {
    // Balance just above floor — 5% would take them below 100
    const balance = FLOOR + 1; // 101
    const user = await createInactiveUser('decay-near-floor@example.com', balance, THRESHOLD + 5);

    await participationRightsService.applyInactivityDecay();

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.participationRights).toBeGreaterThanOrEqual(FLOOR);
  });

  it('creates a ParticipationRightsLog entry with a negative amount', async () => {
    const user = await createInactiveUser('decay-log@example.com', 200, THRESHOLD + 1);

    await participationRightsService.applyInactivityDecay();

    const log = await prisma.participationRightsLog.findFirst({
      where: { userId: user.id, amount: { lt: 0 } },
    });
    expect(log).not.toBeNull();
    expect(log!.amount).toBe(-Math.floor(200 * RATE)); // -10
    expect(log!.balance).toBe(190);
  });

  it('skips users with no lastLoginAt if balance is at the floor', async () => {
    const user = await createEconomyTestUser('decay-null-login@example.com');
    await prisma.user.update({
      where: { id: user.id },
      data: { participationRights: FLOOR, lastLoginAt: null },
    });

    await participationRightsService.applyInactivityDecay();

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.participationRights).toBe(FLOOR);
  });

  it('decays a user with null lastLoginAt who is above the floor', async () => {
    const user = await createEconomyTestUser('decay-null-above@example.com');
    await prisma.user.update({
      where: { id: user.id },
      data: { participationRights: 400, lastLoginAt: null },
    });

    await participationRightsService.applyInactivityDecay();

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.participationRights).toBe(400 - Math.floor(400 * RATE)); // 380
  });

  it('does not decay a user who last logged in 59 days ago (just under threshold)', async () => {
    // 59 days ago is strictly before the 60-day cutoff — should not be decayed
    const user = await createInactiveUser('decay-boundary@example.com', 200, THRESHOLD - 1);

    await participationRightsService.applyInactivityDecay();

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.participationRights).toBe(200);
  });
});
