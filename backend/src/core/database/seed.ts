/**
 * @file prisma/seed/core.ts
 * @description Core database seeding for UjamaaDAO — v2.1
 *
 * Seeds:
 * - System configuration
 * - Industries & Goods/Services
 * - Full Kenyan geography (counties → constituencies → wards)
 * - System groups (national, county, constituency, ward)
 * - Built-in roles
 * - Onboarding tutorials
 * - Test admin user (dev/test only)
 *
 * Safety:
 * - Blocks production runs unless FORCE_SEED=true
 * - Uses upsert to avoid duplicates
 * - Bulk operations for performance
 *
 * Version: 2.1 — January 2026
 */

import { prisma } from './client.js'; // ← Use the shared client
import { v4 as uuidv4 } from 'uuid';
import countiesData from '../data/counties.js';
import { industries as industriesList } from '../data/industries.js';
import { goodsServices as goodsList } from '../data/goodsServices.js';
import { groupMembershipService } from '../../modules/community/services/groupMembership.service.js';
import { auditService } from '../../modules/audit/services/audit.service.js';
import { AuditAction } from '../../modules/audit/types.js';

// ============================================================================
// SAFETY CHECK
// ============================================================================

if (
  process.env.NODE_ENV === 'production' &&
  process.env.FORCE_SEED !== 'true'
) {
  console.error('🚫 ERROR: Seeding is disabled in production.');
  console.error('   To override, run with FORCE_SEED=true');
  process.exit(1);
}

console.log(`🌱 Starting core seeding in ${process.env.NODE_ENV} mode...\n`);

// ============================================================================
// LOCAL TYPES
// ============================================================================

interface WardFull {
  id: string;
  name: string;
  constituencyId: string;
  countyId: string | null;
  constituency: {
    id: string;
    name: string;
    countyId: string;
    county: { id: string; name: string; code: number };
  };
}

type TestUser = {
  email: string;
  name: string;
  phoneNumber: string;
  role?: string;
  verificationLevel?: string;
};

interface WardRefs {
  firstWard: WardFull;
  secondWard: WardFull | null;
  diffConstituencyWard: WardFull | null;
  diffCountyWard: WardFull | null;
  mainSecondaryWardId: string;
}

// ============================================================================
// MODULE-LEVEL DATA CONSTANTS
// ============================================================================

const SYSTEM_CONFIG_ENTRIES = [
  // Voting thresholds
  {
    key: 'voting.quorum.community',
    value: 0.4,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'Community initiative quorum',
    isPublic: true,
  },
  {
    key: 'voting.approval.community',
    value: 0.5,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'Community initiative approval threshold',
    isPublic: true,
  },
  {
    key: 'voting.period.community',
    value: 7,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'Community initiative voting period (days)',
    isPublic: true,
  },

  {
    key: 'voting.quorum.major',
    value: 0.5,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'Major project quorum',
    isPublic: true,
  },
  {
    key: 'voting.approval.major',
    value: 0.6,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'Major project approval threshold',
    isPublic: true,
  },
  {
    key: 'voting.period.major',
    value: 14,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'Major project voting period (days)',
    isPublic: true,
  },

  {
    key: 'voting.quorum.strategic',
    value: 0.6,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'Strategic decision quorum',
    isPublic: true,
  },
  {
    key: 'voting.approval.strategic',
    value: 0.66,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'Strategic decision approval threshold',
    isPublic: true,
  },
  {
    key: 'voting.period.strategic',
    value: 21,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'Strategic decision voting period (days)',
    isPublic: true,
  },

  {
    key: 'voting.quorum.emergency',
    value: 0.3,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'Emergency proposal quorum',
    isPublic: true,
  },
  {
    key: 'voting.approval.emergency',
    value: 0.6,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'Emergency proposal approval threshold',
    isPublic: true,
  },
  {
    key: 'voting.period.emergency',
    value: 3,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'Emergency proposal voting period (days)',
    isPublic: true,
  },

  // Dues
  {
    key: 'dues.tier.ordinary',
    value: 60,
    category: 'ECONOMY',
    dataType: 'NUMBER',
    description: 'Ordinary monthly dues (KES)',
    isPublic: true,
  },
  {
    key: 'dues.tier.supporter',
    value: 200,
    category: 'ECONOMY',
    dataType: 'NUMBER',
    description: 'Supporter monthly dues (KES)',
    isPublic: true,
  },
  {
    key: 'dues.tier.sponsor',
    value: 1000,
    category: 'ECONOMY',
    dataType: 'NUMBER',
    description: 'Sponsor monthly dues (KES)',
    isPublic: true,
  },
  {
    key: 'dues.grace_period',
    value: 30,
    category: 'ECONOMY',
    dataType: 'NUMBER',
    description: 'Dues grace period (days)',
    isPublic: true,
  },

  // Impact Points
  {
    key: 'ip.decay.monthly_rate',
    value: 0.1,
    category: 'REPUTATION',
    dataType: 'NUMBER',
    description: 'Monthly IP decay rate',
    isPublic: true,
  },
  {
    key: 'ip.decay.active_user_rate',
    value: 0.05,
    category: 'REPUTATION',
    dataType: 'NUMBER',
    description: 'Active user reduced decay rate',
    isPublic: true,
  },
  {
    key: 'ip.grace_period_months',
    value: 3,
    category: 'REPUTATION',
    dataType: 'NUMBER',
    description: 'No decay for first N months',
    isPublic: true,
  },

  // Participation Rights
  {
    key: 'pr.monthly_regen',
    value: 25,
    category: 'REPUTATION',
    dataType: 'NUMBER',
    description: 'Base monthly PR regeneration',
    isPublic: true,
  },
  {
    key: 'pr.max_balance',
    value: 500,
    category: 'REPUTATION',
    dataType: 'NUMBER',
    description: 'Maximum PR balance',
    isPublic: true,
  },
  {
    key: 'pr.low_warning',
    value: 20,
    category: 'REPUTATION',
    dataType: 'NUMBER',
    description: 'Low PR warning threshold',
    isPublic: true,
  },

  // PR from dues
  {
    key: 'pr.dues.ordinary',
    value: 100,
    category: 'ECONOMY',
    dataType: 'NUMBER',
    description: 'PR from ordinary dues',
    isPublic: true,
  },
  {
    key: 'pr.dues.supporter',
    value: 200,
    category: 'ECONOMY',
    dataType: 'NUMBER',
    description: 'PR from supporter dues',
    isPublic: true,
  },
  {
    key: 'pr.dues.sponsor',
    value: 500,
    category: 'ECONOMY',
    dataType: 'NUMBER',
    description: 'PR from sponsor dues',
    isPublic: true,
  },

  // PR costs
  {
    key: 'pr.cost.vote',
    value: 5,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'PR cost to vote',
    isPublic: true,
  },
  {
    key: 'pr.cost.proposal.ward',
    value: 50,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'PR cost for ward proposal',
    isPublic: true,
  },
  {
    key: 'pr.cost.proposal.constituency',
    value: 100,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'PR cost for constituency proposal',
    isPublic: true,
  },
  {
    key: 'pr.cost.proposal.county',
    value: 150,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'PR cost for county proposal',
    isPublic: true,
  },
  {
    key: 'pr.cost.proposal.national',
    value: 200,
    category: 'GOVERNANCE',
    dataType: 'NUMBER',
    description: 'PR cost for national proposal',
    isPublic: true,
  },
  {
    key: 'pr.cost.group_create',
    value: 100,
    category: 'COMMUNITY',
    dataType: 'NUMBER',
    description: 'PR cost to create group',
    isPublic: true,
  },

  // Onboarding rewards
  {
    key: 'onboarding.email_verified.ip',
    value: 50,
    category: 'REPUTATION',
    dataType: 'NUMBER',
    description: 'IP reward for email verification',
    isPublic: true,
  },
  {
    key: 'onboarding.email_verified.pr',
    value: 25,
    category: 'REPUTATION',
    dataType: 'NUMBER',
    description: 'PR reward for email verification',
    isPublic: true,
  },
  {
    key: 'onboarding.profile_complete.ip',
    value: 25,
    category: 'REPUTATION',
    dataType: 'NUMBER',
    description: 'IP reward for profile completion',
    isPublic: true,
  },
  {
    key: 'onboarding.wallet_connected.ip',
    value: 200,
    category: 'REPUTATION',
    dataType: 'NUMBER',
    description: 'IP reward for wallet connection',
    isPublic: true,
  },
  {
    key: 'onboarding.wallet_connected.pr',
    value: 100,
    category: 'REPUTATION',
    dataType: 'NUMBER',
    description: 'PR reward for wallet connection',
    isPublic: true,
  },
  {
    key: 'onboarding.phone_verified.ip',
    value: 100,
    category: 'REPUTATION',
    dataType: 'NUMBER',
    description: 'IP reward for phone verification',
    isPublic: true,
  },
  {
    key: 'onboarding.phone_verified.pr',
    value: 25,
    category: 'REPUTATION',
    dataType: 'NUMBER',
    description: 'PR reward for phone verification',
    isPublic: true,
  },
];

const BUILT_IN_ROLES_DATA = [
  {
    name: 'system:super_admin',
    description: 'Full platform access',
  },
  {
    name: 'system:auditor',
    description: 'Read-only audit access',
  },
  {
    name: 'system:support',
    description: 'User support and moderation',
  },
  {
    name: 'system:compliance_officer',
    description: 'User verification and platform rule enforcement',
  },
  {
    name: 'system:county_coordinator',
    description:
      'County-level elected observer and coordinator (one per county, 47 total)',
  },
  {
    name: 'system:blockchain_admin',
    description:
      'Manages smart contracts — deploy, upgrade governor contracts, emergency pauses. Technical only, no governance override.',
  },
  {
    name: 'system:contract_deployer',
    description: 'Can deploy new smart contracts to the blockchain',
  },
  {
    name: 'system:multisig_signer',
    description:
      'Signs critical on-chain transactions, required for treasury operations',
  },

  {
    name: 'location:ward_admin',
    description: 'Ward administrator',
  },
  {
    name: 'location:constituency_admin',
    description: 'Constituency administrator',
  },
  {
    name: 'location:county_admin',
    description: 'County administrator',
  },

  {
    name: 'group:leader',
    description: 'Group leader',
  },
  {
    name: 'group:treasurer',
    description: 'Group treasurer',
  },
  {
    name: 'group:admin',
    description: 'Group administrator',
  },
  {
    name: 'group:auditor',
    description: 'Group auditor',
  },

  {
    name: 'project:manager',
    description: 'Project manager',
  },
  {
    name: 'project:verifier',
    description: 'Milestone verifier',
  },
];

const ONBOARDING_TUTORIALS_DATA = [
  {
    key: 'platform_intro',
    title: 'Welcome to UjamaaDAO',
    description:
      'Learn what UjamaaDAO is, how Participation Rights (PR) work, and what you can do on the platform.',
    category: 'BASICS',
    order: 1,
    ipReward: 25,
    prReward: 10,
    estimatedMinutes: 3,
    requiredFor: null,
    isOptional: false,
    content: {
      steps: [
        {
          title: 'What is UjamaaDAO?',
          body: 'UjamaaDAO is a community-owned platform for Kenyan citizens to collaborate, govern, and grow together — ward by ward. Every member earns Participation Rights (PR) for showing up and contributing.',
        },
        {
          title: 'Participation Rights (PR)',
          body: 'PR is your non-transferable civic currency. You earn PR by attending barazas, voting on proposals, completing your profile, and contributing to your community. It cannot be bought or sold.',
        },
        {
          title: 'Your verification journey',
          body: 'Start by verifying your phone number, then get vouched for by 3 ward members to unlock governance. Each step unlocks more of the platform.',
        },
      ],
    },
  },
  {
    key: 'verify_phone',
    title: 'Verify your phone number',
    description:
      'Add and verify your Kenyan phone number to unlock economy features and prove you are a real person.',
    category: 'VERIFICATION',
    order: 2,
    ipReward: 30,
    prReward: 15,
    estimatedMinutes: 2,
    requiredFor: null,
    isOptional: false,
    content: {
      steps: [
        {
          title: 'Why verify your phone?',
          body: 'Your phone number ties your UjamaaDAO account to a real Kenyan identity. It unlocks economy features, baraza attendance recording, and is required for community verification.',
        },
        {
          title: 'How to verify',
          body: 'Go to your Profile page and click "Verify Phone". You can receive your code via SMS, WhatsApp, or Telegram — whichever you prefer.',
        },
      ],
    },
  },
  {
    key: 'connect_wallet',
    title: 'Connect your Web3 wallet',
    description:
      'Link a wallet to receive Utility Tokens (UT) and participate in on-chain governance.',
    category: 'VERIFICATION',
    order: 3,
    ipReward: 30,
    prReward: 15,
    estimatedMinutes: 3,
    requiredFor: null,
    isOptional: true,
    content: {
      steps: [
        {
          title: 'What is a wallet for?',
          body: 'Your Web3 wallet is where Utility Tokens (UT) land when you earn them. UT represents long-term commitment to the community and is used in on-chain governance.',
        },
        {
          title: 'How to connect',
          body: 'Click the wallet icon in your Profile. We support MetaMask and WalletConnect. Your wallet address is stored on-chain — never your private key.',
        },
      ],
    },
  },
  {
    key: 'community_verification',
    title: 'Get community verified',
    description:
      'Have 3 verified ward members vouch for you to unlock proposals, voting, and full platform access.',
    category: 'VERIFICATION',
    order: 4,
    ipReward: 50,
    prReward: 25,
    estimatedMinutes: 5,
    requiredFor: null,
    isOptional: false,
    content: {
      steps: [
        {
          title: 'What is community verification?',
          body: 'Community verification means 3 real people in your ward can confirm you are who you say you are. This is how UjamaaDAO stays human — no bots, no fake accounts.',
        },
        {
          title: 'Who can vouch for you?',
          body: 'Any COMMUNITY_VERIFIED member in your ward can vouch for you. If you do not know anyone yet, you can pay the platform fee as an alternative path.',
        },
        {
          title: 'What does it unlock?',
          body: 'Community verification gives you access to governance (proposals and voting), the economy module, baraza attendance PR, and your full ward dashboard.',
        },
      ],
    },
  },
  {
    key: 'governance_basics',
    title: 'How governance works',
    description:
      'Learn how to read proposals, cast votes, and understand what quorum means for your ward.',
    category: 'GOVERNANCE',
    order: 5,
    ipReward: 50,
    prReward: 25,
    estimatedMinutes: 8,
    requiredFor: 'VOTING',
    isOptional: false,
    content: {
      steps: [
        {
          title: 'Proposals',
          body: 'Any COMMUNITY_VERIFIED member can raise a proposal — a request for the community to decide something. Proposals go through a draft → review → voting → results lifecycle.',
        },
        {
          title: 'Voting with PR',
          body: 'Your PR balance is your voting power. More PR = more weight. PR is earned by showing up, not by buying. This keeps governance fair and participation-based.',
        },
        {
          title: 'Quorum',
          body: "A proposal only passes if enough members vote. Quorum rules are set per ward. Check the governance page for your ward's current thresholds.",
        },
      ],
    },
  },
  {
    key: 'attend_baraza',
    title: 'Attend your first baraza',
    description:
      'Join your ward baraza group on Telegram and type /present to log attendance and earn PR.',
    category: 'COMMUNITY',
    order: 6,
    ipReward: 40,
    prReward: 20,
    estimatedMinutes: 3,
    requiredFor: null,
    isOptional: false,
    content: {
      steps: [
        {
          title: 'What is a baraza?',
          body: "A baraza is your ward's regular community meeting — held on Telegram. When you attend, you type /present and earn 15 PR automatically. Your ward leader opens and closes each session.",
        },
        {
          title: 'How to join',
          body: 'Find your baraza group link on your dashboard under "My Barazas". Join the Telegram group and introduce yourself. When the next session opens, type /present to be counted.',
        },
      ],
    },
  },
  {
    key: 'learn_basics',
    title: 'Complete a learning module',
    description:
      'Earn Impact Points by completing your first civic education module on the Learn page.',
    category: 'BASICS',
    order: 7,
    ipReward: 0,
    prReward: 5,
    estimatedMinutes: 15,
    requiredFor: null,
    isOptional: true,
    content: {
      steps: [
        {
          title: 'Learn and earn',
          body: 'The Learn section has modules covering governance, the economy system, civic rights, and more. Completing a module earns you Impact Points (IP) and strengthens your civic knowledge.',
        },
        {
          title: 'Start with the basics',
          body: 'Head to the Learn page, pick any module that interests you, click "Start Module", read through it, then click "Mark as Complete". Your IP balance updates immediately.',
        },
      ],
    },
  },
  {
    key: 'explore_marketplace',
    title: 'Explore the marketplace',
    description:
      'Browse skills and goods offered by community members in your ward and beyond.',
    category: 'MARKETPLACE',
    order: 8,
    ipReward: 20,
    prReward: 10,
    estimatedMinutes: 3,
    requiredFor: null,
    isOptional: true,
    content: {
      steps: [
        {
          title: 'Community-first marketplace',
          body: 'The UjamaaDAO marketplace is for discovering what community members offer — skills, goods, services. All transactions stay within the community.',
        },
        {
          title: 'Discovery only',
          body: 'The marketplace is a discovery platform. Payments happen directly between members via M-Pesa. Browse freely — no account needed to view listings.',
        },
      ],
    },
  },
];

const EDUCATION_MODULES_DATA = [
  {
    title: 'What is UjamaaDAO?',
    description:
      'An introduction to UjamaaDAO — what it is, why it was built, and how it empowers Kenyan ward communities through collective governance and economic cooperation.',
    content: `# What is UjamaaDAO?

UjamaaDAO is a community-owned digital platform designed to strengthen local governance and economic cooperation at the ward level in Kenya.

## The name

"Ujamaa" is a Swahili word meaning *familyhood* or *cooperative economics*. It reflects the founding belief that communities grow strongest when members invest in one another.

"DAO" stands for *Decentralised Autonomous Organisation* — a structure where decisions are made collectively by members, with rules encoded transparently on a blockchain rather than sitting with a single authority.

## Why it was built

Kenya's 1,450 wards are the smallest unit of government, yet most civic participation tools are designed for national or county use. UjamaaDAO fills this gap by giving each ward its own governed community: a space to propose projects, vote on spending, organise local markets, and track collective progress.

## The four pillars

1. **Identity & Verification** — Members verify their ward residency through community vouching (3 neighbours confirm you live there) or a one-time KES 100 payment. This makes the system Sybil-resistant and locally accountable.

2. **Participation Rights (PR)** — A non-transferable score that measures your right to participate. You earn PR by paying dues, completing education, attending barazas, and contributing to projects. You spend PR to vote and create proposals.

3. **Impact Points (IP)** — A reputation score for your contributions. IP decays slowly over time to reward sustained engagement over one-off actions.

4. **Governance** — Any verified member can propose a project or community initiative. Proposals go through a transparent voting window; passing proposals become funded projects with trackable milestones.

## What you can do on UjamaaDAO

- **Learn** — Complete education modules (like this one) to earn IP and deepen your civic knowledge.
- **Govern** — Create or vote on proposals for your ward.
- **Contribute** — Join project teams, complete milestones, and earn rewards.
- **Trade** — List skills and goods in the ward marketplace (discovery only — no platform payments).
- **Connect** — Join your ward's Telegram/WhatsApp baraza and have your attendance recorded on-chain.

## The blockchain layer

PR and Utility Tokens (UT) are minted on Base (an Ethereum Layer 2). This means your participation record is publicly verifiable and can never be altered by any single actor — including the platform team.

## Getting started

1. Verify your email → complete your profile → verify your phone.
2. Get community-verified by three ward neighbours.
3. Start participating: vote, learn, propose, contribute.

Every action you take here strengthens your ward. Welcome to UjamaaDAO.`,
    duration: 15,
    difficulty: 'BEGINNER' as const,
    category: 'civic',
    completionIP: 25,
    verified: true,
    expertApproved: true,
  },
  {
    title: 'Understanding Participation Rights (PR)',
    description:
      'Learn how Participation Rights work, how to earn them, how they are spent, and why they are non-transferable.',
    content: `# Understanding Participation Rights (PR)

Participation Rights (PR) are your democratic currency on UjamaaDAO. Unlike money, they cannot be bought, sold, or given away — they must be *earned* through genuine community participation.

## What PR measures

PR is a measure of your *right to participate* at any given moment. A high PR balance signals that you have been actively engaged with your community recently. A low balance means you may need to re-engage before you can take certain actions.

## Earning PR

| Action | PR earned |
|--------|-----------|
| Email verification | +25 |
| Phone verification | +25 |
| Monthly dues (ordinary, KES 60) | +100 |
| Monthly dues (supporter, KES 200) | +200 |
| Monthly dues (sponsor, KES 1,000) | +500 |
| Completing an education module | varies |
| Attending a baraza | +10 |
| Wallet connection | +100 |

## Spending PR

| Action | PR cost |
|--------|---------|
| Casting a vote | 5 |
| Ward proposal | 50 |
| Constituency proposal | 100 |
| County proposal | 150 |
| National proposal | 200 |
| Creating a community group | 100 |

## PR regeneration

Your PR balance regenerates by **25 PR per month** automatically, as long as your account is active. This means even members who are temporarily inactive don't lose their ability to re-engage.

## Maximum balance

The maximum PR balance is **500**. There is no benefit to accumulating PR beyond this cap — the system is designed to reward consistent participation, not hoarding.

## Why PR is non-transferable

PR cannot be transferred between users. This design choice is intentional:

- It prevents wealthy members from buying influence.
- It ensures every vote represents genuine community engagement.
- It makes the governance system resistant to capture by outside interests.

PR is recorded on the Base blockchain, meaning your participation history is transparent and tamper-proof.

## Low PR warning

When your balance falls below **20 PR**, you will see a warning in your dashboard. This is your signal to re-engage: attend a baraza, pay dues, or complete an education module.`,
    duration: 10,
    difficulty: 'BEGINNER' as const,
    category: 'governance',
    completionIP: 20,
    verified: true,
    expertApproved: true,
  },
  {
    title: 'How Governance Works',
    description:
      'A step-by-step guide to proposals, voting thresholds, quorums, and how ward decisions become funded projects.',
    content: `# How Governance Works

UjamaaDAO's governance system allows any community-verified member to propose ideas and have them decided by collective vote. Here is how the process works from start to finish.

## Step 1 — Create a proposal

Any verified member with sufficient PR can create a proposal. The cost depends on the scope:

- **Ward** (affects your ward only) — 50 PR
- **Constituency** — 100 PR
- **County** — 150 PR
- **National** — 200 PR

A proposal includes a title, description, and optionally a requested funding amount in KES. Proposals can also include milestones — measurable checkpoints for how the project will be delivered.

## Step 2 — The voting window opens

After creation, a proposal enters a *voting window*. The length depends on the proposal type:

| Type | Voting period |
|------|--------------|
| Community initiative | 7 days |
| Major project | 14 days |
| Strategic decision | 21 days |
| Emergency | 3 days |

During this window, eligible members can vote YES, NO, or ABSTAIN. Each vote costs **5 PR**.

## Step 3 — Quorum and approval thresholds

For a proposal to pass, two conditions must be met:

1. **Quorum** — A minimum percentage of eligible voters must have voted.
2. **Approval threshold** — A minimum percentage of votes must be YES.

| Proposal type | Quorum required | Approval required |
|--------------|-----------------|-------------------|
| Community | 40% | 50% |
| Major | 50% | 60% |
| Strategic | 60% | 66% |
| Emergency | 30% | 60% |

## Step 4 — Execution

If a proposal passes, it becomes an approved project. A project manager can then:

1. Break the work into milestones.
2. Assign team members.
3. Submit milestone completions with proof (photos, receipts, links).
4. Have milestones verified by designated verifiers.

Verified milestones trigger IP and PR awards to the contributors.

## Transparency

All votes, proposal texts, and results are stored immutably. No administrator can delete a proposal or alter vote counts after the window closes.

## Tips for a strong proposal

- Be specific: what exactly will be built or changed?
- Include a realistic budget with line items.
- Break large work into 3–5 milestones.
- Link your proposal to a baraza discussion so the community has context before voting.`,
    duration: 12,
    difficulty: 'BEGINNER' as const,
    category: 'governance',
    completionIP: 30,
    verified: true,
    expertApproved: true,
  },
  {
    title: 'Reading Your Ward Budget',
    description:
      'Learn how to find, read, and interrogate your ward\'s annual development budget — where money comes from, where it goes, and how citizens can hold leaders accountable.',
    content: `# Reading Your Ward Budget

Every ward in Kenya receives an allocation from the County Government and the national government through the Ward Development Fund (WDF). Understanding where this money comes from and how it is spent is a fundamental civic right.

## Where ward money comes from

| Source | Description |
|--------|-------------|
| Ward Development Fund (WDF) | National CDF allocation per ward — roughly KES 7–12 million per year |
| County Equitable Share | County decides how much reaches each ward based on population and needs |
| Own-source revenue | Local market fees, parking charges, land rates in some wards |

## How to find your ward's budget

1. **County assembly website** — Most counties publish their annual budgets and ward development fund allocations online.
2. **Ward administrator's office** — You can request a printed copy. This is your right under the Access to Information Act 2016.
3. **Public participation meetings** — County budgets must go through public participation. Attend to influence priorities before funds are allocated.

## What to look for in a budget

When you see a ward budget document, check these five things:

### 1. Allocation vs. actual spending
The budget shows what was *planned*. Check if there is an "actual expenditure" column. A large gap means funds were not spent — or not spent on what was budgeted.

### 2. Line items that benefit the most people
Water, health, roads, and schools typically affect the most residents. How much of the budget goes to these vs. administrative costs?

### 3. Pending projects from previous years
Many wards carry forward unfinished projects year after year. If a borehole was budgeted three years ago and is still incomplete, ask why.

### 4. Single-source procurement
Large contracts awarded to one supplier without competitive tendering are a red flag. Under the Public Procurement and Asset Disposal Act 2015, contracts above KES 500,000 must be openly tendered.

### 5. Travel and allowances
These are often inflated. Compare them to the budget of the most important service delivery item.

## How to ask hard questions

Use public participation forums, ward barazas, or UjamaaDAO proposals to raise concerns. Frame your questions around data:

> "The 2023/24 budget allocated KES 2.3 million for the Kamuthe road. The road is still not tarmacked. Can the ward administrator account for the expenditure?"

A question backed by budget numbers is harder to dismiss than a general complaint.

## Your rights

- You have the right to request any public financial document under the Access to Information Act 2016.
- County governments are required to hold at least two public participation forums per budget cycle.
- The Controller of Budget publishes quarterly reports on all county expenditure at controller.go.ke.`,
    duration: 18,
    difficulty: 'INTERMEDIATE' as const,
    category: 'governance',
    completionIP: 35,
    verified: true,
    expertApproved: true,
  },
  {
    title: 'Community Health: Prevention Over Cure',
    description:
      'How wards can reduce the burden of preventable disease through collective action — clean water, sanitation, immunisation, and maternal health.',
    content: `# Community Health: Prevention Over Cure

Kenya's public health system is under pressure. But the most common causes of illness and death in most wards are *preventable*. This module covers how communities can act together to reduce preventable disease before it starts.

## The leading preventable killers

According to Kenya's national health data, the top causes of death and hospitalisation in rural and peri-urban areas include:

- **Malaria** — entirely preventable with nets, drainage, and indoor spraying
- **Waterborne diarrheal diseases** — caused by contaminated water and poor sanitation
- **Respiratory infections** — worsened by indoor smoke from cooking fires
- **Maternal mortality** — most deaths occur from complications during delivery that are manageable with skilled attendance
- **Malnutrition** — especially in children under 5

Each of these is a *community problem* before it is an individual problem.

## Water and sanitation

The single highest-impact intervention any community can make is improving access to clean water. A contaminated water source affects every person, every meal, every child.

**What your ward can do:**
- Propose a borehole or rainwater harvesting project through UjamaaDAO
- Organise a community clean-up of drainage channels before the rains
- Lobby the ward administrator to chlorinate community water sources regularly

**What you can do personally:**
- Boil drinking water if you are not sure of the source
- Wash hands at critical times: after the toilet, before handling food, after handling a baby
- Keep latrines covered and at least 30 metres from any water source

## Immunisation

Kenya has a strong national immunisation programme. Every child under 1 should receive:

| Vaccine | Disease prevented | Age |
|---------|------------------|-----|
| BCG | Tuberculosis | At birth |
| OPV | Polio | 6, 10, 14 weeks |
| DTP-HepB-Hib | Diphtheria, pertussis, tetanus, hepatitis B, Hib | 6, 10, 14 weeks |
| Rotavirus | Severe diarrhoea | 6, 10 weeks |
| PCV | Pneumonia | 6, 10, 14 weeks |
| Measles/Rubella | Measles, rubella | 9 months, 18 months |

If a child misses a vaccine, they can still be caught up at any government health facility. **Vaccination is free.**

## Maternal health

A woman who delivers at a health facility with a skilled attendant is dramatically less likely to die from birth complications. In Kenya, facility deliveries have increased significantly — but in some wards, many women still deliver at home.

**How communities can support maternal health:**
- Organise community health volunteers to escort pregnant women to antenatal clinics
- Propose a community ambulance or motorbike transport fund for emergencies
- Use UjamaaDAO to fund a maternity waiting room near the local health facility

## Community health workers

Kenya's Community Health Volunteers (CHVs) are trained health workers who operate at the household level. They conduct home visits, refer sick patients, track nutrition, and run health education sessions.

If your ward has active CHVs, support them. If not, approach the sub-county health office to request CHV training for community members.

## Turning health into a proposal

Any of the above can become a UjamaaDAO proposal:
- Borehole or piped water scheme
- Community ambulance fund
- Sanitation facility construction
- CHV support fund for consumables

Use the governance module to propose, and the treasury to track funds.`,
    duration: 20,
    difficulty: 'BEGINNER' as const,
    category: 'health',
    completionIP: 30,
    verified: true,
    expertApproved: true,
  },
  {
    title: 'Smallholder Farming: Soil, Water, and Markets',
    description:
      'Practical knowledge for small-scale farmers — soil health, water harvesting, common crop diseases, and how to get better prices at the market.',
    content: `# Smallholder Farming: Soil, Water, and Markets

Over 70% of Kenyans depend on agriculture for food and income. Most are smallholder farmers working plots of less than 2 acres. This module covers three areas where small changes deliver the biggest results.

## 1. Soil health

Soil is the foundation of farming. Degraded soil produces poor yields no matter how much seed or fertiliser you add.

### Signs of degraded soil
- Hard crust that forms after rain
- Poor water infiltration — water runs off instead of soaking in
- Yellowing crops despite adequate rain
- Low yields year after year on the same plot

### Restoring soil health

**Compost** is the most cost-effective intervention. A simple compost pile — crop residues, kitchen waste, animal manure, left to decompose for 6–8 weeks — creates a soil amendment that feeds crops and improves water retention. One bag of good compost can treat 5–10 square metres.

**Crop rotation** prevents nutrient depletion. Alternate between cereals (maize, sorghum) and legumes (beans, groundnuts). Legumes fix nitrogen from the air into the soil, reducing the need for artificial fertiliser.

**Minimum tillage** — rather than deep ploughing every season, loosen only the top 5–10cm. Deep ploughing destroys the soil structure and releases stored carbon.

**Mulching** — covering the soil surface with dry grass or crop residue reduces moisture loss by 30–50% and suppresses weeds. In low-rainfall areas this can be the difference between crop failure and success.

### Soil testing

The Kenya Agricultural and Livestock Research Organisation (KALRO) offers affordable soil testing at regional centres. A soil test tells you exactly which nutrients your soil lacks, so you buy only the fertiliser you actually need — saving money and avoiding over-application.

## 2. Water harvesting

In most Kenyan agroecological zones, rainfall is adequate for crops — but it falls unevenly. The challenge is capturing and holding water when it rains.

### Zai pits
A zai pit is a small planting hole (30cm diameter, 10cm deep) dug before the rains. Filled with a handful of compost, zai pits concentrate water and nutrients directly at the root zone. They were developed in the Sahel but are highly effective in semi-arid Kenya.

### Tied ridges
Instead of making continuous furrows, block them every metre with a small ridge of soil. This creates a series of small water-holding basins that stop water from running off.

### Rainwater harvesting tanks
A 5,000-litre tank can be fed by a single iron-sheet roof and a simple gutter. Even two months of stored water can bridge a dry spell. A community can propose a shared water harvesting scheme through UjamaaDAO.

## 3. Getting better prices

Post-harvest loss and poor market access cost Kenyan smallholders billions of shillings every year. Here are four practical strategies:

### Form a group
Buyers pay higher per-unit prices for bulk supply. A group of 20 farmers selling 20 bags each can negotiate collectively and reduce transport costs.

### Time your sales
Prices are lowest immediately after harvest when everyone is selling. If you have storage, wait 4–6 weeks before selling. A simple hermetically sealed bag (PICS bag) can store grain safely for 6 months with no chemicals.

### Know the price
Check prices at the nearest market and through your County Kilimo office before accepting a price from a middleman. The e-Granary platform also lists current grain prices.

### Reduce post-harvest loss
- Dry grain to below 13% moisture before storage (test by biting — if it shatters cleanly, it is dry enough)
- Store in a clean, dry location off the ground
- Use metal bins or PICS bags to prevent weevil damage`,
    duration: 22,
    difficulty: 'BEGINNER' as const,
    category: 'agriculture',
    completionIP: 30,
    verified: true,
    expertApproved: true,
  },
  {
    title: 'Emergency Preparedness at the Ward Level',
    description:
      'How communities can prepare for floods, fires, droughts, and other emergencies before they happen — early warning, response plans, and mutual aid.',
    content: `# Emergency Preparedness at the Ward Level

Emergencies don't wait for government. When a flood arrives, a fire starts, or a drought deepens, the first responders are always community members — neighbours, local leaders, anyone who is present. This module covers how wards can prepare *before* disaster strikes.

## Why preparation matters

Research consistently shows that communities with pre-existing preparedness plans suffer fewer deaths and recover faster than those that improvise. The difference is not resources — it is *organisation*.

A community that knows:
- Who to call
- Where to go
- What to bring
- Who needs help first

...will always outperform a community that is trying to figure these things out during a crisis.

## Know your local hazards

Every ward has a different risk profile. Before you can prepare, you need to identify what you are preparing for.

| Hazard type | Common in | Warning signs |
|-------------|-----------|---------------|
| Flash floods | Riverine wards, urban valleys | Heavy upstream rain, rapid river rise |
| Drought | ASAL regions, dry highlands | Late onset rains, failed short rains |
| Fire (grass/bush) | Dry grasslands, informal settlements | Dry season + wind + ignition source |
| Disease outbreak | Dense populations, poor sanitation | Sudden cluster of similar illness |
| Landslides | Steep slopes, deforested hillsides | Heavy sustained rain |

Discuss with ward elders and the ward administrator: what emergencies have affected your ward in the last 10 years?

## Building a ward emergency plan

A ward emergency plan does not need to be a formal document. It needs to answer five questions:

### 1. Early warning
Who monitors for signs of an emergency? This might be the sub-county weather station, a river level gauge, or a community volunteer who lives near a flood-prone area. How do they communicate warnings to the rest of the community?

### 2. Evacuation routes
If people need to leave their homes, where do they go? Which routes are passable in heavy rain? Are there bridges that flood? Where is the designated meeting point?

### 3. Vulnerable persons register
Who in your ward cannot self-evacuate? Elderly people living alone, people with disabilities, households with very young children, pregnant women. A community volunteer keeping this list can save lives.

### 4. First response roles
Who does what in the first hour? This doesn't require training — it requires agreement. Examples:
- Community health volunteers: triage and first aid
- Bodaboda riders: rapid transport of injured
- Church/school: temporary shelter
- Community store owners: emergency food supplies

### 5. Communication tree
In an emergency, phone networks may be congested. A simple communication tree — each person calls two others — ensures information spreads even when direct communication fails.

## Reporting emergencies on UjamaaDAO

UjamaaDAO has a built-in emergency reporting system. When you report an emergency on the platform:

1. Your ward and sub-county administrators are immediately notified
2. The alert is visible to all ward members
3. The emergency is logged for future review and planning

To report: go to the Emergency section from your dashboard or press the emergency button in the navigation.

## Mutual aid networks

The most resilient communities are those where members look after each other. Consider organising:

- A neighbourhood watch for fire season
- A food sharing network for drought periods
- A transport mutual aid arrangement for medical emergencies

These informal networks cost nothing and save lives.`,
    duration: 18,
    difficulty: 'BEGINNER' as const,
    category: 'civic',
    completionIP: 25,
    verified: true,
    expertApproved: true,
  },
  {
    title: 'Know Your Rights: Land, Labour, and Local Governance',
    description:
      'A practical guide to the rights Kenyan citizens hold regarding land ownership, employment, and participation in local government decisions.',
    content: `# Know Your Rights: Land, Labour, and Local Governance

Kenya's constitution is one of the most progressive in Africa. It guarantees broad rights — but rights only protect you if you know them and can invoke them. This module covers three areas most relevant to ward communities.

## Land rights

Land is the most contested resource in Kenya. Here is what the law says.

### Community land

Under the Community Land Act 2016, land that is held, managed, or used by a community is community land. This includes ancestral lands, grazing land, forests used collectively, and land that families have occupied for generations without formal title.

Community land cannot be sold by individuals. It can only be transferred by a registered community with the consent of members.

**What this means for you:** If your community has been using land collectively and someone claims private title to it, you can challenge that claim. Contact the National Land Commission (NLC) or a legal aid organisation.

### Squatter rights

If you have occupied and continuously used land for **12 years or more** without the owner taking action, you may have a claim to adverse possession (squatter's rights). This is a legal process — you would need to apply to the Land Court.

### Land grabbing

Land grabbing — the illegal allocation of public or community land to individuals — is common in Kenya. If public land (a school compound, a forest reserve, a road reserve) is being fenced or developed without a community process, you have the right to:

1. Report to the county lands office
2. File a complaint with the National Land Commission (0800 723 656 — free)
3. Raise a UjamaaDAO proposal to fund legal assistance

### Searching land records

You can search land records at the nearest land registry. The search fee is KES 500. Bring the plot number (from a title deed, survey map, or rate demand notice). The search will tell you who is registered as the owner.

## Labour rights

Whether you are formally employed or working informally, you have rights.

### Minimum wage

Kenya sets minimum wages by sector and region each year through the Labour (General) (Minimum Wage) Order. As of 2024, the minimum wage for general labourers in major towns is approximately KES 16,000–19,000 per month. Agricultural workers have lower minimums.

**Your employer cannot legally pay below the minimum wage for your job category.**

### Working conditions

Under the Employment Act 2007:
- You are entitled to a written contract for any employment over one month
- Maximum working hours are 52 per week (excluding overtime)
- Overtime must be paid at 1.5× normal rate
- You are entitled to 21 working days of annual leave after 12 months
- Female employees are entitled to 3 months' maternity leave on full pay

### Reporting labour violations

Report to the nearest County Labour Office. You can also call the Ministry of Labour hotline or contact the Federation of Kenya Employers (FKE) for guidance.

Informal workers — casual labourers, domestic workers, agricultural workers — are often unaware they have the same protections. A verbal contract is still a contract.

## Rights in local governance

### Public participation

The Constitution (Article 174) and the County Governments Act require that residents are *meaningfully consulted* before decisions that affect them. This applies to:

- County budgets (you must be given a real opportunity to comment)
- Development projects (EIA processes require community input)
- Land use changes
- By-laws that affect communities

If public participation is being conducted as a rubber stamp — short notice, inaccessible venues, no translation — you can challenge the validity of the decision.

### Access to information

Under the Access to Information Act 2016, any person can request any document held by a public body. The body must respond within **21 days**. Documents that affect public health, safety, the environment, or land cannot be withheld even if they contain some confidential information.

Requests can be made in writing, by email, or at the public body's office.

### Petitions to the county assembly

Any resident can petition the County Assembly on any matter within county jurisdiction. A petition must be signed by at least 10 residents and submitted to the County Assembly Clerk. The Assembly must respond within 60 days.

Use this mechanism to raise issues that the ward administration has not acted on.`,
    duration: 25,
    difficulty: 'INTERMEDIATE' as const,
    category: 'civic',
    completionIP: 40,
    verified: true,
    expertApproved: true,
  },
  {
    title: 'The Community Economy: Utility Tokens and the Ward Treasury',
    description:
      'How UjamaaDAO\'s internal economy works — Utility Tokens, the ward treasury, dues allocation, and how community funds become real projects.',
    content: `# The Community Economy: Utility Tokens and the Ward Treasury

UjamaaDAO runs a parallel community economy alongside the formal Kenyan economy. This module explains how money and tokens flow through the system, from a member paying dues to a funded borehole.

## Two types of value

UjamaaDAO tracks two distinct types of value:

### Participation Rights (PR)
Already covered in another module. PR measures your democratic engagement. It is non-transferable and cannot be bought.

### Utility Tokens (UT)
UT is the economic token. It comes in two forms:

| Type | Source | Can it be withdrawn? |
|------|--------|---------------------|
| **Fiat-backed UT** | Depositing KES via M-Pesa | Yes — back to M-Pesa at 1 UT = 1 KES |
| **Earned UT** | Platform rewards (contributing, learning, completing tasks) | No — for in-platform use only |

This distinction is permanent. Fiat-backed UT and earned UT are tracked separately and can never be merged.

## How dues work

When a member pays monthly dues via M-Pesa, the payment goes to a platform-controlled account (never peer-to-peer). The KES amount is then split across four treasury levels:

| Level | Share | Purpose |
|-------|-------|---------|
| Ward treasury | 70% | Directly funds local projects |
| Constituency treasury | 15% | Cross-ward projects |
| County treasury | 10% | County-level initiatives |
| National treasury | 5% | Platform operations and national projects |

This split is configurable by platform administrators and can be adjusted to reflect community priorities.

## The ward treasury

Your ward's treasury is visible to all members on the Treasury page. It shows:

- Current balance
- Incoming contributions (dues, direct deposits)
- Outgoing disbursements (approved projects)
- Transaction history

Funds in the treasury can only be disbursed through an approved governance proposal. No individual — including platform administrators — can unilaterally withdraw from a ward treasury.

## From treasury to project

Here is the full flow from a proposal passing to money being spent:

1. A proposal is submitted and passes the voting threshold
2. The proposal enters the **APPROVED** state
3. A project manager launches the project from the approved proposal
4. The project is broken into milestones with deliverables
5. Treasury funds are locked (not yet disbursed) when the project enters **EXECUTING** state
6. As milestones are verified, proportional funds are released
7. Milestone completion is recorded on-chain — tamper-proof

This milestone-based disbursement ensures money is only released when real work is done.

## Earning UT through contribution

Beyond dues, members can earn UT by:

- Contributing to verified project milestones
- Attending barazas (recorded on-chain via the /present command)
- Completing education modules
- Having work sessions verified by witnesses (QR-code based)

Earned UT cannot be withdrawn to M-Pesa, but it can be used for in-platform actions such as boosting marketplace listings or contributing to community funds.

## Transparency

All treasury transactions are logged in the audit trail. The blockchain layer provides a second, immutable record of key transactions. This means:

- No one can hide money that entered the treasury
- No one can claim a milestone was completed if it wasn't verified
- Every member can trace every shilling from contribution to project delivery

This transparency is the core promise of the community economy. It transforms "trust me" into "check the record".`,
    duration: 16,
    difficulty: 'INTERMEDIATE' as const,
    category: 'economy',
    completionIP: 35,
    verified: true,
    expertApproved: true,
  },
];

const ROLE_COVERAGE_USERS_DATA: TestUser[] = [
  {
    email: 'compliance@ujamaa.test',
    name: 'Compliance Officer',
    phoneNumber: '+254700000001',
    role: 'system:compliance_officer',
    verificationLevel: 'FULL_VERIFIED',
  },
  {
    email: 'auditor@ujamaa.test',
    name: 'System Auditor',
    phoneNumber: '+254700000005',
    role: 'system:auditor',
    verificationLevel: 'FULL_VERIFIED',
  },
  {
    email: 'coordinator@ujamaa.test',
    name: 'County Coordinator',
    phoneNumber: '+254700000006',
    role: 'system:county_coordinator',
    verificationLevel: 'FULL_VERIFIED',
  },
  {
    email: 'support@ujamaa.test',
    name: 'Support Staff',
    phoneNumber: '+254700000007',
    role: 'system:support',
    verificationLevel: 'FULL_VERIFIED',
  },
  {
    email: 'ward.admin@ujamaa.test',
    name: 'Ward Administrator',
    phoneNumber: '+254700000002',
    role: 'location:ward_admin',
    verificationLevel: 'FULL_VERIFIED',
  },
  {
    email: 'constituency.admin@ujamaa.test',
    name: 'Constituency Administrator',
    phoneNumber: '+254700000003',
    role: 'location:constituency_admin',
    verificationLevel: 'FULL_VERIFIED',
  },
  {
    email: 'county.admin@ujamaa.test',
    name: 'County Administrator',
    phoneNumber: '+254700000004',
    role: 'location:county_admin',
    verificationLevel: 'FULL_VERIFIED',
  },
  {
    email: 'waichari@ujamaa.test',
    name: 'James Waichari',
    phoneNumber: '+254700000010',
  },
  {
    email: 'akinyi@ujamaa.test',
    name: 'Grace Akinyi',
    phoneNumber: '+254700000011',
  },
  {
    email: 'otieno@ujamaa.test',
    name: 'Kevin Otieno',
    phoneNumber: '+254700000012',
  },
];

// ============================================================================
// 1. SYSTEM CONFIGURATION
// ============================================================================

async function seedSystemConfiguration() {
  console.log('Seeding system configuration...');

  let created = 0;
  for (const config of SYSTEM_CONFIG_ENTRIES) {
    const result = await prisma.systemConfiguration.upsert({
      where: { key: config.key },
      update: {
        value: config.value,
        description: config.description,
      },
      create: {
        id: uuidv4(),
        key: config.key,
        value: config.value,
        category: config.category,
        dataType: config.dataType,
        description: config.description,
        isPublic: config.isPublic ?? false,
      },
    });

    if (result) created++;
  }

  console.log(`   Created/updated ${created} system configuration entries`);
}

// ============================================================================
// 2. INDUSTRIES & GOODS/SERVICES
// ============================================================================

async function seedIndustriesAndGoods() {
  console.log('Seeding industries and goods/services...');

  // Industries
  const industryData = industriesList.map((name: string) => ({
    id: uuidv4(),
    name,
  }));

  await prisma.industry.createMany({
    data: industryData,
    skipDuplicates: true,
  });

  const industries = await prisma.industry.findMany();
  const industryMap = new Map(industries.map((i) => [i.name, i.id]));

  console.log(`   Created/ensured ${industries.length} industries`);

  // Goods/Services
  const validGoods = goodsList
    .map((good: any) => {
      const industryId = industryMap.get(good.industry);
      if (!industryId) {
        console.warn(
          `   Skipping "${good.name}" — industry "${good.industry}" not found`
        );
        return null;
      }
      return {
        id: uuidv4(),
        name: good.name,
        industryId,
        category: good.category || null,
        active: true,
      };
    })
    .filter(Boolean);

  await prisma.goodsService.createMany({
    data: validGoods as any,
    skipDuplicates: true,
  });

  console.log(`   Created/ensured ${validGoods.length} goods/services`);
}

// ============================================================================
// 3. GEOGRAPHY — Full Kenya
// ============================================================================

function buildGeographyRecords(data: typeof countiesData) {
  const countyCreates: { id: string; code: number; name: string }[] = [];
  const constituencyCreates: {
    id: string;
    name: string;
    countyId: string;
  }[] = [];
  const wardCreates: {
    id: string;
    name: string;
    constituencyId: string;
    countyId: string;
    code: null;
  }[] = [];
  let counties = 0,
    constituencies = 0,
    wards = 0;

  for (const county of data) {
    if (!county.code || !county.name) {
      console.warn(`Skipping invalid county:`, county);
      continue;
    }

    const countyId = uuidv4();
    countyCreates.push({ id: countyId, code: county.code, name: county.name });
    counties++;

    for (const cons of county.constituencies ?? []) {
      if (!cons.name) continue;

      const consId = uuidv4();
      constituencyCreates.push({ id: consId, name: cons.name, countyId });
      constituencies++;

      const uniqueWards = [...new Set(cons.wards ?? [])].filter(Boolean);
      for (const wardName of uniqueWards) {
        wardCreates.push({
          id: uuidv4(),
          name: wardName,
          constituencyId: consId,
          countyId,
          code: null,
        });
        wards++;
      }
    }
  }

  return {
    countyCreates,
    constituencyCreates,
    wardCreates,
    counts: { counties, constituencies, wards },
  };
}

async function seedGeography() {
  console.log('Seeding Kenyan geography...');

  // Clear existing data
  await prisma.$transaction([
    prisma.ward.deleteMany(),
    prisma.constituency.deleteMany(),
    prisma.county.deleteMany(),
  ]);

  const { countyCreates, constituencyCreates, wardCreates, counts } =
    buildGeographyRecords(countiesData);

  await prisma.county.createMany({ data: countyCreates });
  await prisma.constituency.createMany({ data: constituencyCreates });
  await prisma.ward.createMany({ data: wardCreates });

  console.log(
    `Created ${counts.counties} counties, ${counts.constituencies} constituencies, ${counts.wards} wards`
  );
}

// ============================================================================
// 4. SYSTEM GROUPS
// ============================================================================

async function seedSystemGroups() {
  console.log('Creating system groups...');

  const [national, counties, constituencies, wards] = await Promise.all([
    prisma.group.upsert({
      where: { name: 'Kenya National Community' },
      update: {},
      create: {
        id: uuidv4(),
        name: 'Kenya National Community',
        description: 'National-level governance for all members',
        locationScope: 'NATIONAL',
        isSystemGroup: true,
        systemType: 'NATIONAL',
        canBeDeleted: false,
        canBeRenamed: false,
        status: 'ACTIVE',
      },
    }),
    prisma.county.findMany(),
    prisma.constituency.findMany(),
    prisma.ward.findMany(),
  ]);

  void national; // used only for the upsert side-effect

  const groupData = [
    ...counties.map((c) => ({
      id: uuidv4(),
      name: `${c.name} County Community`,
      description: `County-level community for ${c.name}`,
      locationScope: 'COUNTY' as const,
      countyId: c.id,
      isSystemGroup: true,
      systemType: 'COUNTY' as const,
      canBeDeleted: false,
      canBeRenamed: false,
      status: 'ACTIVE' as const,
    })),
    ...constituencies.map((c) => ({
      id: uuidv4(),
      name: `${c.name} Constituency Community`,
      description: `Constituency community for ${c.name}`,
      locationScope: 'CONSTITUENCY' as const,
      constituencyId: c.id,
      countyId: c.countyId,
      isSystemGroup: true,
      systemType: 'CONSTITUENCY' as const,
      canBeDeleted: false,
      canBeRenamed: false,
      status: 'ACTIVE' as const,
    })),
    ...wards.map((w) => ({
      id: uuidv4(),
      name: `${w.name} Ward Community`,
      description: `Local community for ${w.name} Ward`,
      locationScope: 'WARD' as const,
      wardId: w.id,
      constituencyId: w.constituencyId,
      countyId: w.countyId,
      isSystemGroup: true,
      systemType: 'WARD' as const,
      canBeDeleted: false,
      canBeRenamed: false,
      status: 'ACTIVE' as const,
    })),
  ];

  await prisma.group.createMany({
    data: groupData,
    skipDuplicates: true,
  });

  console.log(
    `   Created 1 national + ${counties.length} county + ${constituencies.length} constituency + ${wards.length} ward groups`
  );
}

// ============================================================================
// 5. ROLES
// ============================================================================

async function seedRoles() {
  console.log('Seeding built-in roles...');

  for (const role of BUILT_IN_ROLES_DATA) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: {
        id: uuidv4(),
        name: role.name,
        description: role.description,
      },
    });
  }

  console.log(
    `   Created/ensured ${BUILT_IN_ROLES_DATA.length} built-in roles`
  );
}

// ============================================================================
// 6. ONBOARDING TUTORIALS
// ============================================================================

async function seedOnboardingTutorials() {
  console.log('Seeding onboarding tutorials...');

  for (const tutorial of ONBOARDING_TUTORIALS_DATA) {
    const { content, ...rest } = tutorial;
    await prisma.onboardingTutorial.upsert({
      where: { key: tutorial.key },
      update: { ...rest, content: content as any },
      create: {
        id: uuidv4(),
        ...rest,
        active: true,
        content: content as any,
      },
    });
  }

  console.log(
    `   Created/ensured ${ONBOARDING_TUTORIALS_DATA.length} tutorials`
  );
}

// ============================================================================
// 7. TEST ADMIN USER (dev/test only)
// ============================================================================

async function assignAdminRoles(adminUserId: string) {
  const superRole = await prisma.role.findUnique({
    where: { name: 'system:super_admin' },
  });
  if (superRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: adminUserId, roleId: superRole.id },
      },
      update: {},
      create: {
        id: uuidv4(),
        userId: adminUserId,
        roleId: superRole.id,
        active: true,
      },
    });
  }

  // Also give admin ward_admin role for dev testing of the proposal review chain
  const wardAdminRole = await prisma.role.findUnique({
    where: { name: 'location:ward_admin' },
  });
  if (wardAdminRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: adminUserId, roleId: wardAdminRole.id },
      },
      update: { active: true },
      create: {
        id: uuidv4(),
        userId: adminUserId,
        roleId: wardAdminRole.id,
        active: true,
      },
    });
  }
}

async function seedTestAdmin() {
  if (process.env.NODE_ENV === 'production') {
    console.log('   Skipping test admin in production');
    return;
  }

  console.log('   Creating test admin user...');

  const firstWard = await prisma.ward.findFirst();
  if (!firstWard) {
    console.warn('   No ward found — skipping test admin');
    return;
  }

  const adminSecondaryWard = await prisma.ward.findFirst({
    where: {
      constituencyId: firstWard.constituencyId,
      id: { not: firstWard.id },
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ujamaa.test' },
    update: {
      // Always keep the admin fully verified and in a ward (fixes re-seed after ward data added)
      primaryWardId: firstWard.id,
      secondaryWardId: adminSecondaryWard?.id ?? firstWard.id,
      verificationLevel: 'FULL_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
    },
    create: {
      id: uuidv4(),
      email: 'admin@ujamaa.test',
      name: 'System Administrator',
      phoneNumber: '+254700000000',
      primaryWardId: firstWard.id,
      secondaryWardId: adminSecondaryWard?.id ?? firstWard.id,
      verificationLevel: 'FULL_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      participationRights: 1000,
      globalImpactPoints: 10000,
    },
  });

  await assignAdminRoles(adminUser.id);

  console.log(
    `   Created admin@ujamaa.test with super admin + ward admin roles`
  );
}

// ============================================================================
// 8b. TEST USERS — helpers (dev/test only)
// ============================================================================

async function seedSpecialCaseUsers(
  firstWard: { id: string },
  mainSecondaryWardId: string
) {
  // PHONE_VERIFIED user — for testing verification flow UX
  await prisma.user.upsert({
    where: { email: 'phone-only@ujamaa.test' },
    update: {
      primaryWardId: firstWard.id,
      secondaryWardId: mainSecondaryWardId,
      verificationLevel: 'PHONE_VERIFIED',
    },
    create: {
      id: uuidv4(),
      email: 'phone-only@ujamaa.test',
      name: 'Amina Phone-Only',
      phoneNumber: '+254700000020',
      primaryWardId: firstWard.id,
      secondaryWardId: mainSecondaryWardId,
      verificationLevel: 'PHONE_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: false,
      participationRights: 0,
      globalImpactPoints: 0,
    },
  });

  // EMAIL_VERIFIED user — for testing onboarding / nudge UX
  await prisma.user.upsert({
    where: { email: 'email-only@ujamaa.test' },
    update: {
      primaryWardId: firstWard.id,
      secondaryWardId: mainSecondaryWardId,
      verificationLevel: 'EMAIL_VERIFIED',
    },
    create: {
      id: uuidv4(),
      email: 'email-only@ujamaa.test',
      name: 'Brian Email-Only',
      phoneNumber: '+254700000021',
      primaryWardId: firstWard.id,
      secondaryWardId: mainSecondaryWardId,
      verificationLevel: 'EMAIL_VERIFIED',
      emailVerified: true,
      phoneVerified: false,
      communityVerified: false,
      participationRights: 50,
      globalImpactPoints: 0,
    },
  });

  // FULL_VERIFIED member without special roles — wallet connected
  await prisma.user.upsert({
    where: { email: 'full-member@ujamaa.test' },
    update: {
      primaryWardId: firstWard.id,
      secondaryWardId: mainSecondaryWardId,
      verificationLevel: 'FULL_VERIFIED',
    },
    create: {
      id: uuidv4(),
      email: 'full-member@ujamaa.test',
      name: 'Wanjiru Full-Member',
      phoneNumber: '+254700000022',
      primaryWardId: firstWard.id,
      secondaryWardId: mainSecondaryWardId,
      verificationLevel: 'FULL_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      walletAddress: '0xfullmember000000000000000000000000000001',
      participationRights: 200,
      globalImpactPoints: 500,
    },
  });
}

async function upsertGeoSpreadUser(params: {
  email: string;
  name: string;
  phoneNumber: string;
  primaryWardId: string;
  secondaryWardId: string;
}) {
  await prisma.user.upsert({
    where: { email: params.email },
    update: {
      primaryWardId: params.primaryWardId,
      secondaryWardId: params.secondaryWardId,
    },
    create: {
      id: uuidv4(),
      email: params.email,
      name: params.name,
      phoneNumber: params.phoneNumber,
      primaryWardId: params.primaryWardId,
      secondaryWardId: params.secondaryWardId,
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      participationRights: 300,
      globalImpactPoints: 100,
    },
  });
}

async function seedGeographicSpreadUsers(refs: WardRefs) {
  const { firstWard, secondWard, diffConstituencyWard, diffCountyWard } = refs;

  if (secondWard) {
    await upsertGeoSpreadUser({
      email: 'ward2.member@ujamaa.test',
      name: `${secondWard.name} Member`,
      phoneNumber: '+254700000030',
      primaryWardId: secondWard.id,
      secondaryWardId: firstWard.id,
    });
    console.log(
      `   → ward2.member placed in ward: ${secondWard.name} (${secondWard.constituency.name})`
    );
  }

  if (diffConstituencyWard) {
    await upsertGeoSpreadUser({
      email: 'const.member@ujamaa.test',
      name: `${diffConstituencyWard.constituency.name} Member`,
      phoneNumber: '+254700000031',
      primaryWardId: diffConstituencyWard.id,
      secondaryWardId: firstWard.id,
    });
    console.log(
      `   → const.member placed in constituency: ${diffConstituencyWard.constituency.name} (${diffConstituencyWard.constituency.county.name})`
    );
  }

  if (diffCountyWard) {
    await upsertGeoSpreadUser({
      email: 'county.member@ujamaa.test',
      name: `${diffCountyWard.constituency.county.name} Member`,
      phoneNumber: '+254700000032',
      primaryWardId: diffCountyWard.id,
      secondaryWardId: firstWard.id,
    });
    console.log(
      `   → county.member placed in county: ${diffCountyWard.constituency.county.name}`
    );
  }
}

async function seedRoleCoverageUsers(
  firstWard: { id: string },
  mainSecondaryWardId: string
): Promise<Record<string, string>> {
  const COMMON_FIELDS = {
    emailVerified: true,
    phoneVerified: true,
    communityVerified: true,
    verificationLevel: 'COMMUNITY_VERIFIED' as const,
    participationRights: 500,
    globalImpactPoints: 200,
    primaryWardId: firstWard.id,
    secondaryWardId: mainSecondaryWardId,
  };

  const testUsers = ROLE_COVERAGE_USERS_DATA;

  const createdUsers: Record<string, string> = {};

  for (const u of testUsers) {
    const verificationLevel = (u.verificationLevel ??
      COMMON_FIELDS.verificationLevel) as
      | 'COMMUNITY_VERIFIED'
      | 'FULL_VERIFIED';
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        primaryWardId: firstWard.id,
        secondaryWardId: mainSecondaryWardId,
        verificationLevel,
      },
      create: {
        id: uuidv4(),
        email: u.email,
        name: u.name,
        phoneNumber: u.phoneNumber,
        ...COMMON_FIELDS,
        verificationLevel,
      },
    });
    createdUsers[u.email] = user.id;

    if (u.role) {
      const roleRecord = await prisma.role.findUnique({
        where: { name: u.role },
      });
      if (roleRecord) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: roleRecord.id } },
          update: { active: true },
          create: {
            id: uuidv4(),
            userId: user.id,
            roleId: roleRecord.id,
            active: true,
          },
        });
      }
    }
  }

  return createdUsers;
}

async function seedBoreholeGroupAndMembers(
  firstWard: { id: string },
  createdUsers: Record<string, string>
) {
  const boreholeGroup = await prisma.group
    .upsert({
      where: {
        name_wardId: {
          name: 'Kayole Borehole Committee',
          wardId: firstWard.id,
        },
      } as any,
      update: {},
      create: {
        id: uuidv4(),
        name: 'Kayole Borehole Committee',
        description:
          'Community borehole construction and maintenance committee',
        isSystemGroup: false,
        locationScope: 'WARD',
        voluntaryType: 'INFRASTRUCTURE_COMMITTEE',
        wardId: firstWard.id,
        memberCount: 0,
      },
    })
    .catch(async () => {
      // fallback: group may exist in a different ward from a prior seed run
      const existing = await prisma.group.findFirst({
        where: { name: 'Kayole Borehole Committee' },
      });
      if (existing) return existing;
      // Only create if truly absent (name is globally unique on Group)
      return prisma.group.create({
        data: {
          id: uuidv4(),
          name: 'Kayole Borehole Committee',
          description:
            'Community borehole construction and maintenance committee',
          isSystemGroup: false,
          locationScope: 'WARD',
          voluntaryType: 'INFRASTRUCTURE_COMMITTEE',
          wardId: firstWard.id,
          memberCount: 0,
        },
      });
    });

  const groupMembers = [
    { email: 'waichari@ujamaa.test', role: 'LEADER' },
    { email: 'akinyi@ujamaa.test', role: 'MEMBER' },
    { email: 'otieno@ujamaa.test', role: 'MEMBER' },
  ];

  let memberCount = 0;
  for (const m of groupMembers) {
    const userId = createdUsers[m.email];
    if (!userId) continue;
    await prisma.groupMember.upsert({
      where: { userId_groupId: { userId, groupId: boreholeGroup.id } },
      update: {},
      create: {
        userId,
        groupId: boreholeGroup.id,
        role: m.role as any,
        autoEnrolled: false,
        canLeave: true,
        joinedAt: new Date(),
        active: true,
      },
    });
    memberCount++;
  }

  await prisma.group.update({
    where: { id: boreholeGroup.id },
    data: { memberCount },
  });

  return boreholeGroup;
}

async function createSeedProposalIfAbsent(
  groupId: string,
  creatorId: string,
  data: { title: string; description: string; status: string; budget: number },
  extraAuditStatuses: string[] = []
) {
  const existing = await prisma.proposal.findFirst({
    where: { title: data.title, creatorId },
  });
  if (existing) return;
  const p = await prisma.proposal.create({
    data: {
      id: uuidv4(),
      groupId,
      creatorId,
      title: data.title,
      description: data.description,
      status: data.status as any,
      proposalType: 'COMMUNITY_INITIATIVE',
      proposalScope: 'COMMUNITY',
      budget: data.budget,
    },
  });
  await auditService.log(
    creatorId,
    AuditAction.PROPOSAL_CREATED,
    'Proposal',
    p.id,
    { groupId, title: p.title, scope: 'COMMUNITY' }
  );
  for (const newStatus of extraAuditStatuses) {
    await auditService.log(
      creatorId,
      AuditAction.PROPOSAL_STATUS_CHANGED,
      'Proposal',
      p.id,
      { newStatus, stage: 1 }
    );
  }
}

async function seedTestProposals(
  boreholeGroup: { id: string },
  waichariId: string
) {
  await createSeedProposalIfAbsent(boreholeGroup.id, waichariId, {
    title: 'New Community Borehole',
    description:
      'Proposal to drill a new borehole in Kayole Ward to address water scarcity affecting 5,000 residents.',
    status: 'DRAFT',
    budget: 350000,
  });
  await createSeedProposalIfAbsent(
    boreholeGroup.id,
    waichariId,
    {
      title: 'Road Maintenance Request',
      description:
        'Request for maintenance of the main access road connecting Kayole to Embakasi Road.',
      status: 'PENDING_REVIEW',
      budget: 150000,
    },
    ['PENDING_REVIEW']
  );
  await createSeedProposalIfAbsent(
    boreholeGroup.id,
    waichariId,
    {
      title: 'Youth Skills Programme',
      description:
        'Six-month vocational skills programme for unemployed youth aged 18–35 in Kayole Ward.',
      status: 'APPROVED_FOR_VOTING',
      budget: 200000,
    },
    ['APPROVED_FOR_VOTING']
  );
}

function buildExtraEmailEnrollments(refs: WardRefs) {
  const {
    firstWard,
    secondWard,
    diffConstituencyWard,
    diffCountyWard,
    mainSecondaryWardId,
  } = refs;
  return [
    {
      email: 'phone-only@ujamaa.test',
      primary: firstWard.id,
      secondary: mainSecondaryWardId,
    },
    {
      email: 'email-only@ujamaa.test',
      primary: firstWard.id,
      secondary: mainSecondaryWardId,
    },
    {
      email: 'full-member@ujamaa.test',
      primary: firstWard.id,
      secondary: mainSecondaryWardId,
    },
    ...(secondWard
      ? [
          {
            email: 'ward2.member@ujamaa.test',
            primary: secondWard.id,
            secondary: firstWard.id,
          },
        ]
      : []),
    ...(diffConstituencyWard
      ? [
          {
            email: 'const.member@ujamaa.test',
            primary: diffConstituencyWard.id,
            secondary: firstWard.id,
          },
        ]
      : []),
    ...(diffCountyWard
      ? [
          {
            email: 'county.member@ujamaa.test',
            primary: diffCountyWard.id,
            secondary: firstWard.id,
          },
        ]
      : []),
  ];
}

async function enrollAllUsersIntoSystemGroups(
  refs: WardRefs,
  createdUsers: Record<string, string>
) {
  console.log('   Enrolling test users into system groups...');

  const allUsersForEnrollment: {
    userId: string;
    primary: string;
    secondary: string;
  }[] = [];

  for (const [, userId] of Object.entries(createdUsers)) {
    allUsersForEnrollment.push({
      userId,
      primary: refs.firstWard.id,
      secondary: refs.mainSecondaryWardId,
    });
  }

  for (const { email, primary, secondary } of buildExtraEmailEnrollments(
    refs
  )) {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (u) allUsersForEnrollment.push({ userId: u.id, primary, secondary });
  }

  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@ujamaa.test' },
    select: { id: true },
  });
  if (adminUser) {
    allUsersForEnrollment.push({
      userId: adminUser.id,
      primary: refs.firstWard.id,
      secondary: refs.mainSecondaryWardId,
    });
  }

  let enrolled = 0;
  for (const { userId, primary, secondary } of allUsersForEnrollment) {
    try {
      await groupMembershipService.enrollInSystemGroups(
        userId,
        primary,
        secondary
      );
      enrolled++;
      await auditService.log(
        userId,
        AuditAction.GROUP_JOINED,
        'Group',
        primary,
        {}
      );
    } catch {
      // already enrolled — safe to ignore
    }
  }

  console.log(`   Enrolled ${enrolled} users into system groups`);
}

// ============================================================================
// 8b. TEST USERS — orchestrator (dev/test only)
// ============================================================================

async function seedTestUsers() {
  if (process.env.NODE_ENV === 'production') {
    console.log('   Skipping test users in production');
    return;
  }

  console.log(
    '   Seeding test users (role coverage + governance test data)...'
  );

  const firstWard = await prisma.ward.findFirst({
    include: { constituency: { include: { county: true } } },
  });
  if (!firstWard) {
    console.warn('   No ward found — skipping test users');
    return;
  }

  const secondWard = await prisma.ward.findFirst({
    where: {
      constituencyId: firstWard.constituencyId,
      id: { not: firstWard.id },
    },
    include: { constituency: { include: { county: true } } },
  });

  const diffConstituencyWard = await prisma.ward.findFirst({
    where: {
      constituency: {
        countyId: firstWard.constituency.countyId,
        id: { not: firstWard.constituencyId },
      },
    },
    include: { constituency: { include: { county: true } } },
  });

  const diffCountyWard = await prisma.ward.findFirst({
    where: {
      constituency: {
        countyId: { not: firstWard.constituency.countyId },
      },
    },
    include: { constituency: { include: { county: true } } },
  });

  const mainSecondaryWardId = secondWard?.id ?? firstWard.id;

  const refs: WardRefs = {
    firstWard,
    secondWard,
    diffConstituencyWard,
    diffCountyWard,
    mainSecondaryWardId,
  };
  await seedSpecialCaseUsers(firstWard, mainSecondaryWardId);
  await seedGeographicSpreadUsers(refs);
  const createdUsers = await seedRoleCoverageUsers(
    firstWard,
    mainSecondaryWardId
  );
  const boreholeGroup = await seedBoreholeGroupAndMembers(
    firstWard,
    createdUsers
  );
  const waichariId = createdUsers['waichari@ujamaa.test'];
  if (waichariId) await seedTestProposals(boreholeGroup, waichariId);
  await enrollAllUsersIntoSystemGroups(refs, createdUsers);

  console.log(
    `   Created ${Object.keys(createdUsers).length} test users, 1 voluntary group, 3 test proposals`
  );
}

// ============================================================================
// 8. EDUCATION MODULES (template modules about the system itself)
// ============================================================================

async function seedEducationModules() {
  if (process.env.NODE_ENV === 'production') {
    console.log('   Skipping education module seed in production');
    return;
  }

  console.log('   Seeding education modules...');

  const admin = await prisma.user.findUnique({
    where: { email: 'admin@ujamaa.test' },
  });
  if (!admin) {
    console.warn('   admin@ujamaa.test not found — skipping education modules');
    return;
  }

  for (const mod of EDUCATION_MODULES_DATA) {
    const existing = await prisma.educationalModule.findFirst({
      where: { title: mod.title, creatorId: admin.id },
      select: { id: true },
    });

    if (existing) {
      await prisma.educationalModule.update({
        where: { id: existing.id },
        data: {
          description: mod.description,
          content: mod.content,
          verified: mod.verified,
          completionIP: mod.completionIP,
        },
      });
    } else {
      const created = await prisma.educationalModule.create({
        data: {
          id: uuidv4(),
          creatorId: admin.id,
          ...mod,
          mediaUrls: [],
        },
      });
      await auditService.log(
        admin.id,
        AuditAction.MODULE_PUBLISHED,
        'EducationModule',
        created.id,
        { title: mod.title }
      );
    }
  }

  console.log(
    `   Created/ensured ${EDUCATION_MODULES_DATA.length} education modules`
  );
}

// ============================================================================
// PLATFORM CONFIG SEED
// ============================================================================

async function seedPlatformConfig() {
  console.log('\n📊 Seeding platform configuration...');

  const entries = [
    // Monthly operating costs
    {
      key: 'cost_infrastructure',
      value: '8500',
      label: 'Infrastructure (servers, DB, storage)',
      category: 'cost',
    },
    {
      key: 'cost_sms',
      value: '3200',
      label: "SMS verification (Africa's Talking)",
      category: 'cost',
    },
    {
      key: 'cost_mpesa_fees',
      value: '1800',
      label: 'M-Pesa API fees (~1.5% on dues)',
      category: 'cost',
    },
    {
      key: 'cost_blockchain_gas',
      value: '1200',
      label: 'Blockchain gas (Base Sepolia → Base)',
      category: 'cost',
    },
    // Dues tiers — KES per month only (ADR-034: dues earn UT, not PR)
    // UT earned = KES paid (1:1). PR comes from participation only.
    {
      key: 'tier_ordinary_kes',
      value: '60',
      label: 'Ordinary tier — monthly dues (KES)',
      category: 'tier',
    },
    {
      key: 'tier_supporter_kes',
      value: '200',
      label: 'Supporter tier — monthly dues (KES)',
      category: 'tier',
    },
    {
      key: 'tier_sponsor_kes',
      value: '1000',
      label: 'Sponsor tier — monthly dues (KES)',
      category: 'tier',
    },
    // Dues allocation split across geographic levels (percentages must sum to 100)
    {
      key: 'dues_allocation_split',
      value: JSON.stringify({
        WARD: 70,
        CONSTITUENCY: 15,
        COUNTY: 10,
        NATIONAL: 5,
      }),
      label:
        'Dues allocation split across Ward / Constituency / County / National (%)',
      category: 'treasury',
    },
  ];

  for (const entry of entries) {
    await prisma.platformConfig.upsert({
      where: { key: entry.key },
      update: { label: entry.label },
      create: entry,
    });
  }

  console.log(`   Seeded ${entries.length} platform config entries`);
}

// ============================================================================
// MAIN SEED EXECUTION
// ============================================================================

async function main() {
  try {
    await seedSystemConfiguration();
    await seedPlatformConfig();
    await seedIndustriesAndGoods();
    await seedGeography();
    await seedSystemGroups();
    await seedRoles();
    await seedOnboardingTutorials();
    await seedTestAdmin();
    await seedTestUsers();
    await seedEducationModules();

    console.log('\n✅ Core seeding completed successfully!');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
