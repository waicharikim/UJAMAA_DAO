/**
 * @file src/modules/auth/routes/auth.routes.ts
 * @description
 * Complete Auth Routes - All authentication endpoints with full authorization layers
 *
 * Updated: February 2026 — Added strong per-user & global rate limiting on write endpoints
 * Security: Full layered authorization (Layers 1–3) + dual rate limiting
 *
 * Version: 1.4 — February 2026
 */

import { Router } from 'express';
import { asyncHandler } from '../../../core/utils/response.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { prisma } from '../../../core/database/client.js';
import { signJwtToken, JwtPayload } from '../../../core/utils/jwt.service.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { authorize } from '../../../core/middleware/authorize.js';
import { toMiddleware, requireAdmin } from '../../../core/rbac/authorize.js';
import {
  strictRateLimit,
  buildRateLimiter,
} from '../../../core/middleware/rateLimiter.js';

// Validators
import {
  sendMagicLinkSchema,
  verifyEmailTokenSchema,
  verifyMagicLinkSchema,
  walletNonceSchema,
  walletVerifySchema,
  walletLinkSchema,
  sendPhoneCodeSchema,
  verifyPhoneCodeSchema,
  sessionIdSchema,
  refreshTokenSchema,
  twoFactorCodeSchema,
  deviceNameSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  securityEventIdSchema,
  resolveSecurityEventSchema,
  resetTokenQuerySchema,
} from '../validators/auth.validators.js';

// Handlers
import {
  sendMagicLink,
  verifyEmail,
  verifyMagicLink,
} from '../handlers/auth.handlers.js';
import {
  generateNonce,
  verifySignature,
  linkWallet,
  disconnectWallet,
} from '../handlers/wallet.handlers.js';
import {
  getUserSessions,
  revokeSession,
  revokeAllSessions,
  logout,
} from '../handlers/session.handlers.js';
import {
  renameSession,
  trustDevice,
  untrustDevice,
  getSuspiciousSessions,
} from '../handlers/session-device.handlers.js';
import {
  refreshToken,
  revokeAllRefreshTokens,
} from '../handlers/refresh-token.handlers.js';
import {
  sendVerificationCode,
  verifyCode,
} from '../handlers/phone-verification.handlers.js';
import {
  enable2FA,
  verify2FA,
  disable2FA,
  regenerateBackupCodes,
  get2FAStatus,
} from '../handlers/totp-2fa.handlers.js';
import {
  requestPasswordReset,
  verifyResetToken,
  resetPassword,
} from '../handlers/password-reset.handlers.js';
import {
  getUserSecurityEvents,
  getUnresolvedEvents,
  resolveEvent,
} from '../handlers/security-events.handlers.js';
import {
  webAuthnRegisterOptions,
  webAuthnRegisterVerify,
  webAuthnLoginOptions,
  webAuthnLoginVerify,
  listPasskeys,
  deletePasskey,
} from '../handlers/webauthn.handlers.js';

const router = Router();

// ============================================================================
// PUBLIC FLOWS (No auth required — only rate limiting + validation)
// ============================================================================

router.post(
  '/magic-link/send',
  strictRateLimit(),
  buildRateLimiter({ windowMs: 5 * 60 * 1000, max: 5 }),
  validateRequest({ schema: sendMagicLinkSchema, target: 'body' }),
  asyncHandler(sendMagicLink)
);

router.get(
  '/verify-email',
  validateRequest({ schema: verifyEmailTokenSchema, target: 'query' }),
  asyncHandler(verifyEmail)
);

router.get(
  '/login',
  validateRequest({ schema: verifyMagicLinkSchema, target: 'query' }),
  asyncHandler(verifyMagicLink)
);

router.post(
  '/wallet/nonce',
  buildRateLimiter({ windowMs: 5 * 60 * 1000, max: 10 }),
  validateRequest({ schema: walletNonceSchema, target: 'body' }),
  asyncHandler(generateNonce)
);

router.post(
  '/wallet/verify',
  buildRateLimiter({ windowMs: 5 * 60 * 1000, max: 10 }),
  validateRequest({ schema: walletVerifySchema, target: 'body' }),
  asyncHandler(verifySignature)
);

router.post(
  '/password/request-reset',
  buildRateLimiter({ windowMs: 15 * 60 * 1000, max: 3 }),
  validateRequest({ schema: passwordResetRequestSchema, target: 'body' }),
  asyncHandler(requestPasswordReset)
);

