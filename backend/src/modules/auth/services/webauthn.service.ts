/**
 * @file src/modules/auth/services/webauthn.service.ts
 * @description
 * WebAuthn / Passkey Authentication Service for UjamaaDAO
 *
 * Implements passkey registration and authentication using @simplewebauthn/server.
 * Credentials are stored in the database; challenges are ephemeral (5-minute TTL).
 *
 * Version: 1.0 — March 2026
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';

const RP_NAME = 'UjamaaDAO';
const RP_ID = process.env.WEBAUTHN_RP_ID ?? 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3000';
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class WebAuthnService {
  // ── Registration ──────────────────────────────────────────

  async generateRegistrationOptions(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        webauthnCredentials: true,
      },
    });
    if (!user) throw ApiError.notFound('User', userId);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.email ?? user.name ?? userId,
      userDisplayName: user.name ?? user.email ?? userId,
      userID: new TextEncoder().encode(userId),
      attestationType: 'none',
      excludeCredentials: user.webauthnCredentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Store challenge — one pending challenge per user for registration
    await prisma.webAuthnChallenge.deleteMany({ where: { userId } });
    await prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        userId,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    return options;
  }

  async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON,
    credentialName?: string
  ) {
    const record = await prisma.webAuthnChallenge.findFirst({
      where: { userId, expiresAt: { gt: new Date() } },
    });
    if (!record)
      throw ApiError.badRequest(
        'No active challenge — start registration again'
      );

    await prisma.webAuthnChallenge.delete({ where: { id: record.id } });

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: record.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw ApiError.badRequest('Passkey registration failed');
    }

    const { credential } = verification.registrationInfo;

    const cred = await prisma.webAuthnCredential.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: BigInt(credential.counter),
        credentialName: credentialName ?? this.guessCredentialName(response),
        aaguid: verification.registrationInfo.aaguid,
        transports: (response.response.transports ?? []) as string[],
      },
    });

    logger.info(
      { userId, credentialId: cred.credentialId },
      'WebAuthn credential registered'
    );
    return {
      credentialId: cred.credentialId,
      credentialName: cred.credentialName,
    };
  }

  // ── Authentication ────────────────────────────────────────

  async generateAuthenticationOptions(email: string) {
    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, webauthnCredentials: true },
    });

    const allowCredentials =
      user?.webauthnCredentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransport[],
      })) ?? [];

    if (allowCredentials.length === 0) {
      throw ApiError.badRequest(
        'No passkeys registered for this account. Use magic link to sign in.'
      );
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
      allowCredentials,
    });

    // Store challenge keyed by email (userId not yet confirmed)
    await prisma.webAuthnChallenge.deleteMany({ where: { email } });
    await prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        email,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    return options;
  }

  async verifyAuthentication(
    email: string,
    response: AuthenticationResponseJSON
  ) {
    const record = await prisma.webAuthnChallenge.findFirst({
      where: { email, expiresAt: { gt: new Date() } },
    });
    if (!record)
      throw ApiError.badRequest('No active challenge — start sign-in again');

    await prisma.webAuthnChallenge.delete({ where: { id: record.id } });

    // Find the credential
    const credential = await prisma.webAuthnCredential.findUnique({
      where: { credentialId: response.id },
      include: {
        user: {
          include: {
            primaryWard: {
              select: { id: true, constituencyId: true, countyId: true },
            },
            userRoles: {
              where: { active: true },
              include: { role: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    if (!credential || credential.user.email !== email) {
      throw ApiError.authenticationError(
        'Passkey not recognised for this account'
      );
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: record.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.publicKey, 'base64url'),
        counter: Number(credential.counter),
        transports: credential.transports as AuthenticatorTransport[],
      },
    });

    if (!verification.verified)
      throw ApiError.authenticationError('Passkey verification failed');

    // Update counter + lastUsedAt
    await prisma.webAuthnCredential.update({
      where: { id: credential.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });

    logger.info(
      { userId: credential.userId, credentialId: credential.credentialId },
      'WebAuthn login verified'
    );
    return credential.user;
  }

  // ── Credential management ─────────────────────────────────

  async listCredentials(userId: string) {
    return prisma.webAuthnCredential.findMany({
      where: { userId },
      select: {
        id: true,
        credentialId: true,
        credentialName: true,
        createdAt: true,
        lastUsedAt: true,
        transports: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteCredential(userId: string, credentialDbId: string) {
    const cred = await prisma.webAuthnCredential.findFirst({
      where: { id: credentialDbId, userId },
    });
    if (!cred) throw ApiError.notFound('Credential', credentialDbId);
    await prisma.webAuthnCredential.delete({ where: { id: credentialDbId } });
  }

  // ── Helpers ───────────────────────────────────────────────

  private guessCredentialName(response: RegistrationResponseJSON): string {
    const transports = response.response.transports ?? [];
    if (transports.includes('internal'))
      return 'Biometric (Face ID / Touch ID)';
    if (transports.includes('usb')) return 'Security Key (USB)';
    if (transports.includes('nfc')) return 'Security Key (NFC)';
    return 'Passkey';
  }
}

export const webAuthnService = new WebAuthnService();
