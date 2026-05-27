/**
 * @file tests/governance/proposal.annotation.test.ts
 * @description Integration tests for inline proposal annotation routes.
 *
 * Routes under test:
 *   POST   /governance/:proposalId/annotations
 *   GET    /governance/:proposalId/annotations
 *   DELETE /governance/:proposalId/annotations/:annotationId
 *   POST   /governance/:proposalId/annotations/:annotationId/react
 *
 * Annotation window: PENDING_REVIEW and APPROVED_FOR_VOTING only.
 */

// ─────────────────────────────────────────────
// Mocks — must be before all imports
// ─────────────────────────────────────────────

vi.mock('../../src/core/services/token-blacklist.service.js', () => ({
  tokenBlacklistService: {
    isRevoked: vi.fn().mockResolvedValue(false),
    revoke: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/core/utils/email.service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendLoginEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: {
      send: vi
        .fn()
        .mockResolvedValue({ SMSMessageData: { Recipients: [] } }),
    },
  })),
}));

vi.mock('../../src/modules/community/services/groupMembership.service.js', () => ({
  groupMembershipService: {
    enrollInSystemGroups: vi.fn().mockResolvedValue(undefined),
    updateResidenceGroups: vi.fn().mockResolvedValue(undefined),
    getUserGroups: vi.fn().mockResolvedValue([]),
    getGroupMembers: vi.fn().mockResolvedValue([]),
    getGroupById: vi.fn().mockResolvedValue(null),
  },
}));

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { ProposalStatus } from '@prisma/client';
import { prisma } from '../../src/core/database/client.js';
import app, { servicesReady } from '../../src/app.js';
import {
  createGovernanceUser,
  seedGovernanceGroup,
  seedProposal,
  makeGovernanceToken,
} from './helpers.js';

const BASE = '/api/v1/governance';

const VALID_ANNOTATION = {
  fieldKey: 'description',
  startOffset: 2,
  endOffset: 20,
  quotedText: 'detailed description',
  comment: 'This part needs more clarity on funding sources.',
};

