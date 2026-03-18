/**
 * @file prisma/seed/core.ts
 * @description Core database seeding for UjamaaDAO — v2.1
 *
 * Seeds:
 * - System configuration
 * - Industries & Goods/Services
 * - Full Kenyan geography (counties → constituencies → wards)
 * - System groups (national, county, constituency, ward)
 * - Built-in roles
 * - Onboarding tutorials
 * - Test admin user (dev/test only)
 *
 * Safety:
 * - Blocks production runs unless FORCE_SEED=true
 * - Uses upsert to avoid duplicates
 * - Bulk operations for performance
 *
 * Version: 2.1 — January 2026
 */

import { prisma } from './client.js'; // ← Use the shared client
import { v4 as uuidv4 } from 'uuid';
import countiesData from '../data/counties.js';
import { industries as industriesList } from '../data/industries.js';
import { goodsServices as goodsList } from '../data/goodsServices.js';

// ============================================================================
// SAFETY CHECK
// ============================================================================

if (
  process.env.NODE_ENV === 'production' &&
  process.env.FORCE_SEED !== 'true'
) {
  console.error('🚫 ERROR: Seeding is disabled in production.');
  console.error('   To override, run with FORCE_SEED=true');
  process.exit(1);
}

console.log(`🌱 Starting core seeding in ${process.env.NODE_ENV} mode...\n`);
// ============================================================================
// 1. SYSTEM CONFIGURATION
// ============================================================================

