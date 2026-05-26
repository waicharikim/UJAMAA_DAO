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

describe('AdminService.getStats', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('returns expected stats shape', async () => {
    await seedUser('stats-shape@ujamaa.test');

    const stats = await adminService.getStats();

    expect(typeof stats.users.total).toBe('number');
    expect(typeof stats.users.active).toBe('number');
    expect(typeof stats.users.suspended).toBe('number');
    expect(stats.users.byVerification).toBeDefined();
    expect(typeof stats.governance.activeProposals).toBe('number');
    expect(typeof stats.pendingActions.total).toBe('number');
    expect(typeof stats.economy.totalParticipationRights).toBe('number');
    expect(typeof stats.economy.totalUtilityTokens).toBe('number');
  });

  it('counts users across verification levels', async () => {
    await seedUser('stats-cv@ujamaa.test');

    const stats = await adminService.getStats();

    expect(stats.users.total).toBeGreaterThanOrEqual(1);
    expect(stats.users.byVerification['COMMUNITY_VERIFIED']).toBeGreaterThanOrEqual(1);
  });

  it('pendingActions.total equals verifications + residenceChanges', async () => {
    const stats = await adminService.getStats();
    expect(stats.pendingActions.total).toBe(
      stats.pendingActions.verifications + stats.pendingActions.residenceChanges
    );
  });
});

describe('AdminService.listUsers', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('returns users with expected shape', async () => {
    await seedUser('list-user@ujamaa.test');

    const result = await adminService.listUsers({});

    expect(Array.isArray(result.users)).toBe(true);
    expect(typeof result.total).toBe('number');
    expect(result.total).toBeGreaterThanOrEqual(1);

    const user = result.users.find((u) => u.email === 'list-user@ujamaa.test');
    expect(user).toBeDefined();
    expect(user!.verificationLevel).toBe('COMMUNITY_VERIFIED');
    expect(Array.isArray(user!.roles)).toBe(true);
    expect(user!.participationRights).toBeDefined();
  });

  it('filters by search term (email match)', async () => {
    await seedUser('searchable-unique-user@ujamaa.test');

    const result = await adminService.listUsers({ search: 'searchable-unique-user' });

    expect(result.users.length).toBeGreaterThanOrEqual(1);
    expect(result.users.every((u) =>
      u.email.includes('searchable-unique-user') || u.name?.includes('searchable-unique-user')
    )).toBe(true);
  });

  it('respects limit and offset', async () => {
    for (let i = 0; i < 3; i++) {
      await seedUser(`paginate-list-${i}@ujamaa.test`);
    }

    const result = await adminService.listUsers({ limit: 2, offset: 0 });

    expect(result.users.length).toBeLessThanOrEqual(2);
    expect(result.limit).toBe(2);
    expect(result.offset).toBe(0);
  });
});

