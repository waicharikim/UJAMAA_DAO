// prisma/seedRoles.ts
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { ALL_ROLES } from '../src/constants/roles.js';

const prisma = new PrismaClient();

async function upsertCanonicalRoles() {
  console.info('Seeding canonical roles...');
  // Use transaction for atomicity
  const ops = ALL_ROLES.map((name) =>
    prisma.role.upsert({
      where: { name },
      update: { builtin: true, updatedAt: new Date() },
      create: { name, builtin: true },
    })
  );

  // If ALL_ROLES is large, consider chunking ops into smaller transactions
  await prisma.$transaction(ops);
  console.info('Canonical roles upserted.');
}

async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'adminpass';

  console.info(`Ensuring admin user exists (${adminEmail})...`);
  const passwordHash = await argon2.hash(adminPassword);

  // Upsert admin user
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      emailVerified: true,
      updatedAt: new Date(),
    },
    create: {
      email: adminEmail,
      passwordHash,
      name: 'Admin',
      nonce: '',
      emailVerified: true,
    },
  });

  // Assign system:super_admin role safely
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'system:super_admin' } });
  if (!superAdminRole) {
    throw new Error('Role "system:super_admin" not found. Ensure roles were seeded first.');
  }

  // Try to find existing assignment (works regardless of whether you added @@unique)
  const existing = await prisma.userRole.findFirst({
    where: { userId: admin.id, roleId: superAdminRole.id, scope: null },
  });

  if (!existing) {
    await prisma.userRole.create({
      data: {
        userId: admin.id,
        roleId: superAdminRole.id,
        scope: null,
        active: true,
      },
    });
    console.info('Assigned system:super_admin to admin user.');
  } else if (!existing.active) {
    await prisma.userRole.update({
      where: { id: existing.id },
      data: { active: true, updatedAt: new Date() },
    });
    console.info('Re-activated admin user role assignment.');
  } else {
    console.info('Admin user already has system:super_admin.');
  }
}

async function main() {
  // Safety guard: prevent accidental prod seeding
  const isProd = process.env.NODE_ENV === 'production' || (process.env.DATABASE_URL ?? '').includes('prod');
  if (isProd && process.env.FORCE_SEED !== 'true') {
    console.warn('Seeding against production is disabled. Set FORCE_SEED=true to override.');
    process.exit(0);
  }

  try {
    await upsertCanonicalRoles();
    await ensureAdminUser();
    console.info('Seed finished successfully.');
  } catch (err) {
    console.error('Seed failed', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();