async function seedSystemConfiguration() {
  console.log('Seeding system configuration...');

  const configs = [
    // Voting thresholds
    {
      key: 'voting.quorum.community',
      value: 0.4,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'Community initiative quorum',
      isPublic: true,
    },
    {
      key: 'voting.approval.community',
      value: 0.5,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'Community initiative approval threshold',
      isPublic: true,
    },
    {
      key: 'voting.period.community',
      value: 7,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'Community initiative voting period (days)',
      isPublic: true,
    },

    {
      key: 'voting.quorum.major',
      value: 0.5,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'Major project quorum',
      isPublic: true,
    },
    {
      key: 'voting.approval.major',
      value: 0.6,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'Major project approval threshold',
      isPublic: true,
    },
    {
      key: 'voting.period.major',
      value: 14,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'Major project voting period (days)',
      isPublic: true,
    },

    {
      key: 'voting.quorum.strategic',
      value: 0.6,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'Strategic decision quorum',
      isPublic: true,
    },
    {
      key: 'voting.approval.strategic',
      value: 0.66,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'Strategic decision approval threshold',
      isPublic: true,
    },
    {
      key: 'voting.period.strategic',
      value: 21,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'Strategic decision voting period (days)',
      isPublic: true,
    },

    {
      key: 'voting.quorum.emergency',
      value: 0.3,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'Emergency proposal quorum',
      isPublic: true,
    },
    {
      key: 'voting.approval.emergency',
      value: 0.6,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'Emergency proposal approval threshold',
      isPublic: true,
    },
    {
      key: 'voting.period.emergency',
      value: 3,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'Emergency proposal voting period (days)',
      isPublic: true,
    },

    // Dues
    {
      key: 'dues.tier.ordinary',
      value: 60,
      category: 'ECONOMY',
      dataType: 'NUMBER',
      description: 'Ordinary monthly dues (KES)',
      isPublic: true,
    },
    {
      key: 'dues.tier.supporter',
      value: 200,
      category: 'ECONOMY',
      dataType: 'NUMBER',
      description: 'Supporter monthly dues (KES)',
      isPublic: true,
    },
    {
      key: 'dues.tier.sponsor',
      value: 1000,
      category: 'ECONOMY',
      dataType: 'NUMBER',
      description: 'Sponsor monthly dues (KES)',
      isPublic: true,
    },
    {
      key: 'dues.grace_period',
      value: 30,
      category: 'ECONOMY',
      dataType: 'NUMBER',
      description: 'Dues grace period (days)',
      isPublic: true,
    },

    // Impact Points
    {
      key: 'ip.decay.monthly_rate',
      value: 0.1,
      category: 'REPUTATION',
      dataType: 'NUMBER',
      description: 'Monthly IP decay rate',
      isPublic: true,
    },
    {
      key: 'ip.decay.active_user_rate',
      value: 0.05,
      category: 'REPUTATION',
      dataType: 'NUMBER',
      description: 'Active user reduced decay rate',
      isPublic: true,
    },
    {
      key: 'ip.grace_period_months',
      value: 3,
      category: 'REPUTATION',
      dataType: 'NUMBER',
      description: 'No decay for first N months',
      isPublic: true,
    },

    // Participation Rights
    {
      key: 'pr.monthly_regen',
      value: 25,
      category: 'REPUTATION',
      dataType: 'NUMBER',
      description: 'Base monthly PR regeneration',
      isPublic: true,
    },
    {
      key: 'pr.max_balance',
      value: 500,
      category: 'REPUTATION',
      dataType: 'NUMBER',
      description: 'Maximum PR balance',
      isPublic: true,
    },
    {
      key: 'pr.low_warning',
      value: 20,
      category: 'REPUTATION',
      dataType: 'NUMBER',
      description: 'Low PR warning threshold',
      isPublic: true,
    },

    // PR from dues
    {
      key: 'pr.dues.ordinary',
      value: 100,
      category: 'ECONOMY',
      dataType: 'NUMBER',
      description: 'PR from ordinary dues',
      isPublic: true,
    },
    {
      key: 'pr.dues.supporter',
      value: 200,
      category: 'ECONOMY',
      dataType: 'NUMBER',
      description: 'PR from supporter dues',
      isPublic: true,
    },
    {
      key: 'pr.dues.sponsor',
      value: 500,
      category: 'ECONOMY',
      dataType: 'NUMBER',
      description: 'PR from sponsor dues',
      isPublic: true,
    },

    // PR costs
    {
      key: 'pr.cost.vote',
      value: 5,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'PR cost to vote',
      isPublic: true,
    },
    {
      key: 'pr.cost.proposal.ward',
      value: 50,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'PR cost for ward proposal',
      isPublic: true,
    },
    {
      key: 'pr.cost.proposal.constituency',
      value: 100,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'PR cost for constituency proposal',
      isPublic: true,
    },
    {
      key: 'pr.cost.proposal.county',
      value: 150,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'PR cost for county proposal',
      isPublic: true,
    },
    {
      key: 'pr.cost.proposal.national',
      value: 200,
      category: 'GOVERNANCE',
      dataType: 'NUMBER',
      description: 'PR cost for national proposal',
      isPublic: true,
    },
    {
      key: 'pr.cost.group_create',
      value: 100,
      category: 'COMMUNITY',
      dataType: 'NUMBER',
      description: 'PR cost to create group',
      isPublic: true,
    },

    // Onboarding rewards
    {
      key: 'onboarding.email_verified.ip',
      value: 50,
      category: 'REPUTATION',
      dataType: 'NUMBER',
      description: 'IP reward for email verification',
      isPublic: true,
    },
    {
      key: 'onboarding.email_verified.pr',
      value: 25,
      category: 'REPUTATION',
      dataType: 'NUMBER',
      description: 'PR reward for email verification',
      isPublic: true,
    },
    {
      key: 'onboarding.profile_complete.ip',
      value: 25,
      category: 'REPUTATION',
      dataType: 'NUMBER',
      description: 'IP reward for profile completion',
      isPublic: true,
    },
    {
      key: 'onboarding.wallet_connected.ip',
      value: 200,
      category: 'REPUTATION',
      dataType: 'NUMBER',
      description: 'IP reward for wallet connection',
      isPublic: true,
    },
    {
      key: 'onboarding.wallet_connected.pr',
      value: 100,
      category: 'REPUTATION',
      dataType: 'NUMBER',
      description: 'PR reward for wallet connection',
      isPublic: true,
    },
    {
      key: 'onboarding.phone_verified.ip',
      value: 100,
      category: 'REPUTATION',
      dataType: 'NUMBER',
      description: 'IP reward for phone verification',
      isPublic: true,
    },
    {
      key: 'onboarding.phone_verified.pr',
      value: 25,
      category: 'REPUTATION',
      dataType: 'NUMBER',
      description: 'PR reward for phone verification',
      isPublic: true,
    },
  ];

  let created = 0;
  for (const config of configs) {
    const result = await prisma.systemConfiguration.upsert({
      where: { key: config.key },
      update: {
        value: config.value,
        description: config.description,
      },
      create: {
        id: uuidv4(),
        key: config.key,
        value: config.value,
        category: config.category,
        dataType: config.dataType,
        description: config.description,
        isPublic: config.isPublic ?? false,
      },
    });

    if (result) created++;
  }

  console.log(`   Created/updated ${created} system configuration entries`);
}

// ============================================================================
// 2. INDUSTRIES & GOODS/SERVICES
// ============================================================================

async function seedIndustriesAndGoods() {
  console.log('Seeding industries and goods/services...');

  // Industries
  const industryData = industriesList.map((name: string) => ({
    id: uuidv4(),
    name,
  }));

  await prisma.industry.createMany({
    data: industryData,
    skipDuplicates: true,
  });

  const industries = await prisma.industry.findMany();
  const industryMap = new Map(industries.map((i) => [i.name, i.id]));

  console.log(`   Created/ensured ${industries.length} industries`);

  // Goods/Services
  const validGoods = goodsList
    .map((good: any) => {
      const industryId = industryMap.get(good.industry);
      if (!industryId) {
        console.warn(
          `   Skipping "${good.name}" — industry "${good.industry}" not found`
        );
        return null;
      }
      return {
        id: uuidv4(),
        name: good.name,
        industryId,
        category: good.category || null,
        active: true,
      };
    })
    .filter(Boolean);

  await prisma.goodsService.createMany({
    data: validGoods as any,
    skipDuplicates: true,
  });

  console.log(`   Created/ensured ${validGoods.length} goods/services`);
}

