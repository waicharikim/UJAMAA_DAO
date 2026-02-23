/**
 * @file src/core/utils/jwt.service.ts
 * @description
 * JWT Utility Service for UjamaaDAO — Passwordless Authentication
 *
 * Version: 2.2 — January 2026
 * Security Hardened: January 2026
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from './env.js';
import { AuthUser, VerificationLevel } from '../types/Ujamaadao.types.js';
import { generateRandomHex } from '../utils/crypto.js';

const JWT_SECRET = env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is required');

if (JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET must be at least 32 characters for adequate security'
  );
}

const JWT_ISSUER = env.JWT_ISSUER || 'ujamaadao.org';
const JWT_AUDIENCE = env.JWT_AUDIENCE || 'ujamaadao-api';
const JWT_ALGORITHM = 'HS256' as const;

const VALID_VERIFICATION_LEVELS: VerificationLevel[] = [
  'UNVERIFIED',
  'EMAIL_VERIFIED',
  'PHONE_VERIFIED',
  'COMMUNITY_VERIFIED',
  'FULL_VERIFIED',
];

const MAX_TOKEN_SIZE = 2048;

export interface JwtPayload {
  sub: string;
  walletAddress?: string;
  email?: string;
  phoneNumber?: string;
  primaryWardId?: string;
  secondaryWardId?: string;
  currentLocationId?: string;
  currentLocationUntil?: string;
  constituencyId?: string;
  countyId?: string;
  verificationLevel?: VerificationLevel;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  communityVerified?: boolean;
  roles?: string[];
  globalImpactPoints?: number;
  utilityTokens?: number;
  participationRights?: number;
  sessionId?: string;
  type?: 'permanent' | 'temporary' | 'refresh' | 'magic-link' | 'access';

  jti?: string;
  iss?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
}

/**
 * Remove undefined values from payload
 */
function cleanPayload<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as Partial<T>;
}

/**
 * Safe numeric extraction
 */
function safeNumericValue(value: number | undefined | null): number {
  return Math.max(0, Number(value) || 0);
}

/**
 * Sign JWT with proper type handling
 *
 * @param payload - JWT payload (sub is required)
 * @param expiresIn - Expiration time (e.g., "1h", "7d", 3600) or undefined for no expiry
 * @param notBefore - Not valid before (seconds or time string) - default 0 (valid immediately)
 */
export function signJwtToken(
  payload: JwtPayload,
  expiresIn?: string | number,
  notBefore?: string | number
): string {
  if (!payload.sub || payload.sub.trim() === '') {
    throw new Error('JWT subject (sub) is required');
  }

  const jti = generateRandomHex(16);

  const clean = cleanPayload({
    ...payload,
    jti,
  });

  // Build options object - only include properties that have values
  const options: SignOptions = {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    // jti is already in the payload — do NOT also pass jwtid here,
    // jsonwebtoken throws "jwtid payload claim cannot be overridden"
  };

  // Only add expiresIn if explicitly provided (not undefined)
  if (expiresIn !== undefined) {
    options.expiresIn = expiresIn as any;
  }

  // Only add notBefore if explicitly provided
  // Note: 0 is valid (means "valid immediately") so we check !== undefined
  if (notBefore !== undefined) {
    options.notBefore = notBefore as any;
  }

  const token = jwt.sign(clean, JWT_SECRET, options);

  if (token.length > MAX_TOKEN_SIZE) {
    throw new Error(
      `Generated token too large (${token.length} > ${MAX_TOKEN_SIZE})`
    );
  }

  return token;
}

/**
 * Verify JWT
 */
export function verifyJwtToken<T extends JwtPayload = JwtPayload>(
  token: string
): T {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as T;

    if (!decoded.jti) {
      throw new Error('Token missing jti claim');
    }

    return decoded;
  } catch (error) {
    throw error instanceof jwt.JsonWebTokenError
      ? new Error(`JWT verification failed: ${error.message}`)
      : error;
  }
}

/**
 * Map payload to AuthUser
 */
export function jwtPayloadToAuthUser(payload: JwtPayload): AuthUser {
  const verificationLevel: VerificationLevel =
    payload.verificationLevel &&
    VALID_VERIFICATION_LEVELS.includes(payload.verificationLevel)
      ? payload.verificationLevel
      : 'UNVERIFIED';

  const roles = Array.isArray(payload.roles)
    ? payload.roles.filter((r) => typeof r === 'string')
    : [];

  return {
    userId: payload.sub,
    email: payload.email || undefined,
    phoneNumber: payload.phoneNumber || undefined,
    walletAddress: payload.walletAddress || undefined,
    primaryWardId: payload.primaryWardId || undefined,
    secondaryWardId: payload.secondaryWardId || undefined,
    verificationLevel,
    emailVerified: payload.emailVerified ?? false,
    phoneVerified: payload.phoneVerified ?? false,
    communityVerified: payload.communityVerified ?? false,
    roles,
    globalImpactPoints: safeNumericValue(payload.globalImpactPoints),
    utilityTokens: safeNumericValue(payload.utilityTokens),
    participationRights: safeNumericValue(payload.participationRights),
  };
}

/**
 * Helper functions for different token types
 */

/**
 * Sign access token (short-lived, 1 hour)
 * Includes 30s notBefore for clock skew protection
 */
export function signAccessToken(payload: JwtPayload): string {
  return signJwtToken(payload, '1h', 30);
}

/**
 * Sign refresh token (long-lived, 30 days)
 */
export function signRefreshToken(payload: JwtPayload): string {
  return signJwtToken({ ...payload, type: 'refresh' }, '30d');
}

/**
 * Sign magic link token (short-lived, 15 minutes)
 * Includes 30s notBefore for clock skew protection
 */
export function signMagicLinkToken(payload: JwtPayload): string {
  return signJwtToken({ ...payload, type: 'magic-link' }, '15m', 30);
}

/**
 * Sign permanent token (very long-lived, 180 days)
 * Used for "remember me" functionality
 */
export function signPermanentToken(payload: JwtPayload): string {
  return signJwtToken({ ...payload, type: 'permanent' }, '180d');
}

/**
 * Sign temporary session token (configurable expiry)
 *
 * @param payload - JWT payload
 * @param expiresIn - Custom expiration (default from env or 7d)
 */
export function signSessionToken(
  payload: JwtPayload,
  expiresIn?: string
): string {
  return signJwtToken(
    { ...payload, type: 'temporary' },
    expiresIn || env.JWT_EXPIRES_IN || '7d'
  );
}
