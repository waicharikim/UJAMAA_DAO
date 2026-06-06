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
import { projectService } from '../../modules/projects/services/project.service.js';
import { projectUpdateService } from '../../modules/projects/services/project-update.service.js';
import { electionService } from '../../modules/elections/services/election.service.js';
import { barazaBotService } from '../../modules/integration/services/baraza-bot.service.js';

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
    rationale: string;
    alternatives: string;
    outcome?: string; // only for resolved (EXECUTED / REJECTED)
  }[] = [
    {
      title: 'Buy a shared 10,000L water tank',
      creator: joseph,
      fundingAmountKes: 85000,
      description:
        'Install a communal water tank at the estate gate so households stop paying vendors per jerrican. Cheaper water, less queuing.',
      target: 'DRAFT',
      rationale:
        'Vendor water runs KES 20–30 a jerrican; a shared tank pays for itself within months and frees women and children from the daily queue.',
      alternatives:
        'Considered individual household tanks (too costly per family) and sinking a borehole (needs a permit and far more capital — revisit once the SACCO has reserves).',
    },
    {
      title: 'Hire an estate night security guard',
      creator: aisha,
      fundingAmountKes: 144000,
      description:
        'Pool funds to hire a vetted night guard for the estate after the recent break-ins. Twelve-month contract, reviewed quarterly.',
      target: 'APPROVED',
      rationale:
        'Three break-ins in two months. A vetted night guard is the fastest, lowest-cost deterrent while we save for lighting and a gate.',
      alternatives:
        'CCTV (high upfront cost, needs power and someone to monitor) and a neighbourhood WhatsApp watch (already exists, not enough on its own).',
    },
    {
      title: 'Fund a youth coding bootcamp',
      creator: peter,
      fundingAmountKes: 120000,
      description:
        'A three-month coding bootcamp for 20 youth, run with the local IT hub. Laptops shared, trainers paid from the fund.',
      target: 'VOTING',
      rationale:
        'Twenty youth trained in three months with the local IT hub, at a fraction of private-college fees — skills that turn into income and keep talent in the ward.',
      alternatives:
        'Sponsoring individuals at private colleges (far costlier per head) and waiting for a government programme (no timeline).',
    },
    {
      title: 'Install solar street lights on Mtaa Lane',
      creator: leader,
      fundingAmountKes: 96000,
      description:
        'Six solar street lights along the dark stretch of Mtaa Lane to improve safety for women and traders at night.',
      target: 'VOTING',
      rationale:
        'The dark stretch of Mtaa Lane is where most night incidents happen. Solar means no wiring, no KPLC bill, and it keeps working during outages.',
      alternatives:
        'Grid-powered streetlights (monthly bill plus KPLC connection delays) and reflective signage (cheap but does nothing for safety).',
    },
    {
      title: 'Repair the estate access road',
      creator: joseph,
      fundingAmountKes: 210000,
      description:
        'Grade and murram the access road before the rains. Quotes attached; work overseen by the projects committee.',
      target: 'EXECUTED',
      rationale:
        'The access road floods and potholes every rainy season, cutting off matatus and boda riders. Grading and murram before the rains protects everyone’s livelihood.',
      alternatives:
        'Full tarmac (around ten times the cost, needs county engagement) and patching potholes only (washes out within weeks).',
      outcome:
        'Passed with a strong majority. Work scheduled with the projects committee before the rains; contractor quotes shortlisted and the first grading is set for next month.',
    },
    {
      title: 'Buy branded SACCO merchandise',
      creator: aisha,
      fundingAmountKes: 40000,
      description:
        'Branded T-shirts and caps for members. Nice-to-have, not essential right now.',
      target: 'REJECTED',
      rationale:
        'Branded shirts and caps would build identity and visibility at community events.',
      alternatives:
        'Put the same money toward the water tank or the road instead, and revisit merchandise once the essentials are funded.',
      outcome:
        'Voted down — members felt water and the road must come first. To be revisited after the priority projects are funded.',
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

      // Ward Memory — rationale + alternatives (and outcome for resolved ones).
      // Set directly (idempotent): these are author-provided text fields with no
      // side effects, so a plain update keeps the sim simple.
      await prisma.proposal
        .update({
          where: { id },
          data: {
            rationale: p.rationale,
            alternatives: p.alternatives,
            ...(p.outcome
              ? { outcome: p.outcome, outcomeRecordedAt: new Date() }
              : {}),
          },
        })
        .catch(() => {});

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

// ── Phase 8: projects (full lifecycle) ───────────────────────────────────────

const ok = <T>(p: Promise<T>) => p.then(() => true).catch(() => false);

async function phase8Projects(group: { id: string; name: string }) {
  console.log('\n━━ Phase 8: projects (full lifecycle) ━━');
  const passed = await prisma.proposal.findFirst({
    where: { title: 'Repair the estate access road', groupId: group.id },
    select: { id: true, creatorId: true },
  });
  if (!passed) {
    console.log('   ⚠ passed proposal not found — run Phase 3 first');
    return;
  }
  const leaderId = passed.creatorId; // project leader = the proposal's creator

  // 1. Create-or-get the project (only its creator may).
  let project = await prisma.project
    .findFirst({ where: { proposalId: passed.id }, select: { id: true } })
    .catch(() => null);
  if (!project) {
    const created = await projectService
      .createFromProposal(leaderId, { proposalId: passed.id })
      .then((p) => ({ id: (p as any).id as string }))
      .catch((e) => {
        console.warn(`   ⚠ create: ${(e as Error).message}`);
        return null;
      });
    if (!created) return;
    project = created;
    console.log('   ✓ project created from the passed road proposal');
  } else {
    console.log('   • project already exists');
  }
  const projectId = project.id;
  const members = await communityMembers();

  // 2. Members join.
  let joined = 0;
  for (let i = 0; i < Math.min(10, members.length); i++) {
    if (await ok(projectService.joinProject(members[i].id, projectId)))
      joined++;
  }

  // 3. Leader posts a project update.
  await projectUpdateService
    .create({
      projectId,
      authorId: leaderId,
      content:
        'Mobilising this week — grader booked and the murram supplier is confirmed. Asante to everyone who pledged. We start at the gate end on Saturday.',
    })
    .catch(() => {});

  // 4. Ensure two milestones exist (the sim proposal carried none).
  let milestones = await prisma.milestone
    .findMany({
      where: { projectId },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, status: true },
    })
    .catch(() => [] as { id: string; status: string }[]);
  if (milestones.length === 0) {
    await prisma.milestone
      .createMany({
        data: [
          {
            id: uuidv4(),
            projectId,
            title: 'Grade and compact the roadbed',
            description: 'Clear the verge, level, and compact before murram.',
            orderIndex: 0,
          },
          {
            id: uuidv4(),
            projectId,
            title: 'Lay murram and cut side drains',
            description:
              'Haul and spread murram, then cut drainage on both sides.',
            orderIndex: 1,
          },
        ],
      })
      .catch(() => {});
    milestones = await prisma.milestone
      .findMany({
        where: { projectId },
        orderBy: { orderIndex: 'asc' },
        select: { id: true, status: true },
      })
      .catch(() => []);
  }
  const m1 = milestones[0];
  const m2 = milestones[1];

  // 5. Milestone 1 — drive the whole flow.
  if (m1) {
    // start
    if (m1.status === 'PENDING')
      await projectService
        .startMilestone(leaderId, { milestoneId: m1.id })
        .catch(() => {});

    // tasks: create → a member claims → completes
    const taskSpecs = [
      {
        title: 'Clear bush and level the verge',
        skill: 'CONSTRUCTION' as const,
      },
      { title: 'Operate the grader', skill: 'TRANSPORT' as const },
    ];
    for (let i = 0; i < taskSpecs.length; i++) {
      const ts = taskSpecs[i];
      let task = await prisma.task
        .findFirst({
          where: { milestoneId: m1.id, title: ts.title },
          select: { id: true },
        })
        .catch(() => null);
      if (!task) {
        const created = await projectService
          .createTask(leaderId, {
            milestoneId: m1.id,
            title: ts.title,
            skillCategory: ts.skill,
            maxAssignees: 2,
          })
          .then((t) => ({ id: t.id }))
          .catch(() => null);
        task = created;
      }
      if (task) {
        const worker = members[i + 1];
        await ok(projectService.claimTask(worker.id, task.id));
        await ok(projectService.completeTask(worker.id, task.id));
      }
    }

    // physical work logs
    for (let i = 0; i < Math.min(4, members.length); i++) {
      await projectService
        .logWork(members[i].id, {
          milestoneId: m1.id,
          workType: 'MANUAL_LABOR',
          description: 'Cleared and levelled the verge by hand.',
          hours: 4,
        })
        .catch(() => {});
    }

    // QR work session (witness chain): create → members scan → attest → close
    const session = await projectService
      .createWorkSession(leaderId, { milestoneId: m1.id, durationMinutes: 120 })
      .catch(() => null);
    if (session && (session as any).qrSecret) {
      const crew = members.slice(0, 5);
      for (const w of crew)
        await ok(projectService.scanQr(w.id, (session as any).qrSecret));
      for (let i = 0; i < crew.length; i++)
        await ok(
          projectService.attestPresence(
            crew[i].id,
            (session as any).id,
            crew[(i + 1) % crew.length].id
          )
        );
      await projectService
        .closeWorkSession((session as any).id)
        .catch(() => {});
    }

    // submit → verify (leader can verify as project leader)
    await projectService
      .submitMilestone(leaderId, {
        milestoneId: m1.id,
        proofUrl: 'https://example.test/road-grading.jpg',
        description:
          'Roadbed graded and compacted end to end; photos attached.',
      })
      .catch(() => {});
    await projectService
      .verifyMilestone(leaderId, {
        milestoneId: m1.id,
        approved: true,
        feedback: 'Clean grade — well compacted. Approved.',
      })
      .catch(() => {});
  }

  // 6. Milestone 2 — start + one open task, left in progress (for variety).
  if (m2) {
    if (m2.status === 'PENDING')
      await projectService
        .startMilestone(leaderId, { milestoneId: m2.id })
        .catch(() => {});
    const has = await prisma.task
      .findFirst({ where: { milestoneId: m2.id }, select: { id: true } })
      .catch(() => null);
    if (!has)
      await projectService
        .createTask(leaderId, {
          milestoneId: m2.id,
          title: 'Haul and spread murram',
          skillCategory: 'CONSTRUCTION',
          maxAssignees: 3,
        })
        .catch(() => {});
  }

  // 7. Financial contributions (top up a few members' fiat UT, then contribute).
  let contributed = 0;
  for (let i = 0; i < Math.min(4, members.length); i++) {
    await prisma.user
      .update({
        where: { id: members[i].id },
        data: { fiatBackedUtBalance: { increment: 5000 } },
      })
      .catch(() => {});
    if (
      await ok(
        projectService.contributeToProject(members[i].id, projectId, {
          amount: 2000,
        })
      )
    )
      contributed++;
  }

  // Summary from the DB so we see exactly what landed.
  const [taskCount, logCount, sessionCount, mStatuses] = await Promise.all([
    prisma.task.count({ where: { milestone: { projectId } } }).catch(() => 0),
    prisma.physicalWorkLog
      .count({ where: { milestone: { projectId } } })
      .catch(() => 0),
    prisma.workSession
      .count({ where: { milestone: { projectId } } })
      .catch(() => 0),
    prisma.milestone
      .findMany({ where: { projectId }, select: { status: true } })
      .catch(() => [] as { status: string }[]),
  ]);
  console.log(
    `   ✓ +${joined} joined · ${mStatuses.length} milestones (${mStatuses
      .map((m: { status: string }) => m.status)
      .join(
        ', '
      )}) · ${taskCount} tasks · ${logCount} work logs · ${sessionCount} work sessions · ${contributed} contributions`
  );
}

// ── Phase 9: elections ───────────────────────────────────────────────────────

async function phase9Elections(group: { id: string; name: string }) {
  console.log('\n━━ Phase 9: elections ━━');
  const members = await communityMembers();

  let election = await prisma.election
    .findFirst({
      where: { groupId: group.id, roleKey: 'LEADER' },
      select: { id: true },
    })
    .catch(() => null);
  if (!election) {
    const created = await electionService
      .createElection({
        scope: 'GROUP',
        roleKey: 'LEADER',
        groupId: group.id,
        termMonths: 12,
      })
      .catch((e) => {
        console.warn(`   ⚠ schedule: ${(e as Error).message}`);
        return null;
      });
    if (!created) return;
    election = { id: created.id };
    console.log('   ✓ election scheduled (SACCO leader)');
  } else {
    console.log('   • election already exists');
  }
  const eid = election.id;

  // Open nominations directly (the cron windows are time-gated; the sim drives
  // the status transitions and lets nominate/castVote run their real logic).
  await prisma.election
    .update({
      where: { id: eid },
      data: {
        status: 'NOMINATIONS_OPEN',
        nominationsOpenAt: new Date(Date.now() - 3600_000),
      },
    })
    .catch(() => {});

  for (const slug of ['faith', 'brian', 'samuel']) {
    const u = await simUser(slug);
    await electionService
      .nominate(
        u.id,
        eid,
        'I will serve our SACCO with transparency and a steady hand.'
      )
      .catch(() => {});
  }

  await prisma.election
    .update({
      where: { id: eid },
      data: {
        status: 'VOTING_OPEN',
        votingOpenAt: new Date(Date.now() - 1800_000),
      },
    })
    .catch(() => {});

  const candidates = await prisma.electionCandidate
    .findMany({ where: { electionId: eid }, select: { id: true } })
    .catch(() => [] as { id: string }[]);
  if (!candidates.length) {
    console.log('   ⚠ no candidates registered');
    return;
  }

  let votes = 0;
  for (let i = 0; i < members.length; i++) {
    const c = candidates[i % candidates.length];
    if (
      await electionService
        .castVote(members[i].id, eid, c.id)
        .then(() => true)
        .catch(() => false)
    )
      votes++;
  }
  console.log(`   ✓ ${candidates.length} candidates, +${votes} votes this run`);
}

// ── Phase 10: baraza attendance ──────────────────────────────────────────────

async function phase10Baraza(homeWardId: string) {
  console.log('\n━━ Phase 10: baraza attendance ━━');
  const wardGroup = await prisma.group.findFirst({
    where: { wardId: homeWardId, systemType: 'WARD', isSystemGroup: true },
    select: { id: true, name: true },
  });
  if (!wardGroup) {
    console.log('   ⚠ ward system group not found');
    return;
  }
  const admin = await simUser('david');
  const externalGroupId = 'sim-kayole-baraza';

  // Register the ward Baraza (idempotent — one-canonical guard returns existing).
  await barazaBotService
    .registerBarazaGroup(admin.id, {
      groupId: wardGroup.id,
      platform: 'TELEGRAM',
      externalId: externalGroupId,
      name: `${wardGroup.name} Baraza`,
      inviteLink: 'https://t.me/+simKayoleBaraza',
    })
    .catch((e) => console.warn(`   ⚠ register: ${(e as Error).message}`));

  // Give ~15 verified members a Telegram messaging profile (so attendance matches).
  const members = await prisma.user.findMany({
    where: {
      email: { startsWith: 'sim.', endsWith: '@kayole.test' },
      verificationLevel: { in: ['COMMUNITY_VERIFIED', 'FULL_VERIFIED'] },
    },
    select: { id: true, email: true },
    take: 15,
  });
  const tgId = (e: string | null) =>
    'tg-' + (e ?? '').replace('sim.', '').replace('@kayole.test', '');
  for (const m of members) {
    const has = await prisma.userMessagingProfile
      .findFirst({ where: { userId: m.id, platform: 'TELEGRAM' } })
      .catch(() => null);
    if (!has) {
      await prisma.userMessagingProfile
        .create({
          data: {
            userId: m.id,
            platform: 'TELEGRAM',
            handle: tgId(m.email),
            externalUserId: tgId(m.email),
            isVerified: true,
          },
        })
        .catch(() => {});
    }
  }

  const n = await barazaBotService
    .recordAttendance({
      platform: 'TELEGRAM',
      externalGroupId,
      sessionDate: '2026-06-01',
      attendeeExternalIds: members.map((m) => tgId(m.email)),
      facilitatorExternalId: tgId(members[0].email),
      reportedBy: admin.id,
    })
    .then((r) => (Array.isArray(r) ? r.length : 0))
    .catch((e) => {
      console.warn(`   ⚠ attendance: ${(e as Error).message}`);
      return 0;
    });
  console.log(`   ✓ baraza session recorded — ${n} attendees matched`);
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
  if (groups[0]) await phase8Projects(groups[0]);
  if (groups[0]) await phase9Elections(groups[0]);
  await phase10Baraza(homeWard.id);
  console.log('\n✅ Simulation phase(s) complete.');
}

main()
  .catch((e) => {
    console.error('❌ Simulation failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