// ============================================================================
// 3. GEOGRAPHY — Full Kenya
// ============================================================================

async function seedGeography() {
  console.log('Seeding Kenyan geography...');

  // Clear existing data
  await prisma.$transaction([
    prisma.ward.deleteMany(),
    prisma.constituency.deleteMany(),
    prisma.county.deleteMany(),
  ]);

  let counties = 0,
    constituencies = 0,
    wards = 0;

  const countyCreates = [];
  const constituencyCreates = [];
  const wardCreates = [];

  for (const county of countiesData) {
    if (!county.code || !county.name) {
      console.warn(`Skipping invalid county:`, county);
      continue;
    }

    const countyId = uuidv4();
    countyCreates.push({
      id: countyId,
      code: county.code,
      name: county.name,
    });
    counties++;

    for (const cons of county.constituencies ?? []) {
      if (!cons.name) continue;

      const consId = uuidv4();
      constituencyCreates.push({
        id: consId,
        name: cons.name,
        countyId,
      });
      constituencies++;

      const uniqueWards = [...new Set(cons.wards ?? [])].filter(Boolean);
      for (const wardName of uniqueWards) {
        wardCreates.push({
          id: uuidv4(),
          name: wardName,
          constituencyId: consId,
          countyId,
          code: null, // or generate if you have codes
        });
        wards++;
      }
    }
  }

  // Bulk create everything
  await prisma.county.createMany({ data: countyCreates });
  await prisma.constituency.createMany({ data: constituencyCreates });
  await prisma.ward.createMany({ data: wardCreates });

  console.log(
    `Created ${counties} counties, ${constituencies} constituencies, ${wards} wards`
  );
}
// ============================================================================
// 4. SYSTEM GROUPS
// ============================================================================

async function seedSystemGroups() {
  console.log('Creating system groups...');

  const [national, counties, constituencies, wards] = await Promise.all([
    prisma.group.upsert({
      where: { name: 'Kenya National Community' },
      update: {},
      create: {
        id: uuidv4(),
        name: 'Kenya National Community',
        description: 'National-level governance for all members',
        locationScope: 'NATIONAL',
        isSystemGroup: true,
        systemType: 'NATIONAL',
        canBeDeleted: false,
        canBeRenamed: false,
        status: 'ACTIVE',
      },
    }),
    prisma.county.findMany(),
    prisma.constituency.findMany(),
    prisma.ward.findMany(),
  ]);

  const groupData = [
    ...counties.map((c) => ({
      id: uuidv4(),
      name: `${c.name} County Community`,
      description: `County-level community for ${c.name}`,
      locationScope: 'COUNTY' as const,
      countyId: c.id,
      isSystemGroup: true,
      systemType: 'COUNTY' as const,
      canBeDeleted: false,
      canBeRenamed: false,
      status: 'ACTIVE' as const,
    })),
    ...constituencies.map((c) => ({
      id: uuidv4(),
      name: `${c.name} Constituency Community`,
      description: `Constituency community for ${c.name}`,
      locationScope: 'CONSTITUENCY' as const,
      constituencyId: c.id,
      countyId: c.countyId,
      isSystemGroup: true,
      systemType: 'CONSTITUENCY' as const,
      canBeDeleted: false,
      canBeRenamed: false,
      status: 'ACTIVE' as const,
    })),
    ...wards.map((w) => ({
      id: uuidv4(),
      name: `${w.name} Ward Community`,
      description: `Local community for ${w.name} Ward`,
      locationScope: 'WARD' as const,
      wardId: w.id,
      constituencyId: w.constituencyId,
      countyId: w.countyId,
      isSystemGroup: true,
      systemType: 'WARD' as const,
      canBeDeleted: false,
      canBeRenamed: false,
      status: 'ACTIVE' as const,
    })),
  ];

  await prisma.group.createMany({
    data: groupData,
    skipDuplicates: true,
  });

  console.log(
    `   Created 1 national + ${counties.length} county + ${constituencies.length} constituency + ${wards.length} ward groups`
  );
}

// ============================================================================
// 5. ROLES
// ============================================================================

