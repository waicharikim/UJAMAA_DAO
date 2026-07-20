/**
 * @file tests/integration/baraza-reward.jobs.test.ts
 * @description Unit tests for Baraza BullMQ job processors.
 * Tests processBarazaAttendanceReward and processBarazaSendInvite directly.
 */

// ─────────────────────────────────────────────
// Mocks — must be before all imports
// ─────────────────────────────────────────────

vi.mock('../../src/modules/economy/services/participationRights.service.js', () => ({
  participationRightsService: {
    award: vi.fn().mockResolvedValue(undefined),
    spend: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/modules/integration/services/telegram.service.js', () => ({
  telegramSendInviteLink: vi.fn().mockResolvedValue(undefined),
  isTelegramConfigured: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/modules/integration/services/discord.service.js', () => ({
  discordSendInviteLink: vi.fn().mockResolvedValue(undefined),
  isDiscordConfigured: vi.fn().mockReturnValue(false),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Job } from 'bullmq';
import { prisma } from '../../src/core/database/client.js';
import { participationRightsService } from '../../src/modules/economy/services/participationRights.service.js';
import {
  processBarazaAttendanceReward,
  processBarazaSendInvite,
} from '../../src/modules/integration/jobs/baraza-reward.jobs.js';
import {
  seedLocation,
  seedGroup,
  seedUser,
  seedBarazaGroup,
  seedMessagingProfile,
  INT_WARD_ID,
} from './helpers.js';

function makeJob<T>(data: T): Job<T> {
  return { data } as unknown as Job<T>;
}

// ─────────────────────────────────────────────
// processBarazaAttendanceReward
// ─────────────────────────────────────────────

describe('processBarazaAttendanceReward', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('awards PR and marks prAwarded=true', async () => {
    const admin = await seedUser(`jpr-admin-${Date.now()}@test.com`);
    const member = await seedUser(`jpr-member-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const baraza = await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);

    const attendance = await prisma.barazaAttendance.create({
      data: {
        barazaGroupId: baraza.id,
        userId: member.id,
        sessionDate: '2026-03-17',
        prAwarded: false,
        prAmount: 0,
      },
    });

    const awardSpy = vi.mocked(participationRightsService.award);
    awardSpy.mockClear();

    await processBarazaAttendanceReward(
      makeJob({
        attendanceId: attendance.id,
        userId: member.id,
        prAmount: 15,
        reason: 'BARAZA_ATTENDED',
        barazaGroupId: baraza.id,
        sessionDate: '2026-03-17',
      })
    );

    expect(awardSpy).toHaveBeenCalledWith(
      member.id,
      15,
      'BARAZA_ATTENDED',
      expect.any(Object)
    );

    const updated = await prisma.barazaAttendance.findUnique({
      where: { id: attendance.id },
    });
    expect(updated!.prAwarded).toBe(true);
    expect(updated!.prAmount).toBe(15);
  });

  it('is idempotent — skips if prAwarded already true', async () => {
    const admin = await seedUser(`jpr-idem-admin-${Date.now()}@test.com`);
    const member = await seedUser(`jpr-idem-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const baraza = await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);

    const attendance = await prisma.barazaAttendance.create({
      data: {
        barazaGroupId: baraza.id,
        userId: member.id,
        sessionDate: '2026-03-18',
        prAwarded: true,
        prAmount: 15,
      },
    });

    const awardSpy = vi.mocked(participationRightsService.award);
    awardSpy.mockClear();

    await processBarazaAttendanceReward(
      makeJob({
        attendanceId: attendance.id,
        userId: member.id,
        prAmount: 15,
        reason: 'BARAZA_ATTENDED',
        barazaGroupId: baraza.id,
        sessionDate: '2026-03-18',
      })
    );

    expect(awardSpy).not.toHaveBeenCalled();
  });

  it('skips gracefully if attendance record not found', async () => {
    const awardSpy = vi.mocked(participationRightsService.award);
    awardSpy.mockClear();

    await expect(
      processBarazaAttendanceReward(
        makeJob({
          attendanceId: '00000000-0000-4000-b000-000000000000',
          userId: '00000000-0000-4000-b000-000000000001',
          prAmount: 15,
          reason: 'BARAZA_ATTENDED',
          barazaGroupId: '00000000-0000-4000-b000-000000000002',
          sessionDate: '2026-03-17',
        })
      )
    ).resolves.not.toThrow();

    expect(awardSpy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// processBarazaSendInvite
// ─────────────────────────────────────────────

describe('processBarazaSendInvite', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('skips if BarazaGroup has no inviteLink', async () => {
    const admin = await seedUser(`jinv-noinvite-admin-${Date.now()}@test.com`);
    const user = await seedUser(`jinv-noinvite-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);

    const baraza = await prisma.barazaGroup.create({
      data: {
        groupId: group.id,
        platform: 'TELEGRAM',
        externalId: `no-invite-${Date.now()}`,
        name: 'No Invite Baraza',
        inviteLink: null,
        isActive: true,
        registeredBy: admin.id,
      },
    });

    await expect(
      processBarazaSendInvite(
        makeJob({ userId: user.id, barazaGroupId: baraza.id, platform: 'TELEGRAM' })
      )
    ).resolves.not.toThrow();
  });

  it('skips if user has no messaging profile for that platform', async () => {
    const admin = await seedUser(`jinv-noprofile-admin-${Date.now()}@test.com`);
    const user = await seedUser(`jinv-noprofile-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const baraza = await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);

    // No messaging profile seeded for user

    await expect(
      processBarazaSendInvite(
        makeJob({ userId: user.id, barazaGroupId: baraza.id, platform: 'TELEGRAM' })
      )
    ).resolves.not.toThrow();
  });

  it('skips if externalUserId not yet known', async () => {
    const admin = await seedUser(`jinv-noext-admin-${Date.now()}@test.com`);
    const user = await seedUser(`jinv-noext-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const baraza = await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);

    // Profile with null externalUserId
    await prisma.userMessagingProfile.create({
      data: {
        userId: user.id,
        platform: 'TELEGRAM',
        externalUserId: null,
        handle: '@testhandle',
      },
    });

    await expect(
      processBarazaSendInvite(
        makeJob({ userId: user.id, barazaGroupId: baraza.id, platform: 'TELEGRAM' })
      )
    ).resolves.not.toThrow();
  });
});
