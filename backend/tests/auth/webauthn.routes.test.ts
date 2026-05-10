/**
 * @file tests/auth/webauthn.routes.test.ts
 * Integration tests for WebAuthn/passkey HTTP routes.
 *
 * @simplewebauthn/server is mocked — we test our route auth guards,
 * validation, and response shapes without real authenticator hardware.
 */

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn().mockResolvedValue({
    challenge: 'route-registration-challenge',
    rp: { name: 'UjamaaDAO', id: 'localhost' },
    user: { id: new Uint8Array([1, 2, 3]).buffer, name: 'test', displayName: 'Test' },
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
        id: 'route-mock-cred-id',
        publicKey: new Uint8Array([5, 6, 7, 8]),
        counter: 0,
      },
      aaguid: '00000000-0000-0000-0000-000000000000',
    },
  }),
  generateAuthenticationOptions: vi.fn().mockResolvedValue({
    challenge: 'route-authentication-challenge',
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

vi.mock('../../src/modules/community/services/groupMembership.service.js', () => ({
  groupMembershipService: {
    enrollInSystemGroups: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: { send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }) },
  })),
}));

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import { prisma } from '../../src/core/database/client.js';
import { seedLocation, createTestUser, makeAccessToken } from './helpers.js';

const BASE = '/api/v1/auth/webauthn';

