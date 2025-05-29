/**
 * @file seedAll.ts
 *
 * @description
 * Combined seed script to populate Counties, Constituencies,
 * Industries, and Goods/Services into the database.
 * Uses idempotent upsert to allow repeated runs.
 */

import { PrismaClient } from '@prisma/client';
import counties from '../src/data/counties.js';
import { industries } from '../src/data/industries.js';
import { goodsServices } from '../src/data/goodsServices.js';

const prisma = new PrismaClient();

export async function seedAll() {
  console.log('Seeding counties and constituencies...');
  for (const countyData of counties) {
    const county = await prisma.county.upsert({
      where: { name: countyData.name },
      update: {},
      create: { name: countyData.name, code: countyData.code },
    });

    for (const constituencyName of countyData.constituencies) {
      await prisma.constituency.upsert({
        where: {
          name_countyId: {
            name: constituencyName,
            countyId: county.id,
          },
        },
        update: {},
        create: {
          name: constituencyName,
          countyId: county.id,
        },
      });
    }
  }

  console.log('Seeding industries...');
  for (const industry of industries) {
    await prisma.industry.upsert({
      where: { name: industry.name },
      update: {},
      create: { name: industry.name },
    });
  }

  console.log('Seeding goods/services...');
  for (const gs of goodsServices) {
    await prisma.goodsService.upsert({
      where: { name: gs.name },
      update: {},
      create: { name: gs.name },
    });
  }

  console.log('Seeding complete.');
}

if (require.main === module) {
  // Allow direct execution with node
  seedAll()
    .catch((e) => {
      console.error('Seeding error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}