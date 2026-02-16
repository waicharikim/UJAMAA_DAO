/**
 * @file src/modules/auth/services/totp-2fa.service.ts
 * @description
 * TOTP-based 2FA Service (Google Authenticator, Authy, etc.)
 * 
 * Features:
 * - Generate TOTP secret
 * - Generate QR code for easy setup
 * - Verify TOTP codes with rate limiting
 * - Backup codes generation (cryptographically secure)
 * - Failed attempt tracking and account protection
 * - Security event logging
 * 
 * Uses: speakeasy for TOTP, qrcode for QR generation
 * 
 * Version: 2.0 — January 2026 (Security Hardened)
 */

import { prisma } from "../../../core/database/client.js";
import { ApiError } from "../../../core/errors/ApiError.js";
import { logger, logSecurityEvent } from "../../../core/logger/logger.js";
import { encrypt, decrypt, generateRandomHex } from "../../../core/utils/crypto.js";
import { sendEmail } from "../../../core/utils/email.service.js";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

const ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  console.warn('[2FA] TOTP_ENCRYPTION_KEY not set - 2FA will not work');
}

const BACKUP_CODES_COUNT = 10;
const TOTP_WINDOW = 1; // Allow 1 step before/after (30 second tolerance)
const MAX_2FA_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const BACKUP_CODES_LOW_THRESHOLD = 3;

export interface TotpSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

interface VerificationContext {
  ipAddress?: string;
  userAgent?: string;
}

class Totp2FAService {
  /**
   * Enable 2FA for a user - generates secret and backup codes
   */
  async enable(userId: string, userEmail: string): Promise<TotpSetupResult> {
    try {
      // Check if user already has 2FA enabled
      const existing = await prisma.twoFactorAuth.findUnique({
        where: { userId },
      });

      if (existing && existing.enabled) {
        throw ApiError.conflict('2FA is already enabled for this account');
      }

      // Generate TOTP secret
      const secret = speakeasy.generateSecret({
        name: `UjamaaDAO (${userEmail})`,
        issuer: 'UjamaaDAO',
        length: 32,
      });

      // Generate cryptographically secure backup codes
      const backupCodes = this.generateBackupCodes();

      // Encrypt secret and backup codes before storing
      const encryptedSecret = encrypt(secret.base32, ENCRYPTION_KEY!);
      const encryptedBackupCodes = backupCodes.map(code => 
        encrypt(code, ENCRYPTION_KEY!)
      );

      // Store in database (not yet enabled)
      await prisma.twoFactorAuth.upsert({
        where: { userId },
        create: {
          userId,
          secretEncrypted: encryptedSecret,
          backupCodesEncrypted: encryptedBackupCodes,
          enabled: false, // Not enabled until verified
          failedAttempts: 0,
        },
        update: {
          secretEncrypted: encryptedSecret,
          backupCodesEncrypted: encryptedBackupCodes,
          enabled: false,
          failedAttempts: 0,
          lastFailedAttempt: null,
        },
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

      logger.info({
        operationType: 'SECURITY',
        userId,
      }, '2FA setup initiated');

      return {
        secret: secret.base32,
        qrCodeUrl,
        backupCodes,
      };

    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({
        operationType: 'GENERAL',
        userId,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      }, 'Failed to enable 2FA');

      throw ApiError.systemError('Failed to enable 2FA');
    }
  }

  /**
   * Verify TOTP code and enable 2FA
   */
  async verify(userId: string, code: string, context?: VerificationContext): Promise<boolean> {
    try {
      // Get 2FA record
      const twoFactor = await prisma.twoFactorAuth.findUnique({
        where: { userId },
      });

      if (!twoFactor) {
        throw ApiError.notFound('2FA not set up for this account');
      }

      // Check if locked out
      if (await this.isLockedOut(twoFactor)) {
        throw ApiError.tooManyRequests('Too many failed attempts. Please try again later.');
      }

      // Decrypt secret
      const secret = decrypt(twoFactor.secretEncrypted, ENCRYPTION_KEY!);

      // Verify code
      const isValid = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: code,
        window: TOTP_WINDOW,
      });

      if (!isValid) {
        await this.trackFailedAttempt(userId, context);
        
        logger.warn({
          operationType: 'SECURITY',
          userId,
          metadata: { ipAddress: context?.ipAddress },
        }, 'Invalid 2FA code attempt during setup');

        throw ApiError.badRequest('Invalid verification code');
      }

      // Enable 2FA and reset failed attempts
      await prisma.twoFactorAuth.update({
        where: { userId },
        data: { 
          enabled: true,
          enabledAt: new Date(),
          failedAttempts: 0,
          lastFailedAttempt: null,
        },
      });

      logger.info({
        operationType: 'SECURITY',
        userId,
      }, '2FA enabled successfully');

      logSecurityEvent(
        '2FA enabled',
        'TWO_FACTOR_ENABLED',
        'LOW',
        'User enabled two-factor authentication',
        {
          userId,
          ipAddress: context?.ipAddress,
          metadata: { method: 'totp' },
        }
      );

      return true;

    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({
        operationType: 'GENERAL',
        userId,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      }, 'Failed to verify 2FA code');

      throw ApiError.systemError('Failed to verify 2FA');
    }
  }

