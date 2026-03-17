/**
 * @file tests/treasury/treasury.service.test.ts
 * Treasury service unit tests — getOrCreateTreasury, deposit, withdraw,
 * getTransactions, allocateDues
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { treasuryService } from '../../src/modules/treasury/services/treasury.service.js';

const TEST_COUNTY_ID = 'b1ad0001-0000-4000-b000-000000000001';
const TEST_CONST_ID = 'b1ad0002-0000-4000-b000-000000000002';
const TEST_WARD_ID = 'b1ad0003-0000-4000-b000-000000000003';

async function seedLocation() {
  await prisma.county.upsert({
    where: { id: TEST_COUNTY_ID },
    update: {},
    create: { id: TEST_COUNTY_ID, name: 'Treasury Svc County', code: 'TSC-01' },
  });
  await prisma.constituency.upsert({
    where: { id: TEST_CONST_ID },
    update: {},
    create: { id: TEST_CONST_ID, name: 'Treasury Svc Const', countyId: TEST_COUNTY_ID },
  });
  await prisma.ward.upsert({
    where: { id: TEST_WARD_ID },
    update: {},
    create: {
      id: TEST_WARD_ID,
      name: 'Treasury Svc Ward',
      constituencyId: TEST_CONST_ID,
      countyId: TEST_COUNTY_ID,
    },
  });
}

async function seedGroup(name: string, isSystem = false) {
  return prisma.group.create({
    data: {
      name,
      locationScope: 'WARD',
      wardId: TEST_WARD_ID,
      isSystemGroup: isSystem,
      systemType: isSystem ? 'WARD' : null,
      status: 'ACTIVE',
    },
  });
}

async function seedUser(email: string, wardId = TEST_WARD_ID) {
  return prisma.user.create({
    data: {
      email,
      name: 'Treasury Test User',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: false,
      communityVerified: true,
      primaryWardId: wardId,
    },
  });
}

describe('TreasuryService.getOrCreateTreasury', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('creates a treasury for a group that has none', async () => {
    const group = await seedGroup('Treasury Test Group A');

    const treasury = await treasuryService.getOrCreateTreasury(group.id);

    expect(treasury.groupId).toBe(group.id);
    expect(Number(treasury.balance)).toBe(0);
  });

  it('returns existing treasury on second call (idempotent)', async () => {
    const group = await seedGroup('Treasury Test Group B');

    const first = await treasuryService.getOrCreateTreasury(group.id);
    const second = await treasuryService.getOrCreateTreasury(group.id);

    expect(first.id).toBe(second.id);
  });

  it('throws NotFound for unknown group', async () => {
    await expect(
      treasuryService.getOrCreateTreasury('00000000-0000-4000-b000-000000000000')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('TreasuryService.getGroupTreasury', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('returns treasury with group name', async () => {
    const group = await seedGroup('Treasury Get Group');
    await treasuryService.getOrCreateTreasury(group.id);

    const result = await treasuryService.getGroupTreasury(group.id);

    expect(result.groupId).toBe(group.id);
    expect(result.groupName).toBe('Treasury Get Group');
    expect(typeof result.balance).toBe('number');
  });

  it('throws NotFound when no treasury exists', async () => {
    const group = await seedGroup('Treasury No Treasury Group');

    await expect(
      treasuryService.getGroupTreasury(group.id)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('TreasuryService.deposit', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('creates a CREDIT transaction and increments balance', async () => {
    const group = await seedGroup('Deposit Group');
    const user = await seedUser('deposit-actor@ujamaa.test');

    const tx = await treasuryService.deposit(
      group.id,
      { amount: 5000, description: 'Test deposit', referenceType: 'MANUAL' },
      user.id
    );

    expect(tx.transactionType).toBe('CREDIT');
    expect(Number(tx.amount)).toBe(5000);

    const treasury = await prisma.groupTreasury.findUnique({
      where: { groupId: group.id },
    });
    expect(Number(treasury!.balance)).toBe(5000);
  });

  it('accumulates multiple deposits', async () => {
    const group = await seedGroup('Multi Deposit Group');
    const user = await seedUser('multi-deposit-actor@ujamaa.test');

    await treasuryService.deposit(group.id, { amount: 1000 }, user.id);
    await treasuryService.deposit(group.id, { amount: 2500 }, user.id);

    const treasury = await prisma.groupTreasury.findUnique({
      where: { groupId: group.id },
    });
    expect(Number(treasury!.balance)).toBe(3500);
  });

  it('creates a treasury automatically if none exists', async () => {
    const group = await seedGroup('Auto-create Deposit Group');
    const user = await seedUser('auto-deposit-actor@ujamaa.test');

    await expect(
      treasuryService.deposit(group.id, { amount: 100 }, user.id)
    ).resolves.not.toThrow();
  });
});

describe('TreasuryService.withdraw', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('creates a DEBIT transaction and decrements balance', async () => {
    const group = await seedGroup('Withdraw Group');
    const user = await seedUser('withdraw-actor@ujamaa.test');

    await treasuryService.deposit(group.id, { amount: 10000 }, user.id);
    const tx = await treasuryService.withdraw(
      group.id,
      { amount: 3000, description: 'Project funding' },
      user.id
    );

    expect(tx.transactionType).toBe('DEBIT');
    expect(Number(tx.amount)).toBe(3000);

    const treasury = await prisma.groupTreasury.findUnique({
      where: { groupId: group.id },
    });
    expect(Number(treasury!.balance)).toBe(7000);
  });

  it('throws BadRequest when balance is insufficient', async () => {
    const group = await seedGroup('Insufficient Balance Group');
    const user = await seedUser('insuf-actor@ujamaa.test');

    await treasuryService.deposit(group.id, { amount: 500 }, user.id);

    await expect(
      treasuryService.withdraw(group.id, { amount: 1000 }, user.id)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFound when treasury does not exist', async () => {
    const group = await seedGroup('No Treasury Withdraw Group');
    const user = await seedUser('no-treasury-actor@ujamaa.test');

    await expect(
      treasuryService.withdraw(group.id, { amount: 100 }, user.id)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('TreasuryService.getTransactions', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('returns paginated transactions', async () => {
    const group = await seedGroup('Txn List Group');
    const user = await seedUser('txn-list-actor@ujamaa.test');

    for (let i = 0; i < 5; i++) {
      await treasuryService.deposit(group.id, { amount: 100 * (i + 1) }, user.id);
    }

    const result = await treasuryService.getTransactions(group.id, {
      limit: 3,
      page: 1,
    });

    expect(result.transactions.length).toBe(3);
    expect(result.pagination.total).toBe(5);
    expect(result.pagination.totalPages).toBe(2);
  });

  it('filters by transactionType', async () => {
    const group = await seedGroup('Txn Filter Group');
    const user = await seedUser('txn-filter-actor@ujamaa.test');

    await treasuryService.deposit(group.id, { amount: 5000 }, user.id);
    await treasuryService.withdraw(group.id, { amount: 1000 }, user.id);

    const credits = await treasuryService.getTransactions(group.id, {
      transactionType: 'CREDIT',
    });
    const debits = await treasuryService.getTransactions(group.id, {
      transactionType: 'DEBIT',
    });

    expect(credits.transactions.every((t) => t.transactionType === 'CREDIT')).toBe(true);
    expect(debits.transactions.every((t) => t.transactionType === 'DEBIT')).toBe(true);
  });

  it('throws NotFound when treasury does not exist', async () => {
    const group = await seedGroup('Txn No Treasury Group');

    await expect(
      treasuryService.getTransactions(group.id, {})
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('TreasuryService.allocateDues', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('credits the ward group treasury after dues payment', async () => {
    // Seed a WARD system group for the test ward
    const wardGroup = await prisma.group.create({
      data: {
        name: 'Ward System Group Dues Test',
        locationScope: 'WARD',
        wardId: TEST_WARD_ID,
        isSystemGroup: true,
        systemType: 'WARD',
        status: 'ACTIVE',
      },
    });

    const user = await seedUser('dues-allocate-user@ujamaa.test');

    const payment = await prisma.duesPayment.create({
      data: {
        userId: user.id,
        tier: 'ORDINARY',
        totalAmount: 60,
        period: '2026-03',
        paymentMethod: 'MPESA',
        status: 'COMPLETED',
        paidAt: new Date(),
      },
    });

    await treasuryService.allocateDues(payment.id, user.id);

    const treasury = await prisma.groupTreasury.findUnique({
      where: { groupId: wardGroup.id },
    });
    expect(treasury).not.toBeNull();
    expect(Number(treasury!.balance)).toBe(60);

    const allocation = await prisma.duesAllocation.findFirst({
      where: { duesPaymentId: payment.id },
    });
    expect(allocation).not.toBeNull();
    expect(Number(allocation!.percentage)).toBe(100);
  });

  it('skips gracefully when ward group does not exist', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'dues-no-ward-group@ujamaa.test',
        name: 'No Ward Group User',
        verificationLevel: 'COMMUNITY_VERIFIED',
        emailVerified: true,
        phoneVerified: false,
        communityVerified: true,
        primaryWardId: TEST_WARD_ID,
      },
    });

    const payment = await prisma.duesPayment.create({
      data: {
        userId: user.id,
        tier: 'ORDINARY',
        totalAmount: 60,
        period: '2026-04',
        paymentMethod: 'MPESA',
        status: 'COMPLETED',
        paidAt: new Date(),
      },
    });

    // No ward system group exists — should not throw
    await expect(
      treasuryService.allocateDues(payment.id, user.id)
    ).resolves.not.toThrow();
  });

  it('skips gracefully when user has no primaryWardId', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'dues-no-ward@ujamaa.test',
        name: 'No Ward User',
        verificationLevel: 'COMMUNITY_VERIFIED',
        emailVerified: true,
        phoneVerified: false,
        communityVerified: true,
        primaryWardId: null,
      },
    });

    const payment = await prisma.duesPayment.create({
      data: {
        userId: user.id,
        tier: 'ORDINARY',
        totalAmount: 60,
        period: '2026-05',
        paymentMethod: 'MPESA',
        status: 'COMPLETED',
        paidAt: new Date(),
      },
    });

    await expect(
      treasuryService.allocateDues(payment.id, user.id)
    ).resolves.not.toThrow();
  });
});
