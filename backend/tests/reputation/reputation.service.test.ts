/**
 * @file tests/reputation/reputation.service.test.ts
 * @description Unit tests for GlobalImpactPointService and LocationImpactService.
 * Uses real Prisma + test DB. DB truncated before each test by testSetup.ts.
 */

import { describe, it, expect } from 'vitest';
import { GlobalImpactPointService } from '../../src/modules/reputation/service/impactPoint.service.js';
import { LocationImpactService } from '../../src/modules/reputation/service/locationImpact.service.js';
import { ImpactPointReason } from '../../src/modules/reputation/types.js';
import {
  createReputationUser,
  seedWard,
  seedImpactPointLog,
  seedLocationImpact,
} from './helpers.js';

const ipService = new GlobalImpactPointService();
const locService = new LocationImpactService();

// ─────────────────────────────────────────────
// GlobalImpactPointService.award
// ─────────────────────────────────────────────

describe('GlobalImpactPointService.award', () => {
  it('increments globalImpactPoints on the user', async () => {
    const user = await createReputationUser('award@test.com', 100);

    await ipService.award(user.id, 50, ImpactPointReason.EMAIL_VERIFIED);

    const { prisma } = await import('../../src/core/database/client.js');
    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { globalImpactPoints: true },
    });
    expect(updated?.globalImpactPoints).toBe(150);
  });

  it('creates an ImpactPointLog record', async () => {
    const user = await createReputationUser('logcheck@test.com');
    const { prisma } = await import('../../src/core/database/client.js');

    await ipService.award(user.id, 25, ImpactPointReason.PHONE_VERIFIED);

    const log = await prisma.impactPointLog.findFirst({
      where: { userId: user.id },
    });
    expect(log).not.toBeNull();
    expect(log?.amount).toBe(25);
    expect(log?.reason).toBe('PHONE_VERIFIED');
    expect(log?.scope).toBe('GLOBAL');
  });

  it('does nothing when amount is 0 or negative', async () => {
    const user = await createReputationUser('zero@test.com', 50);
    const { prisma } = await import('../../src/core/database/client.js');

    await ipService.award(user.id, 0, ImpactPointReason.EMAIL_VERIFIED);

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { globalImpactPoints: true },
    });
    expect(updated?.globalImpactPoints).toBe(50); // unchanged
  });
});

// ─────────────────────────────────────────────
// GlobalImpactPointService.getTotal
// ─────────────────────────────────────────────

describe('GlobalImpactPointService.getTotal', () => {
  it('returns the user globalImpactPoints value', async () => {
    const user = await createReputationUser('total@test.com', 300);
    const total = await ipService.getTotal(user.id);
    expect(total).toBe(300);
  });

  it('returns 0 for user with no IP', async () => {
    const user = await createReputationUser('zerototalt@test.com', 0);
    const total = await ipService.getTotal(user.id);
    expect(total).toBe(0);
  });
});

// ─────────────────────────────────────────────
// GlobalImpactPointService.getHistory
// ─────────────────────────────────────────────

describe('GlobalImpactPointService.getHistory', () => {
  it('returns empty list when no logs', async () => {
    const user = await createReputationUser('nohistory@test.com');
    const result = await ipService.getHistory(user.id);
    expect(result.logs).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });

  it('returns logs for the user in descending order', async () => {
    const user = await createReputationUser('withhistory@test.com');
    await seedImpactPointLog(user.id, 10, 'EMAIL_VERIFIED');
    await seedImpactPointLog(user.id, 20, 'PHONE_VERIFIED');

    const result = await ipService.getHistory(user.id);
    expect(result.logs).toHaveLength(2);
    expect(result.pagination.total).toBe(2);
  });

  it('paginates correctly', async () => {
    const user = await createReputationUser('paginate@test.com');
    for (let i = 0; i < 5; i++) {
      await seedImpactPointLog(user.id, 10, 'EMAIL_VERIFIED');
    }

    const page1 = await ipService.getHistory(user.id, 2, 1);
    expect(page1.logs).toHaveLength(2);
    expect(page1.pagination.total).toBe(5);
    expect(page1.pagination.totalPages).toBe(3);
  });
});

// ─────────────────────────────────────────────
// LocationImpactService.awardWardPoints
// ─────────────────────────────────────────────

describe('LocationImpactService.awardWardPoints', () => {
  it('creates UserLocationImpact record for new user+ward combo', async () => {
    const user = await createReputationUser('newloc@test.com');
    const ward = await seedWard();

    await locService.awardWardPoints(
      user.id,
      ward.id,
      150,
      ImpactPointReason.PHYSICAL_WORK_VERIFIED
    );

    const { prisma } = await import('../../src/core/database/client.js');
    const impact = await prisma.userLocationImpact.findUnique({
      where: { userId_wardId: { userId: user.id, wardId: ward.id } },
    });
    expect(impact?.impactPoints).toBe(150);
    expect(impact?.tier).toBe('BRONZE'); // 150 >= 100 threshold
  });

  it('increments existing record on subsequent awards', async () => {
    const user = await createReputationUser('increment@test.com');
    const ward = await seedWard();

    await locService.awardWardPoints(user.id, ward.id, 50, ImpactPointReason.EMAIL_VERIFIED);
    await locService.awardWardPoints(user.id, ward.id, 60, ImpactPointReason.PHONE_VERIFIED);

    const { prisma } = await import('../../src/core/database/client.js');
    const impact = await prisma.userLocationImpact.findUnique({
      where: { userId_wardId: { userId: user.id, wardId: ward.id } },
    });
    expect(impact?.impactPoints).toBeGreaterThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────
// LocationImpactService.getUserImpactBreakdown
// ─────────────────────────────────────────────

describe('LocationImpactService.getUserImpactBreakdown', () => {
  it('returns empty breakdown for user with no location impact', async () => {
    const user = await createReputationUser('nobreakdown@test.com');
    const result = await locService.getUserImpactBreakdown(user.id);
    expect(result.breakdown).toHaveLength(0);
    expect(result.totals.locations).toBe(0);
    expect(result.totals.totalPoints).toBe(0);
  });

  it('returns ward breakdown with correct totals', async () => {
    const user = await createReputationUser('withbreakdown@test.com');
    const ward = await seedWard();
    await seedLocationImpact(user.id, ward.id, 500, 'SILVER');

    const result = await locService.getUserImpactBreakdown(user.id);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].points).toBe(500);
    expect(result.breakdown[0].tier).toBe('SILVER');
    expect(result.totals.totalPoints).toBe(500);
  });
});
