/**
 * @file tests/verification.spec.ts
 * @description
 * Comprehensive unit tests for the UJAMAADAO Verification Module, 
 * using the Vitest testing framework. 
 * * CRITICAL FIX: Uses the MOCKS object structure to define mock functions 
 * at the top level, preventing the "Cannot access before initialization" 
 * ReferenceError caused by Vitest's module hoisting mechanism when mocking 
 * exported functions like hashVerificationCode and verifyCode.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
// Import the service file to get the type and the module for mocking
import { VerificationService } from '../src/services/verification.service.js'; 
import { verificationController } from '../src/controllers/verification.controller.js';
import { ApiError } from '../src/utils/ApiError.js';
import prisma from '../src/prismaClient.js';

// --- Setup Global Test Constants ---
const STABLE_TEST_CODE = '123456';
const STABLE_HASH = 'stable-test-hash-for-mocking'; 
const TEST_USER_ID = 'user-123';
const TEST_VERIFICATION_ID = 'auth-456';

// ---------------------------------------------------------------------
// GLOBAL MOCK REFERENCES (THE HOISTING FIX)
// ---------------------------------------------------------------------
// This object defines the mock implementations *before* the vi.mock factory executes.
const MOCKS = {
    // Mock implementation for hashVerificationCode: always returns a stable hash
    hash: vi.fn().mockImplementation(async (code: string) => STABLE_HASH),
    // Mock implementation for verifyCode: only succeeds if code/hash match constants
    verify: vi.fn().mockImplementation(async (code: string, hash: string) => 
        Promise.resolve(code === STABLE_TEST_CODE && hash === STABLE_HASH)
    ),
    // Mock implementations for the external logger and event bus
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
    eventBus: {
        publish: vi.fn(),
    }
};

// Expose mock functions for easy use in test assertions
const mockHash = MOCKS.hash;
const mockVerify = MOCKS.verify;


// ---------------------------------------------------------------------
// MODULE MOCKS (Hoisted by Vitest)
// ---------------------------------------------------------------------

// 1. Mock Prisma Client
vi.mock('../src/prismaClient.js', () => ({
  default: {
    authToken: {
      findUnique: vi.fn(),
      findFirst: vi.fn(), 
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    userActivityLog: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ward: {
        findUnique: vi.fn(),
    },
    // Mock $transaction to simply execute the callback function synchronously for tests
    $transaction: vi.fn(async (callback) => {
        const tx = vi.mocked(prisma);
        await callback(tx);
        // This array simulates the results of the two operations in the phone verification transaction
        return [
            { id: TEST_VERIFICATION_ID, used: true, usedAt: new Date() }, 
            { id: TEST_USER_ID, phoneVerified: true }
        ]; 
    }),
  }
}));

// 2. Mock smsProvider (External Dependency)
vi.mock('../src/services/smsProvider.js', () => ({
    SMSProvider: vi.fn().mockImplementation(() => ({
        sendVerificationCode: vi.fn().mockResolvedValue(true),
    })),
}));

// 3. Mock Logger and Event Bus (newly added mocks to match the merged service file)
vi.mock('../src/utils/logger.js', () => ({ default: MOCKS.logger }));
vi.mock('../src/events/eventBus.js', () => ({ EventBus: MOCKS.eventBus }));


// 4. Mock the Hashing functions directly from the service module
// This is the CRITICAL STEP where the hoisting fix (using MOCKS) is applied.
vi.mock('../src/services/verification.service.js', async (importOriginal) => {
    const actual = await importOriginal() as typeof import('../src/services/verification.service.js'); 
    return {
        ...actual,
        hashVerificationCode: MOCKS.hash, // Injects the pre-initialized mock
        verifyCode: MOCKS.verify,         // Injects the pre-initialized mock
    };
});

// Create a single instance of the service (This line must be *after* the vi.mock call)
const verificationServiceInstance = new VerificationService();

// Inject the mocked service instance into the controller (if needed for controller tests)
(verificationController as any).verificationService = verificationServiceInstance;


// --- Mock Helper Functions (for Controller tests, not used in this specific test file) ---
const mockRequest = (body = {}, params = {}, user = { userId: 'test-user-id', roles: ['user:basic'] }) => ({
    body,
    params,
    user,
}) as any;

const mockSyncResponse = () => {
    const res = {} as any;
    res.status = vi.fn().mockReturnThis();
    res.json = vi.fn().mockReturnThis();
    res.send = vi.fn().mockReturnThis();
    return res;
};

const mockNext = vi.fn();

// ---------------------------------------------------------------------
// TEST SUITE: VerificationService Core Logic
// ---------------------------------------------------------------------

describe('VerificationService Core Security & Logic', () => {
  const TEST_PHONE = '+254700000000';
  const TEST_CODE = STABLE_TEST_CODE;
  const TEST_WARD_ID = 'ward-001';

  beforeEach(() => {
    // Reset all mock calls and implementations before each test
    vi.clearAllMocks();
    MOCKS.hash.mockImplementation(async (code: string) => STABLE_HASH);
    MOCKS.verify.mockImplementation(async (code: string, hash: string) => 
        Promise.resolve(code === STABLE_TEST_CODE && hash === STABLE_HASH)
    );
  });

  // T1: Initiate Phone Verification (Happy Path)
  it('T1: initiatePhoneVerification should successfully hash and store the code securely', async () => {
    // Mock database responses for the rate-limiting check and user existence
    (prisma.user.findUnique as vi.Mock).mockResolvedValue({ id: TEST_USER_ID });
    (prisma.authToken.findFirst as vi.Mock).mockResolvedValue(null); // No active token
    (prisma.authToken.create as vi.Mock).mockResolvedValue({ id: TEST_VERIFICATION_ID });

    const result = await verificationServiceInstance.initiatePhoneVerification(TEST_USER_ID, TEST_PHONE);

    expect(result.verificationId).toBe(TEST_VERIFICATION_ID);
    
    // Assert that the mock hash function was called and its output was stored
    expect(mockHash).toHaveBeenCalledWith(expect.any(String)); 
    expect(prisma.authToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tokenHash: STABLE_HASH, 
        type: 'VERIFY_PHONE',
      }),
    }));
    // Assert SMS was attempted
    expect(verificationServiceInstance['smsProvider'].sendVerificationCode).toHaveBeenCalled();
    // Assert logger was called
    expect(MOCKS.logger.info).toHaveBeenCalledWith(expect.stringContaining('Phone verification initiated'), expect.any(Object));
  });
  
  // T1.5: Initiate Phone Verification (Rate Limit Hit)
  it('T1.5: initiatePhoneVerification should return the ID of an existing active token if found', async () => {
      const activeToken = { id: TEST_VERIFICATION_ID, expiresAt: new Date(Date.now() + 60000) };
      (prisma.user.findUnique as vi.Mock).mockResolvedValue({ id: TEST_USER_ID });
      (prisma.authToken.findFirst as vi.Mock).mockResolvedValue(activeToken);

      const result = await verificationServiceInstance.initiatePhoneVerification(TEST_USER_ID, TEST_PHONE);

      expect(result.verificationId).toBe(TEST_VERIFICATION_ID);
      // Assert that we skipped creating a new token and sending a new SMS
      expect(prisma.authToken.create).not.toHaveBeenCalled();
      expect(verificationServiceInstance['smsProvider'].sendVerificationCode).not.toHaveBeenCalled();
      // Assert logger was called for warning
      expect(MOCKS.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Active phone token reused'), expect.any(Object));
  });

  // T2: Complete Phone Verification (Success)
  it('T2: completePhoneVerification should succeed with a valid code and update user/token', async () => {
    const verification = {
      id: TEST_VERIFICATION_ID,
      userId: TEST_USER_ID,
      tokenHash: STABLE_HASH, 
      expiresAt: new Date(Date.now() + 60000), 
      used: false,
      metadata: { attempts: 0 } as any, 
      type: 'VERIFY_PHONE', 
    };
    // Mock: Verification token found
    (prisma.authToken.findUnique as vi.Mock).mockResolvedValue(verification);
    
    // Mock: $transaction execution is handled by the global mock, which asserts the user.update and authToken.update calls inside
    
    const result = await verificationServiceInstance.completePhoneVerification(TEST_VERIFICATION_ID, TEST_CODE);

    expect(result).toBe(true);
    expect(mockVerify).toHaveBeenCalledWith(TEST_CODE, STABLE_HASH);
    
    // Assert Transaction was called
    expect(prisma.$transaction).toHaveBeenCalled();

    // The updates are asserted against the mock transaction function's execution of the callback:
    
    // 1. Assert Token update (marked used) inside transaction
    expect(vi.mocked(prisma.authToken.update)).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TEST_VERIFICATION_ID }, data: expect.objectContaining({ used: true }) })
    );
    // 2. Assert User update (phoneVerified = true) inside transaction
    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TEST_USER_ID }, data: { phoneVerified: true } })
    );

    // 3. Assert IP award (outside transaction, after success)
    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TEST_USER_ID }, data: expect.objectContaining({ globalImpactPoints: { increment: 10 } }) })
    );
    // 4. Assert event was published
    expect(MOCKS.eventBus.publish).toHaveBeenCalledWith('user.verified.phone', expect.any(Object));
  });

  // T3: Phone Verification (Failure - Invalid Code/Attempts Increment)
  it('T3: completePhoneVerification should fail and increment attempts on invalid code', async () => {
    // Force the verification to fail (code mismatch)
    mockVerify.mockResolvedValueOnce(false); 
      
    const verification = {
        id: TEST_VERIFICATION_ID,
        userId: TEST_USER_ID,
        tokenHash: STABLE_HASH, 
        expiresAt: new Date(Date.now() + 60000),
        used: false,
        metadata: { attempts: 0 } as any,
        type: 'VERIFY_PHONE', 
    };
    (prisma.authToken.findUnique as vi.Mock).mockResolvedValue(verification);
    (prisma.authToken.update as vi.Mock).mockResolvedValue({}); // Mock update success for the attempt counter

    await expect(verificationServiceInstance.completePhoneVerification(TEST_VERIFICATION_ID, '999999'))
        .rejects.toThrow(ApiError);
    
    // Confirms the update logic was executed (attempts: 1, used: false)
    expect(prisma.authToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ 
            where: { id: verification.id },
            data: expect.objectContaining({ metadata: { attempts: 1 }, used: false }) 
        })
    );
    expect(prisma.user.update).not.toHaveBeenCalled(); // User should not be updated
    expect(MOCKS.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid code attempt'), expect.any(Object));
  });
  
  // T4: Phone Verification (Failure - Attempts Exceeded)
  it('T4: completePhoneVerification should fail permanently and mark token used after max attempts (5) exceeded', async () => {
    const verification = {
        id: TEST_VERIFICATION_ID,
        userId: TEST_USER_ID,
        tokenHash: STABLE_HASH,
        expiresAt: new Date(Date.now() + 60000),
        used: false,
        metadata: { attempts: 4 } as any, // 5th attempt will hit the limit
        type: 'VERIFY_PHONE', 
    };
    (prisma.authToken.findUnique as vi.Mock).mockResolvedValue(verification);
    mockVerify.mockResolvedValueOnce(false); // Code fails

    // The attempt itself hits the limit
    await expect(verificationServiceInstance.completePhoneVerification(TEST_VERIFICATION_ID, '999999'))
        .rejects.toThrow('Verification attempts exceeded. Please restart the process.');
    
    // Assertion: Check that the token was marked as used: true when limit is exceeded
    expect(prisma.authToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ 
            where: { id: TEST_VERIFICATION_ID },
            data: expect.objectContaining({ 
                used: true, // Marked as used
                metadata: { attempts: 5 }
            }) 
        })
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  
  // T6: Community Verification (Success - Reaches Threshold)
  it('T6: submitCommunityVerificationVote should succeed and update user status if vote passes required threshold', async () => {
    const LOG_ID = 'log-123';
    const VERIFIER_1 = 'verifier-1';
    const VERIFIER_3 = 'verifier-3';
    
    // Log state before VERIFIER_3 votes (1 approval, 2 required)
    const verificationLog = {
      id: LOG_ID,
      userId: TEST_USER_ID,
      eventType: 'COMMUNITY_VERIFICATION_INITIATED',
      eventData: {
        verifierIds: [VERIFIER_1, 'verifier-2', VERIFIER_3],
        requiredApprovals: 2, 
        approvals: [VERIFIER_1],
        rejections: [],
        status: 'PENDING'
      }
    };
    (prisma.userActivityLog.findUnique as vi.Mock).mockResolvedValue(verificationLog);
    
    const result = await verificationServiceInstance.submitCommunityVerificationVote(
      LOG_ID,
      VERIFIER_3, // This vote pushes approvals to 2 (threshold met)
      true
    );

    expect(result.completed).toBe(true);
    expect(result.result).toBe(true);
    
    // Assert Transaction was called
    expect(prisma.$transaction).toHaveBeenCalled();
    
    // Assert User update (communityVerified = true) inside transaction
    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TEST_USER_ID }, data: { communityVerified: true } })
    );
    // Assert Verifier IP award (updateMany) inside transaction
    expect(vi.mocked(prisma.user.updateMany)).toHaveBeenCalledWith(
        expect.objectContaining({ data: { globalImpactPoints: { increment: 5 } } })
    );
    // Assert IP award for the verified user (inside transaction)
    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TEST_USER_ID }, data: expect.objectContaining({ globalImpactPoints: { increment: 25 } }) })
    );
    // Assert event was published
    expect(MOCKS.eventBus.publish).toHaveBeenCalledWith('community.verification.completed', expect.any(Object));
  });
  
  // T7: Location Verification (Success)
  it('T7: verifyLocation should succeed, update user and create activity log if ward is valid', async () => {
      const locationData = {
          userId: TEST_USER_ID,
          coordinates: { latitude: 1.0, longitude: 36.0 },
          wardId: TEST_WARD_ID,
          timestamp: new Date(),
          evidence: 'photo.url'
      };

      // Mock: Ward exists (location validation passes)
      (prisma.ward.findUnique as vi.Mock).mockResolvedValue({ id: TEST_WARD_ID, name: 'Test Ward' });

      const result = await verificationServiceInstance.verifyLocation(locationData);

      expect(result).toBe(true);
      
      // Assert Transaction calls
      expect(prisma.$transaction).toHaveBeenCalled();
      
      // Assert User update (locationVerified, primaryWardId) inside transaction
      expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
          expect.objectContaining({ data: { locationVerified: true, primaryWardId: TEST_WARD_ID } })
      );
      
      // Assert Activity Log creation inside transaction
      expect(vi.mocked(prisma.userActivityLog.create)).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ eventType: 'LOCATION_VERIFIED' }) })
      );
      
      // Assert IP award (outside transaction)
      expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ globalImpactPoints: { increment: 15 } }) })
      );
      expect(MOCKS.eventBus.publish).toHaveBeenCalledWith('user.verified.location', expect.any(Object));
  });

  // T9: Get Verification Status
  it('T9: getVerificationStatus should calculate the correct overall level and score (BASIC)', async () => {
      // Mock user state
      const mockUserStatus = {
          emailVerified: true,  // 10 points
          phoneVerified: true,  // 20 points
          communityVerified: false,
          locationVerified: false,
          expertVerified: false,
      };
      
      // Total Score: 30. Thresholds: UNVERIFIED (<30), BASIC (>=30), COMMUNITY (>=70), FULLY_VERIFIED (>=120)
      const expectedScore = 30; 
      const expectedLevel = 'BASIC';

      (prisma.user.findUnique as vi.Mock).mockResolvedValue(mockUserStatus);

      const status = await verificationServiceInstance.getVerificationStatus(TEST_USER_ID);

      expect(status.verificationScore).toBe(expectedScore);
      expect(status.overallLevel).toBe(expectedLevel);
  });
});
