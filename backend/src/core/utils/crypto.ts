/**
 * @file crypto.ts
 *
 * @description
 * Centralized cryptographic utility module for the UJAMAADAO platform.
 * Provides secure hashing, encryption/decryption, and verification utilities
 * with sensible defaults.
 *
 * Designed for use across all modules (auth, wallet, governance, etc.)
 * under strict cryptographic hygiene principles.
 * 
 * Version: 2.0 — December 2025
 * Security Hardened: December 2025
 * 
 * NOTE: JWT operations have been moved to jwt.service.ts for better security.
 * DO NOT add JWT functions here - use jwt.service.ts instead.
 */

import crypto from "crypto";
import bcrypt from "bcrypt";
import { env } from "./env.js"; // Import environment variables

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

// Strong defaults — configurable via environment
const BCRYPT_SALT_ROUNDS = (() => {
  const rounds = parseInt(env.BCRYPT_SALT_ROUNDS || "12", 10);
  if (rounds < 10 || rounds > 15) {
    throw new Error("BCRYPT_SALT_ROUNDS must be between 10 and 15");
  }
  return rounds;
})();

// AES-256-GCM encryption defaults
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128-bit IV
const AUTH_TAG_LENGTH = 16; // Authentication tag length in bytes
const KEY_LENGTH = 32; // 256 bits for AES-256

// Password validation
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt truncates at 72 bytes

// ============================================================================
// PASSWORD HASHING
// ============================================================================
// 
// NOTE: UjamaaDAO uses PASSWORDLESS authentication (wallets + magic links).
// These password functions are for:
// - Admin/internal accounts only
// - Backend service authentication
// - Key derivation for data encryption
// 
// DO NOT use for regular user authentication - users authenticate via:
// - Wallet signatures (MetaMask, etc.) - Primary method
// - Magic links (email/phone) - Secondary method
// ============================================================================

/**
 * Hash a plain text password using bcrypt.
 * 
 * WARNING: Only use for admin accounts or internal systems.
 * Regular users authenticate via wallets (no passwords).
 * 
 * @param password - Plain text password (8-72 characters)
 * @returns Bcrypt hash
 * @throws Error if password is invalid
 */
