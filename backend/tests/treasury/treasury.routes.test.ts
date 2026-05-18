/**
 * @file tests/treasury/treasury.routes.test.ts
 * Route integration tests for /treasury endpoints
 */

// Hoist mocks before imports
vi.mock('../../src/core/services/token-blacklist.service.js', () => ({
  tokenBlacklistService: {
    isRevoked: vi.fn().mockResolvedValue(false),
    revoke: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/core/utils/email.service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendLoginEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/modules/community/services/groupMembership.service.js', () => ({
  groupMembershipService: {
    enrollInSystemGroups: vi.fn().mockResolvedValue(undefined),
    updateResidenceGroups: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/modules/economy/services/participationRights.service.js', () => ({
  participationRightsService: {
    award: vi.fn().mockResolvedValue(undefined),
    spend: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/modules/notifications/services/notification.service.js', () => ({
  notificationService: { send: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: { send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }) },
  })),
}));

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import {
  makeAccessToken,
  seedLocation,
  TEST_WARD_ID,
  TEST_CONST_ID,
  TEST_COUNTY_ID,
} from '../auth/helpers.js';
import { prisma } from '../../src/core/database/client.js';
import { treasuryService } from '../../src/modules/treasury/services/treasury.service.js';

async function seedAdmin() {
  await seedLocation();

  const user = await prisma.user.create({
    data: {
      email: `treasury-admin-${Date.now()}@ujamaa.test`,
      name: 'Treasury Admin',
      verificationLevel: 'FULL_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      primaryWardId: TEST_WARD_ID,
    },
  });

  const role = await prisma.role.upsert({
    where: { name: 'system:super_admin' },
    update: {},
    create: { name: 'system:super_admin', description: 'Super admin' },
  });

  await prisma.userRole.create({
    data: { userId: user.id, roleId: role.id, active: true },
  });

  const token = makeAccessToken(user.id, 'FULL_VERIFIED', {
    roles: ['system:super_admin'],
  });

  return { user, token };
}

async function seedGroup(name: string) {
  return prisma.group.create({
    data: {
      name,
      locationScope: 'WARD',
      wardId: TEST_WARD_ID,
      isSystemGroup: false,
      status: 'ACTIVE',
    },
  });
}

async function seedRegularUser() {
  return prisma.user.create({
    data: {
      email: `treasury-user-${Date.now()}@ujamaa.test`,
      name: 'Regular User',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: false,
      communityVerified: true,
      primaryWardId: TEST_WARD_ID,
    },
  });
}

describe('GET /treasury/my-groups', () => {
  beforeAll(async () => {
    await servicesReady;
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/v1/treasury/my-groups');
    expect(res.status).toBe(401);
  });

  it('returns empty array when user belongs to no groups with a treasury', async () => {
    const { token } = await seedAdmin();

    const res = await request(app)
      .get('/api/v1/treasury/my-groups')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });

  it('returns treasury entries for all groups the user belongs to with a treasury', async () => {
    const { user, token } = await seedAdmin();
    const groupA = await seedGroup('My Groups A');
    const groupB = await seedGroup('My Groups B');

    // add user to both groups
    await prisma.groupMember.create({
      data: { userId: user.id, groupId: groupA.id, role: 'MEMBER', autoEnrolled: false, canLeave: true, joinedAt: new Date(), active: true },
    });
    await prisma.groupMember.create({
      data: { userId: user.id, groupId: groupB.id, role: 'MEMBER', autoEnrolled: false, canLeave: true, joinedAt: new Date(), active: true },
    });

    // create treasury for groupA only
    await treasuryService.deposit(groupA.id, { amount: 1000 }, user.id);

    const res = await request(app)
      .get('/api/v1/treasury/my-groups')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data: Array<{ groupId: string; balance: number; groupName: string }> = res.body.data;
    expect(data.some((d) => d.groupId === groupA.id && d.balance === 1000)).toBe(true);
    expect(data.every((d) => d.groupId !== groupB.id)).toBe(true);
  });

  it('returns correct balance and groupName fields', async () => {
    const { user, token } = await seedAdmin();
    const group = await seedGroup('My Groups Shape Group');

    await prisma.groupMember.create({
      data: { userId: user.id, groupId: group.id, role: 'MEMBER', autoEnrolled: false, canLeave: true, joinedAt: new Date(), active: true },
    });
    await treasuryService.deposit(group.id, { amount: 2500 }, user.id);

    const res = await request(app)
      .get('/api/v1/treasury/my-groups')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const entry = res.body.data.find((d: any) => d.groupId === group.id);
    expect(entry).toBeDefined();
    expect(entry.groupName).toBe('My Groups Shape Group');
    expect(entry.balance).toBe(2500);
    expect(typeof entry.isSystem).toBe('boolean');
    expect('systemType' in entry).toBe(true);
    expect('updatedAt' in entry).toBe(true);
  });
});

