/**
 * @file tests/testSetup.ts
 * @description Global Vitest setup for integration tests
 * 
 * Responsibilities:
 * - Force critical test environment variables at the very top to ensure they are available before any module imports
 * - Connect to the isolated test database
 * - Clean the database before each test to ensure test isolation
 * - Gracefully disconnect after all tests
 * 
 * Important note:
 * - We are currently using a minimal Prisma schema (only User, Session, LoginEvent, EmailVerificationToken)
 * - Role loading has been removed because the Role table does not exist in this phase
 * - Group enrollment and role-based assertions are deferred to the Groups module
 * - Only location holdings are cached for ward ID references in tests
 */

 // ===================================================================
 // 1. FORCE TEST ENVIRONMENT — MUST BE FIRST (before any imports)
 // ===================================================================

process.env.NODE_ENV = 'test';
process.env.BASE_URL = 'http://localhost:8000';
// DATABASE_URL is set by vitest.config.ts env block (before module init).
// testSetup.ts runs after Prisma client is constructed — do NOT override it here.
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.JWT_SECRET = '6e603cfa9affb7677020ad6a930bd3f076867ff38d100586dc5d985bed845ad0';
process.env.LOG_LEVEL = 'error';
process.env.ENABLE_EMAILS = 'false';
process.env.PORT = '4000';

// Disable Redis in tests to avoid connection attempts and use in-memory rate limiting
delete process.env.REDIS_URL;

console.log('[testSetup] FORCED TEST ENVIRONMENT VARIABLES');
console.log('BASE_URL =', process.env.BASE_URL);
console.log('NODE_ENV =', process.env.NODE_ENV);

// ===================================================================
// 2. NOW SAFE TO IMPORT MODULES
// ===================================================================

import { beforeAll, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/core/database/client.js';

// ===================================================================
// 3. GLOBAL SEED REFERENCE CACHE (Minimal — only location holdings)
// ===================================================================

export let seeded: {
  holdings: {
    national: string;
    nairobiCounty: string;
    kibraConst: string;
    kibraWard: string;
    langataConst: string;
    langataWard: string;
    nakuruCounty: string;
    nakuruTownConst: string;
    nakuruTownWestWard: string;
    moloConst: string;
    moloWard: string;
  };
} = {
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
  },
};

// ===================================================================
// 4. DATABASE CONNECTION
// ===================================================================

beforeAll(async () => {
  try {
    console.log('[testSetup] Connecting to test database...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ [testSetup] Failed to connect to test database:', error);
    throw error; // Fail fast if DB is not available
  }
}, 30000);

// ===================================================================
// 5. CLEAN DATABASE BEFORE EACH TEST
// ===================================================================

beforeEach(async () => {
  // Terminate any connections stuck in an idle-in-transaction state before TRUNCATE.
  // The PrismaPg adapter can leave connections in this state when a $transaction
  // callback throws (e.g. deadlock) and the ROLLBACK path is slow. Those stale
  // connections hold table-level locks that cause the TRUNCATE to deadlock.
  // Only affects connections idle in transaction — normal idle connections are left alone.
  await prisma.$executeRawUnsafe(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid != pg_backend_pid()
      AND state IN ('idle in transaction', 'idle in transaction (aborted)')
  `).catch(() => {});

  // Get all user-defined tables in public schema (exclude Prisma migration tables)
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'prisma_%'`;

  if (tablenames.length === 0) return;

  const tables = tablenames
    .map(({ tablename }) => `"public"."${tablename}"`)
    .join(', ');

  // Retry on deadlock (40P01): fire-and-forget writes from service methods
  // (e.g. participationRightsService.award().catch(() => {})) can still be in
  // flight when the next test's TRUNCATE starts, causing a lock conflict.
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
      console.log(`🧹 Truncated ${tablenames.length} tables before test`);
      return;
    } catch (error: unknown) {
      const msg = String((error as { message?: string })?.message ?? '');
      const isDeadlock =
        msg.includes('deadlock') ||
        (error as { code?: string })?.code === '40P01';
      if (isDeadlock && attempt < 5) {
        await new Promise((r) => setTimeout(r, 150 * attempt));
        continue;
      }
      console.error('❌ Failed to truncate tables:', error);
      throw error;
    }
  }
}, 30000);

// ===================================================================
// 6. TEARDOWN — Graceful shutdown
// ===================================================================

afterAll(async () => {
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected');
  } catch (error) {
    console.error('❌ Error during database disconnect:', error);
  }
});