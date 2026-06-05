/**
 * @file src/core/database/simulate.ts
 * @description
 * Ecosystem simulation — populates a single ward (the alphabetically-first ward,
 * "home" of the existing test data) with a living community: a cast of ~40 users
 * across every verification level + role, then drives the REAL services so the
 * interesting flows (governance, projects, economy, marketplace, …) actually run
 * with their business logic, events, and PR/IP awards.
 *
 * Design:
 *  - ADDITIVE & IDEMPOTENT — never wipes; safe to re-run. Users keyed by a stable
 *    `sim.*@kayole.test` email; PR/activity awards only fire on first creation.
 *  - Dev-only — refuses to run when NODE_ENV === 'production'.
 *
 * Run:  docker exec ujamaa_web npx tsx src/core/database/simulate.ts
 *
 * Built in phases; each phase is independent and idempotent.
 */

import { prisma } from './client.js';
import { v4 as uuidv4 } from 'uuid';
import { groupMembershipService } from '../../modules/community/services/groupMembership.service.js';
import { participationRightsService } from '../../modules/economy/services/participationRights.service.js';
import { ParticipationRightsReason } from '../../modules/economy/types.js';

// ── Guard ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  console.error('❌ simulate.ts refuses to run in production.');
  process.exit(1);
}

// ── Roster ──────────────────────────────────────────────────────────────────
type Vlevel =
  | 'UNVERIFIED'
  | 'EMAIL_VERIFIED'
  | 'PHONE_VERIFIED'
  | 'COMMUNITY_VERIFIED'
  | 'FULL_VERIFIED';

interface CastMember {
  name: string;
  /** stable email slug → sim.<slug>@kayole.test */
  slug: string;
  level: Vlevel;
  /** system/location/group role to grant, if any */
  role?: string;
  /** true → origin (secondary) ward differs from residence */
  fromAway?: boolean;
}

// A realistic Kayole cast. Verification spread skews toward community-verified
// (the active core), with a handful at each lower rung and a few full-verified
// leaders. Roles cover the governance + oversight surface.
const CAST: CastMember[] = [
  // ── Leadership / oversight (full-verified) ──
  { name: 'Mama Njeri Kamau', slug: 'njeri', level: 'FULL_VERIFIED', role: 'group:leader' },
  { name: 'David Otieno', slug: 'david', level: 'FULL_VERIFIED', role: 'location:ward_admin' },
  { name: 'Grace Wambui', slug: 'grace', level: 'FULL_VERIFIED', role: 'location:constituency_admin' },
  { name: 'Joseph Kiprono', slug: 'joseph', level: 'FULL_VERIFIED', role: 'location:county_admin' },
  { name: 'Aisha Mohamed', slug: 'aisha', level: 'FULL_VERIFIED', role: 'system:compliance_officer' },
  { name: 'Peter Mwangi', slug: 'peter', level: 'FULL_VERIFIED', role: 'group:treasurer' },
  // ── Active community-verified core ──
  { name: 'Faith Achieng', slug: 'faith', level: 'COMMUNITY_VERIFIED' },
  { name: 'Brian Kemboi', slug: 'brian', level: 'COMMUNITY_VERIFIED' },
  { name: 'Mercy Wanjiru', slug: 'mercy', level: 'COMMUNITY_VERIFIED', fromAway: true },
  { name: 'Samuel Maina', slug: 'samuel', level: 'COMMUNITY_VERIFIED' },
  { name: 'Esther Nyong’o', slug: 'esther', level: 'COMMUNITY_VERIFIED' },
  { name: 'Kevin Omondi', slug: 'kevin', level: 'COMMUNITY_VERIFIED' },
  { name: 'Lucy Chebet', slug: 'lucy', level: 'COMMUNITY_VERIFIED', fromAway: true },
  { name: 'Daniel Mutua', slug: 'daniel', level: 'COMMUNITY_VERIFIED' },
  { name: 'Caroline Adhiambo', slug: 'caroline', level: 'COMMUNITY_VERIFIED' },
  { name: 'Anthony Kariuki', slug: 'anthony', level: 'COMMUNITY_VERIFIED' },
  { name: 'Beatrice Moraa', slug: 'beatrice', level: 'COMMUNITY_VERIFIED' },
  { name: 'Felix Barasa', slug: 'felix', level: 'COMMUNITY_VERIFIED' },
  { name: 'Janet Wairimu', slug: 'janet', level: 'COMMUNITY_VERIFIED', fromAway: true },
  { name: 'Collins Ouma', slug: 'collins', level: 'COMMUNITY_VERIFIED' },
  { name: 'Diana Nasimiyu', slug: 'diana', level: 'COMMUNITY_VERIFIED' },
  { name: 'Eric Njoroge', slug: 'eric', level: 'COMMUNITY_VERIFIED' },
  { name: 'Pauline Atieno', slug: 'pauline', level: 'COMMUNITY_VERIFIED' },
  { name: 'George Kiplagat', slug: 'george', level: 'COMMUNITY_VERIFIED' },
  // ── Phone-verified (mid-funnel) ──
  { name: 'Sharon Wangari', slug: 'sharon', level: 'PHONE_VERIFIED' },
  { name: 'Martin Wekesa', slug: 'martin', level: 'PHONE_VERIFIED' },
  { name: 'Joyce Kemunto', slug: 'joyce', level: 'PHONE_VERIFIED' },
  { name: 'Dennis Mbugua', slug: 'dennis', level: 'PHONE_VERIFIED' },
  { name: 'Ruth Jepkosgei', slug: 'ruth', level: 'PHONE_VERIFIED', fromAway: true },
  { name: 'Patrick Onyango', slug: 'patrick', level: 'PHONE_VERIFIED' },
  // ── Email-verified (new arrivals) ──
  { name: 'Cynthia Akinyi', slug: 'cynthia', level: 'EMAIL_VERIFIED' },
  { name: 'Victor Kirui', slug: 'victor', level: 'EMAIL_VERIFIED' },
  { name: 'Nancy Muthoni', slug: 'nancy', level: 'EMAIL_VERIFIED' },
  { name: 'Allan Simiyu', slug: 'allan', level: 'EMAIL_VERIFIED' },
  { name: 'Teresia Wanja', slug: 'teresia', level: 'EMAIL_VERIFIED' },
  // ── Unverified (just landed) ──
  { name: 'Brenda Cherono', slug: 'brenda', level: 'UNVERIFIED' },
  { name: 'Isaac Wafula', slug: 'isaac', level: 'UNVERIFIED' },
  { name: 'Linet Moraa', slug: 'linet', level: 'UNVERIFIED' },
  { name: 'Tom Kÿalo', slug: 'tom', level: 'UNVERIFIED' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

const email = (slug: string) => `sim.${slug}@kayole.test`;
const phoneFor = (i: number) => `+2547${String(11000000 + i).padStart(8, '0')}`;

const verifiedFlags = (level: Vlevel) => ({
  emailVerified: level !== 'UNVERIFIED',
  phoneVerified: ['PHONE_VERIFIED', 'COMMUNITY_VERIFIED', 'FULL_VERIFIED'].includes(level),
  communityVerified: ['COMMUNITY_VERIFIED', 'FULL_VERIFIED'].includes(level),
  locationVerified: ['COMMUNITY_VERIFIED', 'FULL_VERIFIED'].includes(level),
});

/** Starting PR a member of this level would plausibly have earned climbing the funnel. */
function startingPr(level: Vlevel): { amount: number; reason: ParticipationRightsReason }[] {
  const steps: { amount: number; reason: ParticipationRightsReason }[] = [];
  if (level !== 'UNVERIFIED')
    steps.push({ amount: 10, reason: ParticipationRightsReason.EMAIL_VERIFIED });
  if (['PHONE_VERIFIED', 'COMMUNITY_VERIFIED', 'FULL_VERIFIED'].includes(level))
    steps.push({ amount: 15, reason: ParticipationRightsReason.PHONE_VERIFIED });
  if (['COMMUNITY_VERIFIED', 'FULL_VERIFIED'].includes(level)) {
    steps.push({ amount: 50, reason: ParticipationRightsReason.COMMUNITY_VERIFIED });
    steps.push({ amount: 25, reason: ParticipationRightsReason.ONBOARDING_COMPLETE });
  }
  if (level === 'FULL_VERIFIED')
    steps.push({ amount: 100, reason: ParticipationRightsReason.WALLET_CONNECTED });
  return steps;
}

async function grantRole(userId: string, roleName: string) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    console.warn(`   ⚠ role "${roleName}" not found — skipping`);
    return;
  }
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: { active: true },
    create: { id: uuidv4(), userId, roleId: role.id, active: true },
  });
}

