/**
 * @file src/modules/auth/services/password-reset.service.ts
 * @description
 * Password Reset Service - For admin accounts only
 * 
 * UjamaaDAO uses passwordless auth for regular users, but admins
 * may need password-based access for emergency situations.
 * 
 * Features:
 * - Request password reset (email with token)
 * - Verify reset token
 * - Set new password
 * - Password strength validation
 * - Rate limiting and brute force protection
 * - Security event logging
 * 
 * Version: 2.0 — January 2026
 * Security Hardened: Added brute force protection and comprehensive logging
 */

import { prisma } from "../../../core/database/client.js";
import { ApiError } from "../../../core/errors/ApiError.js";
import { logger, logSecurityEvent } from "../../../core/logger/logger.js";
import { hashPassword } from "../../../core/utils/crypto.js";
import { generateRandomHex } from "../../../core/utils/crypto.js";
import { sendEmail } from "../../../core/utils/email.service.js";

const RESET_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour
const MAX_RESET_ATTEMPTS = 5;
const RESET_ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

// Password strength requirements
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_REQUIREMENTS = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
  special: /[!@#$%^&*(),.?":{}|<>]/,
};

interface ResetContext {
  ipAddress?: string;
  userAgent?: string;
}

class PasswordResetService {
  /**
   * Request password reset (send email with reset link)
   * Only works for admin accounts with passwords
   */
  async requestReset(email: string, context?: ResetContext, correlationId?: string): Promise<void> {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          userRoles: {
            where: { active: true },
            include: { role: { select: { name: true } } }
          },
          passwordHash: true,
        },
      });

      // Always return success to prevent email enumeration
      if (!user) {
        logger.info({
          operationType: 'AUTH',
          metadata: { 
            email: email.slice(0, 3) + '***', // Partial redaction for logs
            reason: 'User not found',
            ipAddress: context?.ipAddress,
            correlationId,
          },
        }, 'Password reset requested for non-existent email');
        return;
      }

      // Check if user is admin (only admins can have passwords)
      const roles = user.userRoles.map(ur => ur.role.name);
      const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
      
      if (!isAdmin) {
        logSecurityEvent(
          'Password reset requested for non-admin',
          'AUTH_FAILURE',
          'MEDIUM',
          'Non-admin user attempted password reset',
          {
            userId: user.id,
            ipAddress: context?.ipAddress,
            metadata: { 
              roles,
              correlationId,
            },
          }
        );
        return; // Silent fail
      }

      // Check if user has a password (some admins might use wallet-only)
      if (!user.passwordHash) {
        logger.info({
          operationType: 'AUTH',
          userId: user.id,
          metadata: { correlationId },
        }, 'Password reset requested for passwordless admin account');
        return; // Silent fail
      }

      // Check for brute force attempts
      const recentAttempts = await this.checkResetAttempts(user.id);
      if (recentAttempts >= MAX_RESET_ATTEMPTS) {
        logSecurityEvent(
          'Password reset rate limit exceeded',
          'BRUTE_FORCE',
          'HIGH',
          `${recentAttempts} reset attempts in ${RESET_ATTEMPT_WINDOW / 60000} minutes`,
          {
            userId: user.id,
            ipAddress: context?.ipAddress,
            metadata: {
              attempts: recentAttempts,
              correlationId,
            },
          }
        );
        
        // Still return success to prevent enumeration
        return;
      }

      // Generate secure reset token
      const token = generateRandomHex(32); // 64 character token
      const tokenHash = await hashPassword(token); // Store hash, not plaintext

      // Store reset token
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY),
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        },
      });

      // Send reset email
      const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password?token=${token}`;
      
      await sendEmail({
        to: user.email!,
        subject: 'Password Reset Request - UjamaaDAO Admin',
        html: this.generateResetEmail(user.name || 'Admin', resetLink),
        text: `
          Password Reset Request
          
          Click this link to reset your password: ${resetLink}
          
          This link expires in 1 hour.
          
          If you didn't request this, please ignore this email and contact support.
        `,
      });

      logSecurityEvent(
        'Password reset requested',
        'AUTH_SUCCESS',
        'MEDIUM',
        'Password reset email sent to admin',
        {
          userId: user.id,
          ipAddress: context?.ipAddress,
          metadata: {
            correlationId,
          },
        }
      );

    } catch (error) {
      logger.error({
        operationType: 'GENERAL',
        metadata: { 
          error: error instanceof Error ? error.message : String(error),
          correlationId,
        },
      }, 'Failed to process password reset request');
      
      // Don't throw - silent fail to prevent enumeration
    }
  }

  /**
   * Check recent reset attempts for rate limiting
   */
  private async checkResetAttempts(userId: string): Promise<number> {
    try {
      const windowStart = new Date(Date.now() - RESET_ATTEMPT_WINDOW);
      
      const count = await prisma.passwordReset.count({
        where: {
          userId,
          createdAt: { gte: windowStart },
        },
      });
      
      return count;
    } catch (error) {
      logger.error({
        operationType: 'DATABASE',
        userId,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      }, 'Failed to check reset attempts');
      
      return 0; // Allow on error (fail open for availability)
    }
  }

  /**
   * Verify reset token and return user ID
   */
  async verifyResetToken(token: string, correlationId?: string): Promise<string> {
    if (!token || token.length !== 64) {
      throw ApiError.badRequest('Invalid reset token format', undefined, correlationId);
    }

    try {
      const tokenHash = await hashPassword(token);

      // Find valid reset token
      const reset = await prisma.passwordReset.findFirst({
        where: {
          tokenHash,
          used: false,
          expiresAt: { gt: new Date() },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              userRoles: {
                where: { active: true },
                include: { role: { select: { name: true } } }
              },
            },
          },
        },
      });

      if (!reset) {
        logSecurityEvent(
          'Invalid reset token used',
          'AUTH_FAILURE',
          'MEDIUM',
          'User attempted to use invalid or expired reset token',
          {
            metadata: { 
              tokenLength: token.length,
              correlationId,
            },
          }
        );
        
        throw ApiError.badRequest('Invalid or expired reset token', undefined, correlationId);
      }

      // Check if user is still admin
      const roles = reset.user.userRoles.map(ur => ur.role.name);
      const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
      
      if (!isAdmin) {
        logSecurityEvent(
          'Reset token used by non-admin',
          'AUTHORIZATION_FAILURE',
          'HIGH',
          'User lost admin role but tried to use reset token',
          {
            userId: reset.user.id,
            metadata: {
              roles,
              correlationId,
            },
          }
        );
        
        throw ApiError.forbidden('User is no longer an admin', undefined, correlationId);
      }

      return reset.user.id;

    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({
        operationType: 'GENERAL',
        metadata: { 
          error: error instanceof Error ? error.message : String(error),
          correlationId,
        },
      }, 'Error verifying reset token');

      throw ApiError.systemError('Failed to verify reset token', undefined, correlationId);
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string, 
    newPassword: string, 
    context?: ResetContext,
    correlationId?: string
  ): Promise<void> {
    // Validate password strength
    this.validatePasswordStrength(newPassword);

    // Verify token and get user ID
    const userId = await this.verifyResetToken(token, correlationId);

    try {
      const tokenHash = await hashPassword(token);

      // Hash new password
      const passwordHash = await hashPassword(newPassword);

      // Update password and mark token as used (atomic transaction)
      await prisma.$transaction(async (tx) => {
        // Update user password
        await tx.user.update({
          where: { id: userId },
          data: { passwordHash },
        });

        // Mark reset token as used
        await tx.passwordReset.updateMany({
          where: { tokenHash },
          data: { 
            used: true,
            usedAt: new Date(),
          },
        });

        // Revoke all sessions (force re-login)
        await tx.session.updateMany({
          where: { userId },
          data: { revoked: true },
        });
      });

      logSecurityEvent(
        'Password reset completed',
        'AUTH_SUCCESS',
        'HIGH',
        'Admin password reset - all sessions revoked',
        {
          userId,
          ipAddress: context?.ipAddress,
          metadata: {
            allSessionsRevoked: true,
            correlationId,
          },
        }
      );

      // Send confirmation email
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (user?.email) {
        await this.sendPasswordChangedEmail(user.email, user.name || 'Admin');
      }

    } catch (error) {
      logger.error({
        operationType: 'DATABASE',
        userId,
        metadata: { 
          error: error instanceof Error ? error.message : String(error),
          correlationId,
        },
      }, 'Failed to reset password');

      throw ApiError.systemError('Failed to reset password', undefined, correlationId);
    }
  }

  /**
   * Validate password strength
   */
  private validatePasswordStrength(password: string): void {
    const errors: string[] = [];

    if (password.length < PASSWORD_MIN_LENGTH) {
      errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }

    if (!PASSWORD_REQUIREMENTS.uppercase.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!PASSWORD_REQUIREMENTS.lowercase.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!PASSWORD_REQUIREMENTS.number.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!PASSWORD_REQUIREMENTS.special.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password123', 'admin123456', 'letmein123', 
      'welcome123', 'password1234', '123456789012',
      'administrator', 'passw0rd!123',
    ];
    
    const lowerPassword = password.toLowerCase();
    if (commonPasswords.some(weak => lowerPassword.includes(weak))) {
      errors.push('Password is too common');
    }

    // Check for sequential characters
    if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
      errors.push('Password contains sequential characters');
    }

    if (errors.length > 0) {
      throw ApiError.validationError('Weak password', { errors });
    }
  }

  /**
   * Send password changed confirmation email
   */
  private async sendPasswordChangedEmail(email: string, name: string): Promise<void> {
    try {
      await sendEmail({
        to: email,
        subject: 'Password Changed - UjamaaDAO Admin',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Password Changed</h1>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p>Hi ${name},</p>
              
              <p>Your admin password has been successfully changed.</p>
              
              <p><strong>All your active sessions have been logged out for security.</strong> Please log in again with your new password.</p>
              
              <p>If you didn't make this change, please contact support immediately at <a href="mailto:support@ujamaadao.org">support@ujamaadao.org</a></p>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              
              <p style="color: #999; font-size: 12px;">
                This is an automated security notification. Please do not reply to this email.
              </p>
            </div>
          </body>
          </html>
        `,
        text: `
          Password Changed
          
          Hi ${name},
          
          Your admin password has been successfully changed.
          
          All your active sessions have been logged out for security.
          Please log in again with your new password.
          
          If you didn't make this change, please contact support immediately.
        `,
      });
    } catch (error) {
      logger.error({
        operationType: 'EMAIL',
        metadata: { 
          error: error instanceof Error ? error.message : String(error),
          recipient: email,
        },
      }, 'Failed to send password changed confirmation email');
    }
  }

  /**
   * Generate password reset email HTML
   */
  private generateResetEmail(name: string, resetLink: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Password Reset Request</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi ${name},</p>
          
          <p>We received a request to reset your admin password for your UjamaaDAO account.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
          
          <p><strong>This link expires in 1 hour.</strong></p>
          
          <p>If you didn't request this password reset, please ignore this email and contact support immediately.</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px;">
            For security reasons, this link can only be used once and will expire in 1 hour.
            If you need help, contact us at support@ujamaadao.org
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Clean up expired reset tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await prisma.passwordReset.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { 
              used: true,
              usedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 7 days old
            },
          ],
        },
      });

      if (result.count > 0) {
        logger.info({
          operationType: 'GENERAL',
          metadata: { deletedCount: result.count },
        }, 'Expired password reset tokens cleaned up');
      }

      return result.count;
    } catch (error) {
      logger.error({
        operationType: 'DATABASE',
        metadata: { error: error instanceof Error ? error.message : String(error) },
      }, 'Failed to cleanup expired reset tokens');
      return 0;
    }
  }
}

export const passwordResetService = new PasswordResetService();
export default passwordResetService;