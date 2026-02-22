// tests/auth/auth.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '../../src/modules/auth/services/auth.service.js';
import { prisma } from '../../src/core/database/client.js';
import { sendVerificationEmail, sendLoginEmail } from '../../src/core/utils/email.service.js';

vi.mock('../../src/core/utils/email.service.js');
vi.mock('../../src/modules/economy/services/participationRights.service.js');
vi.mock('../../src/modules/community/services/groupMembership.service.js');

// Fixed UUIDs for location hierarchy (seeded fresh before each test)
const TEST_COUNTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TEST_CONST_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const TEST_WARD_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

describe('Auth Service - Magic Link Flow', () => {
  beforeEach(async () => {
    // testSetup.ts already TRUNCATEs all tables before each test via global beforeEach.
    // Here we seed the location hierarchy required by authService.sendMagicLink.
    await prisma.county.create({
      data: { id: TEST_COUNTY_ID, name: 'Test County', code: 'TC-TEST-01' },
    });
    await prisma.constituency.create({
      data: { id: TEST_CONST_ID, name: 'Test Constituency', countyId: TEST_COUNTY_ID },
    });
    await prisma.ward.create({
      data: {
        id: TEST_WARD_ID,
        name: 'Test Ward',
        constituencyId: TEST_CONST_ID,
        countyId: TEST_COUNTY_ID,
      },
    });
  });

  it('should create new user and send verification email on first request', async () => {
    const dto = {
      email: 'newuser@ujamaa.test',
      name: 'New User',
      phoneNumber: '+254700000000',
      primaryWardId: TEST_WARD_ID,
      secondaryWardId: TEST_WARD_ID,
      industryIds: [] as string[],
      goodsServiceIds: [] as string[],
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
      primaryWardId: TEST_WARD_ID,
      secondaryWardId: TEST_WARD_ID,
      industryIds: [] as string[],
      goodsServiceIds: [] as string[],
    };

    const result = await authService.sendMagicLink(dto);

    expect(result.newUser).toBe(false);
    expect(result.sentLogin).toBe(true);
    expect(sendLoginEmail).toHaveBeenCalledTimes(1);
  });
});