async function seedRoles() {
  console.log('Seeding built-in roles...');

  const roles = [
    {
      name: 'system:super_admin',
      namespace: 'system',
      description: 'Full platform access',
      builtin: true,
    },
    {
      name: 'system:auditor',
      namespace: 'system',
      description: 'Read-only audit access',
      builtin: true,
    },
    {
      name: 'system:support',
      namespace: 'system',
      description: 'User support and moderation',
      builtin: true,
    },
    {
      name: 'system:compliance_officer',
      namespace: 'system',
      description: 'User verification and platform rule enforcement',
      builtin: true,
    },
    {
      name: 'system:county_coordinator',
      namespace: 'system',
      description:
        'County-level elected observer and coordinator (one per county, 47 total)',
      builtin: true,
    },
    {
      name: 'system:blockchain_admin',
      namespace: 'system',
      description:
        'Manages smart contracts — deploy, upgrade governor contracts, emergency pauses. Technical only, no governance override.',
      builtin: true,
    },
    {
      name: 'system:contract_deployer',
      namespace: 'system',
      description: 'Can deploy new smart contracts to the blockchain',
      builtin: true,
    },
    {
      name: 'system:multisig_signer',
      namespace: 'system',
      description:
        'Signs critical on-chain transactions, required for treasury operations',
      builtin: true,
    },

    {
      name: 'location:ward_admin',
      namespace: 'location',
      description: 'Ward administrator',
      builtin: true,
    },
    {
      name: 'location:constituency_admin',
      namespace: 'location',
      description: 'Constituency administrator',
      builtin: true,
    },
    {
      name: 'location:county_admin',
      namespace: 'location',
      description: 'County administrator',
      builtin: true,
    },

    {
      name: 'group:leader',
      namespace: 'group',
      description: 'Group leader',
      builtin: true,
    },
    {
      name: 'group:treasurer',
      namespace: 'group',
      description: 'Group treasurer',
      builtin: true,
    },
    {
      name: 'group:admin',
      namespace: 'group',
      description: 'Group administrator',
      builtin: true,
    },
    {
      name: 'group:auditor',
      namespace: 'group',
      description: 'Group auditor',
      builtin: true,
    },

    {
      name: 'project:manager',
      namespace: 'project',
      description: 'Project manager',
      builtin: true,
    },
    {
      name: 'project:verifier',
      namespace: 'project',
      description: 'Milestone verifier',
      builtin: true,
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: {
        id: uuidv4(),
        name: role.name,
        description: role.description,
      },
    });
  }

  console.log(`   Created/ensured ${roles.length} built-in roles`);
}

// ============================================================================
// 6. ONBOARDING TUTORIALS
// ============================================================================

async function seedOnboardingTutorials() {
  console.log('Seeding onboarding tutorials...');

  const tutorials = [
    {
      key: 'platform_intro',
      title: 'Welcome to UjamaaDAO',
      description: 'Introduction to the platform',
      category: 'BASICS',
      order: 1,
      ipReward: 25,
      prReward: 10,
      estimatedMinutes: 5,
      requiredFor: null,
      isOptional: false,
    },
    {
      key: 'governance_basics',
      title: 'How Governance Works',
      description: 'Proposals, voting, and decision making',
      category: 'GOVERNANCE',
      order: 2,
      ipReward: 50,
      prReward: 25,
      estimatedMinutes: 10,
      requiredFor: 'VOTING',
      isOptional: false,
    },
    // Add more as needed...
  ];

  for (const tutorial of tutorials) {
    await prisma.onboardingTutorial.upsert({
      where: { key: tutorial.key },
      update: {},
      create: {
        id: uuidv4(),
        ...tutorial,
        active: true,
        content: { steps: [] }, // Placeholder
      },
    });
  }

  console.log(`   Created/ensured ${tutorials.length} tutorials`);
}

// ============================================================================
// 7. TEST ADMIN USER (dev/test only)
// ============================================================================

async function seedTestAdmin() {
  if (process.env.NODE_ENV === 'production') {
    console.log('   Skipping test admin in production');
    return;
  }

  console.log('   Creating test admin user...');

  const firstWard = await prisma.ward.findFirst();
  if (!firstWard) {
    console.warn('   No ward found — skipping test admin');
    return;
  }

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ujamaa.test' },
    update: {
      // Always keep the admin fully verified and in a ward (fixes re-seed after ward data added)
      primaryWardId: firstWard.id,
      verificationLevel: 'FULL_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
    },
    create: {
      id: uuidv4(),
      email: 'admin@ujamaa.test',
      name: 'System Administrator',
      phoneNumber: '+254700000000',
      primaryWardId: firstWard.id,
      verificationLevel: 'FULL_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      participationRights: 1000,
      globalImpactPoints: 10000,
    },
  });

  const superRole = await prisma.role.findUnique({
    where: { name: 'system:super_admin' },
  });
  if (superRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: adminUser.id, roleId: superRole.id },
      },
      update: {},
      create: {
        id: uuidv4(),
        userId: adminUser.id,
        roleId: superRole.id,
        active: true,
      },
    });
  }

  // Also give admin ward_admin role for dev testing of the proposal review chain
  const wardAdminRole = await prisma.role.findUnique({
    where: { name: 'location:ward_admin' },
  });
  if (wardAdminRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: adminUser.id, roleId: wardAdminRole.id },
      },
      update: { active: true },
      create: {
        id: uuidv4(),
        userId: adminUser.id,
        roleId: wardAdminRole.id,
        active: true,
      },
    });
  }

  console.log(
    `   Created admin@ujamaa.test with super admin + ward admin roles`
  );
}

