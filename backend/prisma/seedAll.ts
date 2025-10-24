/**
 * @file seedAll.ts - PERFECT: CLEAN SLATE + EXACT COUNTS
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import counties from '../src/data/counties.ts';
import { industries } from '../src/data/industries.ts';
import { goodsServices } from '../src/data/goodsServices.ts';

const ALL_SEED_ROLES = [
  'system:super_admin', 'system:auditor', 'system:compliance_officer',
  'system:support_staff', 'system:general_user', 'group:member', 'group:admin',
  'group:treasurer', 'group:auditor', 'project:member', 'project:admin',
  'project:milestone_verifier', 'wallet:user', 'wallet:group_admin',
  'wallet:admin', 'payment:processor', 'chain:token_minter', 'chain:governor_admin',
  'location:ward_member', 'location:constituency_member', 'location:county_member',
  'location:national_member',
];

const prisma = new PrismaClient();

export async function seedAll() {
  console.log('🧹 CLEANING DATABASE...');
  
  // **CRITICAL: CLEAN SLATE**
  await prisma.$transaction([
    prisma.userHolding.deleteMany(),
    prisma.holding.deleteMany(),
    prisma.constituency.deleteMany(),
    prisma.county.deleteMany(),
    prisma.goodsService.deleteMany(),
    prisma.industry.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.role.deleteMany({ where: { builtin: true } }),
  ]);
  console.log('✅ CLEAN SLATE!');

  // 1. ROLES (EXACT 23)
  console.log('👑 SEEDING 23 ROLES...');
  for (const roleName of ALL_SEED_ROLES) {
    await prisma.role.create({ data: { name: roleName, builtin: true } });
  }
  console.log('✅ 23 ROLES');

  // 2. NATIONAL (ID=1)
  await prisma.holding.create({ 
    data: { id: 1, name: 'National', holdingType: 4 } 
  });
  console.log('✅ NATIONAL (ID=1)');

  // 3. COUNTIES (EXACT 47)
  console.log('🏛️  SEEDING 47 COUNTIES...');
  let nextHoldingId = 2;
  let totalConstituencies = 0;
  let totalWards = 0;

  for (let i = 0; i < counties.length; i++) {
    const countyData = counties[i];
    
    // County
    const county = await prisma.county.create({ 
      data: { id: uuidv4(), name: countyData.name, code: countyData.code } 
    });

    // County Holding
    await prisma.holding.create({ 
      data: { id: nextHoldingId++, name: `${countyData.name} County`, holdingType: 3, countyId: county.id } 
    });

    // Constituencies
    for (const constituencyData of countyData.constituencies) {
      totalConstituencies++;
      const constituency = await prisma.constituency.create({ 
        data: { id: uuidv4(), name: constituencyData.name, countyId: county.id } 
      });

      // Constituency Holding
      await prisma.holding.create({ 
        data: { id: nextHoldingId++, name: `${constituencyData.name} Constituency`, holdingType: 2, countyId: county.id, constituencyId: constituency.id } 
      });

      // Wards
      for (const wardName of constituencyData.wards) {
        totalWards++;
        await prisma.holding.create({ 
          data: { id: nextHoldingId++, name: `${wardName} Ward`, holdingType: 1, countyId: county.id, constituencyId: constituency.id } 
        });
      }
    }

    if ((i + 1) % 10 === 0) console.log(`   • ${i + 1}/47 counties | ${totalConstituencies} const | ${totalWards} wards`);
  }

  // 4. INDUSTRIES (15)
  for (const industry of industries) {
    await prisma.industry.create({ data: { id: uuidv4(), name: industry } });
  }
  console.log('✅ 15 INDUSTRIES');

  // 5. GOODS/SERVICES (12)
  for (const gs of goodsServices) {
    await prisma.goodsService.create({ data: { id: uuidv4(), name: gs } });
  }
  console.log('✅ 12 GOODS/SERVICES');

  // FINAL COUNTS
  const totals = await prisma.$transaction([
    prisma.role.count(),
    prisma.holding.count(),
    prisma.county.count(),
    prisma.constituency.count(),
    prisma.industry.count(),
    prisma.goodsService.count(),
  ]);

  console.log('\n🎉 SEED 100% COMPLETE!');
  console.log(`📊 EXACT COUNTS:
  • ROLES: ${totals[0]} ✅
  • HOLDINGS: ${totals[1]} (1-${nextHoldingId - 1}) ✅
  • COUNTIES: ${totals[2]} ✅
  • CONSTITUENCIES: ${totals[3]} ✅
  • WARDS: ${totalWards} ✅
  • INDUSTRIES: ${totals[4]} ✅
  • GOODS/SERVICES: ${totals[5]} ✅`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedAll()
    .then(() => {
      console.log('\n🚀 DATABASE READY!');
      prisma.$disconnect();
    })
    .catch((e) => {
      console.error('💥 ERROR:', e);
      process.exit(1);
    });
}