beforeAll(async () => {
  await servicesReady;
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: seed annotation directly in the DB
// ─────────────────────────────────────────────────────────────────────────────

async function seedAnnotation(
  authorId: string,
  proposalId: string,
  overrides: Partial<typeof VALID_ANNOTATION> = {}
) {
  return prisma.proposalAnnotation.create({
    data: {
      proposalId,
      authorId,
      fieldKey: overrides.fieldKey ?? VALID_ANNOTATION.fieldKey,
      startOffset: overrides.startOffset ?? VALID_ANNOTATION.startOffset,
      endOffset: overrides.endOffset ?? VALID_ANNOTATION.endOffset,
      quotedText: overrides.quotedText ?? VALID_ANNOTATION.quotedText,
      comment: overrides.comment ?? VALID_ANNOTATION.comment,
      color: '#C9922A',
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /governance/:proposalId/annotations
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /governance/:proposalId/annotations', () => {
  it('returns 200 and creates annotation for COMMUNITY_VERIFIED user on PENDING_REVIEW proposal', async () => {
    const user = await createGovernanceUser('ann-create-ok@example.com');
    const token = makeGovernanceToken(user.id);
    const group = await seedGovernanceGroup(user.id);
    const proposal = await seedProposal(user.id, group.id, ProposalStatus.PENDING_REVIEW);

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/annotations`)
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ANNOTATION);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fieldKey).toBe('description');
    expect(res.body.data.quotedText).toBe(VALID_ANNOTATION.quotedText);
    expect(res.body.data.comment).toBe(VALID_ANNOTATION.comment);
    expect(res.body.data.color).toBeDefined();
    expect(res.body.data.upvotes).toBe(0);
    expect(res.body.data.downvotes).toBe(0);
    expect(res.body.data.myReaction).toBeNull();
    expect(res.body.data.author).not.toBeNull();
    expect(res.body.data.author.id).toBe(user.id);
  });

  it('returns 200 for APPROVED_FOR_VOTING proposal', async () => {
    const user = await createGovernanceUser('ann-create-afv@example.com');
    const token = makeGovernanceToken(user.id);
    const group = await seedGovernanceGroup(user.id);
    const proposal = await seedProposal(user.id, group.id, ProposalStatus.APPROVED_FOR_VOTING);

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/annotations`)
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ANNOTATION);

    expect(res.status).toBe(201);
    expect(res.body.data.proposalId).toBe(proposal.id);
  });

  it('returns 403 for EMAIL_VERIFIED user (below COMMUNITY_VERIFIED threshold)', async () => {
    const user = await createGovernanceUser('ann-create-ev@example.com');
    const token = makeGovernanceToken(user.id, { verificationLevel: 'EMAIL_VERIFIED' });
    const group = await seedGovernanceGroup(user.id);
    const proposal = await seedProposal(user.id, group.id, ProposalStatus.PENDING_REVIEW);

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/annotations`)
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ANNOTATION);

    expect(res.status).toBe(403);
  });

  it('returns 403 when proposal is in VOTING status (outside annotation window)', async () => {
    const user = await createGovernanceUser('ann-create-voting@example.com');
    const token = makeGovernanceToken(user.id);
    const group = await seedGovernanceGroup(user.id);
    const proposal = await seedProposal(user.id, group.id, ProposalStatus.VOTING);

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/annotations`)
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ANNOTATION);

    expect(res.status).toBe(403);
  });

  it('returns 400 when endOffset is equal to startOffset', async () => {
    const user = await createGovernanceUser('ann-create-bad-offset@example.com');
    const token = makeGovernanceToken(user.id);
    const group = await seedGovernanceGroup(user.id);
    const proposal = await seedProposal(user.id, group.id, ProposalStatus.PENDING_REVIEW);

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/annotations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_ANNOTATION, startOffset: 5, endOffset: 5 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when endOffset is less than startOffset', async () => {
    const user = await createGovernanceUser('ann-create-bad-offset2@example.com');
    const token = makeGovernanceToken(user.id);
    const group = await seedGovernanceGroup(user.id);
    const proposal = await seedProposal(user.id, group.id, ProposalStatus.PENDING_REVIEW);

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/annotations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_ANNOTATION, startOffset: 20, endOffset: 5 });

    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent proposalId', async () => {
    const user = await createGovernanceUser('ann-create-404@example.com');
    const token = makeGovernanceToken(user.id);
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const res = await request(app)
      .post(`${BASE}/${fakeId}/annotations`)
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ANNOTATION);

    expect(res.status).toBe(404);
  });

  it('assigns a different color to a second annotator on the same proposal', async () => {
    const user1 = await createGovernanceUser('ann-color1@example.com');
    const user2 = await createGovernanceUser('ann-color2@example.com');
    const group = await seedGovernanceGroup(user1.id);
    const proposal = await seedProposal(user1.id, group.id, ProposalStatus.PENDING_REVIEW);

    const res1 = await request(app)
      .post(`${BASE}/${proposal.id}/annotations`)
      .set('Authorization', `Bearer ${makeGovernanceToken(user1.id)}`)
      .send(VALID_ANNOTATION);

    const res2 = await request(app)
      .post(`${BASE}/${proposal.id}/annotations`)
      .set('Authorization', `Bearer ${makeGovernanceToken(user2.id)}`)
      .send({ ...VALID_ANNOTATION, startOffset: 25, endOffset: 40, quotedText: 'different portion' });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.data.color).not.toBe(res2.body.data.color);
  });

  it('returns 401 without auth token', async () => {
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const res = await request(app)
      .post(`${BASE}/${fakeId}/annotations`)
      .send(VALID_ANNOTATION);

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /governance/:proposalId/annotations
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /governance/:proposalId/annotations', () => {
  it('returns 200 with an empty array when no annotations exist', async () => {
    const user = await createGovernanceUser('ann-list-empty@example.com');
    const token = makeGovernanceToken(user.id);
    const group = await seedGovernanceGroup(user.id);
    const proposal = await seedProposal(user.id, group.id, ProposalStatus.PENDING_REVIEW);

    const res = await request(app)
      .get(`${BASE}/${proposal.id}/annotations`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('returns 200 with annotations including author info and reaction counts', async () => {
    const author = await createGovernanceUser('ann-list-data@example.com');
    const viewer = await createGovernanceUser('ann-list-viewer@example.com');
    const token = makeGovernanceToken(viewer.id);
    const group = await seedGovernanceGroup(author.id);
    const proposal = await seedProposal(author.id, group.id, ProposalStatus.PENDING_REVIEW);

    await seedAnnotation(author.id, proposal.id);

    const res = await request(app)
      .get(`${BASE}/${proposal.id}/annotations`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const ann = res.body.data[0];
    expect(ann.author).not.toBeNull();
    expect(ann.author.id).toBe(author.id);
    expect(ann.upvotes).toBe(0);
    expect(ann.downvotes).toBe(0);
    expect(ann.myReaction).toBeNull();
    expect(ann.fieldKey).toBe('description');
  });

  it('reflects myReaction for the requesting user', async () => {
    const author = await createGovernanceUser('ann-list-react-author@example.com');
    const reactor = await createGovernanceUser('ann-list-react-user@example.com');
    const group = await seedGovernanceGroup(author.id);
    const proposal = await seedProposal(author.id, group.id, ProposalStatus.PENDING_REVIEW);
    const annotation = await seedAnnotation(author.id, proposal.id);

    // Reactor upvotes via API
    await request(app)
      .post(`${BASE}/${proposal.id}/annotations/${annotation.id}/react`)
      .set('Authorization', `Bearer ${makeGovernanceToken(reactor.id)}`)
      .send({ type: 'UP' });

    const res = await request(app)
      .get(`${BASE}/${proposal.id}/annotations`)
      .set('Authorization', `Bearer ${makeGovernanceToken(reactor.id)}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].upvotes).toBe(1);
    expect(res.body.data[0].myReaction).toBe('UP');
  });

  it('returns 404 for a non-existent proposalId', async () => {
    const user = await createGovernanceUser('ann-list-404@example.com');
    const token = makeGovernanceToken(user.id);
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const res = await request(app)
      .get(`${BASE}/${fakeId}/annotations`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const res = await request(app).get(`${BASE}/${fakeId}/annotations`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /governance/:proposalId/annotations/:annotationId
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /governance/:proposalId/annotations/:annotationId', () => {
  it('returns 200 and deletes annotation when requester is the author', async () => {
    const user = await createGovernanceUser('ann-del-ok@example.com');
    const token = makeGovernanceToken(user.id);
    const group = await seedGovernanceGroup(user.id);
    const proposal = await seedProposal(user.id, group.id, ProposalStatus.PENDING_REVIEW);
    const annotation = await seedAnnotation(user.id, proposal.id);

    const res = await request(app)
      .delete(`${BASE}/${proposal.id}/annotations/${annotation.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
    expect(res.body.data.id).toBe(annotation.id);

    const row = await prisma.proposalAnnotation.findUnique({
      where: { id: annotation.id },
    });
    expect(row).toBeNull();
  });

  it('returns 403 when requester is not the annotation author', async () => {
    const author = await createGovernanceUser('ann-del-author@example.com');
    const other = await createGovernanceUser('ann-del-other@example.com');
    const group = await seedGovernanceGroup(author.id);
    const proposal = await seedProposal(author.id, group.id, ProposalStatus.PENDING_REVIEW);
    const annotation = await seedAnnotation(author.id, proposal.id);

    const res = await request(app)
      .delete(`${BASE}/${proposal.id}/annotations/${annotation.id}`)
      .set('Authorization', `Bearer ${makeGovernanceToken(other.id)}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent annotationId', async () => {
    const user = await createGovernanceUser('ann-del-404@example.com');
    const group = await seedGovernanceGroup(user.id);
    const proposal = await seedProposal(user.id, group.id, ProposalStatus.PENDING_REVIEW);
    const fakeAnnotId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const res = await request(app)
      .delete(`${BASE}/${proposal.id}/annotations/${fakeAnnotId}`)
      .set('Authorization', `Bearer ${makeGovernanceToken(user.id)}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const res = await request(app).delete(`${BASE}/${fakeId}/annotations/${fakeId}`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /governance/:proposalId/annotations/:annotationId/react
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /governance/:proposalId/annotations/:annotationId/react', () => {
  it('returns 200 and records an upvote — upvotes:1, myReaction:"UP"', async () => {
    const author = await createGovernanceUser('ann-react-up-author@example.com');
    const reactor = await createGovernanceUser('ann-react-up-user@example.com');
    const group = await seedGovernanceGroup(author.id);
    const proposal = await seedProposal(author.id, group.id, ProposalStatus.PENDING_REVIEW);
    const annotation = await seedAnnotation(author.id, proposal.id);

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/annotations/${annotation.id}/react`)
      .set('Authorization', `Bearer ${makeGovernanceToken(reactor.id)}`)
      .send({ type: 'UP' });

    expect(res.status).toBe(200);
    expect(res.body.data.upvotes).toBe(1);
    expect(res.body.data.downvotes).toBe(0);
    expect(res.body.data.myReaction).toBe('UP');
  });

  it('returns 200 and removes reaction when same type sent twice (toggle off)', async () => {
    const author = await createGovernanceUser('ann-react-toggle-author@example.com');
    const reactor = await createGovernanceUser('ann-react-toggle-user@example.com');
    const group = await seedGovernanceGroup(author.id);
    const proposal = await seedProposal(author.id, group.id, ProposalStatus.PENDING_REVIEW);
    const annotation = await seedAnnotation(author.id, proposal.id);

    await request(app)
      .post(`${BASE}/${proposal.id}/annotations/${annotation.id}/react`)
      .set('Authorization', `Bearer ${makeGovernanceToken(reactor.id)}`)
      .send({ type: 'UP' });

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/annotations/${annotation.id}/react`)
      .set('Authorization', `Bearer ${makeGovernanceToken(reactor.id)}`)
      .send({ type: null });

    expect(res.status).toBe(200);
    expect(res.body.data.upvotes).toBe(0);
    expect(res.body.data.myReaction).toBeNull();
  });

  it('returns 200 and correctly updates counts when switching UP → DOWN', async () => {
    const author = await createGovernanceUser('ann-react-switch-author@example.com');
    const reactor = await createGovernanceUser('ann-react-switch-user@example.com');
    const group = await seedGovernanceGroup(author.id);
    const proposal = await seedProposal(author.id, group.id, ProposalStatus.PENDING_REVIEW);
    const annotation = await seedAnnotation(author.id, proposal.id);
    const reactorToken = makeGovernanceToken(reactor.id);

    await request(app)
      .post(`${BASE}/${proposal.id}/annotations/${annotation.id}/react`)
      .set('Authorization', `Bearer ${reactorToken}`)
      .send({ type: 'UP' });

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/annotations/${annotation.id}/react`)
      .set('Authorization', `Bearer ${reactorToken}`)
      .send({ type: 'DOWN' });

    expect(res.status).toBe(200);
    expect(res.body.data.upvotes).toBe(0);
    expect(res.body.data.downvotes).toBe(1);
    expect(res.body.data.myReaction).toBe('DOWN');
  });

  it('returns 403 when proposal is in VOTING status (outside reaction window)', async () => {
    const author = await createGovernanceUser('ann-react-voting-author@example.com');
    const reactor = await createGovernanceUser('ann-react-voting-user@example.com');
    const group = await seedGovernanceGroup(author.id);
    // Seed annotation while in PENDING_REVIEW, then move to VOTING for the react test
    const proposal = await seedProposal(author.id, group.id, ProposalStatus.PENDING_REVIEW);
    const annotation = await seedAnnotation(author.id, proposal.id);

    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: ProposalStatus.VOTING },
    });

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/annotations/${annotation.id}/react`)
      .set('Authorization', `Bearer ${makeGovernanceToken(reactor.id)}`)
      .send({ type: 'UP' });

    expect(res.status).toBe(403);
  });

  it('returns 403 for EMAIL_VERIFIED user', async () => {
    const author = await createGovernanceUser('ann-react-ev-author@example.com');
    const reactor = await createGovernanceUser('ann-react-ev-user@example.com');
    const group = await seedGovernanceGroup(author.id);
    const proposal = await seedProposal(author.id, group.id, ProposalStatus.PENDING_REVIEW);
    const annotation = await seedAnnotation(author.id, proposal.id);

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/annotations/${annotation.id}/react`)
      .set('Authorization', `Bearer ${makeGovernanceToken(reactor.id, { verificationLevel: 'EMAIL_VERIFIED' })}`)
      .send({ type: 'UP' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent annotationId', async () => {
    const user = await createGovernanceUser('ann-react-404@example.com');
    const group = await seedGovernanceGroup(user.id);
    const proposal = await seedProposal(user.id, group.id, ProposalStatus.PENDING_REVIEW);
    const fakeAnnotId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/annotations/${fakeAnnotId}/react`)
      .set('Authorization', `Bearer ${makeGovernanceToken(user.id)}`)
      .send({ type: 'UP' });

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const res = await request(app)
      .post(`${BASE}/${fakeId}/annotations/${fakeId}/react`)
      .send({ type: 'UP' });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /governance/:proposalId — proposal includes annotations array
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /governance/:proposalId — annotations field', () => {
  it('includes an empty annotations array when no annotations exist', async () => {
    const user = await createGovernanceUser('ann-incl-empty@example.com');
    const token = makeGovernanceToken(user.id);
    const group = await seedGovernanceGroup(user.id);
    const proposal = await seedProposal(user.id, group.id, ProposalStatus.PENDING_REVIEW);

    const res = await request(app)
      .get(`${BASE}/${proposal.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.annotations)).toBe(true);
    expect(res.body.data.annotations).toHaveLength(0);
  });

  it('includes annotations with computed reaction counts in the proposal response', async () => {
    const author = await createGovernanceUser('ann-incl-data@example.com');
    const viewer = await createGovernanceUser('ann-incl-viewer@example.com');
    const group = await seedGovernanceGroup(author.id);
    const proposal = await seedProposal(author.id, group.id, ProposalStatus.PENDING_REVIEW);
    await seedAnnotation(author.id, proposal.id);

    const res = await request(app)
      .get(`${BASE}/${proposal.id}`)
      .set('Authorization', `Bearer ${makeGovernanceToken(viewer.id)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.annotations).toHaveLength(1);
    const ann = res.body.data.annotations[0];
    expect(ann.upvotes).toBe(0);
    expect(ann.downvotes).toBe(0);
    expect(ann.myReaction).toBeNull();
  });
});