// ============================================================================
// 8b. TEST USERS — Role coverage + governance test data (dev/test only)
// ============================================================================

async function seedTestUsers() {
  if (process.env.NODE_ENV === 'production') {
    console.log('   Skipping test users in production');
    return;
  }

  console.log(
    '   Seeding test users (role coverage + governance test data)...'
  );

  const firstWard = await prisma.ward.findFirst({
    include: { constituency: { include: { county: true } } },
  });
  if (!firstWard) {
    console.warn('   No ward found — skipping test users');
    return;
  }

  const COMMON_FIELDS = {
    emailVerified: true,
    phoneVerified: true,
    communityVerified: true,
    verificationLevel: 'COMMUNITY_VERIFIED' as const,
    participationRights: 500,
    globalImpactPoints: 200,
    primaryWardId: firstWard.id,
  };

  type TestUser = {
    email: string;
    name: string;
    phoneNumber: string;
    role?: string;
    verificationLevel?: string;
  };
  const testUsers: TestUser[] = [
    {
      email: 'compliance@ujamaa.test',
      name: 'Compliance Officer',
      phoneNumber: '+254700000001',
      role: 'system:compliance_officer',
      verificationLevel: 'FULL_VERIFIED',
    },
    {
      email: 'auditor@ujamaa.test',
      name: 'System Auditor',
      phoneNumber: '+254700000005',
      role: 'system:auditor',
      verificationLevel: 'FULL_VERIFIED',
    },
    {
      email: 'coordinator@ujamaa.test',
      name: 'County Coordinator',
      phoneNumber: '+254700000006',
      role: 'system:county_coordinator',
      verificationLevel: 'FULL_VERIFIED',
    },
    {
      email: 'ward.admin@ujamaa.test',
      name: 'Ward Administrator',
      phoneNumber: '+254700000002',
      role: 'location:ward_admin',
      verificationLevel: 'FULL_VERIFIED',
    },
    {
      email: 'constituency.admin@ujamaa.test',
      name: 'Constituency Administrator',
      phoneNumber: '+254700000003',
      role: 'location:constituency_admin',
      verificationLevel: 'FULL_VERIFIED',
    },
    {
      email: 'county.admin@ujamaa.test',
      name: 'County Administrator',
      phoneNumber: '+254700000004',
      role: 'location:county_admin',
      verificationLevel: 'FULL_VERIFIED',
    },
    {
      email: 'waichari@ujamaa.test',
      name: 'James Waichari',
      phoneNumber: '+254700000010',
    },
    {
      email: 'akinyi@ujamaa.test',
      name: 'Grace Akinyi',
      phoneNumber: '+254700000011',
    },
    {
      email: 'otieno@ujamaa.test',
      name: 'Kevin Otieno',
      phoneNumber: '+254700000012',
    },
  ];

  // PHONE_VERIFIED user — for testing verification flow UX
  await prisma.user.upsert({
    where: { email: 'phone-only@ujamaa.test' },
    update: { primaryWardId: firstWard.id, verificationLevel: 'PHONE_VERIFIED' },
    create: {
      id: uuidv4(),
      email: 'phone-only@ujamaa.test',
      name: 'Amina Phone-Only',
      phoneNumber: '+254700000020',
      primaryWardId: firstWard.id,
      verificationLevel: 'PHONE_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: false,
      participationRights: 0,
      globalImpactPoints: 0,
    },
  });

  // EMAIL_VERIFIED user — for testing onboarding / nudge UX
  await prisma.user.upsert({
    where: { email: 'email-only@ujamaa.test' },
    update: { primaryWardId: firstWard.id, verificationLevel: 'EMAIL_VERIFIED' },
    create: {
      id: uuidv4(),
      email: 'email-only@ujamaa.test',
      name: 'Brian Email-Only',
      phoneNumber: '+254700000021',
      primaryWardId: firstWard.id,
      verificationLevel: 'EMAIL_VERIFIED',
      emailVerified: true,
      phoneVerified: false,
      communityVerified: false,
      participationRights: 50,
      globalImpactPoints: 0,
    },
  });

  // FULL_VERIFIED member without special roles — wallet connected
  await prisma.user.upsert({
    where: { email: 'full-member@ujamaa.test' },
    update: { primaryWardId: firstWard.id, verificationLevel: 'FULL_VERIFIED' },
    create: {
      id: uuidv4(),
      email: 'full-member@ujamaa.test',
      name: 'Wanjiru Full-Member',
      phoneNumber: '+254700000022',
      primaryWardId: firstWard.id,
      verificationLevel: 'FULL_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      walletAddress: '0xfullmember000000000000000000000000000001',
      participationRights: 200,
      globalImpactPoints: 500,
    },
  });

  const createdUsers: Record<string, string> = {};

  for (const u of testUsers) {
    const verificationLevel = (u.verificationLevel ??
      COMMON_FIELDS.verificationLevel) as
      | 'COMMUNITY_VERIFIED'
      | 'FULL_VERIFIED';
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { primaryWardId: firstWard.id, verificationLevel },
      create: {
        id: uuidv4(),
        email: u.email,
        name: u.name,
        phoneNumber: u.phoneNumber,
        ...COMMON_FIELDS,
        verificationLevel,
      },
    });
    createdUsers[u.email] = user.id;

    if (u.role) {
      const roleRecord = await prisma.role.findUnique({
        where: { name: u.role },
      });
      if (roleRecord) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: roleRecord.id } },
          update: { active: true },
          create: {
            id: uuidv4(),
            userId: user.id,
            roleId: roleRecord.id,
            active: true,
          },
        });
      }
    }
  }

  // Seed voluntary group: Kayole Borehole Committee
  const boreholeGroup = await prisma.group
    .upsert({
      where: {
        name_wardId: {
          name: 'Kayole Borehole Committee',
          wardId: firstWard.id,
        },
      } as any,
      update: {},
      create: {
        id: uuidv4(),
        name: 'Kayole Borehole Committee',
        description:
          'Community borehole construction and maintenance committee',
        isSystemGroup: false,
        locationScope: 'WARD',
        voluntaryType: 'INFRASTRUCTURE_COMMITTEE',
        wardId: firstWard.id,
        memberCount: 0,
      },
    })
    .catch(async () => {
      // fallback if unique constraint differs
      const existing = await prisma.group.findFirst({
        where: { name: 'Kayole Borehole Committee', wardId: firstWard.id },
      });
      return (
        existing ??
        (await prisma.group.create({
          data: {
            id: uuidv4(),
            name: 'Kayole Borehole Committee',
            description:
              'Community borehole construction and maintenance committee',
            isSystemGroup: false,
            locationScope: 'WARD',
            voluntaryType: 'INFRASTRUCTURE_COMMITTEE',
            wardId: firstWard.id,
            memberCount: 0,
          },
        }))
      );
    });

  // Add test users to borehole group
  const groupMembers = [
    { email: 'waichari@ujamaa.test', role: 'LEADER' },
    { email: 'akinyi@ujamaa.test', role: 'MEMBER' },
    { email: 'otieno@ujamaa.test', role: 'MEMBER' },
  ];

  let memberCount = 0;
  for (const m of groupMembers) {
    const userId = createdUsers[m.email];
    if (!userId) continue;
    await prisma.groupMember.upsert({
      where: { userId_groupId: { userId, groupId: boreholeGroup.id } },
      update: {},
      create: {
        userId,
        groupId: boreholeGroup.id,
        role: m.role as any,
        autoEnrolled: false,
        canLeave: true,
        joinedAt: new Date(),
        active: true,
      },
    });
    memberCount++;
  }

  await prisma.group.update({
    where: { id: boreholeGroup.id },
    data: { memberCount },
  });

  // Seed test proposals
  const waichariId = createdUsers['waichari@ujamaa.test'];
  if (waichariId) {
    // DRAFT proposal
    const existing1 = await prisma.proposal.findFirst({
      where: { title: 'New Community Borehole', creatorId: waichariId },
    });
    if (!existing1) {
      await prisma.proposal.create({
        data: {
          id: uuidv4(),
          groupId: boreholeGroup.id,
          creatorId: waichariId,
          title: 'New Community Borehole',
          description:
            'Proposal to drill a new borehole in Kayole Ward to address water scarcity affecting 5,000 residents.',
          status: 'DRAFT',
          proposalType: 'COMMUNITY_INITIATIVE',
          proposalScope: 'COMMUNITY',
          budget: 350000,
        },
      });
    }

    // PENDING_REVIEW proposal
    const existing2 = await prisma.proposal.findFirst({
      where: { title: 'Road Maintenance Request', creatorId: waichariId },
    });
    if (!existing2) {
      await prisma.proposal.create({
        data: {
          id: uuidv4(),
          groupId: boreholeGroup.id,
          creatorId: waichariId,
          title: 'Road Maintenance Request',
          description:
            'Request for maintenance of the main access road connecting Kayole to Embakasi Road.',
          status: 'PENDING_REVIEW',
          proposalType: 'COMMUNITY_INITIATIVE',
          proposalScope: 'COMMUNITY',
          budget: 150000,
        },
      });
    }

    // APPROVED_FOR_VOTING proposal
    const existing3 = await prisma.proposal.findFirst({
      where: { title: 'Youth Skills Programme', creatorId: waichariId },
    });
    if (!existing3) {
      await prisma.proposal.create({
        data: {
          id: uuidv4(),
          groupId: boreholeGroup.id,
          creatorId: waichariId,
          title: 'Youth Skills Programme',
          description:
            'Six-month vocational skills programme for unemployed youth aged 18–35 in Kayole Ward.',
          status: 'APPROVED_FOR_VOTING',
          proposalType: 'COMMUNITY_INITIATIVE',
          proposalScope: 'COMMUNITY',
          budget: 200000,
        },
      });
    }
  }

  console.log(
    `   Created ${testUsers.length} test users, 1 voluntary group, 3 test proposals`
  );
}