describe('WebAuthn Routes', () => {
  let userId: string;
  let userEmail: string;
  let token: string;

  beforeAll(async () => {
    await servicesReady;
  });

  beforeEach(async () => {
    await seedLocation();
    userEmail = `webauthn-route-${Date.now()}@test.com`;
    const user = await createTestUser(userEmail, 'EMAIL_VERIFIED');
    userId = user.id;
    token = makeAccessToken(userId, 'EMAIL_VERIFIED');
  });

  // ─────────────────────────────────────────────
  // POST /webauthn/register/options
  // ─────────────────────────────────────────────

  describe('POST /webauthn/register/options', () => {
    it('returns 401 with no auth token', async () => {
      const res = await request(app).post(`${BASE}/register/options`);
      expect(res.status).toBe(401);
    });

    it('returns registration options for an authenticated user (200)', async () => {
      const res = await request(app)
        .post(`${BASE}/register/options`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.challenge).toBe('route-registration-challenge');

      // Challenge must be stored in DB
      const challenge = await prisma.webAuthnChallenge.findFirst({ where: { userId } });
      expect(challenge).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // POST /webauthn/register/verify
  // ─────────────────────────────────────────────

  describe('POST /webauthn/register/verify', () => {
    it('returns 401 with no auth token', async () => {
      const res = await request(app)
        .post(`${BASE}/register/verify`)
        .send({ response: { id: 'x' }, credentialName: 'Test' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when response field is missing', async () => {
      const res = await request(app)
        .post(`${BASE}/register/verify`)
        .set('Authorization', `Bearer ${token}`)
        .send({ credentialName: 'No Response' });
      expect(res.status).toBe(400);
    });

    it('registers a passkey when a valid challenge exists (200)', async () => {
      // Seed a challenge
      await prisma.webAuthnChallenge.create({
        data: {
          userId,
          challenge: 'route-registration-challenge',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      const res = await request(app)
        .post(`${BASE}/register/verify`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          response: {
            id: 'route-mock-cred-id',
            rawId: 'route-mock-cred-id',
            type: 'public-key',
            response: {
              clientDataJSON: 'eyJ0eXBlIjoiY3JlYXRlIn0',
              attestationObject: 'base64-attestation',
              transports: ['internal'],
            },
          },
          credentialName: 'My MacBook Touch ID',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.credentialId).toBe('route-mock-cred-id');
      expect(res.body.data.credentialName).toBe('My MacBook Touch ID');

      const cred = await prisma.webAuthnCredential.findUnique({
        where: { credentialId: 'route-mock-cred-id' },
      });
      expect(cred).not.toBeNull();
    });

    it('returns 400 when no challenge exists', async () => {
      const res = await request(app)
        .post(`${BASE}/register/verify`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          response: {
            id: 'no-challenge-cred',
            rawId: 'no-challenge-cred',
            type: 'public-key',
            response: {
              clientDataJSON: 'eyJ0eXBlIjoiY3JlYXRlIn0',
              attestationObject: 'base64-attestation',
              transports: [],
            },
          },
        });

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────
  // POST /webauthn/login/options
  // ─────────────────────────────────────────────

  describe('POST /webauthn/login/options', () => {
    it('returns 400 when email is missing', async () => {
      const res = await request(app)
        .post(`${BASE}/login/options`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 when the user has no registered passkeys', async () => {
      const res = await request(app)
        .post(`${BASE}/login/options`)
        .send({ email: userEmail });
      expect(res.status).toBe(400);
    });

    it('returns authentication options when passkeys exist (200)', async () => {
      await prisma.webAuthnCredential.create({
        data: {
          userId,
          credentialId: 'login-opt-cred',
          publicKey: 'dGVzdA',
          counter: BigInt(0),
          credentialName: 'Passkey',
          transports: ['internal'],
        },
      });

      const res = await request(app)
        .post(`${BASE}/login/options`)
        .send({ email: userEmail });

      expect(res.status).toBe(200);
      expect(res.body.data.challenge).toBe('route-authentication-challenge');

      const challenge = await prisma.webAuthnChallenge.findFirst({
        where: { email: userEmail },
      });
      expect(challenge).not.toBeNull();
    });

    it('does not require authentication (no Bearer token)', async () => {
      await prisma.webAuthnCredential.create({
        data: {
          userId,
          credentialId: 'login-noauth-cred',
          publicKey: 'dGVzdA',
          counter: BigInt(0),
          credentialName: 'Passkey',
          transports: [],
        },
      });

      const res = await request(app)
        .post(`${BASE}/login/options`)
        .send({ email: userEmail });

      expect(res.status).toBe(200);
    });
  });

  // ─────────────────────────────────────────────
  // POST /webauthn/login/verify
  // ─────────────────────────────────────────────

  describe('POST /webauthn/login/verify', () => {
    it('returns 400 when email is missing', async () => {
      const res = await request(app)
        .post(`${BASE}/login/verify`)
        .send({ response: { id: 'x' } });
      expect(res.status).toBe(400);
    });

    it('returns 400 when response is missing', async () => {
      const res = await request(app)
        .post(`${BASE}/login/verify`)
        .send({ email: userEmail });
      expect(res.status).toBe(400);
    });

    it('returns a sessionToken on successful passkey login (200)', async () => {
      const cred = await prisma.webAuthnCredential.create({
        data: {
          userId,
          credentialId: 'login-verify-cred',
          publicKey: 'dGVzdA',
          counter: BigInt(0),
          credentialName: 'Passkey',
          transports: ['internal'],
        },
      });

      await prisma.webAuthnChallenge.create({
        data: {
          email: userEmail,
          challenge: 'route-authentication-challenge',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      const res = await request(app)
        .post(`${BASE}/login/verify`)
        .send({
          email: userEmail,
          response: {
            id: cred.credentialId,
            rawId: cred.credentialId,
            type: 'public-key',
            response: {
              clientDataJSON: 'eyJ0eXBlIjoiZ2V0In0',
              authenticatorData: 'base64-auth-data',
              signature: 'base64-signature',
            },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessionToken).toBeDefined();
      expect(typeof res.body.data.sessionToken).toBe('string');
    });
  });

  // ─────────────────────────────────────────────
  // GET /webauthn/credentials
  // ─────────────────────────────────────────────

  describe('GET /webauthn/credentials', () => {
    it('returns 401 with no auth token', async () => {
      const res = await request(app).get(`${BASE}/credentials`);
      expect(res.status).toBe(401);
    });

    it('returns empty array when user has no passkeys (200)', async () => {
      const res = await request(app)
        .get(`${BASE}/credentials`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns the list of registered passkeys (200)', async () => {
      await prisma.webAuthnCredential.create({
        data: {
          userId,
          credentialId: 'list-route-cred-1',
          publicKey: 'dGVzdA',
          counter: BigInt(0),
          credentialName: 'My iPhone',
          transports: ['internal'],
        },
      });

      const res = await request(app)
        .get(`${BASE}/credentials`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].credentialName).toBe('My iPhone');
      // Sensitive fields must be absent
      expect(res.body.data[0].publicKey).toBeUndefined();
      expect(res.body.data[0].counter).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────
  // DELETE /webauthn/credentials/:id
  // ─────────────────────────────────────────────

  describe('DELETE /webauthn/credentials/:id', () => {
    it('returns 401 with no auth token', async () => {
      const res = await request(app).delete(`${BASE}/credentials/some-id`);
      expect(res.status).toBe(401);
    });

    it('returns 404 for a non-existent credential id', async () => {
      const res = await request(app)
        .delete(`${BASE}/credentials/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('deletes the passkey and returns 200', async () => {
      const cred = await prisma.webAuthnCredential.create({
        data: {
          userId,
          credentialId: 'delete-route-cred',
          publicKey: 'dGVzdA',
          counter: BigInt(0),
          credentialName: 'To Remove',
          transports: [],
        },
      });

      const res = await request(app)
        .delete(`${BASE}/credentials/${cred.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const deleted = await prisma.webAuthnCredential.findUnique({ where: { id: cred.id } });
      expect(deleted).toBeNull();
    });

    it('returns 404 when trying to delete another user\'s credential', async () => {
      const other = await createTestUser(`other-del-rt-${Date.now()}@test.com`, 'EMAIL_VERIFIED');
      const cred = await prisma.webAuthnCredential.create({
        data: {
          userId: other.id,
          credentialId: 'other-route-cred',
          publicKey: 'dGVzdA',
          counter: BigInt(0),
          credentialName: 'Not Mine',
          transports: [],
        },
      });

      const res = await request(app)
        .delete(`${BASE}/credentials/${cred.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