// ── Phase 1: the cast ────────────────────────────────────────────────────────

async function phase1Cast() {
  console.log('\n━━ Phase 1: the cast ━━');

  const homeWard = await prisma.ward.findFirst({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, constituencyId: true },
  });
  if (!homeWard) throw new Error('No wards seeded — run the seed first.');

  // An "origin" ward in a different constituency, for members who moved here.
  const originWard = await prisma.ward.findFirst({
    where: { constituencyId: { not: homeWard.constituencyId } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  console.log(`   Home ward: ${homeWard.name}  |  origin ward: ${originWard?.name ?? '(none)'}`);

  let created = 0;
  let existing = 0;

  for (let i = 0; i < CAST.length; i++) {
    const c = CAST[i];
    const flags = verifiedFlags(c.level);
    const secondaryWardId =
      c.fromAway && originWard ? originWard.id : homeWard.id;

    const prior = await prisma.user.findUnique({
      where: { email: email(c.slug) },
      select: { id: true },
    });

    const user = await prisma.user.upsert({
      where: { email: email(c.slug) },
      update: {
        name: c.name,
        verificationLevel: c.level,
        ...flags,
        primaryWardId: homeWard.id,
        secondaryWardId,
      },
      create: {
        id: uuidv4(),
        email: email(c.slug),
        name: c.name,
        phoneNumber: phoneFor(i),
        verificationLevel: c.level,
        ...flags,
        primaryWardId: homeWard.id,
        secondaryWardId,
      },
      select: { id: true },
    });

    if (c.role) await grantRole(user.id, c.role);

    // Enrol verified members into their system groups (ward/constituency/county).
    if (c.level !== 'UNVERIFIED') {
      await groupMembershipService
        .enrollInSystemGroups(user.id, homeWard.id, secondaryWardId)
        .catch(() => {});
    }

    // Starting PR — only on first creation (keeps re-runs idempotent).
    if (!prior) {
      for (const step of startingPr(c.level)) {
        await participationRightsService
          .award(user.id, step.amount, step.reason, { sim: true })
          .catch(() => {});
      }
      created++;
    } else {
      existing++;
    }
  }

  console.log(`   ✓ cast ready — ${created} created, ${existing} already present (${CAST.length} total)`);
  return { homeWard, originWard };
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 UjamaaDAO ecosystem simulation (additive, idempotent)');
  await phase1Cast();
  console.log('\n✅ Simulation phase(s) complete.');
}

main()
  .catch((e) => {
    console.error('❌ Simulation failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