router.get(
  '/password/verify-token',
  validateRequest({ schema: resetTokenQuerySchema, target: 'query' }),
  asyncHandler(verifyResetToken)
);

router.post(
  '/password/reset',
  strictRateLimit(),
  validateRequest({ schema: passwordResetSchema, target: 'body' }),
  asyncHandler(resetPassword)
);

// ============================================================================
// PROTECTED ROUTES — Full Layered Authorization + Rate Limiting
// ============================================================================

router.post(
  '/wallet/link',
  authenticate,
  authorize({
    verificationLevel: 'COMMUNITY_VERIFIED',
  }),
  buildRateLimiter({ windowMs: 60 * 1000, max: 5 }),
  buildRateLimiter({
    windowMs: 60 * 1000,
    max: 2,
    keyGenerator: (req: any) => req.user?.userId || req.ip,
  }),
  validateRequest({ schema: walletLinkSchema, target: 'body' }),
  asyncHandler(linkWallet)
);

router.delete(
  '/wallet/disconnect',
  authenticate,
  authorize({
    verificationLevel: 'COMMUNITY_VERIFIED',
    requiresWalletAuth: true,
  }),
  buildRateLimiter({ windowMs: 60 * 1000, max: 5 }),
  buildRateLimiter({
    windowMs: 60 * 1000,
    max: 2,
    keyGenerator: (req: any) => req.user?.userId || req.ip,
  }),
  asyncHandler(disconnectWallet)
);

router.get(
  '/sessions',
  authenticate,
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(getUserSessions)
);

router.delete(
  '/sessions/:sessionId',
  authenticate,
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  validateRequest({ schema: sessionIdSchema, target: 'params' }),
  asyncHandler(revokeSession)
);

router.delete(
  '/sessions',
  authenticate,
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(revokeAllSessions)
);

router.post(
  '/logout',
  authenticate,
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(logout)
);

router.patch(
  '/sessions/:sessionId/rename',
  authenticate,
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  validateRequest({ schema: sessionIdSchema, target: 'params' }),
  validateRequest({ schema: deviceNameSchema, target: 'body' }),
  asyncHandler(renameSession)
);

router.post(
  '/sessions/:sessionId/trust',
  authenticate,
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(trustDevice)
);

router.delete(
  '/sessions/:sessionId/trust',
  authenticate,
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(untrustDevice)
);

router.get(
  '/sessions/suspicious',
  authenticate,
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(getSuspiciousSessions)
);

router.post(
  '/2fa/enable',
  authenticate,
  authorize({ verificationLevel: 'FULL_VERIFIED' }),
  buildRateLimiter({ windowMs: 60 * 1000, max: 5 }),
  buildRateLimiter({
    windowMs: 60 * 1000,
    max: 2,
    keyGenerator: (req: any) => req.user?.userId || req.ip,
  }),
  asyncHandler(enable2FA)
);

router.post(
  '/2fa/verify',
  authenticate,
  authorize({ verificationLevel: 'FULL_VERIFIED' }),
  validateRequest({ schema: twoFactorCodeSchema, target: 'body' }),
  asyncHandler(verify2FA)
);

router.post(
  '/2fa/disable',
  authenticate,
  authorize({ verificationLevel: 'FULL_VERIFIED' }),
  buildRateLimiter({ windowMs: 60 * 1000, max: 5 }),
  buildRateLimiter({
    windowMs: 60 * 1000,
    max: 2,
    keyGenerator: (req: any) => req.user?.userId || req.ip,
  }),
  validateRequest({ schema: twoFactorCodeSchema, target: 'body' }),
  asyncHandler(disable2FA)
);

router.post(
  '/2fa/regenerate-backup-codes',
  authenticate,
  authorize({ verificationLevel: 'FULL_VERIFIED' }),
  buildRateLimiter({ windowMs: 60 * 1000, max: 5 }),
  buildRateLimiter({
    windowMs: 60 * 1000,
    max: 2,
    keyGenerator: (req: any) => req.user?.userId || req.ip,
  }),
  validateRequest({ schema: twoFactorCodeSchema, target: 'body' }),
  asyncHandler(regenerateBackupCodes)
);

router.get(
  '/2fa/status',
  authenticate,
  authorize({ verificationLevel: 'FULL_VERIFIED' }),
  asyncHandler(get2FAStatus)
);

