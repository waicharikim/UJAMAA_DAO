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

if (process.env.NODE_ENV === 'production' && process.env.FORCE_SEED !== 'true') {
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
    { key: 'voting.quorum.community', value: 0.40, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'Community initiative quorum', isPublic: true },
    { key: 'voting.approval.community', value: 0.50, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'Community initiative approval threshold', isPublic: true },
    { key: 'voting.period.community', value: 7, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'Community initiative voting period (days)', isPublic: true },

    { key: 'voting.quorum.major', value: 0.50, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'Major project quorum', isPublic: true },
    { key: 'voting.approval.major', value: 0.60, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'Major project approval threshold', isPublic: true },
    { key: 'voting.period.major', value: 14, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'Major project voting period (days)', isPublic: true },

    { key: 'voting.quorum.strategic', value: 0.60, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'Strategic decision quorum', isPublic: true },
    { key: 'voting.approval.strategic', value: 0.66, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'Strategic decision approval threshold', isPublic: true },
    { key: 'voting.period.strategic', value: 21, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'Strategic decision voting period (days)', isPublic: true },

    { key: 'voting.quorum.emergency', value: 0.30, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'Emergency proposal quorum', isPublic: true },
    { key: 'voting.approval.emergency', value: 0.60, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'Emergency proposal approval threshold', isPublic: true },
    { key: 'voting.period.emergency', value: 3, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'Emergency proposal voting period (days)', isPublic: true },

    // Dues
    { key: 'dues.tier.ordinary', value: 60, category: 'ECONOMY', dataType: 'NUMBER', description: 'Ordinary monthly dues (KES)', isPublic: true },
    { key: 'dues.tier.supporter', value: 200, category: 'ECONOMY', dataType: 'NUMBER', description: 'Supporter monthly dues (KES)', isPublic: true },
    { key: 'dues.tier.sponsor', value: 1000, category: 'ECONOMY', dataType: 'NUMBER', description: 'Sponsor monthly dues (KES)', isPublic: true },
    { key: 'dues.grace_period', value: 30, category: 'ECONOMY', dataType: 'NUMBER', description: 'Dues grace period (days)', isPublic: true },

    // Impact Points
    { key: 'ip.decay.monthly_rate', value: 0.10, category: 'REPUTATION', dataType: 'NUMBER', description: 'Monthly IP decay rate', isPublic: true },
    { key: 'ip.decay.active_user_rate', value: 0.05, category: 'REPUTATION', dataType: 'NUMBER', description: 'Active user reduced decay rate', isPublic: true },
    { key: 'ip.grace_period_months', value: 3, category: 'REPUTATION', dataType: 'NUMBER', description: 'No decay for first N months', isPublic: true },

    // Participation Rights
    { key: 'pr.monthly_regen', value: 25, category: 'REPUTATION', dataType: 'NUMBER', description: 'Base monthly PR regeneration', isPublic: true },
    { key: 'pr.max_balance', value: 500, category: 'REPUTATION', dataType: 'NUMBER', description: 'Maximum PR balance', isPublic: true },
    { key: 'pr.low_warning', value: 20, category: 'REPUTATION', dataType: 'NUMBER', description: 'Low PR warning threshold', isPublic: true },

    // PR from dues
    { key: 'pr.dues.ordinary', value: 100, category: 'ECONOMY', dataType: 'NUMBER', description: 'PR from ordinary dues', isPublic: true },
    { key: 'pr.dues.supporter', value: 200, category: 'ECONOMY', dataType: 'NUMBER', description: 'PR from supporter dues', isPublic: true },
    { key: 'pr.dues.sponsor', value: 500, category: 'ECONOMY', dataType: 'NUMBER', description: 'PR from sponsor dues', isPublic: true },

    // PR costs
    { key: 'pr.cost.vote', value: 5, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'PR cost to vote', isPublic: true },
    { key: 'pr.cost.proposal.ward', value: 50, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'PR cost for ward proposal', isPublic: true },
    { key: 'pr.cost.proposal.constituency', value: 100, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'PR cost for constituency proposal', isPublic: true },
    { key: 'pr.cost.proposal.county', value: 150, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'PR cost for county proposal', isPublic: true },
    { key: 'pr.cost.proposal.national', value: 200, category: 'GOVERNANCE', dataType: 'NUMBER', description: 'PR cost for national proposal', isPublic: true },
    { key: 'pr.cost.group_create', value: 100, category: 'COMMUNITY', dataType: 'NUMBER', description: 'PR cost to create group', isPublic: true },

    // Onboarding rewards
    { key: 'onboarding.email_verified.ip', value: 50, category: 'REPUTATION', dataType: 'NUMBER', description: 'IP reward for email verification', isPublic: true },
    { key: 'onboarding.email_verified.pr', value: 25, category: 'REPUTATION', dataType: 'NUMBER', description: 'PR reward for email verification', isPublic: true },
    { key: 'onboarding.profile_complete.ip', value: 25, category: 'REPUTATION', dataType: 'NUMBER', description: 'IP reward for profile completion', isPublic: true },
    { key: 'onboarding.wallet_connected.ip', value: 200, category: 'REPUTATION', dataType: 'NUMBER', description: 'IP reward for wallet connection', isPublic: true },
    { key: 'onboarding.wallet_connected.pr', value: 100, category: 'REPUTATION', dataType: 'NUMBER', description: 'PR reward for wallet connection', isPublic: true },
    { key: 'onboarding.phone_verified.ip', value: 100, category: 'REPUTATION', dataType: 'NUMBER', description: 'IP reward for phone verification', isPublic: true },
    { key: 'onboarding.phone_verified.pr', value: 25, category: 'REPUTATION', dataType: 'NUMBER', description: 'PR reward for phone verification', isPublic: true },
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
  const industryMap = new Map(industries.map(i => [i.name, i.id]));

  console.log(`   Created/ensured ${industries.length} industries`);

  // Goods/Services
  const validGoods = goodsList
    .map((good: any) => {
      const industryId = industryMap.get(good.industry);
      if (!industryId) {
        console.warn(`   Skipping "${good.name}" — industry "${good.industry}" not found`);
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

  let counties = 0, constituencies = 0, wards = 0;

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

  console.log(`Created ${counties} counties, ${constituencies} constituencies, ${wards} wards`);
}
// ============================================================================
// 4. SYSTEM GROUPS
// ============================================================================

async function seedSystemGroups() {
  console.log('Creating system groups...');

  const [national, counties, constituencies, wards] = await Promise.all([
    prisma.group.upsert({
      where: { systemType: 'NATIONAL' },
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
    ...counties.map(c => ({
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
    ...constituencies.map(c => ({
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
    ...wards.map(w => ({
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

  console.log(`   Created 1 national + ${counties.length} county + ${constituencies.length} constituency + ${wards.length} ward groups`);
}

// ============================================================================
// 5. ROLES
// ============================================================================

async function seedRoles() {
  console.log('Seeding built-in roles...');

  const roles = [
    { name: 'system:super_admin', namespace: 'system', description: 'Full platform access', builtin: true },
    { name: 'system:auditor', namespace: 'system', description: 'Read-only audit access', builtin: true },
    { name: 'system:support', namespace: 'system', description: 'User support and moderation', builtin: true },

    { name: 'location:ward_admin', namespace: 'location', description: 'Ward administrator', builtin: true },
    { name: 'location:constituency_admin', namespace: 'location', description: 'Constituency administrator', builtin: true },
    { name: 'location:county_admin', namespace: 'location', description: 'County administrator', builtin: true },

    { name: 'group:leader', namespace: 'group', description: 'Group leader', builtin: true },
    { name: 'group:treasurer', namespace: 'group', description: 'Group treasurer', builtin: true },
    { name: 'group:admin', namespace: 'group', description: 'Group administrator', builtin: true },
    { name: 'group:auditor', namespace: 'group', description: 'Group auditor', builtin: true },

    { name: 'project:manager', namespace: 'project', description: 'Project manager', builtin: true },
    { name: 'project:verifier', namespace: 'project', description: 'Milestone verifier', builtin: true },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: {
        id: uuidv4(),
        ...role,
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
    update: {},
    create: {
      id: uuidv4(),
      email: 'admin@ujamaa.test',
      name: 'System Administrator',
      phoneNumber: '+254700000000',
      primaryWardId: firstWard.id,
      verificationLevel: 'FULL_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      participationRights: 1000,
      globalImpactPoints: 10000,
    },
  });

  const superRole = await prisma.role.findUnique({ where: { name: 'system:super_admin' } });
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

  console.log(`   Created admin@ujamaa.test with super admin role`);
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

    console.log('\n✅ Core seeding completed successfully!');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();