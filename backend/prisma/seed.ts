// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import counties from '../src/data/counties.js';

const prisma = new PrismaClient();

async function main() {
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

  console.log('Counties and constituencies have been seeded successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });