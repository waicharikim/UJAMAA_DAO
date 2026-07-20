/**
 * @file src/core/database/seed-demo.ts
 * @description
 * Operator-run: provision the hackathon-judge DEMO account + a flagship
 * deliberation so judges can explore the live AI layer with NO signup and NO
 * magic-link inbox. Pairs with `POST /auth/demo-login` (shared passcode) and the
 * `/judges` page.
 *
 * Creates (all idempotent):
 *   1. A demo user (`DEMO_JUDGE_EMAIL`, default demo@ujamaadao.org) —
 *      COMMUNITY_VERIFIED, NON-admin, seeded with PR so it can create the demo
 *      content. Enrolled in a real ward's system-group chain so Buda has
 *      communities to reason over.
 *   2. A demo voluntary group (AGRICULTURE_COOPERATIVE).
 *   3. A demo PROJECT proposal (urban hydroponics) with structured fields.
 *   4. A real Baraza deliberation queued for it → the instant "flagship" the
 *      judges land on. (No-op if Qwen is unavailable; re-run once it is.)
 *
 * Safe to run in production (unlike seed-geo-testusers) — this is how the live
 * Alibaba demo is provisioned.
 *
 * Run: docker exec ujamaa_web npx tsx src/core/database/seed-demo.ts
 *   (compiled image: docker exec ujamaa_web node dist/core/database/seed-demo.js)
 */
import { prisma } from './client.js';
import { groupService } from '../../modules/community/services/group.service.js';
import { participationRightsService } from '../../modules/economy/services/participationRights.service.js';
import { ParticipationRightsReason } from '../../modules/economy/types.js';
import { proposalService } from '../../modules/governance/services/proposal.service.js';
import { queueBarazaDeliberation } from '../../modules/governance/baraza/baraza.job.js';
import { historianService } from '../../modules/governance/historian/historian.service.js';
import { knowledgeService } from '../../modules/governance/knowledge/knowledge.service.js';

const DEMO_EMAIL = (
  process.env.DEMO_JUDGE_EMAIL || 'demo@ujamaadao.org'
).toLowerCase();
const GROUP_NAME = 'Demo — Urban Youth Hydroponics Cooperative';
const PROPOSAL_TITLE = 'Community hydroponics units for fresh vegetables';

async function main() {
  // A real ward to anchor the demo (Buda + geographic context). Deterministic.
  const ward = await prisma.ward.findFirst({ orderBy: { name: 'asc' } });
  if (!ward) {
    throw new Error(
      'No wards found — run the core seed (geography) before the demo seed.'
    );
  }

  // 1) Demo user — verified, non-admin, funded with PR to create the content.
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      name: 'Demo (Hackathon Judge)',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      primaryWardId: ward.id,
    },
    create: {
      email: DEMO_EMAIL,
      name: 'Demo (Hackathon Judge)',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      locationVerified: false,
      primaryWardId: ward.id,
    },
  });

  // PR balance is ledger-derived (participationRightsLog), so award (not the
  // scalar) to fund the demo. A MODEST top-up — just enough to create the demo
  // group (100) + proposal (50) with headroom — so the account never looks like
  // a whale even if it somehow surfaces. It's also excluded from leaderboards
  // (see reputation.controller). Idempotent across re-runs.
  const prBalance = await participationRightsService.getBalance(user.id);
  if (prBalance < 300) {
    await participationRightsService.award(
      user.id,
      1000 - prBalance,
      ParticipationRightsReason.MONTHLY_REGENERATION,
      { seed: 'demo' }
    );
  }

  // ISOLATION: deliberately DO NOT enroll the demo user in real system groups
  // (ward → constituency → county → national). That would put it in real
  // communities' member rolls. It lives only in its own demo voluntary group;
  // Buda still has that community to reason over.

  // 2) Demo voluntary group (idempotent by name).
  let group = await prisma.group.findFirst({ where: { name: GROUP_NAME } });
  if (!group) {
    group = await groupService.createVoluntaryGroup(user.id, {
      name: GROUP_NAME,
      voluntaryType: 'AGRICULTURE_COOPERATIVE',
      description:
        'A demo cooperative of urban youth growing fresh vegetables with low-water hydroponics. Provisioned so hackathon judges can see the Baraza AI council in action.',
      wardId: ward.id,
    });
    console.log(`[demo] created voluntary group ${group.id}`);
  } else {
    console.log(`[demo] voluntary group exists ${group.id}`);
  }

  // 3) Demo PROJECT proposal (idempotent by title within the group).
  let proposal = await prisma.proposal.findFirst({
    where: { groupId: group.id, title: PROPOSAL_TITLE },
  });
  let freshProposal = false;
  if (!proposal) {
    const created = await proposalService.createProposal(user.id, {
      groupId: group.id,
      title: PROPOSAL_TITLE,
      description:
        'Set up shared hydroponic growing units so member families can grow their own fresh vegetables year-round, cutting food costs and building a small surplus to sell.',
      problem:
        'Urban member families spend a large share of income on vegetables of uneven quality, with no land to grow their own.',
      solution:
        'Pool funds to build and run shared hydroponic units on rented rooftop/idle space, run by a trained youth team, with produce shared among members and surplus sold to fund the next phase.',
      fundingSource: 'MEMBER_CONTRIBUTIONS',
      kind: 'PROJECT',
      fundingAmountKes: 520000,
      groupFundingAmount: 200000,
    });
    proposal = created as unknown as typeof proposal;
    freshProposal = true;
    console.log(`[demo] created proposal ${proposal!.id}`);
  } else {
    console.log(`[demo] proposal exists ${proposal.id}`);
  }

  // 3b) Advance the demo proposal to VOTING so judges see the full pre-vote →
  //     vote context (deliberation + vote bar), not the DRAFT author view.
  //     Voluntary + GROUP-scoped proposals fast-track past location review, and
  //     the demo user is the group LEADER, so it can open voting directly.
  const cur = await prisma.proposal.findUnique({
    where: { id: proposal!.id },
    select: { status: true },
  });
  if (cur && (cur.status === 'DRAFT' || cur.status === 'PENDING_REVIEW')) {
    await prisma.proposal.update({
      where: { id: proposal!.id },
      data: { status: 'APPROVED_FOR_VOTING' },
    });
    await proposalService.startVoting(user.id, proposal!.id, []);
    console.log('[demo] proposal advanced to VOTING');
  } else {
    console.log(`[demo] proposal already at ${cur?.status} — not advancing`);
  }

  // 3c) Activate the AI layer so the demo deliberation is well-grounded (both
  //     fail-open + idempotent; no-op without a Qwen key). For full doc RAG on
  //     prod, `docker cp docs/. ujamaa_web:/usr/src/app/knowledge-docs` BEFORE
  //     running this seed (reindex reads that dir + verified education modules).
  try {
    const events = await historianService.seedHistoricalBackbone();
    console.log(`[demo] historian backbone seeded: ${events} event(s)`);
  } catch (e) {
    console.warn('[demo] historian seed skipped:', (e as Error).message);
  }
  try {
    const chunks = await knowledgeService.reindex();
    console.log(`[demo] RAG knowledge index: ${chunks} chunk(s)`);
  } catch (e) {
    console.warn('[demo] RAG reindex skipped:', (e as Error).message);
  }

  // 4) Queue a REAL Baraza deliberation for the flagship — unless a COMPLETED
  //    one already exists. Re-runs retry a PENDING/RUNNING/FAILED one (e.g. a
  //    dev run with no Qwen key, or a transient failure on prod).
  const latest = await prisma.barazaDeliberation
    .findFirst({
      where: { proposalId: proposal!.id },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    })
    .catch(() => null);
  if (!latest || latest.status !== 'COMPLETE') {
    await queueBarazaDeliberation(proposal!.id, group.id, 'AUTHOR');
    console.log(
      '[demo] deliberation queued — the worker runs it on Qwen (~4-6 min).'
    );
  } else {
    console.log('[demo] a completed deliberation already exists — skipping.');
  }

  console.log('\n✅ Demo provisioned.');
  console.log(`   Demo user:   ${DEMO_EMAIL} (id=${user.id})`);
  console.log(`   Group:       ${GROUP_NAME} (${group.id})`);
  console.log(`   Proposal:    ${proposal!.id}`);
  console.log(
    '   Judges log in at /judges with DEMO_ACCESS_CODE (set it in .env.prod).'
  );
  await prisma.$disconnect();
}

main()
  // Force exit — the BullMQ/Redis queue connection keeps the event loop alive.
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
