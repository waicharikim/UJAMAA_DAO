// tests/auth/auth.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '../../src/modules/auth/services/auth.service.js';
import { prisma } from '../../src/core/database/client.js';
import { participationRightsService } from '../../src/modules/economy/services/participationRights.service.js';
import { groupMembershipService } from '../../src/modules/community/services/groupMembership.service.js';
import { sendVerificationEmail, sendLoginEmail } from '../../src/core/utils/email.service.js';

vi.mock('../../src/core/utils/email.service.js');
vi.mock('../../src/modules/economy/services/participationRights.service.js');
vi.mock('../../src/modules/community/services/groupMembership.service.js');

describe('Auth Service - Magic Link Flow', () => {
  beforeEach(async () => {
    await prisma.$transaction([
      prisma.user.deleteMany(),
      prisma.ward.deleteMany(),
      prisma.emailVerificationToken.deleteMany(),
    ]);
  });

  it('should create new user and send verification email on first request', async () => {
    const ward = await prisma.ward.create({
      data: {
        id: 'ward-test-1',
        name: 'Test Ward',
        constituencyId: 'const-1',
        countyId: 'county-1',
      },
    });

    const dto = {
      email: 'newuser@ujamaa.test',
      name: 'New User',
      phoneNumber: '+254700000000',
      primaryWardId: ward.id,
      secondaryWardId: ward.id,
      industryIds: [],
      goodsServiceIds: [],
    };

    const result = await authService.sendMagicLink(dto);

    expect(result.newUser).toBe(true);
    expect(result.sentVerification).toBe(true);
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);

    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    expect(user).toBeTruthy();
    expect(user?.verificationLevel).toBe('UNVERIFIED');
  });

  it('should send magic link to existing verified user', async () => {
    await prisma.user.create({
      data: {
        email: 'existing@ujamaa.test',
        name: 'Existing User',
        verificationLevel: 'EMAIL_VERIFIED',
      },
    });

    const dto = {
      email: 'existing@ujamaa.test',
      name: 'Existing',
      phoneNumber: '+254700000001',
      primaryWardId: 'dummy',
      secondaryWardId: 'dummy',
      industryIds: [],
      goodsServiceIds: [],
    };

    const result = await authService.sendMagicLink(dto);

    expect(result.newUser).toBe(false);
    expect(result.sentLogin).toBe(true);
    expect(sendLoginEmail).toHaveBeenCalledTimes(1);
  });
});