/**
 * @file tests/education/education.routes.test.ts
 * @description Supertest integration tests for education routes.
 *
 * Routes under test:
 *   GET  /education
 *   GET  /education/:moduleId
 *   POST /education/:moduleId/start
 *   POST /education/:moduleId/complete
 *   POST /education/:moduleId/review
 *
 * DB truncated before each test by testSetup.ts.
 */

// ─── Mocks — before all imports ───────────────────────────────────────────────

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
      send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }),
    },
  })),
}));

vi.mock(
  '../../src/modules/community/services/groupMembership.service.js',
  () => ({
    groupMembershipService: {
      enrollInSystemGroups: vi.fn().mockResolvedValue(undefined),
      updateResidenceGroups: vi.fn().mockResolvedValue(undefined),
      getUserGroups: vi.fn().mockResolvedValue([]),
      getGroupMembers: vi.fn().mockResolvedValue([]),
      getGroupById: vi.fn().mockResolvedValue(null),
    },
  })
);

vi.mock(
  '../../src/modules/economy/services/participationRights.service.js',
  () => ({
    participationRightsService: {
      award: vi.fn().mockResolvedValue({ balance: 75 }),
      spend: vi.fn().mockResolvedValue({ balance: 25 }),
      getBalance: vi.fn().mockResolvedValue(50),
      hasSufficient: vi.fn().mockResolvedValue(true),
    },
  })
);

vi.mock(
  '../../src/modules/notifications/services/notification.service.js',
  () => ({
    notificationService: {
      send: vi.fn().mockResolvedValue(undefined),
      getNotifications: vi.fn().mockResolvedValue([]),
      markAsRead: vi.fn().mockResolvedValue(undefined),
    },
  })
);

