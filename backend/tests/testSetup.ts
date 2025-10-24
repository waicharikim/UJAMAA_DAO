/**
 * @file testSetup.ts
 * @description Test setup: Connect to REAL DB + Get seed references (0s seeding)
 */

import { beforeAll, afterAll } from 'vitest';
import prisma from '../src/prismaClient.js';
import path from 'path';
import fs from 'fs';

export let seeded;

beforeAll(async () => {
  await prisma.$connect();
  
  console.log('✅ USING REAL DB SEED (0s)');
  
  seeded = {
    roles: {
      general: (await prisma.role.findUnique({ where: { name: 'system:general_user' } }))?.id,
      ward: (await prisma.role.findUnique({ where: { name: 'location:ward_member' } }))?.id,
      constituency: (await prisma.role.findUnique({ where: { name: 'location:constituency_member' } }))?.id,
      county: (await prisma.role.findUnique({ where: { name: 'location:county_member' } }))?.id,
      national: (await prisma.role.findUnique({ where: { name: 'location:national_member' } }))?.id,
    },
    holdings: {
      national: '1',
      nairobiCounty: 'e1ef8162-88bc-4f64-a23d-445b06029a69',
      kibraConst: 'f7d4b1a0-4b1e-4a7c-9f0b-1c2d3e4f5a67',
      kibraWard: '12345678-9abc-4def-1234-56789abcdef0',
      langataConst: '2a3b4c5d-6e7f-8a9b-0c1d-2e3f4a5b6c7d',
      langataWard: '3456789a-bcde-f012-3456-789abcdef012',
      nakuruCounty: '7b7a8c19-4b52-47b6-b2fb-6c32b686be5e',
      nakuruTownConst: '8c9d0e2f-5c63-48a7-a3fc-7d43e8f5c678',
      nakuruTownWestWard: 'abcdef12-3456-7890-abcd-ef1234567890',
      moloConst: '0f1e2d3c-4b5a-6978-9a0b-1c2d3e4f5a67',
      moloWard: 'bcdef123-4567-890a-bcde-f1234567890a',
    }
  };
  
  console.log('✅ SEED REFERENCES LOADED');
  
  const uploadDir = path.join(process.cwd(), 'Uploads', 'avatars');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}, 2000);

afterAll(async () => {
  await prisma.$disconnect();
});