describe('GET /treasury/:groupId', () => {
  beforeAll(async () => {
    await servicesReady;
  });

  it('returns 401 with no token', async () => {
    await seedLocation();
    const group = await seedGroup('Anon Treasury Group');
    const res = await request(app).get(`/api/v1/treasury/${group.id}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 when no treasury exists for group', async () => {
    const { token } = await seedAdmin();
    const group = await seedGroup('No Treasury GET Group');

    const res = await request(app)
      .get(`/api/v1/treasury/${group.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 200 with treasury data when treasury exists', async () => {
    const { user, token } = await seedAdmin();
    const group = await seedGroup('Has Treasury GET Group');
    await treasuryService.deposit(group.id, { amount: 1000 }, user.id);

    const res = await request(app)
      .get(`/api/v1/treasury/${group.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.groupId).toBe(group.id);
    expect(res.body.data.balance).toBe(1000);
  });

  it('returns 200 for non-admin authenticated user', async () => {
    await seedLocation();
    const adminUser = (await seedAdmin()).user;
    const group = await seedGroup('Regular User GET Group');
    await treasuryService.deposit(group.id, { amount: 500 }, adminUser.id);

    const regularUser = await seedRegularUser();
    const token = makeAccessToken(regularUser.id, 'COMMUNITY_VERIFIED', { roles: [] });

    const res = await request(app)
      .get(`/api/v1/treasury/${group.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /treasury/:groupId/transactions', () => {
  beforeAll(async () => {
    await servicesReady;
  });

  it('returns 401 with no token', async () => {
    await seedLocation();
    const group = await seedGroup('Anon Txn Group');
    const res = await request(app).get(`/api/v1/treasury/${group.id}/transactions`);
    expect(res.status).toBe(401);
  });

  it('returns 404 when no treasury exists', async () => {
    const { token } = await seedAdmin();
    const group = await seedGroup('No Treasury Txn Group');

    const res = await request(app)
      .get(`/api/v1/treasury/${group.id}/transactions`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns transactions with pagination metadata', async () => {
    const { user, token } = await seedAdmin();
    const group = await seedGroup('Txn Route List Group');

    await treasuryService.deposit(group.id, { amount: 100 }, user.id);
    await treasuryService.deposit(group.id, { amount: 200 }, user.id);

    const res = await request(app)
      .get(`/api/v1/treasury/${group.id}/transactions`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.transactions)).toBe(true);
    expect(res.body.data.transactions.length).toBe(2);
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.total).toBe(2);
  });

  it('filters by transactionType query param', async () => {
    const { user, token } = await seedAdmin();
    const group = await seedGroup('Txn Filter Route Group');

    await treasuryService.deposit(group.id, { amount: 5000 }, user.id);
    await treasuryService.withdraw(group.id, { amount: 1000 }, user.id);

    const res = await request(app)
      .get(`/api/v1/treasury/${group.id}/transactions?transactionType=DEBIT`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.transactions.every((t: any) => t.transactionType === 'DEBIT')).toBe(true);
  });
});

describe('POST /treasury/:groupId/deposit', () => {
  beforeAll(async () => {
    await servicesReady;
  });

  it('returns 401 with no token', async () => {
    await seedLocation();
    const group = await seedGroup('Deposit No Token Group');
    const res = await request(app)
      .post(`/api/v1/treasury/${group.id}/deposit`)
      .send({ amount: 100 });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    await seedLocation();
    const group = await seedGroup('Deposit Forbidden Group');
    const user = await seedRegularUser();
    const token = makeAccessToken(user.id, 'COMMUNITY_VERIFIED', { roles: [] });

    const res = await request(app)
      .post(`/api/v1/treasury/${group.id}/deposit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid body (missing amount)', async () => {
    const { token } = await seedAdmin();
    const group = await seedGroup('Deposit Bad Body Group');

    const res = await request(app)
      .post(`/api/v1/treasury/${group.id}/deposit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'no amount here' });

    expect(res.status).toBe(400);
  });

  it('returns 200 and creates CREDIT transaction (200)', async () => {
    const { token } = await seedAdmin();
    const group = await seedGroup('Deposit Success Group');

    const res = await request(app)
      .post(`/api/v1/treasury/${group.id}/deposit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 2500, description: 'Ward grant', referenceType: 'MANUAL' });

    expect(res.status).toBe(200);
    expect(res.body.data.transactionType).toBe('CREDIT');
    expect(Number(res.body.data.amount)).toBe(2500);
  });
});

describe('POST /treasury/:groupId/withdraw', () => {
  beforeAll(async () => {
    await servicesReady;
  });

  it('returns 403 for non-admin user', async () => {
    const { user: admin } = await seedAdmin();
    const group = await seedGroup('Withdraw Forbidden Group');
    await treasuryService.deposit(group.id, { amount: 5000 }, admin.id);

    const regular = await seedRegularUser();
    const token = makeAccessToken(regular.id, 'COMMUNITY_VERIFIED', { roles: [] });

    const res = await request(app)
      .post(`/api/v1/treasury/${group.id}/withdraw`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 500 });

    expect(res.status).toBe(403);
  });

  it('returns 400 when balance is insufficient', async () => {
    const { user, token } = await seedAdmin();
    const group = await seedGroup('Withdraw Insufficient Group');
    await treasuryService.deposit(group.id, { amount: 100 }, user.id);

    const res = await request(app)
      .post(`/api/v1/treasury/${group.id}/withdraw`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 9999 });

    expect(res.status).toBe(400);
  });

  it('returns 200 and creates DEBIT transaction', async () => {
    const { user, token } = await seedAdmin();
    const group = await seedGroup('Withdraw Success Group');
    await treasuryService.deposit(group.id, { amount: 10000 }, user.id);

    const res = await request(app)
      .post(`/api/v1/treasury/${group.id}/withdraw`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 3000, description: 'Borehole supplies' });

    expect(res.status).toBe(200);
    expect(res.body.data.transactionType).toBe('DEBIT');
    expect(Number(res.body.data.amount)).toBe(3000);

    // Balance should be 7000
    const treasury = await prisma.groupTreasury.findUnique({
      where: { groupId: group.id },
    });
    expect(Number(treasury!.balance)).toBe(7000);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// allocateDues — geographic split
// ────────────────────────────────────────────────────────────────────────────

async function seedSystemGroups() {
  await seedLocation();
  const wardGroup = await prisma.group.upsert({
    where: { name: '__SYS_WARD__' },
    update: {},
    create: {
      name: '__SYS_WARD__',
      locationScope: 'WARD',
      wardId: TEST_WARD_ID,
      constituencyId: TEST_CONST_ID,
      countyId: TEST_COUNTY_ID,
      isSystemGroup: true,
      systemType: 'WARD',
      status: 'ACTIVE',
      canBeDeleted: false,
      canBeRenamed: false,
    },
  });
  const constGroup = await prisma.group.upsert({
    where: { name: '__SYS_CONSTITUENCY__' },
    update: {},
    create: {
      name: '__SYS_CONSTITUENCY__',
      locationScope: 'CONSTITUENCY',
      constituencyId: TEST_CONST_ID,
      countyId: TEST_COUNTY_ID,
      isSystemGroup: true,
      systemType: 'CONSTITUENCY',
      status: 'ACTIVE',
      canBeDeleted: false,
      canBeRenamed: false,
    },
  });
  const countyGroup = await prisma.group.upsert({
    where: { name: '__SYS_COUNTY__' },
    update: {},
    create: {
      name: '__SYS_COUNTY__',
      locationScope: 'COUNTY',
      countyId: TEST_COUNTY_ID,
      isSystemGroup: true,
      systemType: 'COUNTY',
      status: 'ACTIVE',
      canBeDeleted: false,
      canBeRenamed: false,
    },
  });
  const nationalGroup = await prisma.group.upsert({
    where: { name: '__SYS_NATIONAL__' },
    update: {},
    create: {
      name: '__SYS_NATIONAL__',
      locationScope: 'NATIONAL',
      isSystemGroup: true,
      systemType: 'NATIONAL',
      status: 'ACTIVE',
      canBeDeleted: false,
      canBeRenamed: false,
    },
  });
  return { wardGroup, constGroup, countyGroup, nationalGroup };
}

async function seedDuesPayment(userId: string, period: string, amount: number) {
  return prisma.duesPayment.create({
    data: {
      userId,
      totalAmount: amount,
      tier: 'ORDINARY',
      period,
      paymentMethod: 'MPESA',
      status: 'COMPLETED',
      paidAt: new Date(),
    },
  });
}

async function seedAllocUser(suffix: string) {
  await seedLocation();
  return prisma.user.create({
    data: {
      email: `alloc-${suffix}-${Date.now()}@ujamaa.test`,
      name: `Alloc User ${suffix}`,
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      primaryWardId: TEST_WARD_ID,
    },
  });
}

describe('treasuryService.allocateDues() — geographic split', () => {
  beforeAll(async () => {
    await servicesReady;
  });

  afterEach(async () => {
    // Remove any custom PlatformConfig override so tests don't bleed into each other
    await prisma.platformConfig
      .delete({ where: { key: 'dues_allocation_split' } })
      .catch(() => {});
  });

  it('splits 70/15/10/5 across all 4 system group levels with default config', async () => {
    await seedSystemGroups();
    const user = await seedAllocUser('full');
    const payment = await seedDuesPayment(user.id, '2026-06', 1000);

    await treasuryService.allocateDues(payment.id, user.id);

    // Assert via DuesAllocation records (per-payment, unaffected by other tests)
    const allocations = await prisma.duesAllocation.findMany({
      where: { duesPaymentId: payment.id },
      orderBy: { amount: 'desc' },
    });
    expect(allocations).toHaveLength(4);

    const amounts = allocations.map((a) => Number(a.amount)).sort((a, b) => b - a);
    expect(amounts).toEqual([700, 150, 100, 50]);

    const percentages = allocations.map((a) => Number(a.percentage)).sort((a, b) => b - a);
    expect(percentages).toEqual([70, 15, 10, 5]);
  });

  it('respects custom split from PlatformConfig and skips zero-percentage levels', async () => {
    await prisma.platformConfig.upsert({
      where: { key: 'dues_allocation_split' },
      update: {
        value: JSON.stringify({ WARD: 60, CONSTITUENCY: 40, COUNTY: 0, NATIONAL: 0 }),
      },
      create: {
        key: 'dues_allocation_split',
        value: JSON.stringify({ WARD: 60, CONSTITUENCY: 40, COUNTY: 0, NATIONAL: 0 }),
        label: 'Test override',
        category: 'treasury',
      },
    });

    await seedSystemGroups();
    const user = await seedAllocUser('config');
    const payment = await seedDuesPayment(user.id, '2026-07', 500);

    await treasuryService.allocateDues(payment.id, user.id);

    // Only 2 levels with non-zero percentage → 2 allocation records
    const allocations = await prisma.duesAllocation.findMany({
      where: { duesPaymentId: payment.id },
    });
    expect(allocations).toHaveLength(2);

    const amounts = allocations.map((a) => Number(a.amount)).sort((a, b) => b - a);
    expect(amounts).toEqual([300, 200]); // 60% and 40% of 500

    const percentages = allocations.map((a) => Number(a.percentage)).sort((a, b) => b - a);
    expect(percentages).toEqual([60, 40]);
  });

  it('skips allocation gracefully when user has no primaryWardId', async () => {
    const user = await prisma.user.create({
      data: {
        email: `alloc-noward-${Date.now()}@ujamaa.test`,
        name: 'No Ward User',
        verificationLevel: 'EMAIL_VERIFIED',
        emailVerified: true,
        primaryWardId: null,
      },
    });
    const payment = await prisma.duesPayment.create({
      data: {
        userId: user.id,
        totalAmount: 100,
        tier: 'ORDINARY',
        period: '2026-09',
        paymentMethod: 'MPESA',
        status: 'COMPLETED',
        paidAt: new Date(),
      },
    });

    await expect(
      treasuryService.allocateDues(payment.id, user.id)
    ).resolves.toBeUndefined();

    const allocations = await prisma.duesAllocation.findMany({
      where: { duesPaymentId: payment.id },
    });
    expect(allocations).toHaveLength(0);
  });

  it('skips gracefully when DuesPayment does not exist', async () => {
    const fakeId = '00000000-0000-4000-8000-000000000001';
    const user = await seedAllocUser('nodues');

    await expect(
      treasuryService.allocateDues(fakeId, user.id)
    ).resolves.toBeUndefined();
  });
});
