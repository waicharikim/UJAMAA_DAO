/**
 * @file tests/integration/baraza-bot.service.test.ts
 * @description Unit tests for BarazaBotService.
 * Uses real Prisma + test DB. integrationQueue is mocked.
 */

// ─────────────────────────────────────────────
// Mocks — must be before all imports
// ─────────────────────────────────────────────

vi.mock('../../src/core/queue/index.js', () => ({
  integrationQueue: {
    add: vi.fn().mockResolvedValue(undefined),
  },
  economyQueue: {
    add: vi.fn().mockResolvedValue(undefined),
  },
  deadLetterQueue: {
    add: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/modules/economy/services/participationRights.service.js', () => ({
  participationRightsService: {
    award: vi.fn().mockResolvedValue(undefined),
    spend: vi.fn().mockResolvedValue(undefined),
  },
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { integrationQueue } from '../../src/core/queue/index.js';
import { barazaBotService } from '../../src/modules/integration/services/baraza-bot.service.js';
import {
  seedLocation,
  seedGroup,
  seedUser,
  seedBarazaGroup,
  seedMessagingProfile,
  INT_WARD_ID,
} from './helpers.js';

// ─────────────────────────────────────────────
// registerBarazaGroup
// ─────────────────────────────────────────────

describe('BarazaBotService.registerBarazaGroup', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('creates BarazaGroup record in DB', async () => {
    const admin = await seedUser(`bgcreate-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);

    const baraza = await barazaBotService.registerBarazaGroup(admin.id, {
      groupId: group.id,
      platform: 'TELEGRAM',
      externalId: `chat-${Date.now()}`,
      name: 'Test Baraza Group',
      inviteLink: 'https://t.me/joinchat/testlink',
    });

    expect(baraza.id).toBeDefined();
    expect(baraza.groupId).toBe(group.id);
    expect(baraza.platform).toBe('TELEGRAM');
    expect(baraza.isActive).toBe(true);
    expect(baraza.registeredBy).toBe(admin.id);
  });

  it('fans out invite jobs to group members with matching platform profiles', async () => {
    const admin = await seedUser(`bgfanout-${Date.now()}@test.com`);
    const member = await seedUser(`bgmember-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);

    // Add member to group
    await prisma.groupMember.create({
      data: { groupId: group.id, userId: member.id, role: 'MEMBER', active: true },
    });

    // Give member a TELEGRAM profile
    await seedMessagingProfile(member.id, 'TELEGRAM', `tg-${Date.now()}`);

    const queueAddSpy = vi.mocked(integrationQueue.add);
    queueAddSpy.mockClear();

    await barazaBotService.registerBarazaGroup(admin.id, {
      groupId: group.id,
      platform: 'TELEGRAM',
      externalId: `fanout-chat-${Date.now()}`,
      name: 'Fan Out Baraza',
    });

    expect(queueAddSpy).toHaveBeenCalledWith(
      'BARAZA_SEND_INVITE',
      expect.objectContaining({ userId: member.id })
    );
  });

  it('throws on duplicate (unique: groupId+platform+externalId)', async () => {
    const admin = await seedUser(`bgdup-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const externalId = `dup-ext-${Date.now()}`;

    await barazaBotService.registerBarazaGroup(admin.id, {
      groupId: group.id,
      platform: 'TELEGRAM',
      externalId,
      name: 'Original Baraza',
    });

    await expect(
      barazaBotService.registerBarazaGroup(admin.id, {
        groupId: group.id,
        platform: 'TELEGRAM',
        externalId,
        name: 'Duplicate Baraza',
      })
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────
// getBarazaGroupsForUser
// ─────────────────────────────────────────────

describe('BarazaBotService.getBarazaGroupsForUser', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('returns active baraza groups for user with group membership + platform profile', async () => {
    const admin = await seedUser(`bgget-admin-${Date.now()}@test.com`);
    const user = await seedUser(`bgget-user-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);

    await prisma.groupMember.create({
      data: { groupId: group.id, userId: user.id, role: 'MEMBER', active: true },
    });

    const baraza = await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);
    await seedMessagingProfile(user.id, 'TELEGRAM', `tg-user-${Date.now()}`);

    const results = await barazaBotService.getBarazaGroupsForUser(user.id);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(baraza.id);
  });

  it('returns empty when user has no messaging profiles', async () => {
    const admin = await seedUser(`bgget-noprofile-admin-${Date.now()}@test.com`);
    const user = await seedUser(`bgget-noprofile-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);

    await prisma.groupMember.create({
      data: { groupId: group.id, userId: user.id, role: 'MEMBER', active: true },
    });

    await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);
    // No messaging profile seeded

    const results = await barazaBotService.getBarazaGroupsForUser(user.id);
    expect(results).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// recordAttendance
// ─────────────────────────────────────────────

describe('BarazaBotService.recordAttendance', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('creates attendance records for known users (by externalUserId)', async () => {
    const admin = await seedUser(`bgrec-admin-${Date.now()}@test.com`);
    const member = await seedUser(`bgrec-member-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const baraza = await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);
    const externalUserId = `tg-attend-${Date.now()}`;
    await seedMessagingProfile(member.id, 'TELEGRAM', externalUserId);

    const results = await barazaBotService.recordAttendance({
      platform: 'TELEGRAM',
      externalGroupId: baraza.externalId,
      sessionDate: '2026-03-17',
      attendeeExternalIds: [externalUserId],
    });

    expect(results).toHaveLength(1);
    expect(results[0].userId).toBe(member.id);
  });

  it('skips attendees with no matching UserMessagingProfile', async () => {
    const admin = await seedUser(`bgrec-skip-admin-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const baraza = await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);

    const results = await barazaBotService.recordAttendance({
      platform: 'TELEGRAM',
      externalGroupId: baraza.externalId,
      sessionDate: '2026-03-17',
      attendeeExternalIds: ['unknown-external-999'],
    });

    expect(results).toHaveLength(0);
  });

  it('is idempotent — upsert does not queue duplicate reward jobs', async () => {
    const admin = await seedUser(`bgrec-idem-admin-${Date.now()}@test.com`);
    const member = await seedUser(`bgrec-idem-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const baraza = await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);
    const externalUserId = `tg-idem-${Date.now()}`;
    await seedMessagingProfile(member.id, 'TELEGRAM', externalUserId);

    const queueAddSpy = vi.mocked(integrationQueue.add);

    // Mark attendance as already rewarded
    await prisma.barazaAttendance.create({
      data: {
        barazaGroupId: baraza.id,
        userId: member.id,
        sessionDate: '2026-03-17',
        prAwarded: true,
        prAmount: 15,
      },
    });

    queueAddSpy.mockClear();

    await barazaBotService.recordAttendance({
      platform: 'TELEGRAM',
      externalGroupId: baraza.externalId,
      sessionDate: '2026-03-17',
      attendeeExternalIds: [externalUserId],
    });

    // No new reward job should be queued since prAwarded=true
    const rewardCalls = queueAddSpy.mock.calls.filter(
      ([name]) => name === 'BARAZA_ATTENDANCE_REWARD'
    );
    expect(rewardCalls).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// sendInvitesToUser
// ─────────────────────────────────────────────

describe('BarazaBotService.sendInvitesToUser', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('queues BARAZA_SEND_INVITE jobs for matched groups', async () => {
    const admin = await seedUser(`bginv-admin-${Date.now()}@test.com`);
    const user = await seedUser(`bginv-user-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);

    await prisma.groupMember.create({
      data: { groupId: group.id, userId: user.id, role: 'MEMBER', active: true },
    });

    await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);
    await seedMessagingProfile(user.id, 'TELEGRAM', `tg-inv-${Date.now()}`);

    const queueAddSpy = vi.mocked(integrationQueue.add);
    queueAddSpy.mockClear();

    await barazaBotService.sendInvitesToUser(user.id);

    const inviteCalls = queueAddSpy.mock.calls.filter(
      ([name]) => name === 'BARAZA_SEND_INVITE'
    );
    expect(inviteCalls.length).toBeGreaterThan(0);
  });

  it('does nothing when user has no messaging profiles', async () => {
    const user = await seedUser(`bginv-noprofile-${Date.now()}@test.com`);

    const queueAddSpy = vi.mocked(integrationQueue.add);
    queueAddSpy.mockClear();

    await barazaBotService.sendInvitesToUser(user.id);

    const inviteCalls = queueAddSpy.mock.calls.filter(
      ([name]) => name === 'BARAZA_SEND_INVITE'
    );
    expect(inviteCalls).toHaveLength(0);
  });
});
