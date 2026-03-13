/**
 * @file tests/notifications/notification.service.test.ts
 * @description Unit tests for NotificationService.
 *
 * Tests: getUserNotifications, getUnreadCount, markAsRead, send
 */

import { describe, it, expect, vi } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { NotificationService } from '../../src/modules/notifications/services/notification.service.js';
import { NotificationType, NotificationChannel } from '../../src/modules/notifications/types.js';
import { createNotificationUser, seedNotification } from './helpers.js';

// Prevent real emails in tests
vi.mock('../../src/core/utils/email.service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendLoginEmail: vi.fn().mockResolvedValue(undefined),
}));

const service = new NotificationService();

// ─────────────────────────────────────────────────────────────────────────────
// getUserNotifications()
// ─────────────────────────────────────────────────────────────────────────────

describe('getUserNotifications()', () => {
  it('returns empty array when user has no notifications', async () => {
    const user = await createNotificationUser('notif-empty@test.com');
    const result = await service.getUserNotifications(user.id);
    expect(result).toEqual([]);
  });

  it('returns notifications with isRead mapped from DB read field', async () => {
    const user = await createNotificationUser('notif-isread@test.com');
    await seedNotification(user.id, 'Unread notif', false);
    await seedNotification(user.id, 'Read notif', true);

    const result = await service.getUserNotifications(user.id);
    expect(result).toHaveLength(2);
    // Both isRead values should be present
    const readFlags = result.map((n) => n.isRead);
    expect(readFlags).toContain(true);
    expect(readFlags).toContain(false);
  });

  it('filters to unread only when unreadOnly=true', async () => {
    const user = await createNotificationUser('notif-filter@test.com');
    await seedNotification(user.id, 'Unread', false);
    await seedNotification(user.id, 'Read', true);

    const result = await service.getUserNotifications(user.id, true);
    expect(result).toHaveLength(1);
    expect(result[0].isRead).toBe(false);
    expect(result[0].title).toBe('Unread');
  });

  it('returns response DTO shape (id, type, title, message, isRead, createdAt)', async () => {
    const user = await createNotificationUser('notif-shape@test.com');
    await seedNotification(user.id, 'Shape test');

    const result = await service.getUserNotifications(user.id);
    expect(result[0]).toMatchObject({
      id: expect.any(String),
      type: 'SYSTEM',
      title: 'Shape test',
      message: 'Test message',
      isRead: false,
      createdAt: expect.any(String),
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getUnreadCount()
// ─────────────────────────────────────────────────────────────────────────────

describe('getUnreadCount()', () => {
  it('returns 0 when no notifications', async () => {
    const user = await createNotificationUser('count-zero@test.com');
    const count = await service.getUnreadCount(user.id);
    expect(count).toBe(0);
  });

  it('counts only unread notifications', async () => {
    const user = await createNotificationUser('count-mixed@test.com');
    await seedNotification(user.id, 'Unread 1', false);
    await seedNotification(user.id, 'Unread 2', false);
    await seedNotification(user.id, 'Read', true);

    const count = await service.getUnreadCount(user.id);
    expect(count).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// markAsRead()
// ─────────────────────────────────────────────────────────────────────────────

describe('markAsRead()', () => {
  it('marks the notification as read', async () => {
    const user = await createNotificationUser('mark-read@test.com');
    const notif = await seedNotification(user.id, 'To be read', false);

    await service.markAsRead(user.id, notif.id);

    const updated = await prisma.notification.findUnique({ where: { id: notif.id } });
    expect(updated?.read).toBe(true);
  });

  it('ignores notification belonging to another user', async () => {
    const a = await createNotificationUser('mark-a@test.com');
    const b = await createNotificationUser('mark-b@test.com');
    const notif = await seedNotification(a.id, 'A notif', false);

    await service.markAsRead(b.id, notif.id); // wrong user

    const unchanged = await prisma.notification.findUnique({ where: { id: notif.id } });
    expect(unchanged?.read).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// send()
// ─────────────────────────────────────────────────────────────────────────────

describe('send()', () => {
  it('creates an in-app notification record', async () => {
    const user = await createNotificationUser('send@test.com');

    await service.send({
      userId: user.id,
      type: NotificationType.GENERAL_ANNOUNCEMENT,
      title: 'Hello',
      message: 'You have a new announcement',
    });

    const notif = await prisma.notification.findFirst({ where: { userId: user.id } });
    expect(notif?.title).toBe('Hello');
    expect(notif?.read).toBe(false);
  });

  it('skips notification if all channels disabled', async () => {
    const user = await createNotificationUser('send-skip@test.com');

    // Disable IN_APP channel
    await prisma.notificationPreference.create({
      data: {
        userId: user.id,
        channel: NotificationChannel.IN_APP,
        category: 'GENERAL',
        enabled: false,
      },
    });

    await service.send({
      userId: user.id,
      type: NotificationType.GENERAL_ANNOUNCEMENT,
      title: 'Skipped',
      message: 'Should not be stored',
      channels: [NotificationChannel.IN_APP],
    });

    const count = await prisma.notification.count({ where: { userId: user.id } });
    expect(count).toBe(0);
  });
});
