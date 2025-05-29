/**
 * @file testSetup.ts
 *
 * @description
 * Test environment setup:
 * - Cleans relevant tables before the entire test suite to ensure test isolation.
 * - Seeds essential reference data once before all tests for consistent test runs.
 * - Disconnects Prisma client after all tests.
 */

import prisma from '../src/prismaClient.js';
import { seedAll } from '../prisma/seedAll.js'; // Adjust path if needed
import fs from 'fs';
import path from 'path';

// Import Vitest lifecycle hooks
import { beforeAll, afterAll } from 'vitest';

/**
 * Cleans up user-related tables in correct order to avoid FK constraint errors.
 */
export async function cleanUserData() {
  await prisma.$transaction([
    prisma.groupMember.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.userAudit.deleteMany(),
    prisma.userConsent.deleteMany(),
    prisma.userActivityLog.deleteMany(),
    prisma.userPrivacySettings.deleteMany(),
    prisma.notificationPreference.deleteMany(),
    prisma.tokenBalance.deleteMany(),
    prisma.projectParticipant.deleteMany(),
    prisma.groupMemberVote.deleteMany(),
    prisma.vote.deleteMany(),
    prisma.proposal.deleteMany(),
    prisma.user.deleteMany(),
    // Add more tables if needed
  ]);
}

beforeAll(async () => {
  const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true }); // Ensure upload folder exists
  }

  await prisma.$connect();

  // Clean user data once before the entire test suite
  await cleanUserData();

  // Seed reference data once before all tests
  await seedAll();
});

afterAll(async () => {
  await prisma.$disconnect(); // Disconnect Prisma to prevent connection leaks
});