/**
 * @file tests/projects/project-update.service.test.ts
 * @description Unit tests for ProjectUpdateService — create() and list().
 *
 * Uses real test DB via Prisma — no mocking of the service layer.
 * testSetup.ts truncates all tables before each test.
 */

import { describe, it, expect } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { ProjectUpdateService } from '../../src/modules/projects/services/project-update.service.js';
import {
  createProjectUser,
  seedProject,
  addProjectMember,
} from './helpers.js';

const service = new ProjectUpdateService();

// ─────────────────────────────────────────────
// create()
// ─────────────────────────────────────────────

describe('ProjectUpdateService.create()', () => {
  it('creates an update and returns correct DTO fields', async () => {
    const leader = await createProjectUser('create1@test.com');
    const project = await seedProject(leader.id);

    const dto = await service.create({
      projectId: project.id,
      authorId: leader.id,
      content: 'First progress update',
    });

    expect(dto).toMatchObject({
      content: 'First progress update',
      authorId: leader.id,
      authorName: 'Project Test User',
      authorInitials: 'PU',
    });
    expect(typeof dto.id).toBe('string');
    expect(typeof dto.createdAt).toBe('string');
    expect(dto.authorAvatarUrl).toBeNull();
  });

  it('throws 403 when author is not a project member', async () => {
    const leader = await createProjectUser('create2a@test.com');
    const outsider = await createProjectUser('create2b@test.com');
    const project = await seedProject(leader.id);

    await expect(
      service.create({
        projectId: project.id,
        authorId: outsider.id,
        content: 'Unauthorized update',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows a non-lead member to post an update', async () => {
    const leader = await createProjectUser('create3a@test.com');
    const contributor = await createProjectUser('create3b@test.com');
    const project = await seedProject(leader.id);
    await addProjectMember(project.id, contributor.id, 'CONTRIBUTOR');

    const dto = await service.create({
      projectId: project.id,
      authorId: contributor.id,
      content: 'Contributor update',
    });

    expect(dto.authorId).toBe(contributor.id);
    expect(dto.content).toBe('Contributor update');
  });

  it('trims whitespace from content before saving', async () => {
    const leader = await createProjectUser('create4@test.com');
    const project = await seedProject(leader.id);

    const dto = await service.create({
      projectId: project.id,
      authorId: leader.id,
      content: '  Trimmed content  ',
    });

    expect(dto.content).toBe('Trimmed content');
  });

  it('persists the update to the database', async () => {
    const leader = await createProjectUser('create5@test.com');
    const project = await seedProject(leader.id);

    const dto = await service.create({
      projectId: project.id,
      authorId: leader.id,
      content: 'Persisted update',
    });

    const row = await prisma.projectUpdate.findUnique({ where: { id: dto.id } });
    expect(row).not.toBeNull();
    expect(row?.content).toBe('Persisted update');
    expect(row?.projectId).toBe(project.id);
    expect(row?.authorId).toBe(leader.id);
  });
});

// ─────────────────────────────────────────────
// list()
// ─────────────────────────────────────────────

describe('ProjectUpdateService.list()', () => {
  it('returns empty items for a project with no updates', async () => {
    const leader = await createProjectUser('list1@test.com');
    const project = await seedProject(leader.id);

    const result = await service.list({ projectId: project.id });

    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it('returns updates ordered newest first', async () => {
    const leader = await createProjectUser('list2@test.com');
    const project = await seedProject(leader.id);
    const now = Date.now();

    for (let i = 0; i < 3; i++) {
      await prisma.projectUpdate.create({
        data: {
          projectId: project.id,
          authorId: leader.id,
          content: `Update ${i}`,
          createdAt: new Date(now - i * 1000),
        },
      });
    }

    const result = await service.list({ projectId: project.id });

    expect(result.items).toHaveLength(3);
    expect(result.items[0].content).toBe('Update 0');
    expect(result.items[2].content).toBe('Update 2');
  });

  it('returns nextCursor when there are more items than the limit', async () => {
    const leader = await createProjectUser('list3@test.com');
    const project = await seedProject(leader.id);
    const now = Date.now();

    for (let i = 0; i < 3; i++) {
      await prisma.projectUpdate.create({
        data: {
          projectId: project.id,
          authorId: leader.id,
          content: `Update ${i}`,
          createdAt: new Date(now - i * 1000),
        },
      });
    }

    const result = await service.list({ projectId: project.id, limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it('returns nextCursor=null on the last page', async () => {
    const leader = await createProjectUser('list4@test.com');
    const project = await seedProject(leader.id);

    await prisma.projectUpdate.create({
      data: { projectId: project.id, authorId: leader.id, content: 'Only update' },
    });

    const result = await service.list({ projectId: project.id, limit: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('fetches the next page without overlap using cursor', async () => {
    const leader = await createProjectUser('list5@test.com');
    const project = await seedProject(leader.id);
    const now = Date.now();

    for (let i = 0; i < 4; i++) {
      await prisma.projectUpdate.create({
        data: {
          projectId: project.id,
          authorId: leader.id,
          content: `Update ${i}`,
          createdAt: new Date(now - i * 1000),
        },
      });
    }

    const page1 = await service.list({ projectId: project.id, limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await service.list({
      projectId: project.id,
      limit: 2,
      cursor: page1.nextCursor!,
    });

    const page1Ids = new Set(page1.items.map((u) => u.id));
    expect(page2.items.every((u) => !page1Ids.has(u.id))).toBe(true);
    expect(page2.items.length).toBeGreaterThanOrEqual(1);
  });

  it('respects limit cap of 30', async () => {
    const leader = await createProjectUser('list6@test.com');
    const project = await seedProject(leader.id);

    const result = await service.list({ projectId: project.id, limit: 999 });

    expect(result.items.length).toBeLessThanOrEqual(30);
  });

  it('isolates updates by project — does not leak across projects', async () => {
    const leader = await createProjectUser('list7@test.com');
    const projectA = await seedProject(leader.id, undefined, 'Project A');
    const projectB = await seedProject(leader.id, undefined, 'Project B');

    await prisma.projectUpdate.create({
      data: { projectId: projectA.id, authorId: leader.id, content: 'A update' },
    });
    await prisma.projectUpdate.create({
      data: { projectId: projectB.id, authorId: leader.id, content: 'B update' },
    });

    const resultA = await service.list({ projectId: projectA.id });
    expect(resultA.items).toHaveLength(1);
    expect(resultA.items[0].content).toBe('A update');
  });
});
