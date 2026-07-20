/**
 * @file tests/auth/webauthn.service.test.ts
 * Unit tests for WebAuthnService.
 *
 * @simplewebauthn/server crypto calls are mocked — we test our own logic:
 * challenge creation/cleanup, DB writes, credential management, error cases.
 */

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn().mockResolvedValue({
    challenge: 'test-registration-challenge',
    rp: { name: 'UjamaaDAO', id: 'localhost' },
    user: { id: new Uint8Array([1, 2, 3]).buffer, name: 'test@example.com', displayName: 'Test' },
    pubKeyCredParams: [],
    timeout: 60000,
    attestation: 'none',
    excludeCredentials: [],
    authenticatorSelection: {},
  }),
  verifyRegistrationResponse: vi.fn().mockResolvedValue({
    verified: true,
    registrationInfo: {
      credential: {
        id: 'mock-credential-id',
        publicKey: new Uint8Array([1, 2, 3, 4]),
        counter: 0,
      },
      aaguid: '00000000-0000-0000-0000-000000000000',
    },
  }),
  generateAuthenticationOptions: vi.fn().mockResolvedValue({
    challenge: 'test-authentication-challenge',
    rpId: 'localhost',
    allowCredentials: [],
    userVerification: 'preferred',
    timeout: 60000,
  }),
  verifyAuthenticationResponse: vi.fn().mockResolvedValue({
    verified: true,
    authenticationInfo: { newCounter: 1 },
  }),
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { WebAuthnService } from '../../src/modules/auth/services/webauthn.service.js';
import { seedLocation, createTestUser, TEST_WARD_ID } from './helpers.js';

const svc = new WebAuthnService();

// Minimal fake RegistrationResponseJSON shape
function fakeRegistrationResponse(transports: string[] = ['internal']) {
  return {
    id: 'mock-credential-id',
    rawId: 'mock-credential-id',
    type: 'public-key',
    response: {
      clientDataJSON: 'eyJ0eXBlIjoiY3JlYXRlIn0', // base64url {"type":"create"}
      attestationObject: 'base64-attestation',
      transports,
    },
  } as any;
}

// Minimal fake AuthenticationResponseJSON shape
function fakeAuthenticationResponse(credentialId = 'mock-credential-id') {
  return {
    id: credentialId,
    rawId: credentialId,
    type: 'public-key',
    response: {
      clientDataJSON: 'eyJ0eXBlIjoiZ2V0In0', // base64url {"type":"get"}
      authenticatorData: 'base64-auth-data',
      signature: 'base64-signature',
    },
  } as any;
}

