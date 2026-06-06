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

// Import the proposal.service FACADE first. There is an ESM init-order cycle
// (proposal-lifecycle → proposal.jobs → proposal.service facade → lifecycle); the
// app dodges it because the facade is the entry point — it imports lifecycle +
// voting FULLY before constructing itself. Importing lifecycle/voting directly
// (out of that order) hits the partial module and throws. So we go through the
// facade and use its bound methods (createProposal/reviewProposal/startVoting/
// castVote/tallyVotes).
import { proposalService } from '../../modules/governance/services/proposal.service.js';

import { prisma } from './client.js';
import { v4 as uuidv4 } from 'uuid';
import { groupMembershipService } from '../../modules/community/services/groupMembership.service.js';
import { participationRightsService } from '../../modules/economy/services/participationRights.service.js';
import { ParticipationRightsReason } from '../../modules/economy/types.js';
import { groupService } from '../../modules/community/services/group.service.js';
import { proposalAnnotationService } from '../../modules/governance/services/proposal-annotation.service.js';
import { VoteOption } from '../../modules/governance/types.js';
import { treasuryService } from '../../modules/treasury/services/treasury.service.js';
import { commitmentService } from '../../modules/economy/services/commitment.service.js';
import { CommitmentType } from '../../modules/economy/types.js';
import { marketplaceService } from '../../modules/marketplace/services/marketplace.service.js';
import { ListingType } from '../../modules/marketplace/types.js';
import { educationService } from '../../modules/education/services/education.service.js';
import { emergencyService } from '../../modules/emergency/services/emergency.service.js';
import { EmergencyType } from '../../modules/emergency/types.js';

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
  {
    name: 'Mama Njeri Kamau',
    slug: 'njeri',
    level: 'FULL_VERIFIED',
    role: 'group:leader',
  },
  {
    name: 'David Otieno',
    slug: 'david',
    level: 'FULL_VERIFIED',
    role: 'location:ward_admin',
  },
  {
    name: 'Grace Wambui',
    slug: 'grace',
    level: 'FULL_VERIFIED',
    role: 'location:constituency_admin',
  },
  {
    name: 'Joseph Kiprono',
    slug: 'joseph',
    level: 'FULL_VERIFIED',
    role: 'location:county_admin',
  },
  {
    name: 'Aisha Mohamed',
    slug: 'aisha',
    level: 'FULL_VERIFIED',
    role: 'system:compliance_officer',
  },
  {
    name: 'Peter Mwangi',
    slug: 'peter',
    level: 'FULL_VERIFIED',
    role: 'group:treasurer',
  },
  // ── Active community-verified core ──
  { name: 'Faith Achieng', slug: 'faith', level: 'COMMUNITY_VERIFIED' },
  { name: 'Brian Kemboi', slug: 'brian', level: 'COMMUNITY_VERIFIED' },
  {
    name: 'Mercy Wanjiru',
    slug: 'mercy',
    level: 'COMMUNITY_VERIFIED',
    fromAway: true,
  },
  { name: 'Samuel Maina', slug: 'samuel', level: 'COMMUNITY_VERIFIED' },
  { name: 'Esther Nyong’o', slug: 'esther', level: 'COMMUNITY_VERIFIED' },
  { name: 'Kevin Omondi', slug: 'kevin', level: 'COMMUNITY_VERIFIED' },
  {
    name: 'Lucy Chebet',
    slug: 'lucy',
    level: 'COMMUNITY_VERIFIED',
    fromAway: true,
  },
  { name: 'Daniel Mutua', slug: 'daniel', level: 'COMMUNITY_VERIFIED' },
  { name: 'Caroline Adhiambo', slug: 'caroline', level: 'COMMUNITY_VERIFIED' },
  { name: 'Anthony Kariuki', slug: 'anthony', level: 'COMMUNITY_VERIFIED' },
  { name: 'Beatrice Moraa', slug: 'beatrice', level: 'COMMUNITY_VERIFIED' },
  { name: 'Felix Barasa', slug: 'felix', level: 'COMMUNITY_VERIFIED' },
  {
    name: 'Janet Wairimu',
    slug: 'janet',
    level: 'COMMUNITY_VERIFIED',
    fromAway: true,
  },
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
  {
    name: 'Ruth Jepkosgei',
    slug: 'ruth',
    level: 'PHONE_VERIFIED',
    fromAway: true,
  },
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
  phoneVerified: [
    'PHONE_VERIFIED',
    'COMMUNITY_VERIFIED',
    'FULL_VERIFIED',
  ].includes(level),
  communityVerified: ['COMMUNITY_VERIFIED', 'FULL_VERIFIED'].includes(level),
  locationVerified: ['COMMUNITY_VERIFIED', 'FULL_VERIFIED'].includes(level),
});