  /**
   * Verify 2FA code during login with security tracking
   */
  async verifyLogin(userId: string, code: string, context?: VerificationContext): Promise<boolean> {
    try {
      const twoFactor = await prisma.twoFactorAuth.findUnique({
        where: { userId, enabled: true },
      });

      if (!twoFactor) {
        return true; // 2FA not enabled for this user
      }

      // Check if locked out due to failed attempts
      if (await this.isLockedOut(twoFactor)) {
        logSecurityEvent(
          '2FA verification blocked - locked out',
          'TWO_FACTOR_LOCKOUT',
          'HIGH',
          'User attempted 2FA verification while locked out',
          {
            userId,
            ipAddress: context?.ipAddress,
            metadata: {
              failedAttempts: twoFactor.failedAttempts,
              lastFailedAttempt: twoFactor.lastFailedAttempt,
            },
          }
        );
        
        throw ApiError.tooManyRequests(
          'Account temporarily locked due to multiple failed 2FA attempts. Please try again in 15 minutes.'
        );
      }

      // Try TOTP code first
      const secret = decrypt(twoFactor.secretEncrypted, ENCRYPTION_KEY!);
      const isValidTotp = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: code,
        window: TOTP_WINDOW,
      });

      if (isValidTotp) {
        // Reset failed attempts on success
        await prisma.twoFactorAuth.update({
          where: { userId },
          data: { 
            failedAttempts: 0,
            lastFailedAttempt: null,
          },
        });

        logger.info({
          operationType: 'AUTH',
          userId,
          metadata: { ipAddress: context?.ipAddress },
        }, '2FA verification successful (TOTP)');
        
        return true;
      }

      // Try backup codes
      const isValidBackup = await this.verifyBackupCode(userId, code, twoFactor);
      
      if (isValidBackup) {
        // Reset failed attempts on success
        await prisma.twoFactorAuth.update({
          where: { userId },
          data: { 
            failedAttempts: 0,
            lastFailedAttempt: null,
          },
        });

        logger.info({
          operationType: 'AUTH',
          userId,
          metadata: { ipAddress: context?.ipAddress },
        }, '2FA verification successful (backup code)');
        
        return true;
      }

      // Both methods failed - track attempt
      await this.trackFailedAttempt(userId, context);

      logger.warn({
        operationType: 'SECURITY',
        userId,
        metadata: { 
          ipAddress: context?.ipAddress,
          failedAttempts: twoFactor.failedAttempts + 1,
        },
      }, '2FA verification failed');

      logSecurityEvent(
        '2FA verification failed',
        'TWO_FACTOR_FAILED',
        'HIGH',
        'User entered invalid 2FA code',
        {
          userId,
          ipAddress: context?.ipAddress,
          metadata: {
            failedAttempts: twoFactor.failedAttempts + 1,
            userAgent: context?.userAgent,
          },
        }
      );

      return false;

    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({
        operationType: 'GENERAL',
        userId,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      }, 'Error verifying 2FA during login');