describe('WebAuthnService', () => {
  let userId: string;
  let userEmail: string;

  beforeEach(async () => {
    await seedLocation();
    userEmail = `webauthn-${Date.now()}@test.com`;
    const user = await createTestUser(userEmail, 'EMAIL_VERIFIED');
    userId = user.id;
  });

  // ─────────────────────────────────────────────
  // generateRegistrationOptions
  // ─────────────────────────────────────────────

  describe('generateRegistrationOptions', () => {
    it('returns options and stores a challenge for the user', async () => {
      const options = await svc.generateRegistrationOptions(userId);
      expect(options.challenge).toBe('test-registration-challenge');

      const challenge = await prisma.webAuthnChallenge.findFirst({ where: { userId } });
      expect(challenge).not.toBeNull();
      expect(challenge!.challenge).toBe('test-registration-challenge');
      expect(challenge!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('replaces any existing pending challenge for the same user', async () => {
      await svc.generateRegistrationOptions(userId);
      await svc.generateRegistrationOptions(userId);

      const challenges = await prisma.webAuthnChallenge.findMany({ where: { userId } });
      expect(challenges).toHaveLength(1);
    });

    it('throws 404 for an unknown userId', async () => {
      await expect(
        svc.generateRegistrationOptions('00000000-0000-0000-0000-000000000000')
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─────────────────────────────────────────────
  // verifyRegistration
  // ─────────────────────────────────────────────

  describe('verifyRegistration', () => {
    it('throws 400 when no active challenge exists', async () => {
      await expect(
        svc.verifyRegistration(userId, fakeRegistrationResponse())
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('stores a WebAuthnCredential and removes the challenge on success', async () => {
      // Seed a challenge
      await prisma.webAuthnChallenge.create({
        data: {
          userId,
          challenge: 'test-registration-challenge',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      const result = await svc.verifyRegistration(
        userId,
        fakeRegistrationResponse(['internal']),
        'My Touch ID'
      );

      expect(result.credentialId).toBe('mock-credential-id');
      expect(result.credentialName).toBe('My Touch ID');

      const cred = await prisma.webAuthnCredential.findUnique({
        where: { credentialId: 'mock-credential-id' },
      });
      expect(cred).not.toBeNull();
      expect(cred!.userId).toBe(userId);

      // Challenge must be deleted
      const challenge = await prisma.webAuthnChallenge.findFirst({ where: { userId } });
      expect(challenge).toBeNull();
    });

    it('infers credential name from transports when credentialName is omitted', async () => {
      await prisma.webAuthnChallenge.create({
        data: {
          userId,
          challenge: 'test-registration-challenge',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      const result = await svc.verifyRegistration(userId, fakeRegistrationResponse(['usb']));
      expect(result.credentialName).toBe('Security Key (USB)');
    });

    it('throws 400 when the mock verification returns verified=false', async () => {
      const { verifyRegistrationResponse } = await import('@simplewebauthn/server');
      vi.mocked(verifyRegistrationResponse).mockResolvedValueOnce({
        verified: false,
        registrationInfo: undefined,
      } as any);

      await prisma.webAuthnChallenge.create({
        data: {
          userId,
          challenge: 'test-registration-challenge',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      await expect(
        svc.verifyRegistration(userId, fakeRegistrationResponse())
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 when the challenge has expired', async () => {
      await prisma.webAuthnChallenge.create({
        data: {
          userId,
          challenge: 'old-challenge',
          expiresAt: new Date(Date.now() - 1000), // already expired
        },
      });

      await expect(
        svc.verifyRegistration(userId, fakeRegistrationResponse())
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ─────────────────────────────────────────────
  // generateAuthenticationOptions
  // ─────────────────────────────────────────────

  describe('generateAuthenticationOptions', () => {
    it('throws 400 when the user has no registered passkeys', async () => {
      await expect(
        svc.generateAuthenticationOptions(userEmail)
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('returns options and stores a challenge keyed by email', async () => {
      // Seed a credential so the user has passkeys
      await prisma.webAuthnCredential.create({
        data: {
          userId,
          credentialId: 'auth-cred-id',
          publicKey: 'dGVzdA', // base64url "test"
          counter: BigInt(0),
          credentialName: 'Passkey',
          transports: ['internal'],
        },
      });

      const options = await svc.generateAuthenticationOptions(userEmail);
      expect(options.challenge).toBe('test-authentication-challenge');

      const challenge = await prisma.webAuthnChallenge.findFirst({ where: { email: userEmail } });
      expect(challenge).not.toBeNull();
      expect(challenge!.challenge).toBe('test-authentication-challenge');
    });
  });

  // ─────────────────────────────────────────────
  // verifyAuthentication
  // ─────────────────────────────────────────────

  describe('verifyAuthentication', () => {
    it('throws 400 when no active challenge exists for email', async () => {
      await expect(
        svc.verifyAuthentication(userEmail, fakeAuthenticationResponse())
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('returns the user and updates the credential counter on success', async () => {
      const cred = await prisma.webAuthnCredential.create({
        data: {
          userId,
          credentialId: 'login-cred-id',
          publicKey: 'dGVzdA',
          counter: BigInt(0),
          credentialName: 'Passkey',
          transports: ['internal'],
        },
      });

      await prisma.webAuthnChallenge.create({
        data: {
          email: userEmail,
          challenge: 'test-authentication-challenge',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      const user = await svc.verifyAuthentication(
        userEmail,
        fakeAuthenticationResponse('login-cred-id')
      );

      expect(user.id).toBe(userId);

      // Counter should be updated to 1 (mocked newCounter)
      const updated = await prisma.webAuthnCredential.findUnique({ where: { id: cred.id } });
      expect(Number(updated!.counter)).toBe(1);
      expect(updated!.lastUsedAt).not.toBeNull();

      // Challenge must be deleted
      const challenge = await prisma.webAuthnChallenge.findFirst({ where: { email: userEmail } });
      expect(challenge).toBeNull();
    });

    it('throws 401 when the credential does not belong to the given email', async () => {
      const other = await createTestUser(`other-webauthn-${Date.now()}@test.com`, 'EMAIL_VERIFIED');
      await prisma.webAuthnCredential.create({
        data: {
          userId: other.id,
          credentialId: 'other-cred-id',
          publicKey: 'dGVzdA',
          counter: BigInt(0),
          credentialName: 'Passkey',
          transports: ['internal'],
        },
      });

      await prisma.webAuthnChallenge.create({
        data: {
          email: userEmail,
          challenge: 'test-authentication-challenge',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      // other user's cred being presented for userEmail's challenge → 401
      await expect(
        svc.verifyAuthentication(userEmail, fakeAuthenticationResponse('other-cred-id'))
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  // ─────────────────────────────────────────────
  // listCredentials
  // ─────────────────────────────────────────────

  describe('listCredentials', () => {
    it('returns an empty array when the user has no credentials', async () => {
      const result = await svc.listCredentials(userId);
      expect(result).toEqual([]);
    });

    it('returns all credentials for the user ordered by createdAt', async () => {
      await prisma.webAuthnCredential.create({
        data: {
          userId,
          credentialId: 'list-cred-1',
          publicKey: 'dGVzdA',
          counter: BigInt(0),
          credentialName: 'First Key',
          transports: ['internal'],
        },
      });
      await prisma.webAuthnCredential.create({
        data: {
          userId,
          credentialId: 'list-cred-2',
          publicKey: 'dGVzdA',
          counter: BigInt(5),
          credentialName: 'Second Key',
          transports: ['usb'],
        },
      });

      const result = await svc.listCredentials(userId);
      expect(result).toHaveLength(2);
      expect(result[0].credentialName).toBe('First Key');
      expect(result[1].credentialName).toBe('Second Key');
      // Sensitive fields must not be present
      expect((result[0] as any).publicKey).toBeUndefined();
      expect((result[0] as any).counter).toBeUndefined();
    });

    it('does not return credentials belonging to other users', async () => {
      const other = await createTestUser(`other-list-${Date.now()}@test.com`, 'EMAIL_VERIFIED');
      await prisma.webAuthnCredential.create({
        data: {
          userId: other.id,
          credentialId: 'other-list-cred',
          publicKey: 'dGVzdA',
          counter: BigInt(0),
          credentialName: 'Other User Key',
          transports: [],
        },
      });

      const result = await svc.listCredentials(userId);
      expect(result).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────
  // deleteCredential
  // ─────────────────────────────────────────────

  describe('deleteCredential', () => {
    it('deletes a credential by its DB id', async () => {
      const cred = await prisma.webAuthnCredential.create({
        data: {
          userId,
          credentialId: 'delete-cred-id',
          publicKey: 'dGVzdA',
          counter: BigInt(0),
          credentialName: 'To Delete',
          transports: [],
        },
      });

      await svc.deleteCredential(userId, cred.id);

      const deleted = await prisma.webAuthnCredential.findUnique({ where: { id: cred.id } });
      expect(deleted).toBeNull();
    });

    it('throws 404 when the credential does not exist', async () => {
      await expect(
        svc.deleteCredential(userId, '00000000-0000-0000-0000-000000000000')
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 404 when the credential belongs to another user', async () => {
      const other = await createTestUser(`other-del-${Date.now()}@test.com`, 'EMAIL_VERIFIED');
      const cred = await prisma.webAuthnCredential.create({
        data: {
          userId: other.id,
          credentialId: 'not-yours-cred',
          publicKey: 'dGVzdA',
          counter: BigInt(0),
          credentialName: 'Not Yours',
          transports: [],
        },
      });

      await expect(
        svc.deleteCredential(userId, cred.id)
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