/** Starting PR a member of this level would plausibly have earned climbing the funnel. */
function startingPr(
  level: Vlevel
): { amount: number; reason: ParticipationRightsReason }[] {
  const steps: { amount: number; reason: ParticipationRightsReason }[] = [];
  if (level !== 'UNVERIFIED')
    steps.push({
      amount: 10,
      reason: ParticipationRightsReason.EMAIL_VERIFIED,
    });
  if (['PHONE_VERIFIED', 'COMMUNITY_VERIFIED', 'FULL_VERIFIED'].includes(level))
    steps.push({
      amount: 15,
      reason: ParticipationRightsReason.PHONE_VERIFIED,
    });
  if (['COMMUNITY_VERIFIED', 'FULL_VERIFIED'].includes(level)) {
    steps.push({
      amount: 50,
      reason: ParticipationRightsReason.COMMUNITY_VERIFIED,
    });
    steps.push({
      amount: 25,
      reason: ParticipationRightsReason.ONBOARDING_COMPLETE,
    });
  }
  if (level === 'FULL_VERIFIED')
    steps.push({
      amount: 100,
      reason: ParticipationRightsReason.WALLET_CONNECTED,
    });
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

  console.log(
    `   Home ward: ${homeWard.name}  |  origin ward: ${originWard?.name ?? '(none)'}`
  );

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

  console.log(
    `   ✓ cast ready — ${created} created, ${existing} already present (${CAST.length} total)`
  );
  return { homeWard, originWard };
}

// ── shared lookups ───────────────────────────────────────────────────────────

async function simUser(slug: string) {
  const u = await prisma.user.findUnique({
    where: { email: email(slug) },
    select: { id: true, primaryWardId: true, name: true },
  });
  if (!u) throw new Error(`sim user "${slug}" not found — run Phase 1 first`);
  return u;
}

/** community-verified members of the cast, as voters/joiners */
async function communityMembers() {
  return prisma.user.findMany({
    where: {
      email: { startsWith: 'sim.', endsWith: '@kayole.test' },
      verificationLevel: { in: ['COMMUNITY_VERIFIED', 'FULL_VERIFIED'] },
    },
    select: { id: true, primaryWardId: true },
  });
}

// ── Phase 2: voluntary groups ────────────────────────────────────────────────

async function phase2Groups(homeWardId: string) {
  console.log('\n━━ Phase 2: voluntary groups ━━');

  const specs = [
    {
      creator: 'njeri',
      name: 'Kayole Maendeleo SACCO',
      type: 'SAVINGS_CREDIT',
      desc: 'A neighbourhood savings & credit cooperative — pool monthly, lend locally.',
    },
    {
      creator: 'david',
      name: 'Kayole Youth Network',
      type: 'YOUTH_ORGANIZATION',
      desc: 'Youth-led organising: skills, hustles, and a voice in ward decisions.',
    },
    {
      creator: 'grace',
      name: 'Ward Transparency Watch',
      type: 'TRANSPARENCY_WATCHDOG',
      desc: 'Citizens keeping an eye on how ward funds are raised and spent.',
    },
  ];

  const made: { id: string; name: string }[] = [];
  const members = await communityMembers();

  for (const s of specs) {
    let group = await prisma.group.findFirst({
      where: { name: s.name },
      select: { id: true, name: true },
    });
    if (!group) {
      const creator = await simUser(s.creator);
      try {
        const g = await groupService.createVoluntaryGroup(creator.id, {
          name: s.name,
          voluntaryType: s.type,
          description: s.desc,
          wardId: homeWardId,
        });
        group = { id: g.id, name: s.name };
        console.log(`   ✓ created "${s.name}" (leader: ${creator.name})`);
      } catch (e) {
        console.warn(`   ⚠ "${s.name}" — ${(e as Error).message}`);
        continue;
      }
    } else {
      console.log(`   • "${s.name}" already exists`);
    }
    // Enrol ~10 members (best-effort — joinGroup is idempotent-ish).
    let joined = 0;
    for (const m of members.slice(0, 10)) {
      const ok = await groupService
        .joinGroup(m.id, group.id)
        .then(() => true)
        .catch(() => false);
      if (ok) joined++;
    }
    console.log(`     members ensured (+${joined} this run)`);
    made.push(group);
  }
  return made;
}

