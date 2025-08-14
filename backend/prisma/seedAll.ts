/**
 * @file seedAll.ts
 *
 * @description
 * Combined seed script to populate Counties, Constituencies,
 * Industries, and Goods/Services into the database.
 * Uses idempotent upsert to allow repeated runs.
 *
 * Returns an object with created IDs so tests can consume stable IDs.
 */

import { PrismaClient } from '@prisma/client';
import counties from '../src/data/counties.js';
import { industries } from '../src/data/industries.js';
import { goodsServices } from '../src/data/goodsServices.js';

const prisma = new PrismaClient();

export async function seedAll() {
  const ids = {
    counties: {}, // { [countyName]: { id, code, constituencies: { [constName]: id } } }
    industries: {}, // { [industryName]: id }
    goodsServices: {}, // { [gsName]: id }
  };

  console.log('Seeding counties and constituencies...');
  for (const countyData of counties) {
    const county = await prisma.county.upsert({
      where: { name: countyData.name },
      update: {},
      create: { name: countyData.name, code: countyData.code },
    });

    const constituenciesMap = {};
    for (const constituencyName of countyData.constituencies) {
      const constituency = await prisma.constituency.upsert({
        where: {
          // uses the composite unique 'name + countyId' constraint from your schema
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
      constituenciesMap[constituencyName] = constituency.id;
    }

    ids.counties[countyData.name] = {
      id: county.id,
      code: countyData.code,
      constituencies: constituenciesMap,
    };
  }

  console.log('Seeding industries...');
  for (const industry of industries) {
    const rec = await prisma.industry.upsert({
      where: { name: industry.name },
      update: {},
      create: { name: industry.name },
    });
    ids.industries[industry.name] = rec.id;
  }

  console.log('Seeding goods/services...');
  for (const gs of goodsServices) {
    const rec = await prisma.goodsService.upsert({
      where: { name: gs.name },
      update: {},
      create: { name: gs.name },
    });
    ids.goodsServices[gs.name] = rec.id;
  }

  console.log('Seeding complete.');
  return { ids };
}

if (require.main === module) {
  // Allow direct execution with node
  seedAll()
    .then((result) => {
      console.log('Seeded reference IDs:', JSON.stringify(result.ids, null, 2));
      return prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error('Seeding error:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}