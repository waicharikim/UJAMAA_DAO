/**
 * Dev-only: seed 4 COMMUNITY_VERIFIED users across distinct geographies so the
 * frontend bug-sweep can verify geographic scope + impact-point aggregation.
 *
 *   U1 Boito      (Konoin,     Bomet)   ─┐ same constituency, different wards
 *   U2 Chepchabas (Konoin,     Bomet)   ─┘
 *   U3 Chebunyo   (Chepalungu, Bomet)     same county, different constituency
 *   U4 Airbase    (Kamukunji,  Nairobi)   different county
 *
 * Run: docker exec ujamaa_web npx tsx src/core/database/seed-geo-testusers.ts
 * Idempotent (upsert by email). Refuses to run in production.
 */
import { prisma } from './client.js';
import { groupMembershipService } from '../../modules/community/services/groupMembership.service.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run in production.');
  process.exit(1);
}

const USERS = [
  { email: 'geo.boito@sweep.test', name: 'Boito Tester', wardId: '998333e2-3be1-4052-a237-de73916b47c8' },
  { email: 'geo.chepchabas@sweep.test', name: 'Chepchabas Tester', wardId: '53002fed-aa61-49e8-92b8-5c94c1391665' },
  { email: 'geo.chebunyo@sweep.test', name: 'Chebunyo Tester', wardId: 'b84a1576-d467-4eb9-96b5-8067eea5f6cb' },
  { email: 'geo.airbase@sweep.test', name: 'Airbase Tester', wardId: '81b8bd74-0b83-4858-a3af-51dadaefc482' },
];

async function main() {
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        verificationLevel: 'COMMUNITY_VERIFIED',
        emailVerified: true,
        phoneVerified: true,
        communityVerified: true,
        primaryWardId: u.wardId,
        secondaryWardId: u.wardId,
      },
      create: {
        email: u.email,
        name: u.name,
        verificationLevel: 'COMMUNITY_VERIFIED',
        emailVerified: true,
        phoneVerified: true,
        communityVerified: true,
        locationVerified: false,
        primaryWardId: u.wardId,
        secondaryWardId: u.wardId,
      },
    });

    // Real enrollment path → ward + constituency + county + national Community groups.
    await groupMembershipService.enrollInSystemGroups(user.id, u.wardId, u.wardId);

    const groups = await prisma.groupMember.count({
      where: { userId: user.id, active: true },
    });
    console.log(`✓ ${u.email.padEnd(28)} id=${user.id}  systemGroups=${groups}`);
  }
  console.log('\nDone. Log in via /dev/login or POST /auth/dev/login { email }.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