// ── Phase 3: governance lifecycle ────────────────────────────────────────────

async function phase3Governance(group: { id: string; name: string }) {
  console.log(`\n━━ Phase 3: governance (in "${group.name}") ━━`);

  // Voluntary-group governance fast-tracks: a single leader APPROVE takes a
  // proposal DRAFT → APPROVED_FOR_VOTING (no PENDING stage). The SACCO leader
  // (its creator) drives review / open-voting / tally. Full-verified creators
  // (200 PR) so proposal costs never starve.
  const [joseph, aisha, peter, leader] = await Promise.all(
    ['joseph', 'aisha', 'peter', 'njeri'].map(simUser)
  );

  type Target = 'DRAFT' | 'APPROVED' | 'VOTING' | 'EXECUTED' | 'REJECTED';
  const proposals: {
    title: string;
    description: string;
    fundingAmountKes: number;
    creator: { id: string };
    target: Target;
  }[] = [
    {
      title: 'Buy a shared 10,000L water tank',
      creator: joseph,
      fundingAmountKes: 85000,
      description:
        'Install a communal water tank at the estate gate so households stop paying vendors per jerrican. Cheaper water, less queuing.',
      target: 'DRAFT',
    },
    {
      title: 'Hire an estate night security guard',
      creator: aisha,
      fundingAmountKes: 144000,
      description:
        'Pool funds to hire a vetted night guard for the estate after the recent break-ins. Twelve-month contract, reviewed quarterly.',
      target: 'APPROVED',
    },
    {
      title: 'Fund a youth coding bootcamp',
      creator: peter,
      fundingAmountKes: 120000,
      description:
        'A three-month coding bootcamp for 20 youth, run with the local IT hub. Laptops shared, trainers paid from the fund.',
      target: 'VOTING',
    },
    {
      title: 'Install solar street lights on Mtaa Lane',
      creator: leader,
      fundingAmountKes: 96000,
      description:
        'Six solar street lights along the dark stretch of Mtaa Lane to improve safety for women and traders at night.',
      target: 'VOTING',
    },
    {
      title: 'Repair the estate access road',
      creator: joseph,
      fundingAmountKes: 210000,
      description:
        'Grade and murram the access road before the rains. Quotes attached; work overseen by the projects committee.',
      target: 'EXECUTED',
    },
    {
      title: 'Buy branded SACCO merchandise',
      creator: aisha,
      fundingAmountKes: 40000,
      description:
        'Branded T-shirts and caps for members. Nice-to-have, not essential right now.',
      target: 'REJECTED',
    },
  ];

  const members = await communityMembers();
  const statusOf = async (id: string) =>
    (await prisma.proposal.findUnique({
      where: { id },
      select: { status: true },
    }))!.status;

  for (const p of proposals) {
    try {
      // find-or-create (resumable — drives an existing proposal toward its target)
      let row = await prisma.proposal.findFirst({
        where: { title: p.title, groupId: group.id },
        select: { id: true },
      });
      if (!row) {
        const created = await proposalService.createProposal(p.creator.id, {
          groupId: group.id,
          title: p.title,
          description: p.description,
          fundingAmountKes: p.fundingAmountKes,
          proposalScope: 'GROUP',
        });
        row = { id: (created as any).id as string };
      }
      const id = row.id;

      if (p.target === 'DRAFT') {
        console.log(`   ✓ DRAFT: ${p.title}`);
        continue;
      }

      // DRAFT → APPROVED_FOR_VOTING (leader fast-track) + a couple of opinions
      if ((await statusOf(id)) === 'DRAFT') {
        await proposalService.reviewProposal(
          leader.id,
          id,
          { decision: 'APPROVE', note: 'Approved for a community vote.' },
          []
        );
        await annotate(members, id, p.description).catch(() => {});
      }
      if (p.target === 'APPROVED') {
        console.log(`   ✓ APPROVED: ${p.title}`);
        continue;
      }

      // APPROVED_FOR_VOTING → VOTING
      if ((await statusOf(id)) === 'APPROVED_FOR_VOTING') {
        await proposalService.startVoting(leader.id, id, []);
      }

      // cast votes once — skew toward the intended outcome
      const wantPass = p.target === 'EXECUTED';
      if ((await statusOf(id)) === 'VOTING') {
        const have = await prisma.groupMemberVote.count({
          where: { proposalId: id },
        });
        if (have === 0) {
          let n = 0;
          for (let i = 0; i < members.length; i++) {
            const m = members[i];
            const option = wantPass
              ? i % 6 === 0
                ? VoteOption.NO
                : i % 7 === 0
                  ? VoteOption.ABSTAIN
                  : VoteOption.YES
              : i % 5 === 0
                ? VoteOption.YES
                : i % 6 === 0
                  ? VoteOption.ABSTAIN
                  : VoteOption.NO;
            if (
              await proposalService
                .castVote(
                  m.id,
                  { proposalId: id, option },
                  m.primaryWardId ?? undefined
                )
                .then(() => true)
                .catch(() => false)
            )
              n++;
          }
          console.log(`     ${p.title}: ${n} votes cast`);
        }
      }
      if (p.target === 'VOTING') {
        console.log(`   ✓ VOTING: ${p.title}`);
        continue;
      }

      // EXECUTED / REJECTED → tally (outcome decided by the vote skew)
      if ((await statusOf(id)) === 'VOTING') {
        await proposalService
          .tallyVotes(id, leader.id, [])
          .catch((e) => console.warn(`     tally: ${(e as Error).message}`));
      }
      console.log(`   ✓ ${p.target}: ${p.title} → ${await statusOf(id)}`);
    } catch (e) {
      console.warn(`   ⚠ "${p.title}" — ${(e as Error).message}`);
    }
  }
}

