import { PrismaClient } from '@prisma/client';
import { industries } from './industries.js';
import { goodsServices } from './goodsServices.js';

const prisma = new PrismaClient();

async function main() {
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

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
