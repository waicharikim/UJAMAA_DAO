/**
 * @file tests/audit/audit.service.test.ts
 * Audit service unit tests — log() and searchLogs() with filters/sort
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { auditService } from '../../src/modules/audit/services/audit.service.js';
import { AuditAction } from '../../src/modules/audit/types.js';

const TEST_COUNTY_ID = 'a2ad0001-0000-4000-b000-000000000001';
const TEST_CONST_ID = 'a2ad0002-0000-4000-b000-000000000002';
const TEST_WARD_ID = 'a2ad0003-0000-4000-b000-000000000003';

async function seedLocation() {
  await prisma.county.upsert({
    where: { id: TEST_COUNTY_ID },
    update: {},
    create: { id: TEST_COUNTY_ID, name: 'Audit Svc County', code: 'ASC-01' },
  });
  await prisma.constituency.upsert({
    where: { id: TEST_CONST_ID },
    update: {},
    create: { id: TEST_CONST_ID, name: 'Audit Svc Const', countyId: TEST_COUNTY_ID },
  });
  await prisma.ward.upsert({
    where: { id: TEST_WARD_ID },
    update: {},
    create: {
      id: TEST_WARD_ID,
      name: 'Audit Svc Ward',
      constituencyId: TEST_CONST_ID,
      countyId: TEST_COUNTY_ID,
    },
  });
}

async function seedUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      name: 'Audit Test User',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: false,
      communityVerified: true,
      primaryWardId: TEST_WARD_ID,
    },
  });
}

describe('AuditService.log', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('creates an audit log record', async () => {
    const user = await seedUser('audit-log-1@ujamaa.test');

    await auditService.log(user.id, AuditAction.PROFILE_UPDATED, 'User', user.id, {
      fields: ['name'],
    });

    const record = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: AuditAction.PROFILE_UPDATED },
    });
    expect(record).not.toBeNull();
    expect(record?.entityType).toBe('User');
    expect(record?.entityId).toBe(user.id);
  });

  it('stores metadata as JSON', async () => {
    const user = await seedUser('audit-log-meta@ujamaa.test');

    await auditService.log(user.id, AuditAction.ROLE_ASSIGNED, 'User', user.id, {
      role: 'location:ward_admin',
      scope: 'ward',
    });

    const record = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: AuditAction.ROLE_ASSIGNED },
    });
    expect(record?.metadata).toMatchObject({ role: 'location:ward_admin' });
  });

  it('works without entityId or metadata', async () => {
    const user = await seedUser('audit-log-min@ujamaa.test');

    await expect(
      auditService.log(user.id, AuditAction.GROUP_JOINED, 'Group')
    ).resolves.not.toThrow();

    const record = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: AuditAction.GROUP_JOINED },
    });
    expect(record).not.toBeNull();
    expect(record?.entityId).toBeNull();
    expect(record?.metadata).toBeNull();
  });
});

describe('AuditService.searchLogs', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('returns all logs with pagination metadata', async () => {
    const user = await seedUser('audit-search-all@ujamaa.test');
    await auditService.log(user.id, AuditAction.PROFILE_UPDATED, 'User', user.id);
    await auditService.log(user.id, AuditAction.GROUP_CREATED, 'Group');

    const result = await auditService.searchLogs(user.id, {});

    expect(Array.isArray(result.logs)).toBe(true);
    expect(result.logs.length).toBeGreaterThanOrEqual(2);
    expect(result.pagination).toMatchObject({
      page: 1,
      limit: 50,
    });
    expect(result.pagination.total).toBeGreaterThanOrEqual(2);
  });

  it('filters by userId', async () => {
    const user1 = await seedUser('audit-filter-u1@ujamaa.test');
    const user2 = await seedUser('audit-filter-u2@ujamaa.test');

    await auditService.log(user1.id, AuditAction.PROFILE_UPDATED, 'User', user1.id);
    await auditService.log(user2.id, AuditAction.PROFILE_UPDATED, 'User', user2.id);

    const result = await auditService.searchLogs(user1.id, { userId: user1.id });

    expect(result.logs.every((l) => l.userId === user1.id)).toBe(true);
    expect(result.logs.some((l) => l.userId === user2.id)).toBe(false);
  });

  it('filters by action', async () => {
    const user = await seedUser('audit-filter-action@ujamaa.test');
    await auditService.log(user.id, AuditAction.PROPOSAL_CREATED, 'Proposal');
    await auditService.log(user.id, AuditAction.GROUP_JOINED, 'Group');

    const result = await auditService.searchLogs(user.id, {
      action: AuditAction.PROPOSAL_CREATED,
    });

    expect(result.logs.every((l) => l.action === AuditAction.PROPOSAL_CREATED)).toBe(true);
  });

  it('filters by entityType', async () => {
    const user = await seedUser('audit-filter-type@ujamaa.test');
    await auditService.log(user.id, AuditAction.PROPOSAL_CREATED, 'Proposal');
    await auditService.log(user.id, AuditAction.GROUP_JOINED, 'Group');

    const result = await auditService.searchLogs(user.id, { entityType: 'Proposal' });

    expect(result.logs.every((l) => l.entityType === 'Proposal')).toBe(true);
  });

  it('filters by entityId', async () => {
    const user = await seedUser('audit-filter-eid@ujamaa.test');
    const entityId = user.id;
    await auditService.log(user.id, AuditAction.PROFILE_UPDATED, 'User', entityId);
    await auditService.log(user.id, AuditAction.GROUP_JOINED, 'Group');

    const result = await auditService.searchLogs(user.id, { entityId });

    expect(result.logs.every((l) => l.entityId === entityId)).toBe(true);
  });

  it('filters by fromDate / toDate', async () => {
    const user = await seedUser('audit-filter-date@ujamaa.test');
    await auditService.log(user.id, AuditAction.PROFILE_UPDATED, 'User');

    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = await auditService.searchLogs(user.id, { fromDate: future });

    expect(result.logs.length).toBe(0);
  });

  it('respects limit and page for pagination', async () => {
    const user = await seedUser('audit-paginate@ujamaa.test');
    for (let i = 0; i < 5; i++) {
      await auditService.log(user.id, AuditAction.PROFILE_UPDATED, 'User');
    }

    const result = await auditService.searchLogs(user.id, {
      userId: user.id,
      limit: 2,
      page: 1,
    });

    expect(result.logs.length).toBe(2);
    expect(result.pagination.limit).toBe(2);
    expect(result.pagination.totalPages).toBeGreaterThanOrEqual(3);
  });

  it('sorts by createdAt asc', async () => {
    const user = await seedUser('audit-sort-asc@ujamaa.test');
    await auditService.log(user.id, AuditAction.GROUP_JOINED, 'Group');
    await auditService.log(user.id, AuditAction.PROFILE_UPDATED, 'User');

    const result = await auditService.searchLogs(user.id, {
      userId: user.id,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });

    const dates = result.logs.map((l) => l.createdAt.getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
    }
  });

  it('sorts by createdAt desc by default', async () => {
    const user = await seedUser('audit-sort-desc@ujamaa.test');
    await auditService.log(user.id, AuditAction.GROUP_JOINED, 'Group');
    await auditService.log(user.id, AuditAction.PROFILE_UPDATED, 'User');

    const result = await auditService.searchLogs(user.id, { userId: user.id });

    const dates = result.logs.map((l) => l.createdAt.getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
    }
  });

  it('includes user info in log records', async () => {
    const user = await seedUser('audit-include-user@ujamaa.test');
    await auditService.log(user.id, AuditAction.PROFILE_UPDATED, 'User', user.id);

    const result = await auditService.searchLogs(user.id, { userId: user.id });

    const log = result.logs.find((l) => l.userId === user.id);
    expect(log?.user).toBeDefined();
    expect(log?.user?.email).toBe('audit-include-user@ujamaa.test');
  });
});