router.post(
  '/refresh',
  buildRateLimiter({ windowMs: 5 * 60 * 1000, max: 20 }),
  validateRequest({ schema: refreshTokenSchema, target: 'body' }),
  asyncHandler(refreshToken)
);

router.post(
  '/revoke-refresh-tokens',
  authenticate,
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  buildRateLimiter({ windowMs: 60 * 1000, max: 5 }),
  buildRateLimiter({
    windowMs: 60 * 1000,
    max: 2,
    keyGenerator: (req: any) => req.user?.userId || req.ip,
  }),
  asyncHandler(revokeAllRefreshTokens)
);

router.get(
  '/security-events',
  authenticate,
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(getUserSecurityEvents)
);

router.get(
  '/security-events/unresolved',
  authenticate,
  authorize({ verificationLevel: 'FULL_VERIFIED' }),
  toMiddleware(requireAdmin()),
  asyncHandler(getUnresolvedEvents)
);

router.patch(
  '/security-events/:eventId/resolve',
  authenticate,
  authorize({ verificationLevel: 'FULL_VERIFIED' }),
  toMiddleware(requireAdmin()),
  validateRequest({ schema: securityEventIdSchema, target: 'params' }),
  validateRequest({ schema: resolveSecurityEventSchema, target: 'body' }),
  asyncHandler(resolveEvent)
);

// ============================================================================
// PHONE VERIFICATION — Protected (must be authenticated)
// ============================================================================

router.post(
  '/phone/send-code',
  authenticate,
  authorize({ verificationLevel: 'EMAIL_VERIFIED' }),
  buildRateLimiter({ windowMs: 60 * 1000, max: 3 }),
  validateRequest({ schema: sendPhoneCodeSchema, target: 'body' }),
  asyncHandler(sendVerificationCode)
);

router.post(
  '/phone/verify-code',
  authenticate,
  authorize({ verificationLevel: 'EMAIL_VERIFIED' }),
  buildRateLimiter({ windowMs: 5 * 60 * 1000, max: 10 }),
  validateRequest({ schema: verifyPhoneCodeSchema, target: 'body' }),
  asyncHandler(verifyCode)
);

// ============================================================================
// DEV-ONLY: Instant account switcher — returns a JWT without email flow
// Guarded by NODE_ENV check; returns 404 in production.
// ============================================================================

router.post(
  '/dev/login',
  asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      res.status(404).json({ success: false, error: { message: 'Not found' } });
      return;
    }

    const { email } = req.body ?? {};
    if (!email) {
      res
        .status(400)
        .json({ success: false, error: { message: 'email required' } });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email) },
      include: {
        userRoles: { where: { active: true }, include: { role: true } },
      },
    });

    if (!user) {
      res
        .status(404)
        .json({ success: false, error: { message: 'User not found' } });
      return;
    }

    const roleNames = user.userRoles.map((ur: any) => ur.role.name);

    const payload: JwtPayload = {
      sub: user.id,
      verificationLevel: user.verificationLevel as any,
      roles: roleNames,
      globalImpactPoints: user.globalImpactPoints ?? 0,
      utilityTokens:
        ((user as any).fiatBackedUtBalance ?? 0) +
        ((user as any).earnedUtBalance ?? 0),
      participationRights: user.participationRights ?? 0,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      communityVerified: user.communityVerified,
      type: 'permanent',
    };

    const accessToken = signJwtToken(payload, '7d', 0);

    res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          verificationLevel: user.verificationLevel,
          roles: roleNames,
        },
      },
    });
  })
);

// ============================================================================
// WEBAUTHN / PASSKEYS
// ============================================================================

// Registration (requires existing session)
router.post(
  '/webauthn/register/options',
  authenticate,
  asyncHandler(webAuthnRegisterOptions)
);
router.post(
  '/webauthn/register/verify',
  authenticate,
  asyncHandler(webAuthnRegisterVerify)
);

// Authentication (no JWT required)
router.post(
  '/webauthn/login/options',
  buildRateLimiter({ windowMs: 60_000, max: 10 }),
  asyncHandler(webAuthnLoginOptions)
);
router.post(
  '/webauthn/login/verify',
  buildRateLimiter({ windowMs: 60_000, max: 10 }),
  asyncHandler(webAuthnLoginVerify)
);

// Credential management
router.get('/webauthn/credentials', authenticate, asyncHandler(listPasskeys));
router.delete(
  '/webauthn/credentials/:id',
  authenticate,
  asyncHandler(deletePasskey)
);

export default router;