/** Add two opinions on a substring of the proposal description. */
async function annotate(
  members: { id: string }[],
  proposalId: string,
  description: string
) {
  const picks = [
    {
      sub: description.slice(0, Math.min(24, description.length)),
      comment: 'Strongly support this — long overdue.',
    },
    {
      sub: description.slice(Math.max(0, description.length - 24)),
      comment: 'Can we see the quotes before voting?',
    },
  ];
  for (let i = 0; i < picks.length; i++) {
    const author = members[i % members.length];
    const start = description.indexOf(picks[i].sub);
    if (start < 0) continue;
    await proposalAnnotationService.create(author.id, proposalId, {
      fieldKey: 'description',
      startOffset: start,
      endOffset: start + picks[i].sub.length,
      quotedText: picks[i].sub,
      comment: picks[i].comment,
    });
  }
}

// ── Phase 4: economy (treasury funding + dues) ───────────────────────────────

async function phase4Economy(groups: { id: string; name: string }[]) {
  console.log('\n━━ Phase 4: economy (treasury + dues) ━━');
  const members = await communityMembers();

  // Fund each voluntary-group treasury via simulated M-Pesa contributions.
  for (const g of groups) {
    const t = await prisma.groupTreasury
      .findUnique({ where: { groupId: g.id }, select: { balance: true } })
      .catch(() => null);
    if (t && Number(t.balance) > 0) {
      console.log(`   • ${g.name} treasury already funded`);
      continue;
    }
    let total = 0;
    for (let i = 0; i < Math.min(12, members.length); i++) {
      const amt = 200 + (i % 4) * 150;
      const ok = await treasuryService
        .deposit(
          g.id,
          {
            amount: amt,
            description: 'M-Pesa contribution',
            referenceType: 'MPESA',
          },
          members[i].id
        )
        .then(() => true)
        .catch(() => false);
      if (ok) total += amt;
    }
    console.log(`   ✓ ${g.name}: funded ~KES ${total}`);
  }

  // ~half the members opt into monthly dues at varied tiers.
  let dues = 0;
  for (let i = 0; i < members.length; i += 2) {
    const m = members[i];
    const has = await prisma.commitment
      .findFirst({ where: { userId: m.id } })
      .catch(() => null);
    if (has) continue;
    const amt = [200, 500, 1000][i % 3];
    const ok = await commitmentService
      .createCommitment(
        m.id,
        CommitmentType.DUES,
        amt,
        undefined,
        'MONTHLY',
        12,
        groups[0]?.id
      )
      .then(() => true)
      .catch(() => false);
    if (ok) dues++;
  }
  console.log(`   ✓ dues commitments: +${dues} this run`);
}

// ── Phase 5: marketplace ─────────────────────────────────────────────────────