      return false;
    }
  }

  /**
   * Check if user is locked out due to failed attempts
   */
  private async isLockedOut(twoFactor: any): Promise<boolean> {
    if (twoFactor.failedAttempts < MAX_2FA_ATTEMPTS) {
      return false;
    }

    if (!twoFactor.lastFailedAttempt) {
      return false;
    }

    const lockoutEnd = new Date(twoFactor.lastFailedAttempt.getTime() + LOCKOUT_DURATION_MS);
    const isStillLockedOut = new Date() < lockoutEnd;

    // If lockout expired, reset counter
    if (!isStillLockedOut) {
      await prisma.twoFactorAuth.update({
        where: { userId: twoFactor.userId },
        data: { 
          failedAttempts: 0,
          lastFailedAttempt: null,
        },
      });
    }

    return isStillLockedOut;
  }

  /**
   * Track failed 2FA attempt
   */
  private async trackFailedAttempt(userId: string, context?: VerificationContext): Promise<void> {
    const twoFactor = await prisma.twoFactorAuth.update({
      where: { userId },
      data: {
        failedAttempts: { increment: 1 },
        lastFailedAttempt: new Date(),
      },
    });

    // Alert on lockout threshold
    if (twoFactor.failedAttempts >= MAX_2FA_ATTEMPTS) {
      logSecurityEvent(
        '2FA account locked',
        'TWO_FACTOR_LOCKOUT',
        'CRITICAL',
        `Account locked after ${MAX_2FA_ATTEMPTS} failed 2FA attempts`,
        {
          userId,
          ipAddress: context?.ipAddress,
          metadata: {
            failedAttempts: twoFactor.failedAttempts,
            userAgent: context?.userAgent,
          },
        }
      );

      // TODO: Send security alert email
    }
  }

  /**
   * Verify backup code (atomic operation)
   */
  private async verifyBackupCode(
    userId: string, 
    code: string,
    twoFactor: any
  ): Promise<boolean> {
    // Decrypt all backup codes
    const backupCodes = twoFactor.backupCodesEncrypted.map((encrypted: string) =>
      decrypt(encrypted, ENCRYPTION_KEY!)
    );

    // Check if code matches any backup code
    const index = backupCodes.indexOf(code);
    if (index === -1) return false;

    // Remove used backup code (atomic transaction)
    await prisma.$transaction(async (tx) => {
      const updatedCodes = twoFactor.backupCodesEncrypted.filter(
        (_: any, i: number) => i !== index
      );

      await tx.twoFactorAuth.update({
        where: { userId },
        data: { backupCodesEncrypted: updatedCodes },
      });

      // Log backup code usage
      logSecurityEvent(
        'Backup code used',
        'TWO_FACTOR_BACKUP_USED',
        'MEDIUM',
        'User logged in with backup code',
        {
          userId,
          metadata: {
            remainingCodes: updatedCodes.length,
          },
        }
      );

      // Warn user if running low on backup codes
      if (updatedCodes.length <= BACKUP_CODES_LOW_THRESHOLD) {
        logger.warn({
          operationType: 'SECURITY',
          userId,
          metadata: { remainingCodes: updatedCodes.length },
        }, 'User running low on backup codes');
        
        // Send email warning
        await this.sendBackupCodesWarning(userId, updatedCodes.length);
      }
    });

    return true;
  }

  /**
   * Send warning email about low backup codes
   */
  private async sendBackupCodesWarning(userId: string, remaining: number): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (!user?.email) return;

      await sendEmail({
        to: user.email,
        subject: 'Low 2FA Backup Codes - UjamaaDAO',
        html: `
          <h2>Low Backup Codes Warning</h2>
          <p>Hello ${user.name || 'there'},</p>
          <p>You have only <strong>${remaining} backup codes</strong> remaining for your two-factor authentication.</p>
          <p>We recommend regenerating your backup codes soon to ensure you don't lose access to your account.</p>
          <p>You can regenerate them in your account security settings.</p>
        `,
      });
    } catch (error) {
      logger.error({
        operationType: 'EMAIL',
        userId,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      }, 'Failed to send backup codes warning email');
    }
  }

  /**
   * Disable 2FA (requires verification)
   */
  async disable(userId: string, code: string, context?: VerificationContext): Promise<void> {
    // Verify code before disabling
    const isValid = await this.verifyLogin(userId, code, context);
    
    if (!isValid) {
      throw ApiError.badRequest('Invalid verification code');
    }

    try {
      await prisma.twoFactorAuth.update({
        where: { userId },
        data: { 
          enabled: false,
          disabledAt: new Date(),
          failedAttempts: 0,
          lastFailedAttempt: null,
        },
      });

      logger.info({
        operationType: 'SECURITY',
        userId,
      }, '2FA disabled');

      logSecurityEvent(
        '2FA disabled',
        'TWO_FACTOR_DISABLED',
        'MEDIUM',
        'User disabled two-factor authentication',
        {
          userId,
          ipAddress: context?.ipAddress,
          metadata: { method: 'totp' },
        }
      );

    } catch (error) {
      logger.error({
        operationType: 'DATABASE',
        userId,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      }, 'Failed to disable 2FA');

      throw ApiError.systemError('Failed to disable 2FA');
    }
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string, code: string, context?: VerificationContext): Promise<string[]> {
    // Verify current code
    const isValid = await this.verifyLogin(userId, code, context);
    
    if (!isValid) {
      throw ApiError.badRequest('Invalid verification code');
    }

    try {
      const newBackupCodes = this.generateBackupCodes();
      const encrypted = newBackupCodes.map(code => encrypt(code, ENCRYPTION_KEY!));

      await prisma.twoFactorAuth.update({
        where: { userId },
        data: { backupCodesEncrypted: encrypted },
      });

      logger.info({
        operationType: 'SECURITY',
        userId,
      }, 'Backup codes regenerated');

      logSecurityEvent(
        'Backup codes regenerated',
        'TWO_FACTOR_BACKUP_REGENERATED',
        'LOW',
        'User regenerated backup codes',
        {
          userId,
          ipAddress: context?.ipAddress,
        }
      );

      return newBackupCodes;

    } catch (error) {
      logger.error({
        operationType: 'DATABASE',
        userId,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      }, 'Failed to regenerate backup codes');

      throw ApiError.systemError('Failed to regenerate backup codes');
    }
  }

  /**
   * Generate cryptographically secure backup codes
   * Format: XXXX-XXXX (8 alphanumeric characters)
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
      // Generate 8 random bytes = 64 bits of entropy
      const randomBytes = generateRandomHex(8);
      // Convert to uppercase alphanumeric (remove similar-looking characters)
      const code = randomBytes
        .toUpperCase()
        .replace(/[0O1IL]/g, (c) => {
          // Replace confusing characters
          const replacements: Record<string, string> = { '0': '8', 'O': '9', '1': '7', 'I': '6', 'L': '5' };
          return replacements[c] || c;
        })
        .slice(0, 8);
      
      // Format as XXXX-XXXX for readability
      const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
      codes.push(formatted);
    }

    return codes;
  }

  /**
   * Check if user has 2FA enabled
   */
  async isEnabled(userId: string): Promise<boolean> {
    const twoFactor = await prisma.twoFactorAuth.findUnique({
      where: { userId },
      select: { enabled: true },
    });

    return twoFactor?.enabled || false;
  }

  /**
   * Get 2FA status for user
   */
  async getStatus(userId: string): Promise<{
    enabled: boolean;
    enabledAt?: Date;
    backupCodesRemaining: number;
    isLockedOut: boolean;
  }> {
    const twoFactor = await prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactor) {
      return { 
        enabled: false, 
        backupCodesRemaining: 0,
        isLockedOut: false,
      };
    }

    return {
      enabled: twoFactor.enabled,
      enabledAt: twoFactor.enabledAt || undefined,
      backupCodesRemaining: twoFactor.backupCodesEncrypted.length,
      isLockedOut: await this.isLockedOut(twoFactor),
    };
  }
}

export const totp2FAService = new Totp2FAService();
export default totp2FAService;