vi.mock('../../src/modules/audit/services/audit.service.js', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import {
  createEducationUser,
  createEligibleAuthor,
  makeEducationToken,
  makeEmailVerifiedToken,
  seedModule,
  seedProgress,
  seedAssessment,
  seedDraftModule,
  seedSubmittedModule,
  VALID_MODULE_DTO,
} from './helpers.js';

beforeAll(async () => {
  await servicesReady;
});

// ─────────────────────────────────────────────
// GET /education
// ─────────────────────────────────────────────

describe('GET /education', () => {
  it('200 with empty list when no modules exist', async () => {
    const res = await request(app).get('/api/v1/education');
    expect(res.status).toBe(200);
    expect(res.body.data.modules).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  it('200 returns verified modules', async () => {
    const creator = await createEducationUser('route-list-c@test.com');
    await seedModule(creator.id, { verified: true });
    await seedModule(creator.id, { verified: false });

    const res = await request(app).get('/api/v1/education');
    expect(res.status).toBe(200);
    expect(res.body.data.modules).toHaveLength(1);
  });

  it('200 filters by category', async () => {
    const creator = await createEducationUser('route-cat@test.com');
    await seedModule(creator.id, { category: 'governance' });
    await seedModule(creator.id, { category: 'economy' });

    const res = await request(app).get('/api/v1/education?category=economy');
    expect(res.status).toBe(200);
    expect(res.body.data.modules).toHaveLength(1);
    expect(res.body.data.modules[0].category).toBe('economy');
  });

  it('400 for invalid difficulty value', async () => {
    const res = await request(app).get('/api/v1/education?difficulty=ULTRA');
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// GET /education/:moduleId
// ─────────────────────────────────────────────

describe('GET /education/:moduleId', () => {
  it('200 returns module without auth', async () => {
    const creator = await createEducationUser('route-getmod-c@test.com');
    const mod = await seedModule(creator.id);

    const res = await request(app).get(`/api/v1/education/${mod.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(mod.id);
    expect(res.body.data.creator).toBeDefined();
    expect(res.body.data.userProgress).toBeNull();
  });

  it('200 returns userProgress when authenticated and started', async () => {
    const creator = await createEducationUser('route-getprog-c@test.com');
    const user = await createEducationUser('route-getprog-u@test.com');
    const mod = await seedModule(creator.id);
    await seedProgress(user.id, mod.id, 'IN_PROGRESS');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .get(`/api/v1/education/${mod.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.userProgress).not.toBeNull();
    expect(res.body.data.userProgress.status).toBe('IN_PROGRESS');
  });

  it('404 for unknown moduleId', async () => {
    const res = await request(app).get(
      '/api/v1/education/00000000-0000-0000-0000-000000000000'
    );
    expect(res.status).toBe(404);
  });

  it('400 for non-UUID moduleId', async () => {
    const res = await request(app).get('/api/v1/education/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// POST /education/:moduleId/start
// ─────────────────────────────────────────────

describe('POST /education/:moduleId/start', () => {
  it('401 without token', async () => {
    const res = await request(app).post(
      '/api/v1/education/00000000-0000-0000-0000-000000000001/start'
    );
    expect(res.status).toBe(401);
  });

  it('201 creates progress record', async () => {
    const creator = await createEducationUser('route-start-c@test.com');
    const user = await createEducationUser('route-start-u@test.com');
    const mod = await seedModule(creator.id);
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post(`/api/v1/education/${mod.id}/start`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('IN_PROGRESS');
    expect(res.body.data.userId).toBe(user.id);
  });

  it('404 for unknown module', async () => {
    const user = await createEducationUser('route-start-404@test.com');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post('/api/v1/education/00000000-0000-0000-0000-000000000000/start')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('400 for non-UUID moduleId', async () => {
    const user = await createEducationUser('route-start-bad@test.com');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post('/api/v1/education/not-a-uuid/start')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// POST /education/:moduleId/complete
// ─────────────────────────────────────────────

describe('POST /education/:moduleId/complete', () => {
  it('401 without token', async () => {
    const res = await request(app).post(
      '/api/v1/education/00000000-0000-0000-0000-000000000001/complete'
    );
    expect(res.status).toBe(401);
  });

  it('200 marks a no-quiz module completed and awards IP', async () => {
    const creator = await createEducationUser('route-complete-c@test.com');
    const user = await createEducationUser('route-complete-u@test.com');
    const mod = await seedModule(creator.id, { completionIP: 10 });
    await seedProgress(user.id, mod.id, 'IN_PROGRESS');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post(`/api/v1/education/${mod.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.ipAwarded).toBe(10);
  });

  it('200 awards a quiz module only when the quiz is passed', async () => {
    const creator = await createEducationUser('route-quiz-c@test.com');
    const user = await createEducationUser('route-quiz-u@test.com');
    const mod = await seedModule(creator.id, { completionIP: 15 });
    await seedAssessment(mod.id); // answer key [0,1,2]
    await seedProgress(user.id, mod.id, 'IN_PROGRESS');
    const token = makeEducationToken(user.id);

    const fail = await request(app)
      .post(`/api/v1/education/${mod.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [2, 2, 2] });
    expect(fail.status).toBe(200);
    expect(fail.body.data.passed).toBe(false);
    expect(fail.body.data.ipAwarded).toBeUndefined();

    const pass = await request(app)
      .post(`/api/v1/education/${mod.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [0, 1, 2] });
    expect(pass.status).toBe(200);
    expect(pass.body.data.passed).toBe(true);
    expect(pass.body.data.ipAwarded).toBe(15);
  });

  it('400 if module not started', async () => {
    const creator = await createEducationUser('route-cmplt-ns-c@test.com');
    const user = await createEducationUser('route-cmplt-ns-u@test.com');
    const mod = await seedModule(creator.id);
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post(`/api/v1/education/${mod.id}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('400 for invalid answers value', async () => {
    const user = await createEducationUser('route-ans-bad@test.com');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post('/api/v1/education/00000000-0000-0000-0000-000000000001/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: 'not-an-array' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// POST /education/:moduleId/review
// ─────────────────────────────────────────────

describe('POST /education/:moduleId/review', () => {
  it('401 without token', async () => {
    const res = await request(app).post(
      '/api/v1/education/00000000-0000-0000-0000-000000000001/review'
    );
    expect(res.status).toBe(401);
  });

  it('201 submits review for completed module', async () => {
    const creator = await createEducationUser('route-review-c@test.com');
    const user = await createEducationUser('route-review-u@test.com');
    const mod = await seedModule(creator.id);
    await seedProgress(user.id, mod.id, 'COMPLETED');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post(`/api/v1/education/${mod.id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, comment: 'Very helpful!' });
    expect(res.status).toBe(201);
    expect(res.body.data.rating).toBe(5);
    expect(res.body.data.comment).toBe('Very helpful!');
  });

  it('400 for missing rating', async () => {
    const user = await createEducationUser('route-rev-norat@test.com');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post('/api/v1/education/00000000-0000-0000-0000-000000000001/review')
      .set('Authorization', `Bearer ${token}`)
      .send({ comment: 'No rating given' });
    expect(res.status).toBe(400);
  });

  it('400 for rating out of range', async () => {
    const user = await createEducationUser('route-rev-range@test.com');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post('/api/v1/education/00000000-0000-0000-0000-000000000001/review')
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 6 });
    expect(res.status).toBe(400);
  });

  it('400 if module not completed', async () => {
    const creator = await createEducationUser('route-rev-nc-c@test.com');
    const user = await createEducationUser('route-rev-nc-u@test.com');
    const mod = await seedModule(creator.id);
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post(`/api/v1/education/${mod.id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 4 });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// GET /education/my-progress
// ─────────────────────────────────────────────

describe('GET /education/my-progress', () => {
  it('401 without token', async () => {
    const res = await request(app).get('/api/v1/education/my-progress');
    expect(res.status).toBe(401);
  });

  it('200 returns inProgress/completed shape', async () => {
    const creator = await createEducationUser('rt-myprog-c@test.com');
    const user = await createEducationUser('rt-myprog-u@test.com');
    const modA = await seedModule(creator.id, { title: 'Progress A' });
    const modB = await seedModule(creator.id, { title: 'Progress B' });
    await seedProgress(user.id, modA.id, 'IN_PROGRESS');
    await seedProgress(user.id, modB.id, 'COMPLETED');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .get('/api/v1/education/my-progress')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.inProgress).toHaveLength(1);
    expect(res.body.data.completed).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────
// GET /education/my-modules
// ─────────────────────────────────────────────

describe('GET /education/my-modules', () => {
  it('401 without token', async () => {
    const res = await request(app).get('/api/v1/education/my-modules');
    expect(res.status).toBe(401);
  });

  it('200 returns authored modules with status field', async () => {
    const author = await createEligibleAuthor('rt-mymod@test.com');
    await seedDraftModule(author.id, 'My Test Draft');
    const token = makeEducationToken(author.id);

    const res = await request(app)
      .get('/api/v1/education/my-modules')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(4); // 3 prereq modules from createEligibleAuthor + 1 new draft
    const draft = res.body.data.find((m: any) => m.title === 'My Test Draft');
    expect(draft.status).toBe('DRAFT');
  });
});

// ─────────────────────────────────────────────
// GET /education/authorship-eligibility
// ─────────────────────────────────────────────

describe('GET /education/authorship-eligibility', () => {
  it('401 without token', async () => {
    const res = await request(app).get(
      '/api/v1/education/authorship-eligibility'
    );
    expect(res.status).toBe(401);
  });

  it('200 returns not-eligible for user with no IP or modules', async () => {
    const user = await createEducationUser('rt-elig-no@test.com');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .get('/api/v1/education/authorship-eligibility')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.eligible).toBe(false);
    expect(res.body.data.completedModules).toBe(0);
    expect(res.body.data.currentIP).toBe(0);
  });

  it('200 returns eligible for user who meets all criteria', async () => {
    const author = await createEligibleAuthor('rt-elig-yes@test.com');
    const token = makeEducationToken(author.id);

    const res = await request(app)
      .get('/api/v1/education/authorship-eligibility')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.eligible).toBe(true);
    expect(res.body.data.completedModules).toBeGreaterThanOrEqual(3);
  });
});

// ─────────────────────────────────────────────
// POST /education  (create module)
// ─────────────────────────────────────────────

describe('POST /education', () => {
  it('401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/education')
      .send(VALID_MODULE_DTO);
    expect(res.status).toBe(401);
  });

  it('403 for EMAIL_VERIFIED user (route-level auth guard)', async () => {
    const user = await createEducationUser('rt-create-ev@test.com');
    const token = makeEmailVerifiedToken(user.id);

    const res = await request(app)
      .post('/api/v1/education')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_MODULE_DTO);
    expect(res.status).toBe(403);
  });

  it('403 for COMMUNITY_VERIFIED user who does not meet IP/module threshold', async () => {
    const user = await createEducationUser('rt-create-inelig@test.com');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post('/api/v1/education')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_MODULE_DTO);
    expect(res.status).toBe(403);
  });

  it('400 for invalid body (title too short)', async () => {
    const author = await createEligibleAuthor('rt-create-bad@test.com');
    const token = makeEducationToken(author.id);

    const res = await request(app)
      .post('/api/v1/education')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_MODULE_DTO, title: 'Hi' });
    expect(res.status).toBe(400);
  });

  it('201 creates DRAFT module for eligible user', async () => {
    const author = await createEligibleAuthor('rt-create-ok@test.com');
    const token = makeEducationToken(author.id);

    const res = await request(app)
      .post('/api/v1/education')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_MODULE_DTO);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.title).toBe(VALID_MODULE_DTO.title);
    expect(res.body.data.creator.id).toBe(author.id);
  });
});

// ─────────────────────────────────────────────
// PATCH /education/:moduleId  (update)
// ─────────────────────────────────────────────

describe('PATCH /education/:moduleId', () => {
  it('401 without token', async () => {
    const res = await request(app).patch(
      '/api/v1/education/00000000-0000-0000-0000-000000000001'
    );
    expect(res.status).toBe(401);
  });

  it('403 for EMAIL_VERIFIED user', async () => {
    const creator = await createEducationUser('rt-upd-ev-c@test.com');
    const mod = await seedDraftModule(creator.id);
    const token = makeEmailVerifiedToken(creator.id);

    const res = await request(app)
      .patch(`/api/v1/education/${mod.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Edited Title Here' });
    expect(res.status).toBe(403);
  });

  it('403 for ineligible COMMUNITY_VERIFIED user', async () => {
    const user = await createEducationUser('rt-upd-inelig@test.com');
    const mod = await seedDraftModule(user.id);
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .patch(`/api/v1/education/${mod.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Edited Title Here' });
    expect(res.status).toBe(403);
  });

  it("403 when editing another user's module", async () => {
    const authorA = await createEligibleAuthor('rt-upd-owner-a@test.com');
    const authorB = await createEligibleAuthor('rt-upd-owner-b@test.com');
    const mod = await seedDraftModule(authorB.id);
    const token = makeEducationToken(authorA.id);

    const res = await request(app)
      .patch(`/api/v1/education/${mod.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Hijacked Title!!' });
    expect(res.status).toBe(403);
  });

  it('200 updates own DRAFT and returns updated fields', async () => {
    const author = await createEligibleAuthor('rt-upd-ok@test.com');
    const mod = await seedDraftModule(author.id);
    const token = makeEducationToken(author.id);

    const res = await request(app)
      .patch(`/api/v1/education/${mod.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Title Here' });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title Here');
    expect(res.body.data.status).toBe('DRAFT');
  });
});

// ─────────────────────────────────────────────
// POST /education/:moduleId/submit
// ─────────────────────────────────────────────

describe('POST /education/:moduleId/submit', () => {
  it('401 without token', async () => {
    const res = await request(app).post(
      '/api/v1/education/00000000-0000-0000-0000-000000000001/submit'
    );
    expect(res.status).toBe(401);
  });

  it('403 for EMAIL_VERIFIED user', async () => {
    const creator = await createEducationUser('rt-submit-ev@test.com');
    const mod = await seedDraftModule(creator.id);
    const token = makeEmailVerifiedToken(creator.id);

    const res = await request(app)
      .post(`/api/v1/education/${mod.id}/submit`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('400 if module is already submitted', async () => {
    const author = await createEligibleAuthor('rt-submit-dup@test.com');
    const mod = await seedSubmittedModule(author.id);
    const token = makeEducationToken(author.id);

    const res = await request(app)
      .post(`/api/v1/education/${mod.id}/submit`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('200 transitions DRAFT → SUBMITTED', async () => {
    const author = await createEligibleAuthor('rt-submit-ok@test.com');
    const mod = await seedDraftModule(author.id);
    const token = makeEducationToken(author.id);

    const res = await request(app)
      .post(`/api/v1/education/${mod.id}/submit`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUBMITTED');
    expect(res.body.data.submittedAt).not.toBeNull();
  });
});

// ─────────────────────────────────────────────
// DELETE /education/:moduleId
// ─────────────────────────────────────────────

describe('DELETE /education/:moduleId', () => {
  it('401 without token', async () => {
    const res = await request(app).delete(
      '/api/v1/education/00000000-0000-0000-0000-000000000001'
    );
    expect(res.status).toBe(401);
  });

  it('403 for EMAIL_VERIFIED user', async () => {
    const creator = await createEducationUser('rt-del-ev@test.com');
    const mod = await seedDraftModule(creator.id);
    const token = makeEmailVerifiedToken(creator.id);

    const res = await request(app)
      .delete(`/api/v1/education/${mod.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("403 when deleting another user's module", async () => {
    const userA = await createEducationUser('rt-del-owner-a@test.com');
    const userB = await createEducationUser('rt-del-owner-b@test.com');
    const mod = await seedDraftModule(userB.id);
    const token = makeEducationToken(userA.id);

    const res = await request(app)
      .delete(`/api/v1/education/${mod.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('400 for an approved module', async () => {
    const user = await createEducationUser('rt-del-approved@test.com');
    const mod = await seedModule(user.id, { verified: true });
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .delete(`/api/v1/education/${mod.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('200 deletes own DRAFT module', async () => {
    const user = await createEducationUser('rt-del-ok@test.com');
    const mod = await seedDraftModule(user.id);
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .delete(`/api/v1/education/${mod.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