async function phase5Marketplace() {
  console.log('\n━━ Phase 5: marketplace ━━');
  const members = await communityMembers();
  const goods = await prisma.goodsService.findMany({
    where: { active: true },
    select: { id: true, name: true },
    take: 12,
  });
  if (!goods.length) {
    console.log('   ⚠ no goods/services seeded — skipping');
    return;
  }
  const listings = [
    {
      t: ListingType.OFFER,
      title: 'Fresh from my shamba',
      desc: 'Weekly supply, fair prices for neighbours.',
    },
    {
      t: ListingType.OFFER,
      title: 'Skilled & available',
      desc: 'Reliable, references from the estate.',
    },
    {
      t: ListingType.REQUEST,
      title: 'Looking for a supplier',
      desc: 'Steady monthly need — let us talk.',
    },
    {
      t: ListingType.REQUEST,
      title: 'Need this done well',
      desc: 'Quality matters more than the cheapest quote.',
    },
  ];
  let made = 0;
  for (let i = 0; i < Math.min(16, members.length); i++) {
    const m = members[i];
    const has = await prisma.marketplaceListing
      .findFirst({ where: { sellerUserId: m.id } })
      .catch(() => null);
    if (has) continue;
    const g = goods[i % goods.length];
    const l = listings[i % listings.length];
    const ok = await marketplaceService
      .createListing(m.id, {
        goodsServiceId: g.id,
        title: `${l.title}: ${g.name}`,
        description: l.desc,
        type: l.t,
        priceGuideKes:
          l.t === ListingType.OFFER ? 100 + (i % 5) * 50 : undefined,
      })
      .then(() => true)
      .catch(() => false);
    if (ok) made++;
  }
  console.log(`   ✓ listings: +${made} this run`);
}

// ── Phase 6: education ───────────────────────────────────────────────────────

async function phase6Education() {
  console.log('\n━━ Phase 6: education ━━');
  const members = await communityMembers();
  const modules = await prisma.educationalModule.findMany({
    where: { verified: true },
    select: { id: true, title: true },
  });
  if (!modules.length) {
    console.log('   ⚠ no education modules — run the seed first');
    return;
  }
  let completions = 0;
  // Each of the first ~12 members completes a few modules.
  for (let i = 0; i < Math.min(12, members.length); i++) {
    const m = members[i];
    for (const mod of modules.slice(0, 3 + (i % 4))) {
      const done = await prisma.userEducationalProgress
        .findFirst({
          where: { userId: m.id, moduleId: mod.id, status: 'COMPLETED' },
        })
        .catch(() => null);
      if (done) continue;
      // completeModule requires the module to have been started first.
      await educationService.startModule(m.id, mod.id).catch(() => {});
      const ok = await educationService
        .completeModule(m.id, mod.id)
        .then(() => true)
        .catch(() => false);
      if (ok) completions++;
    }
  }
  console.log(
    `   ✓ module completions: +${completions} this run (${modules.length} modules)`
  );
}

// ── Phase 7: emergency ───────────────────────────────────────────────────────

async function phase7Emergency(homeWardId: string) {
  console.log('\n━━ Phase 7: emergency ━━');
  const members = await communityMembers();
  const reports = [
    {
      type: EmergencyType.FLOOD,
      desc: 'Drainage blocked on Mtaa Lane — water rising near the shops after last night’s rain.',
    },
    {
      type: EmergencyType.SECURITY,
      desc: 'Group of strangers loitering near the school gate at night this week.',
    },
  ];
  let made = 0;
  for (let i = 0; i < reports.length; i++) {
    const r = reports[i];
    const exists = await prisma.emergencyAlert
      .findFirst({ where: { description: r.desc } })
      .catch(() => null);
    if (exists) continue;
    const ok = await emergencyService
      .reportEmergency(members[i % members.length].id, {
        type: r.type,
        description: r.desc,
        locationWardId: homeWardId,
      })
      .then(() => true)
      .catch((e) => {
        console.warn(`   ⚠ ${(e as Error).message}`);
        return false;
      });
    if (ok) made++;
  }
  console.log(`   ✓ emergency reports: +${made} this run`);
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 UjamaaDAO ecosystem simulation (additive, idempotent)');
  const { homeWard } = await phase1Cast();
  const groups = await phase2Groups(homeWard.id);
  if (groups[0]) await phase3Governance(groups[0]);
  await phase4Economy(groups);
  await phase5Marketplace();
  await phase6Education();
  await phase7Emergency(homeWard.id);
  console.log('\n✅ Simulation phase(s) complete.');
}

main()
  .catch((e) => {
    console.error('❌ Simulation failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