// ============================================================================
// 8. EDUCATION MODULES (template modules about the system itself)
// ============================================================================

async function seedEducationModules() {
  if (process.env.NODE_ENV === 'production') {
    console.log('   Skipping education module seed in production');
    return;
  }

  console.log('   Seeding education modules...');

  const admin = await prisma.user.findUnique({
    where: { email: 'admin@ujamaa.test' },
  });
  if (!admin) {
    console.warn('   admin@ujamaa.test not found — skipping education modules');
    return;
  }

  const modules = [
    {
      title: 'What is UjamaaDAO?',
      description:
        'An introduction to UjamaaDAO — what it is, why it was built, and how it empowers Kenyan ward communities through collective governance and economic cooperation.',
      content: `# What is UjamaaDAO?

UjamaaDAO is a community-owned digital platform designed to strengthen local governance and economic cooperation at the ward level in Kenya.

## The name

"Ujamaa" is a Swahili word meaning *familyhood* or *cooperative economics*. It reflects the founding belief that communities grow strongest when members invest in one another.

"DAO" stands for *Decentralised Autonomous Organisation* — a structure where decisions are made collectively by members, with rules encoded transparently on a blockchain rather than sitting with a single authority.

## Why it was built

Kenya's 1,450 wards are the smallest unit of government, yet most civic participation tools are designed for national or county use. UjamaaDAO fills this gap by giving each ward its own governed community: a space to propose projects, vote on spending, organise local markets, and track collective progress.

## The four pillars

1. **Identity & Verification** — Members verify their ward residency through community vouching (3 neighbours confirm you live there) or a one-time KES 100 payment. This makes the system Sybil-resistant and locally accountable.

2. **Participation Rights (PR)** — A non-transferable score that measures your right to participate. You earn PR by paying dues, completing education, attending barazas, and contributing to projects. You spend PR to vote and create proposals.

3. **Impact Points (IP)** — A reputation score for your contributions. IP decays slowly over time to reward sustained engagement over one-off actions.

4. **Governance** — Any verified member can propose a project or community initiative. Proposals go through a transparent voting window; passing proposals become funded projects with trackable milestones.

## What you can do on UjamaaDAO

- **Learn** — Complete education modules (like this one) to earn IP and deepen your civic knowledge.
- **Govern** — Create or vote on proposals for your ward.
- **Contribute** — Join project teams, complete milestones, and earn rewards.
- **Trade** — List skills and goods in the ward marketplace (discovery only — no platform payments).
- **Connect** — Join your ward's Telegram/WhatsApp baraza and have your attendance recorded on-chain.

## The blockchain layer

PR and Utility Tokens (UT) are minted on Base (an Ethereum Layer 2). This means your participation record is publicly verifiable and can never be altered by any single actor — including the platform team.

## Getting started

1. Verify your email → complete your profile → verify your phone.
2. Get community-verified by three ward neighbours.
3. Start participating: vote, learn, propose, contribute.

Every action you take here strengthens your ward. Welcome to UjamaaDAO.`,
      duration: 15,
      difficulty: 'BEGINNER' as const,
      category: 'civic',
      completionIP: 25,
      verified: true,
      expertApproved: true,
    },
    {
      title: 'Understanding Participation Rights (PR)',
      description:
        'Learn how Participation Rights work, how to earn them, how they are spent, and why they are non-transferable.',
      content: `# Understanding Participation Rights (PR)

Participation Rights (PR) are your democratic currency on UjamaaDAO. Unlike money, they cannot be bought, sold, or given away — they must be *earned* through genuine community participation.

## What PR measures

PR is a measure of your *right to participate* at any given moment. A high PR balance signals that you have been actively engaged with your community recently. A low balance means you may need to re-engage before you can take certain actions.

## Earning PR

| Action | PR earned |
|--------|-----------|
| Email verification | +25 |
| Phone verification | +25 |
| Monthly dues (ordinary, KES 60) | +100 |
| Monthly dues (supporter, KES 200) | +200 |
| Monthly dues (sponsor, KES 1,000) | +500 |
| Completing an education module | varies |
| Attending a baraza | +10 |
| Wallet connection | +100 |

## Spending PR

| Action | PR cost |
|--------|---------|
| Casting a vote | 5 |
| Ward proposal | 50 |
| Constituency proposal | 100 |
| County proposal | 150 |
| National proposal | 200 |
| Creating a community group | 100 |

## PR regeneration

Your PR balance regenerates by **25 PR per month** automatically, as long as your account is active. This means even members who are temporarily inactive don't lose their ability to re-engage.

## Maximum balance

The maximum PR balance is **500**. There is no benefit to accumulating PR beyond this cap — the system is designed to reward consistent participation, not hoarding.

## Why PR is non-transferable

PR cannot be transferred between users. This design choice is intentional:

- It prevents wealthy members from buying influence.
- It ensures every vote represents genuine community engagement.
- It makes the governance system resistant to capture by outside interests.

PR is recorded on the Base blockchain, meaning your participation history is transparent and tamper-proof.

## Low PR warning

When your balance falls below **20 PR**, you will see a warning in your dashboard. This is your signal to re-engage: attend a baraza, pay dues, or complete an education module.`,
      duration: 10,
      difficulty: 'BEGINNER' as const,
      category: 'governance',
      completionIP: 20,
      verified: true,
      expertApproved: true,
    },
    {
      title: 'How Governance Works',
      description:
        'A step-by-step guide to proposals, voting thresholds, quorums, and how ward decisions become funded projects.',
      content: `# How Governance Works

UjamaaDAO's governance system allows any community-verified member to propose ideas and have them decided by collective vote. Here is how the process works from start to finish.

## Step 1 — Create a proposal

Any verified member with sufficient PR can create a proposal. The cost depends on the scope:

- **Ward** (affects your ward only) — 50 PR
- **Constituency** — 100 PR
- **County** — 150 PR
- **National** — 200 PR

A proposal includes a title, description, and optionally a requested funding amount in KES. Proposals can also include milestones — measurable checkpoints for how the project will be delivered.

## Step 2 — The voting window opens

After creation, a proposal enters a *voting window*. The length depends on the proposal type:

| Type | Voting period |
|------|--------------|
| Community initiative | 7 days |
| Major project | 14 days |
| Strategic decision | 21 days |
| Emergency | 3 days |

During this window, eligible members can vote YES, NO, or ABSTAIN. Each vote costs **5 PR**.

## Step 3 — Quorum and approval thresholds

For a proposal to pass, two conditions must be met:

1. **Quorum** — A minimum percentage of eligible voters must have voted.
2. **Approval threshold** — A minimum percentage of votes must be YES.

| Proposal type | Quorum required | Approval required |
|--------------|-----------------|-------------------|
| Community | 40% | 50% |
| Major | 50% | 60% |
| Strategic | 60% | 66% |
| Emergency | 30% | 60% |

## Step 4 — Execution

If a proposal passes, it becomes an approved project. A project manager can then:

1. Break the work into milestones.
2. Assign team members.
3. Submit milestone completions with proof (photos, receipts, links).
4. Have milestones verified by designated verifiers.

Verified milestones trigger IP and PR awards to the contributors.

## Transparency

All votes, proposal texts, and results are stored immutably. No administrator can delete a proposal or alter vote counts after the window closes.

## Tips for a strong proposal

- Be specific: what exactly will be built or changed?
- Include a realistic budget with line items.
- Break large work into 3–5 milestones.
- Link your proposal to a baraza discussion so the community has context before voting.`,
      duration: 12,
      difficulty: 'BEGINNER' as const,
      category: 'governance',
      completionIP: 30,
      verified: true,
      expertApproved: true,
    },
  ];

  for (const mod of modules) {
    const existing = await prisma.educationalModule.findFirst({
      where: { title: mod.title, creatorId: admin.id },
      select: { id: true },
    });

    if (existing) {
      await prisma.educationalModule.update({
        where: { id: existing.id },
        data: {
          description: mod.description,
          content: mod.content,
          verified: mod.verified,
          completionIP: mod.completionIP,
        },
      });
    } else {
      await prisma.educationalModule.create({
        data: {
          id: uuidv4(),
          creatorId: admin.id,
          ...mod,
          mediaUrls: [],
        },
      });
    }
  }

  console.log(`   Created/ensured ${modules.length} education modules`);
}

// ============================================================================
// MAIN SEED EXECUTION
// ============================================================================

async function main() {
  try {
    await seedSystemConfiguration();
    await seedIndustriesAndGoods();
    await seedGeography();
    await seedSystemGroups();
    await seedRoles();
    await seedOnboardingTutorials();
    await seedTestAdmin();
    await seedTestUsers();
    await seedEducationModules();

    console.log('\n✅ Core seeding completed successfully!');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
