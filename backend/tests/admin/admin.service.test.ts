/**
 * @file tests/admin/admin.service.test.ts
 * Admin service tests — assignRole, revokeRole, generateReport
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { adminService } from '../../src/modules/admin/services/admin.service.js';

// Non-critical externals
vi.mock('../../src/modules/notifications/services/notification.service.js', () => ({
  notificationService: { send: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../src/modules/audit/services/audit.service.js', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

const TEST_COUNTY_ID = 'a1ad0001-0000-4000-b000-000000000001';
const TEST_CONST_ID = 'a1ad0002-0000-4000-b000-000000000002';
const TEST_WARD_ID = 'a1ad0003-0000-4000-b000-000000000003';

async function seedLocation() {
  await prisma.county.upsert({
    where: { id: TEST_COUNTY_ID },
    update: {},
    create: { id: TEST_COUNTY_ID, name: 'Admin Test County', code: 'ATC-01' },
  });
  await prisma.constituency.upsert({
    where: { id: TEST_CONST_ID },
    update: {},
    create: { id: TEST_CONST_ID, name: 'Admin Test Const', countyId: TEST_COUNTY_ID },
  });
  await prisma.ward.upsert({
    where: { id: TEST_WARD_ID },
    update: {},
    create: { id: TEST_WARD_ID, name: 'Admin Test Ward', constituencyId: TEST_CONST_ID, countyId: TEST_COUNTY_ID },
  });
}

async function seedUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      name: 'Admin Test User',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: false,
      communityVerified: true,
      primaryWardId: TEST_WARD_ID,
    },
  });
}

async function seedAdminUser() {
  const admin = await prisma.user.create({
    data: {
      email: 'admin-svc-test@ujamaa.test',
      name: 'Admin',
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
    data: { userId: admin.id, roleId: role.id, active: true },
  });
  return admin;
}

describe('AdminService.assignRole', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('assigns a valid system role to a user', async () => {
    const admin = await seedAdminUser();
    const user = await seedUser('assignrole-target@ujamaa.test');

    await adminService.assignRole(admin.id, user.id, 'location:ward_admin');

    const userRoles = await prisma.userRole.findMany({
      where: { userId: user.id, active: true },
      include: { role: true },
    });
    const roleNames = userRoles.map((ur) => ur.role.name);
    expect(roleNames).toContain('location:ward_admin');
  });

  it('throws BadRequest for unknown role', async () => {
    const admin = await seedAdminUser();
    const user = await seedUser('badrole-target@ujamaa.test');

    await expect(
      adminService.assignRole(admin.id, user.id, 'fake:unknown_role')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFound for unknown user', async () => {
    const admin = await seedAdminUser();

    await expect(
      adminService.assignRole(
        admin.id,
        '00000000-0000-4000-b000-000000000000',
        'location:ward_admin'
      )
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('is idempotent — assigning twice does not throw', async () => {
    const admin = await seedAdminUser();
    const user = await seedUser('idempotent-role@ujamaa.test');

    await adminService.assignRole(admin.id, user.id, 'location:ward_admin');
    await expect(
      adminService.assignRole(admin.id, user.id, 'location:ward_admin')
    ).resolves.not.toThrow();
  });
});

describe('AdminService.revokeRole', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('revokes an existing role', async () => {
    const admin = await seedAdminUser();
    const user = await seedUser('revokerole-target@ujamaa.test');

    await adminService.assignRole(admin.id, user.id, 'location:ward_admin');
    await adminService.revokeRole(admin.id, user.id, 'location:ward_admin');

    const userRoles = await prisma.userRole.findMany({
      where: { userId: user.id, active: true },
      include: { role: true },
    });
    const roleNames = userRoles.map((ur) => ur.role.name);
    expect(roleNames).not.toContain('location:ward_admin');
  });

  it('throws BadRequest when user does not have the role', async () => {
    const admin = await seedAdminUser();
    const user = await seedUser('norole-target@ujamaa.test');

    await prisma.role.upsert({
      where: { name: 'location:constituency_admin' },
      update: {},
      create: { name: 'location:constituency_admin', description: 'Const admin' },
    });

    await expect(
      adminService.revokeRole(admin.id, user.id, 'location:constituency_admin')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFound for unknown role name', async () => {
    const admin = await seedAdminUser();
    const user = await seedUser('norole-role-name@ujamaa.test');

    await expect(
      adminService.revokeRole(admin.id, user.id, 'location:does_not_exist')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('AdminService.getUserRoles', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('returns empty array when user has no roles', async () => {
    const user = await seedUser('getroles-empty@ujamaa.test');
    const roles = await adminService.getUserRoles(user.id);
    expect(roles).toEqual([]);
  });

  it('returns assigned roles', async () => {
    const admin = await seedAdminUser();
    const user = await seedUser('getroles-with@ujamaa.test');
    await adminService.assignRole(admin.id, user.id, 'location:ward_admin');

    const roles = await adminService.getUserRoles(user.id);
    expect(roles.some((r) => r.role === 'location:ward_admin')).toBe(true);
  });

  it('throws NotFound for unknown user', async () => {
    await expect(
      adminService.getUserRoles('00000000-0000-4000-b000-000000000000')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('AdminService.generateReport', () => {
  beforeEach(async () => {
    await seedLocation();
    await seedUser('report-user-1@ujamaa.test');
    await seedUser('report-user-2@ujamaa.test');
  });

  it('users report returns expected shape', async () => {
    const report = await adminService.generateReport('users', {});
    expect(report.title).toBe('User Activity Report');
    expect(Array.isArray(report.rows)).toBe(true);
    expect(Array.isArray(report.columns)).toBe(true);
    expect(report.columns).toContain('verificationLevel');
    expect(report.generatedAt).toBeTruthy();
  });

  it('governance report returns expected shape', async () => {
    const report = await adminService.generateReport('governance', {});
    expect(report.title).toBe('Governance Report');
    expect(Array.isArray(report.rows)).toBe(true);
    expect(report.columns).toContain('status');
    expect(report.summary).toBeDefined();
  });

  it('economy report returns expected shape', async () => {
    const report = await adminService.generateReport('economy', {});
    expect(report.title).toBe('Economy Report');
    expect(Array.isArray(report.rows)).toBe(true);
    expect(report.rows.some((r: any) => r.metric.includes('PR'))).toBe(true);
  });

  it('respects fromDate / toDate filters', async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const report = await adminService.generateReport('users', {
      fromDate: future,
    });
    // No users registered in the future
    const total = report.rows.reduce((sum: number, r: any) => sum + (r.count ?? 0), 0);
    expect(total).toBe(0);
  });
});
