/**
 * One-time backfill: historically all IP was awarded "globally" and the per-location
 * attribution was never written (awardWardPoints had no callers). Now that global
 * awards also attribute to the user's home ward, backfill existing users so their
 * ward/constituency/county reputation isn't empty.
 *
 * Idempotent: only backfills users who have no location-impact rows yet.
 * Run: docker exec ujamaa_web npx tsx src/core/database/backfill-location-impact.ts
 */
import { prisma } from './client.js';
import { locationImpactService } from '../../modules/reputation/service/locationImpact.service.js';
import { ImpactPointReason } from '../../modules/reputation/types.js';

if (process.env.NODE_ENV === 'production') {
  // Safe to run in prod too, but require an explicit opt-in.
  if (process.env.ALLOW_BACKFILL !== 'true') {
    console.error('Set ALLOW_BACKFILL=true to run in production.');
    process.exit(1);
  }
}

async function main() {
  const users = await prisma.user.findMany({
    where: { globalImpactPoints: { gt: 0 }, primaryWardId: { not: null } },
    select: { id: true, primaryWardId: true, globalImpactPoints: true },
  });

  let done = 0;
  for (const u of users) {
    const existing = await prisma.userLocationImpact.count({
      where: { userId: u.id },
    });
    if (existing > 0) continue; // already attributed — don't clobber

    await locationImpactService.awardWardPoints(
      u.id,
      u.primaryWardId!,
      u.globalImpactPoints,
      ImpactPointReason.TASK_COMPLETED,
      { backfill: true },
      true // skipLog — don't pollute IP history
    );
    done++;
  }

  console.log(
    `Backfilled location impact for ${done}/${users.length} users with IP.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