describe('AdminService.adjustParticipationRights', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('ADDs PR to user balance', async () => {
    const admin = await seedAdminUser();
    const user = await seedUser('pr-add-target@ujamaa.test');
    const before = await prisma.user.findUnique({ where: { id: user.id } });

    const result = await adminService.adjustParticipationRights(admin.id, user.id, 50, 'ADD', 'test reward');

    expect(result.previous).toBe(before!.participationRights);
    expect(result.new).toBe(before!.participationRights + 50);
  });

  it('DEDUCTs PR from user balance', async () => {
    const admin = await seedAdminUser();
    const user = await prisma.user.create({
      data: {
        email: 'pr-deduct-target@ujamaa.test',
        name: 'Deduct Target',
        verificationLevel: 'COMMUNITY_VERIFIED',
        emailVerified: true,
        phoneVerified: false,
        communityVerified: true,
        primaryWardId: TEST_WARD_ID,
        participationRights: 100,
      },
    });

    const result = await adminService.adjustParticipationRights(admin.id, user.id, 30, 'DEDUCT', 'penalty');

    expect(result.previous).toBe(100);
    expect(result.new).toBe(70);
  });

  it('floors at 0 — never goes negative', async () => {
    const admin = await seedAdminUser();
    const user = await seedUser('pr-floor-target@ujamaa.test');

    const result = await adminService.adjustParticipationRights(admin.id, user.id, 99999, 'DEDUCT', 'big penalty');

    expect(result.new).toBe(0);
  });

  it('throws 400 when amount is 0', async () => {
    const admin = await seedAdminUser();
    const user = await seedUser('pr-zero-target@ujamaa.test');

    await expect(
      adminService.adjustParticipationRights(admin.id, user.id, 0, 'ADD', 'no-op')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 for unknown userId', async () => {
    const admin = await seedAdminUser();

    await expect(
      adminService.adjustParticipationRights(
        admin.id,
        '00000000-0000-4000-b000-000000000000',
        10,
        'ADD',
        'ghost user'
      )
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('AdminService.suspendUser', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('suspends a user — status becomes SUSPENDED', async () => {
    const admin = await seedAdminUser();
    const user = await seedUser('suspend-target@ujamaa.test');

    await adminService.suspendUser(admin.id, user.id, true, 'ToS violation', 7);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.status).toBe('SUSPENDED');
  });

  it('unsuspends a user — status returns to ACTIVE', async () => {
    const admin = await seedAdminUser();
    const user = await seedUser('unsuspend-target@ujamaa.test');

    await adminService.suspendUser(admin.id, user.id, true, 'ToS violation');
    await adminService.suspendUser(admin.id, user.id, false, 'appeal granted');

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.status).toBe('ACTIVE');
  });

  it('revokes all active sessions on suspend', async () => {
    const admin = await seedAdminUser();
    const user = await seedUser('suspend-sessions@ujamaa.test');

    await prisma.session.create({
      data: { userId: user.id, token: 'tok-abc', expiresAt: new Date(Date.now() + 3600000) },
    });

    await adminService.suspendUser(admin.id, user.id, true, 'ToS violation');

    const activeSessions = await prisma.session.findMany({
      where: { userId: user.id, revoked: false },
    });
    expect(activeSessions.length).toBe(0);
  });

  it('throws 404 for unknown userId', async () => {
    const admin = await seedAdminUser();

    await expect(
      adminService.suspendUser(
        admin.id,
        '00000000-0000-4000-b000-000000000000',
        true,
        'ghost user'
      )
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── Education module seeding helpers ─────────────────────────────────────────

async function seedModuleCreator() {
  return prisma.user.create({
    data: {
      email: `module-creator-${Date.now()}@ujamaa.test`,
      name: 'Module Creator',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      primaryWardId: TEST_WARD_ID,
    },
  });
}

async function seedSubmittedModule(creatorId: string, title = 'Submitted Module') {
  return prisma.educationalModule.create({
    data: {
      creatorId,
      title,
      description: 'A submitted module for admin review.',
      content: 'Introduction to the topic. ' + 'x'.repeat(80),
      mediaUrls: [],
      duration: 20,
      difficulty: 'BEGINNER',
      category: 'governance',
      verified: false,
      completionIP: 10,
      submittedAt: new Date(),
      rejectionReason: null,
    },
  });
}

async function seedDraftModule(creatorId: string) {
  return prisma.educationalModule.create({
    data: {
      creatorId,
      title: 'Draft Module',
      description: 'A draft module not yet submitted.',
      content: 'Introduction to the topic. ' + 'x'.repeat(80),
      mediaUrls: [],
      duration: 20,
      difficulty: 'BEGINNER',
      category: 'governance',
      verified: false,
      completionIP: 10,
    },
  });
}

async function seedApprovedModule(creatorId: string) {
  return prisma.educationalModule.create({
    data: {
      creatorId,
      title: 'Approved Module',
      description: 'An already approved module.',
      content: 'Introduction to the topic. ' + 'x'.repeat(80),
      mediaUrls: [],
      duration: 20,
      difficulty: 'BEGINNER',
      category: 'governance',
      verified: true,
      expertApproved: true,
      completionIP: 10,
      submittedAt: new Date(),
    },
  });
}

const VALID_ADMIN_MODULE_DTO = {
  title: 'Ward Budget Fundamentals',
  description: 'Learn how ward development funds are allocated and tracked by county governments.',
  content:
    'Ward development funds are allocated annually by county governments. This module explains the allocation formula, how to access expenditure reports, and how community members can participate in budget review meetings.',
  duration: 25,
  difficulty: 'BEGINNER',
  category: 'governance',
  completionIP: 15,
};

// ─────────────────────────────────────────────
// AdminService.listPendingModules
// ─────────────────────────────────────────────

describe('AdminService.listPendingModules', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('returns empty when no modules are pending', async () => {
    const result = await adminService.listPendingModules({});
    expect(result.modules).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('returns only submitted modules (not drafts, not approved)', async () => {
    const creator = await seedModuleCreator();
    await seedDraftModule(creator.id);
    await seedApprovedModule(creator.id);
    const submitted = await seedSubmittedModule(creator.id, 'Pending Review');

    const result = await adminService.listPendingModules({});
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].title).toBe('Pending Review');
    expect(result.total).toBe(1);
  });

  it('excludes rejected modules (rejectionReason set)', async () => {
    const creator = await seedModuleCreator();
    await prisma.educationalModule.create({
      data: {
        creatorId: creator.id,
        title: 'Rejected One',
        description: 'Was rejected before.',
        content: 'Content ' + 'x'.repeat(80),
        mediaUrls: [],
        duration: 15,
        difficulty: 'BEGINNER',
        category: 'governance',
        verified: false,
        completionIP: 5,
        submittedAt: new Date(Date.now() - 86_400_000),
        rejectionReason: 'Too short.',
      },
    });
    const result = await adminService.listPendingModules({});
    expect(result.modules).toHaveLength(0);
  });

  it('orders by submittedAt ascending (oldest first)', async () => {
    const creator = await seedModuleCreator();
    await prisma.educationalModule.create({
      data: {
        creatorId: creator.id, title: 'Later Module',
        description: 'Desc', content: 'Content ' + 'x'.repeat(80), mediaUrls: [],
        duration: 10, difficulty: 'BEGINNER', category: 'governance',
        verified: false, completionIP: 0,
        submittedAt: new Date(Date.now() - 1_000),
      },
    });
    await prisma.educationalModule.create({
      data: {
        creatorId: creator.id, title: 'Earlier Module',
        description: 'Desc', content: 'Content ' + 'x'.repeat(80), mediaUrls: [],
        duration: 10, difficulty: 'BEGINNER', category: 'governance',
        verified: false, completionIP: 0,
        submittedAt: new Date(Date.now() - 86_400_000),
      },
    });

    const result = await adminService.listPendingModules({});
    expect(result.modules[0].title).toBe('Earlier Module');
    expect(result.modules[1].title).toBe('Later Module');
  });

  it('paginates correctly', async () => {
    const creator = await seedModuleCreator();
    for (let i = 0; i < 5; i++) {
      await seedSubmittedModule(creator.id, `Module ${i}`);
    }
    const page1 = await adminService.listPendingModules({ limit: 3, offset: 0 });
    const page2 = await adminService.listPendingModules({ limit: 3, offset: 3 });
    expect(page1.modules).toHaveLength(3);
    expect(page2.modules).toHaveLength(2);
    expect(page1.total).toBe(5);
  });
});

// ─────────────────────────────────────────────
// AdminService.adminCreateModule
// ─────────────────────────────────────────────

describe('AdminService.adminCreateModule', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('creates a module that is immediately verified and expert-approved', async () => {
    const admin = await seedAdminUser();
    const result = await adminService.adminCreateModule(admin.id, VALID_ADMIN_MODULE_DTO);
    expect(result.verified).toBe(true);
    expect(result.expertApproved).toBe(true);
    expect(result.submittedAt).not.toBeNull();
  });

  it('sets the admin as the creator', async () => {
    const admin = await seedAdminUser();
    const result = await adminService.adminCreateModule(admin.id, VALID_ADMIN_MODULE_DTO);
    expect(result.creatorId).toBe(admin.id);
  });

  it('persists all DTO fields to the database', async () => {
    const admin = await seedAdminUser();
    const result = await adminService.adminCreateModule(admin.id, VALID_ADMIN_MODULE_DTO);
    const inDb = await prisma.educationalModule.findUnique({ where: { id: result.id } });
    expect(inDb!.title).toBe(VALID_ADMIN_MODULE_DTO.title);
    expect(inDb!.completionIP).toBe(VALID_ADMIN_MODULE_DTO.completionIP);
  });
});

// ─────────────────────────────────────────────
// AdminService.approveModule
// ─────────────────────────────────────────────

describe('AdminService.approveModule', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('sets verified=true and clears rejectionReason', async () => {
    const creator = await seedModuleCreator();
    const mod = await seedSubmittedModule(creator.id);
    const result = await adminService.approveModule(mod.id);
    expect(result.verified).toBe(true);
    expect(result.expertApproved).toBe(true);
    expect(result.rejectionReason).toBeNull();
  });

  it('throws 400 for a module that has not been submitted (draft)', async () => {
    const creator = await seedModuleCreator();
    const mod = await seedDraftModule(creator.id);
    await expect(adminService.approveModule(mod.id)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 if module is already approved', async () => {
    const creator = await seedModuleCreator();
    const mod = await seedApprovedModule(creator.id);
    await expect(adminService.approveModule(mod.id)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 for an unknown moduleId', async () => {
    await expect(
      adminService.approveModule('00000000-0000-0000-0000-000000000000')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─────────────────────────────────────────────
// AdminService.rejectModule
// ─────────────────────────────────────────────

describe('AdminService.rejectModule', () => {
  beforeEach(async () => {
    await seedLocation();
  });

  it('sets rejectionReason and clears submittedAt', async () => {
    const creator = await seedModuleCreator();
    const mod = await seedSubmittedModule(creator.id);
    const result = await adminService.rejectModule(mod.id, 'Content is too brief.');
    expect(result.rejectionReason).toBe('Content is too brief.');
    expect(result.submittedAt).toBeNull();
    expect(result.verified).toBe(false);
  });

  it('throws 400 for a draft module (not submitted)', async () => {
    const creator = await seedModuleCreator();
    const mod = await seedDraftModule(creator.id);
    await expect(
      adminService.rejectModule(mod.id, 'Some reason here.')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 if module is already approved', async () => {
    const creator = await seedModuleCreator();
    const mod = await seedApprovedModule(creator.id);
    await expect(
      adminService.rejectModule(mod.id, 'Too late to reject.')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 for an unknown moduleId', async () => {
    await expect(
      adminService.rejectModule('00000000-0000-0000-0000-000000000000', 'No such module.')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
