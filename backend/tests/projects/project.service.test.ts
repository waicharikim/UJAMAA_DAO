/**
 * @file tests/projects/project.service.test.ts
 * @description Unit tests for ProjectService.
 *
 * Tests: createFromProposal, startMilestone, submitMilestone, verifyMilestone,
 *        listProjects, getProject
 *
 * Uses real Prisma against postgres_test DB.
 * DB truncated before each test by testSetup.ts.
 */

import { describe, it, expect, vi } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { ProjectService } from '../../src/modules/projects/services/project.service.js';
import { treasuryService } from '../../src/modules/treasury/services/treasury.service.js';
import {
  ProjectStatus,
  MilestoneStatus,
} from '../../src/modules/projects/types.js';
import {
  createProjectUser,
  seedProjectGroup,
  seedApprovedProposal,
  seedProject,
  seedMilestone,
  addProjectMember,
} from './helpers.js';

const service = new ProjectService();

// ─────────────────────────────────────────────────────────────────────────────
// createFromProposal()
// ─────────────────────────────────────────────────────────────────────────────

describe('createFromProposal()', () => {
  it('creates a project and adds creator as LEAD member', async () => {
    const creator = await createProjectUser('creator@test.com');
    const group = await seedProjectGroup(creator.id);
    const proposal = await seedApprovedProposal(creator.id, group.id);

    const project = await service.createFromProposal(creator.id, {
      proposalId: proposal.id,
    });

    expect(project.proposalId).toBe(proposal.id);
    expect(project.ownerUserId).toBe(creator.id);
    expect(project.status).toBe(ProjectStatus.PLANNING);

    const member = await prisma.projectMember.findFirst({
      where: { projectId: project.id, userId: creator.id },
    });
    expect(member?.role).toBe('LEAD');
  });

  it('rejects creating a project from a POLICY proposal (400)', async () => {
    const creator = await createProjectUser('policy-proj@test.com');
    const group = await seedProjectGroup(creator.id);
    const proposal = await seedApprovedProposal(creator.id, group.id);
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { kind: 'POLICY' },
    });

    await expect(
      service.createFromProposal(creator.id, { proposalId: proposal.id })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('auto-creates milestones from linked ProposalMilestones', async () => {
    const creator = await createProjectUser('creator2@test.com');
    const group = await seedProjectGroup(creator.id);
    const proposal = await seedApprovedProposal(creator.id, group.id);

    // Seed two ProposalMilestones
    await prisma.proposalMilestone.createMany({
      data: [
        {
          proposalId: proposal.id,
          title: 'Phase 1',
          description: 'First phase',
          deliverables: [],
          budgetAmount: 0,
          startOffset: 0,
          duration: 7,
          dependencies: [],
          verificationMethod: 'PEER',
          verificationCriteria: [],
          orderIndex: 1,
        },
        {
          proposalId: proposal.id,
          title: 'Phase 2',
          description: 'Second phase',
          deliverables: [],
          budgetAmount: 0,
          startOffset: 7,
          duration: 7,
          dependencies: [],
          verificationMethod: 'PEER',
          verificationCriteria: [],
          orderIndex: 2,
        },
      ],
    });

    const project = await service.createFromProposal(creator.id, {
      proposalId: proposal.id,
    });

    const milestones = await prisma.milestone.findMany({
      where: { projectId: project.id },
      orderBy: { orderIndex: 'asc' },
    });
    expect(milestones).toHaveLength(2);
    expect(milestones[0].title).toBe('Phase 1');
    expect(milestones[0].orderIndex).toBe(1);
    expect(milestones[1].title).toBe('Phase 2');
    expect(milestones[1].orderIndex).toBe(2);
  });

  it('setup gate: writes milestones from the payload and creates linked project milestones', async () => {
    const creator = await createProjectUser('setup-milestones@test.com');
    const group = await seedProjectGroup(creator.id);
    const proposal = await seedApprovedProposal(creator.id, group.id);

    const project = await service.createFromProposal(creator.id, {
      proposalId: proposal.id,
      milestones: [
        {
          title: 'Drill the borehole',
          description: 'Hire a rig and drill to 80m.',
          deliverables: [
            { description: 'Borehole drilled', quantity: 1, unit: 'site' },
          ],
          budgetAmount: 6000,
          startOffset: 0,
          duration: 14,
          verificationMethod: 'PHOTO_EVIDENCE',
          verifiersNeeded: 2,
          verificationCriteria: [{ criterion: 'Water flows', required: true }],
          orderIndex: 0,
        },
        {
          title: 'Install the pump',
          description: 'Fit and commission the hand pump.',
          budgetAmount: 2000,
          startOffset: 14,
          duration: 7,
          verificationMethod: 'PEER',
          orderIndex: 1,
        },
      ],
    });

    // ProposalMilestones written from the payload
    const pms = await prisma.proposalMilestone.findMany({
      where: { proposalId: proposal.id },
      orderBy: { orderIndex: 'asc' },
    });
    expect(pms).toHaveLength(2);
    expect(pms[0].title).toBe('Drill the borehole');
    expect(Number(pms[0].budgetAmount)).toBe(6000);
    expect(pms[0].verificationMethod).toBe('PHOTO_EVIDENCE');

    // Project milestones created and linked back to the proposal milestones
    const milestones = await prisma.milestone.findMany({
      where: { projectId: project.id },
      orderBy: { orderIndex: 'asc' },
    });
    expect(milestones).toHaveLength(2);
    expect(milestones[0].proposalMilestoneId).toBe(pms[0].id);
    expect(milestones[1].title).toBe('Install the pump');
  });

  it('does NOT debit the group treasury at setup (disbursement happens at EXECUTING)', async () => {
    const creator = await createProjectUser('setup-nodebit@test.com');
    const group = await seedProjectGroup(creator.id);
    await treasuryService.deposit(group.id, { amount: 20000 }, creator.id);
    const proposal = await prisma.proposal.create({
      data: {
        groupId: group.id,
        creatorId: creator.id,
        title: 'Funded project proposal',
        description:
          'A funded proposal used to confirm no debit at setup time.',
        proposalType: 'COMMUNITY_INITIATIVE',
        proposalScope: 'GROUP',
        status: 'APPROVED',
        groupFundingAmount: 8000,
      },
    });

    await service.createFromProposal(creator.id, { proposalId: proposal.id });

    const treasury = await prisma.groupTreasury.findUnique({
      where: { groupId: group.id },
    });
    expect(Number(treasury!.balance)).toBe(20000); // unchanged — no debit at setup
  });

  it('throws 404 for unknown proposalId', async () => {
    const creator = await createProjectUser('creator3@test.com');
    await expect(
      service.createFromProposal(creator.id, {
        proposalId: '00000000-0000-0000-0000-000000000000',
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 if proposal is not APPROVED', async () => {
    const creator = await createProjectUser('creator4@test.com');
    const group = await seedProjectGroup(creator.id);
    const proposal = await prisma.proposal.create({
      data: {
        groupId: group.id,
        creatorId: creator.id,
        title: 'Draft proposal',
        description: 'desc',
        proposalType: 'COMMUNITY_INITIATIVE',
        status: 'DRAFT',
      },
    });

    await expect(
      service.createFromProposal(creator.id, { proposalId: proposal.id })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 409 if project already exists for proposal', async () => {
    const creator = await createProjectUser('creator5@test.com');
    const group = await seedProjectGroup(creator.id);
    const proposal = await seedApprovedProposal(creator.id, group.id);

    await service.createFromProposal(creator.id, { proposalId: proposal.id });

    await expect(
      service.createFromProposal(creator.id, { proposalId: proposal.id })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// startMilestone()
// ─────────────────────────────────────────────────────────────────────────────

describe('startMilestone()', () => {
  it('transitions PENDING milestone to IN_PROGRESS and sets startedAt', async () => {
    const owner = await createProjectUser('owner@test.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(
      project.id,
      'M1',
      MilestoneStatus.PENDING
    );

    const result = await service.startMilestone(owner.id, {
      milestoneId: milestone.id,
    });

    expect(result.status).toBe(MilestoneStatus.IN_PROGRESS);

    const updated = await prisma.milestone.findUnique({
      where: { id: milestone.id },
    });
    expect(updated?.status).toBe(MilestoneStatus.IN_PROGRESS);
    expect(updated?.startedAt).toBeInstanceOf(Date);
  });

  it('throws 404 for unknown milestoneId', async () => {
    const owner = await createProjectUser('owner2@test.com');
    await expect(
      service.startMilestone(owner.id, {
        milestoneId: '00000000-0000-0000-0000-000000000000',
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 if milestone is not PENDING', async () => {
    const owner = await createProjectUser('owner3@test.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(
      project.id,
      'M2',
      MilestoneStatus.IN_PROGRESS
    );

    await expect(
      service.startMilestone(owner.id, { milestoneId: milestone.id })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// submitMilestone()
// ─────────────────────────────────────────────────────────────────────────────

describe('submitMilestone()', () => {
  it('transitions IN_PROGRESS to AWAITING_VERIFICATION and stores proof', async () => {
    const owner = await createProjectUser('submitter@test.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(
      project.id,
      'M1',
      MilestoneStatus.IN_PROGRESS
    );

    const result = await service.submitMilestone(owner.id, {
      milestoneId: milestone.id,
      proofUrl: 'https://example.com/proof.jpg',
      description: 'Proof of work',
    });

    expect(result.status).toBe(MilestoneStatus.AWAITING_VERIFICATION);

    const updated = await prisma.milestone.findUnique({
      where: { id: milestone.id },
    });
    expect(updated?.submittedById).toBe(owner.id);
    expect(updated?.proofUrl).toBe('https://example.com/proof.jpg');
    expect(updated?.submittedAt).toBeInstanceOf(Date);
  });

  it('throws 404 for unknown milestoneId', async () => {
    const owner = await createProjectUser('submitter2@test.com');
    await expect(
      service.submitMilestone(owner.id, {
        milestoneId: '00000000-0000-0000-0000-000000000000',
        proofUrl: 'https://example.com/p.jpg',
        description: 'desc',
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 if milestone is not IN_PROGRESS', async () => {
    const owner = await createProjectUser('submitter3@test.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(
      project.id,
      'M1',
      MilestoneStatus.PENDING
    );

    await expect(
      service.submitMilestone(owner.id, {
        milestoneId: milestone.id,
        proofUrl: 'https://example.com/p.jpg',
        description: 'desc',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifyMilestone()
// ─────────────────────────────────────────────────────────────────────────────

describe('verifyMilestone()', () => {
  it('approved=true → VERIFIED status', async () => {
    const owner = await createProjectUser('verifier@test.com');
    const submitter = await createProjectUser('sub@test.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(
      project.id,
      'M1',
      MilestoneStatus.AWAITING_VERIFICATION
    );
    await prisma.milestone.update({
      where: { id: milestone.id },
      data: { submittedById: submitter.id },
    });

    const result = await service.verifyMilestone(owner.id, {
      milestoneId: milestone.id,
      approved: true,
    });

    expect(result.status).toBe(MilestoneStatus.VERIFIED);
    const updated = await prisma.milestone.findUnique({
      where: { id: milestone.id },
    });
    expect(updated?.verifiedById).toBe(owner.id);
    expect(updated?.verifiedAt).toBeInstanceOf(Date);
  });

  it('approved=false → REJECTED status, no rewards', async () => {
    const owner = await createProjectUser('verifier2@test.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(
      project.id,
      'M1',
      MilestoneStatus.AWAITING_VERIFICATION
    );

    const result = await service.verifyMilestone(owner.id, {
      milestoneId: milestone.id,
      approved: false,
      feedback: 'Not good enough',
    });

    expect(result.status).toBe(MilestoneStatus.REJECTED);
    const updated = await prisma.milestone.findUnique({
      where: { id: milestone.id },
    });
    expect(updated?.feedback).toBe('Not good enough');
  });

  it('throws 404 for unknown milestoneId', async () => {
    const owner = await createProjectUser('verifier3@test.com');
    await expect(
      service.verifyMilestone(owner.id, {
        milestoneId: '00000000-0000-0000-0000-000000000000',
        approved: true,
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 if milestone is not AWAITING_VERIFICATION', async () => {
    const owner = await createProjectUser('verifier4@test.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(
      project.id,
      'M1',
      MilestoneStatus.PENDING
    );

    await expect(
      service.verifyMilestone(owner.id, {
        milestoneId: milestone.id,
        approved: true,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 403 when the verifier is the submitter (no self-verification)', async () => {
    const owner = await createProjectUser('self-verify@test.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(
      project.id,
      'M1',
      MilestoneStatus.AWAITING_VERIFICATION
    );
    // Owner both submitted and tries to verify their own milestone.
    await prisma.milestone.update({
      where: { id: milestone.id },
      data: { submittedById: owner.id },
    });

    await expect(
      service.verifyMilestone(owner.id, {
        milestoneId: milestone.id,
        approved: true,
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    const unchanged = await prisma.milestone.findUnique({
      where: { id: milestone.id },
    });
    expect(unchanged?.status).toBe(MilestoneStatus.AWAITING_VERIFICATION);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listProjects()
// ─────────────────────────────────────────────────────────────────────────────

describe('listProjects()', () => {
  it('returns empty list when no projects', async () => {
    const result = await service.listProjects({});
    expect(result.projects).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('returns correct milestonesCount and completedMilestonesCount', async () => {
    const owner = await createProjectUser('list@test.com');
    const project = await seedProject(owner.id);
    await seedMilestone(project.id, 'M1', MilestoneStatus.VERIFIED, 1);
    await seedMilestone(project.id, 'M2', MilestoneStatus.VERIFIED, 2);
    await seedMilestone(project.id, 'M3', MilestoneStatus.PENDING, 3);

    const result = await service.listProjects({});
    expect(result.total).toBe(1);
    expect(result.projects[0].milestonesCount).toBe(3);
    expect(result.projects[0].completedMilestonesCount).toBe(2);
  });

  it('filters by ownerUserId', async () => {
    const a = await createProjectUser('listA@test.com');
    const b = await createProjectUser('listB@test.com');
    await seedProject(a.id, undefined, 'Project A');
    await seedProject(b.id, undefined, 'Project B');

    const result = await service.listProjects({ ownerUserId: a.id });
    expect(result.total).toBe(1);
    expect(result.projects[0].title).toBe('Project A');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getProject()
// ─────────────────────────────────────────────────────────────────────────────

describe('getProject()', () => {
  it('returns full project detail with milestones and members', async () => {
    const owner = await createProjectUser('get@test.com');
    const project = await seedProject(owner.id, undefined, 'Detailed Project');
    await seedMilestone(project.id, 'M1');
    const contributor = await createProjectUser('contrib@test.com');
    await addProjectMember(project.id, contributor.id, 'CONTRIBUTOR');

    const detail = await service.getProject(project.id);

    expect(detail.id).toBe(project.id);
    expect(detail.title).toBe('Detailed Project');
    expect(detail.milestones).toHaveLength(1);
    expect(detail.members).toHaveLength(2); // LEAD + CONTRIBUTOR
  });

  it('throws 404 for unknown projectId', async () => {
    await expect(
      service.getProject('00000000-0000-0000-0000-000000000000')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