export async function hashPassword(password: string): Promise<string> {
  // Validate password
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string");
  }
  
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password too long (max ${MAX_PASSWORD_LENGTH} characters - bcrypt limitation)`);
  }
  
  return await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Compare a plain text password to a stored hash.
 * 
 * @param password - Plain text password to verify
 * @param hash - Stored bcrypt hash
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // Validate inputs
    if (!password || !hash) {
      return false;
    }
    
    // Validate hash looks like bcrypt format ($2a$, $2b$, $2y$)
    if (!hash.startsWith('$2') || hash.length < 59) {
      return false;
    }
    
    return await bcrypt.compare(password, hash);
  } catch (error) {
    // Invalid hash format or other error - return false (don't leak info)
    return false;
  }
}

// ============================================================================
// SYMMETRIC ENCRYPTION (AES-256-GCM)
// ============================================================================

/**
 * Encrypt a text string using AES-256-GCM with a secret key.
 * 
 * @param text - Plain text to encrypt
 * @param keyHex - 64-character hex string (32 bytes) encryption key
 * @returns Encrypted data in format: iv:authTag:encryptedData (all hex)
 * @throws Error if key format is invalid
 * 
 * @example
 * const key = generateEncryptionKey();
 * const encrypted = encrypt("sensitive data", key);
 */
export function encrypt(text: string, keyHex: string): string {
  // Validate key format (must be 64 hex characters = 32 bytes)
  if (!keyHex || typeof keyHex !== "string") {
    throw new Error("Encryption key must be a string");
  }
  
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("Encryption key must be 64 hexadecimal characters (32 bytes for AES-256)");
  }
  
  // Validate text
  if (typeof text !== "string") {
    throw new Error("Text to encrypt must be a string");
  }
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(keyHex, "hex"), iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (error) {
    throw new Error("Encryption failed: " + (error instanceof Error ? error.message : "Unknown error"));
  }
}

/**
 * Decrypt a text string encrypted with AES-256-GCM.
 * 
 * @param data - Encrypted data in format: iv:authTag:encryptedData (all hex)
 * @param keyHex - 64-character hex string (32 bytes) encryption key
 * @returns Decrypted plain text
 * @throws Error if decryption fails (wrong key, corrupted data, or tampered)
 * 
 * @example
 * const decrypted = decrypt(encrypted, key);
 */
export function decrypt(data: string, keyHex: string): string {
  // Validate key format
  if (!keyHex || typeof keyHex !== "string") {
    throw new Error("Encryption key must be a string");
  }
  
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("Encryption key must be 64 hexadecimal characters (32 bytes for AES-256)");
  }
  
  // Validate encrypted data format
  if (!data || typeof data !== "string") {
    throw new Error("Encrypted data must be a string");
  }
  
  const parts = data.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format (expected iv:authTag:encrypted)");
  }

  const [ivHex, authTagHex, encryptedData] = parts;
  
  // Validate component lengths
  if (ivHex.length !== IV_LENGTH * 2) {
    throw new Error(`Invalid IV length (expected ${IV_LENGTH * 2} hex characters)`);
  }
  
  if (authTagHex.length !== AUTH_TAG_LENGTH * 2) {
    throw new Error(`Invalid auth tag length (expected ${AUTH_TAG_LENGTH * 2} hex characters)`);
  }
  
  if (!/^[0-9a-fA-F]+$/.test(ivHex + authTagHex + encryptedData)) {
    throw new Error("Invalid encrypted data (must be hexadecimal)");
  }

  try {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(keyHex, "hex"), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    // Generic error - don't reveal whether it's wrong key vs corrupted data
    throw new Error("Decryption failed (wrong key, corrupted data, or tampered)");
  }
}

// ============================================================================
// KEY GENERATION & DERIVATION
// ============================================================================

/**
 * Generate a secure AES-256 encryption key.
 * 
 * @returns 64-character hex string (32 bytes) suitable for AES-256-GCM
 * 
 * @example
 * const key = generateEncryptionKey();
 * // Store this key securely - losing it means losing encrypted data
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString("hex");
}

/**
 * Derive a proper encryption key from a password using PBKDF2.
 * WARNING: Prefer generateEncryptionKey() for new use cases.
 * Only use this when you must derive from user password.
 * 
 * @param password - User password
 * @param salt - Unique salt (16+ bytes recommended, store with encrypted data)
 * @param iterations - Number of PBKDF2 iterations (default: 100000)
 * @returns 64-character hex string (32 bytes) suitable for AES-256-GCM
 * 
 * @example
 * const salt = generateRandomHex(16);
 * const key = deriveEncryptionKey(userPassword, salt);
 * // Store salt with encrypted data for later decryption
 */
export function deriveEncryptionKey(
  password: string, 
  salt: string, 
  iterations: number = 100000
): string {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  
  if (!salt || salt.length < 32) {
    throw new Error("Salt must be at least 32 hex characters (16 bytes)");
  }
  
  if (iterations < 100000) {
    throw new Error("Iterations must be at least 100000 for security");
  }
  
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, 'sha256').toString('hex');
}

// ============================================================================
// RANDOM & SIGNATURE UTILITIES
// ============================================================================

/**
 * Generate a secure random string (hex format).
 * Uses crypto.randomBytes for cryptographically secure randomness.
 * 
 * @param bytes - Number of random bytes to generate (default: 16)
 * @returns Hex string (length = bytes * 2)
 * 
 * @example
 * const token = generateRandomHex(16); // 32-char hex string
 * const sessionId = generateRandomHex(32); // 64-char hex string
 */
export function generateRandomHex(bytes: number = 16): string {
  if (bytes < 8) {
    throw new Error("Must generate at least 8 bytes for security");
  }
  
  if (bytes > 256) {
    throw new Error("Cannot generate more than 256 bytes");
  }
  
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Generate an HMAC signature for data integrity verification.
 * 
 * @param data - Data to sign
 * @param secret - Secret key for HMAC
 * @param context - Optional context for domain separation
 * @returns Hex-encoded HMAC signature
 * 
 * @example
 * const signature = generateHmacSignature(userData, secret, "user-profile");
 */
export function generateHmacSignature(
  data: string, 
  secret: string,
  context?: string
): string {
  if (!data || !secret) {
    throw new Error("Data and secret are required for HMAC");
  }
  
  const hmac = crypto.createHmac("sha256", secret);
  
  // Domain separation - prevents signature reuse across contexts
  if (context) {
    hmac.update(context + ":");
  }
  
  return hmac.update(data).digest("hex");
}

/**
 * Verify an HMAC signature using timing-safe comparison.
 * 
 * @param data - Original data
 * @param signature - Signature to verify
 * @param secret - Secret key for HMAC
 * @param context - Optional context (must match signing context)
 * @returns True if signature is valid, false otherwise
 * 
 * @example
 * const isValid = verifyHmacSignature(userData, signature, secret, "user-profile");
 */
export function verifyHmacSignature(
  data: string, 
  signature: string, 
  secret: string,
  context?: string
): boolean {
  try {
    if (!data || !signature || !secret) {
      return false;
    }
    
    const expected = generateHmacSignature(data, secret, context);
    
    // Validate signature length before comparison (prevent timingSafeEqual errors)
    if (signature.length !== expected.length) {
      return false;
    }
    
    // Validate signature is valid hex
    if (!/^[0-9a-fA-F]+$/.test(signature)) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"), 
      Buffer.from(signature, "hex")
    );
  } catch (error) {
    // Any error in comparison = invalid signature
    return false;
  }
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
  hashPassword,
  verifyPassword,
  encrypt,
  decrypt,
  generateEncryptionKey,
  deriveEncryptionKey,
  generateRandomHex,
  generateHmacSignature,
  verifyHmacSignature,
};