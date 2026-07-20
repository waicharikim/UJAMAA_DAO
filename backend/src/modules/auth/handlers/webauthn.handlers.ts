/**
 * @file src/modules/auth/handlers/webauthn.handlers.ts
 * @description
 * Request handlers for WebAuthn / passkey authentication
 *
 * Version: 1.0 — March 2026
 */

import { Request, Response } from 'express';
import {
  AuthRequest,
  VerificationLevel,
} from '../../../core/types/Ujamaadao.types.js';
import { webAuthnService } from '../services/webauthn.service.js';
import { sessionService } from '../services/session.service.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { signJwtToken, JwtPayload } from '../../../core/utils/jwt.service.js';
import { prisma } from '../../../core/database/client.js';

// ── Registration (authenticated user) ─────────────────────

/**
 * POST /auth/webauthn/register/options
 * Generate registration options for an authenticated user.
 */
export async function webAuthnRegisterOptions(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const options = await webAuthnService.generateRegistrationOptions(userId);
  sendSuccess(res, options, 'Registration options generated');
}

/**
 * POST /auth/webauthn/register/verify
 * Verify and store a new passkey credential.
 */
export async function webAuthnRegisterVerify(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { response, credentialName } = req.body;
  if (!response) throw ApiError.badRequest('response is required');
  const result = await webAuthnService.verifyRegistration(
    userId,
    response,
    credentialName
  );
  sendSuccess(res, result, 'Passkey registered');
}

// ── Authentication (unauthenticated) ──────────────────────

/**
 * POST /auth/webauthn/login/options
 * Generate authentication options for a given email.
 */
export async function webAuthnLoginOptions(req: Request, res: Response) {
  const { email } = req.body;
  if (!email) throw ApiError.badRequest('email is required');
  const options = await webAuthnService.generateAuthenticationOptions(email);
  sendSuccess(res, options, 'Authentication options generated');
}

/**
 * POST /auth/webauthn/login/verify
 * Verify passkey assertion and issue a JWT session token.
 */
export async function webAuthnLoginVerify(req: Request, res: Response) {
  const { email, response } = req.body;
  if (!email || !response)
    throw ApiError.badRequest('email and response are required');

  const user = await webAuthnService.verifyAuthentication(email, response);

  // Create a server-side session (same pattern as magic-link login)
  const { session } = await sessionService.createSession(user.id, {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  const roles = user.userRoles.map((ur: any) => ur.role.name);

  const jwtPayload: JwtPayload = {
    sub: user.id,
    jti: session.id,
    email: user.email || undefined,
    phoneNumber: user.phoneNumber || undefined,
    walletAddress: user.walletAddress || undefined,
    primaryWardId: user.primaryWardId || undefined,
    secondaryWardId: user.secondaryWardId || undefined,
    currentLocationId: user.currentLocationId || undefined,
    currentLocationUntil: user.currentLocationUntil?.toISOString(),
    constituencyId: user.primaryWard?.constituencyId || undefined,
    countyId: user.primaryWard?.countyId || undefined,
    verificationLevel: user.verificationLevel as VerificationLevel,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    communityVerified: user.communityVerified,
    roles,
    globalImpactPoints: user.globalImpactPoints ?? 0,
    utilityTokens:
      ((user as any).fiatBackedUtBalance ?? 0) +
      ((user as any).earnedUtBalance ?? 0),
    participationRights: user.participationRights ?? 0,
    type: 'permanent',
    sessionId: session.id,
  };

  const accessToken = signJwtToken(jwtPayload, '7d');

  // Update last login timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  sendSuccess(res, { sessionToken: accessToken }, 'Signed in with passkey');
}

// ── Credential management ─────────────────────────────────

/**
 * GET /auth/webauthn/credentials
 * List all passkeys for the authenticated user.
 */
export async function listPasskeys(req: AuthRequest, res: Response) {
  const passkeys = await webAuthnService.listCredentials(req.user!.userId);
  sendSuccess(res, passkeys);
}

/**
 * DELETE /auth/webauthn/credentials/:id
 * Remove a specific passkey by its database ID.
 */
export async function deletePasskey(req: AuthRequest, res: Response) {
  await webAuthnService.deleteCredential(req.user!.userId, req.params.id);
  sendSuccess(res, null, 'Passkey removed');
}
