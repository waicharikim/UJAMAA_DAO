/**
 * @file tests/emergency/emergency.service.test.ts
 * @description Unit tests for EmergencyService.
 * Uses real Prisma + test DB. DB truncated before each test by testSetup.ts.
 */

// ─────────────────────────────────────────────
// Mocks — must be before all imports
// ─────────────────────────────────────────────

vi.mock('../../src/modules/economy/services/participationRights.service.js', () => ({
  participationRightsService: {
    spend: vi.fn().mockResolvedValue(undefined),
    award: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/modules/notifications/services/notification.service.js', () => ({
  notificationService: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/modules/audit/services/audit.service.js', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

import { describe, it, expect, vi } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { EmergencyType, EmergencySeverity } from '@prisma/client';
import { EmergencyService } from '../../src/modules/emergency/services/emergency.service.js';
import {
  createEmergencyUser,
  seedWard,
  seedEmergencyAlert,
} from './helpers.js';

const service = new EmergencyService();

// ─────────────────────────────────────────────
// reportEmergency
// ─────────────────────────────────────────────

describe('EmergencyService.reportEmergency', () => {
  it('creates an ACTIVE alert with correct type and severity', async () => {
    const user = await createEmergencyUser('reporter@test.com');
    const ward = await seedWard('Test Ward');

    const alert = await service.reportEmergency(user.id, {
      type: EmergencyType.FIRE,
      description: 'Large fire in the market area near the main road',
      locationWardId: ward.id,
    });

    expect(alert.id).toBeDefined();
    expect(alert.emergencyType).toBe(EmergencyType.FIRE);
    expect(alert.severity).toBe(EmergencySeverity.CRITICAL);
    expect(alert.reporterId).toBe(user.id);
    expect(alert.status).toBe('ACTIVE');
  });

  it('maps MEDICAL type to HIGH severity', async () => {
    const user = await createEmergencyUser('medical@test.com');
    const ward = await seedWard();

    const alert = await service.reportEmergency(user.id, {
      type: EmergencyType.MEDICAL,
      description: 'Person collapsed and needs urgent medical attention now',
      locationWardId: ward.id,
    });

    expect(alert.emergencyType).toBe(EmergencyType.MEDICAL);
    expect(alert.severity).toBe(EmergencySeverity.HIGH);
  });

  it('maps ACCIDENT type to MEDIUM severity', async () => {
    const user = await createEmergencyUser('accident@test.com');
    const ward = await seedWard();

    const alert = await service.reportEmergency(user.id, {
      type: EmergencyType.ACCIDENT,
      description: 'Road accident on the bypass — two vehicles involved',
      locationWardId: ward.id,
    });

    expect(alert.emergencyType).toBe(EmergencyType.ACCIDENT);
    expect(alert.severity).toBe(EmergencySeverity.MEDIUM);
  });

  it('stores locationWardId as location field', async () => {
    const user = await createEmergencyUser('flood@test.com');
    const ward = await seedWard();

    const alert = await service.reportEmergency(user.id, {
      type: EmergencyType.FLOOD,
      description: 'Flooding has blocked main road and homes are affected',
      locationWardId: ward.id,
    });

    expect(alert.location).toBe(ward.id);
  });
});

// ─────────────────────────────────────────────
// respondToEmergency
// ─────────────────────────────────────────────

describe('EmergencyService.respondToEmergency', () => {
  it('creates a response for an existing alert', async () => {
    const reporter = await createEmergencyUser('reporter2@test.com');
    const responder = await createEmergencyUser('responder@test.com');
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(reporter.id, ward.id);

    const response = await service.respondToEmergency(responder.id, alert.id, {
      message: 'On my way with medical supplies',
    });

    expect(response.emergencyId).toBe(alert.id);
    expect(response.userId).toBe(responder.id);
    expect(response.notes).toBe('On my way with medical supplies');
  });

  it('throws 404 for unknown alert', async () => {
    const user = await createEmergencyUser('resp404@test.com');

    await expect(
      service.respondToEmergency(user.id, '00000000-0000-0000-0000-000000000000', {
        message: 'This alert does not exist',
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─────────────────────────────────────────────
// listAlerts
// ─────────────────────────────────────────────

describe('EmergencyService.listAlerts', () => {
  it('returns empty list when no alerts exist', async () => {
    const result = await service.listAlerts({});
    expect(result.alerts).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });

  it('returns all alerts with pagination', async () => {
    const user = await createEmergencyUser('listall@test.com');
    const ward = await seedWard();
    await seedEmergencyAlert(user.id, ward.id, { type: EmergencyType.FIRE });
    await seedEmergencyAlert(user.id, ward.id, { type: EmergencyType.FLOOD });

    const result = await service.listAlerts({});
    expect(result.alerts).toHaveLength(2);
    expect(result.pagination.total).toBe(2);
  });

  it('filters by wardId', async () => {
    const user = await createEmergencyUser('filterward@test.com');
    const wardA = await seedWard('Ward A');
    const wardB = await seedWard('Ward B');
    await seedEmergencyAlert(user.id, wardA.id);
    await seedEmergencyAlert(user.id, wardB.id);

    const result = await service.listAlerts({ wardId: wardA.id });
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].location).toBe(wardA.id);
  });

  it('filters by type', async () => {
    const user = await createEmergencyUser('filtertype@test.com');
    const ward = await seedWard();
    await seedEmergencyAlert(user.id, ward.id, { type: EmergencyType.FIRE });
    await seedEmergencyAlert(user.id, ward.id, { type: EmergencyType.FLOOD });

    const result = await service.listAlerts({ type: EmergencyType.FIRE });
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].emergencyType).toBe(EmergencyType.FIRE);
  });

  it('paginates correctly', async () => {
    const user = await createEmergencyUser('paginate@test.com');
    const ward = await seedWard();
    for (let i = 0; i < 5; i++) {
      await seedEmergencyAlert(user.id, ward.id);
    }

    const page1 = await service.listAlerts({ limit: 2, page: 1 });
    expect(page1.alerts).toHaveLength(2);
    expect(page1.pagination.total).toBe(5);
    expect(page1.pagination.totalPages).toBe(3);
  });
});

// ─────────────────────────────────────────────
// getAlert
// ─────────────────────────────────────────────

describe('EmergencyService.getAlert', () => {
  it('returns alert with reporter and responses', async () => {
    const reporter = await createEmergencyUser('getone@test.com');
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(reporter.id, ward.id);

    const result = await service.getAlert(alert.id);
    expect(result.id).toBe(alert.id);
    expect(result.reporter).toBeDefined();
    expect(result.reporter?.id).toBe(reporter.id);
    expect(result.responses).toEqual([]);
  });

  it('throws 404 for unknown alert', async () => {
    await expect(
      service.getAlert('00000000-0000-0000-0000-000000000000')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─────────────────────────────────────────────
// updateAlertStatus
// ─────────────────────────────────────────────

describe('EmergencyService.updateAlertStatus', () => {
  it('transitions ACTIVE → IN_PROGRESS', async () => {
    const reporter = await createEmergencyUser('status1@test.com');
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(reporter.id, ward.id, { status: 'ACTIVE' });

    const updated = await service.updateAlertStatus(reporter.id, alert.id, 'IN_PROGRESS');

    expect(updated.status).toBe('IN_PROGRESS');
    expect(updated.resolvedAt).toBeNull();
    expect(updated.resolvedById).toBeNull();
  });

  it('transitions ACTIVE → FALSE_ALARM and sets resolvedAt', async () => {
    const reporter = await createEmergencyUser('status2@test.com');
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(reporter.id, ward.id, { status: 'ACTIVE' });

    const updated = await service.updateAlertStatus(
      reporter.id,
      alert.id,
      'FALSE_ALARM',
      'Turned out to be a controlled burn'
    );

    expect(updated.status).toBe('FALSE_ALARM');
    expect(updated.resolvedAt).not.toBeNull();
    expect(updated.resolvedById).toBe(reporter.id);
    expect(updated.statusNote).toBe('Turned out to be a controlled burn');
  });

  it('transitions IN_PROGRESS → RESOLVED and sets resolvedAt', async () => {
    const reporter = await createEmergencyUser('status3@test.com');
    const responder = await createEmergencyUser('responder3@test.com');
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(reporter.id, ward.id, { status: 'IN_PROGRESS' });

    const updated = await service.updateAlertStatus(responder.id, alert.id, 'RESOLVED');

    expect(updated.status).toBe('RESOLVED');
    expect(updated.resolvedAt).not.toBeNull();
    expect(updated.resolvedById).toBe(responder.id);
  });

  it('throws 400 when alert is already RESOLVED', async () => {
    const reporter = await createEmergencyUser('status4@test.com');
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(reporter.id, ward.id, { status: 'RESOLVED' });

    await expect(
      service.updateAlertStatus(reporter.id, alert.id, 'IN_PROGRESS')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when alert is already FALSE_ALARM', async () => {
    const reporter = await createEmergencyUser('status5@test.com');
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(reporter.id, ward.id, { status: 'FALSE_ALARM' });

    await expect(
      service.updateAlertStatus(reporter.id, alert.id, 'RESOLVED')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 for unknown alertId', async () => {
    const reporter = await createEmergencyUser('status6@test.com');

    await expect(
      service.updateAlertStatus(reporter.id, '00000000-0000-0000-0000-000000000000', 'RESOLVED')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
