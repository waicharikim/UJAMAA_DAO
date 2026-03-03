/**
 * Re-enroll users who have no system group memberships.
 *
 * This is a one-time remediation script for users who registered during the
 * window when enrollInSystemGroups was failing with a unique constraint race
 * condition (concurrent findFirst → create on Group.name).
 *
 * The underlying bug is fixed (upsert now used). This script catches up
 * affected users by calling enrollInSystemGroups directly.
 *
 * Run with:
 *   docker exec ujamaa_web npx tsx scripts/re-enroll-orphaned-users.ts
 *
 * Or from host with the correct DATABASE_URL:
 *   DATABASE_URL=<...> npx tsx scripts/re-enroll-orphaned-users.ts
 */

import { prisma } from '../src/core/database/client.js';
import { groupMembershipService } from '../src/modules/community/services/groupMembership.service.js';

const SKIP_EMAIL_PATTERNS = [/flowtest/i, /e2e_test/i, /ujamaa_admin/i];

function isTestUser(email: string): boolean {
  return SKIP_EMAIL_PATTERNS.some((p) => p.test(email));
}

async function main() {
  console.log('=== Re-enrollment script starting ===\n');

  // Find users who:
  // 1. Are at least EMAIL_VERIFIED
  // 2. Have both ward IDs set (required for enrollment)
  // 3. Have zero active group memberships
  const candidates = await prisma.user.findMany({
    where: {
      verificationLevel: {
        in: ['EMAIL_VERIFIED', 'COMMUNITY_VERIFIED', 'FULL_VERIFIED'],
      },
      primaryWardId: { not: null },
      secondaryWardId: { not: null },
      groupMemberships: { none: {} },
    },
    select: {
      id: true,
      email: true,
      verificationLevel: true,
      primaryWardId: true,
      secondaryWardId: true,
    },
  });

  console.log(`Found ${candidates.length} candidate(s) with no group memberships:\n`);

  const toProcess = candidates.filter((u) => !isTestUser(u.email ?? ''));
  const skipped = candidates.filter((u) => isTestUser(u.email ?? ''));

  if (skipped.length > 0) {
    console.log(`Skipping ${skipped.length} test/admin user(s):`);
    skipped.forEach((u) => console.log(`  - ${u.email} (${u.verificationLevel})`));
    console.log();
  }

  if (toProcess.length === 0) {
    console.log('No real users to re-enroll. Done.');
    return;
  }

  console.log(`Processing ${toProcess.length} real user(s):\n`);

  const results = { success: 0, failed: 0 };

  for (const user of toProcess) {
    const { id, email, verificationLevel, primaryWardId, secondaryWardId } = user;

    // Both ward IDs are guaranteed non-null by the query above
    console.log(`  → ${email} (${verificationLevel})`);
    console.log(`    primaryWard=${primaryWardId}  secondaryWard=${secondaryWardId}`);

    try {
      await groupMembershipService.enrollInSystemGroups(
        id,
        primaryWardId!,
        secondaryWardId!
      );

      // Confirm the groups were created
      const membershipCount = await prisma.groupMember.count({
        where: { userId: id },
      });

      console.log(`    ✓ Enrolled in ${membershipCount} group(s)\n`);
      results.success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`    ✗ FAILED: ${msg}\n`);
      results.failed++;
    }
  }

  console.log('=== Summary ===');
  console.log(`  Success: ${results.success}`);
  console.log(`  Failed:  ${results.failed}`);
  console.log(`  Skipped: ${skipped.length} (test users)`);
}

main()
  .catch((err) => {
    console.error('Script error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
