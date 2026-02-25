/**
 * @file src/core/utils/email.service.ts
 * @description
 * Email Service for UjamaaDAO — Passwordless Authentication
 *
 * Handles all outbound email operations:
 * - Verification magic links
 * - Login magic links
 * - Future: PR warnings, dues reminders, notifications
 *
 * Uses Nodemailer with SMTP. Configured via .env.
 * Integrates with logger and error system.
 *
 * Version: 2.0 — Aligned with December 2025 spec
 */

import nodemailer from 'nodemailer';
import { logger } from '../logger/logger.js';
import { ApiError } from '../errors/ApiError.js';

// Email configuration from environment variables
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASSWORD;
const hasAuth = !!(smtpUser && smtpPass);

const EMAIL_CONFIG: nodemailer.TransportOptions = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  ...(hasAuth ? { auth: { user: smtpUser, pass: smtpPass } } : {}),
} as nodemailer.TransportOptions;

const FROM_EMAIL =
  process.env.FROM_EMAIL || process.env.SMTP_FROM || 'noreply@ujamaadao.org';
const FROM_NAME = process.env.FROM_NAME || 'UjamaaDAO';

// Reusable transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    if (!hasAuth) {
      // No-auth SMTP (e.g. MailHog in dev). Log a warning but proceed.
      logger.warn(
        { operationType: 'GENERAL' },
        'Email service running without SMTP auth — suitable for dev/MailHog only'
      );
    }
    transporter = nodemailer.createTransport(EMAIL_CONFIG);
  }
  return transporter;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: string;
  }>;
}

/**
 * Send email using configured SMTP
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    const transport = getTransporter();

    const mailOptions = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    };

    const info = await transport.sendMail(mailOptions);

    logger.info(
      {
        operationType: 'GENERAL',
        metadata: {
          messageId: info.messageId,
          to: mailOptions.to,
          subject: options.subject,
        },
      },
      'Email sent successfully'
    );
  } catch (error) {
    logger.error(
      {
        operationType: 'GENERAL',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          to: options.to,
          subject: options.subject,
        },
      },
      'Failed to send email'
    );

    throw ApiError.systemError('Failed to send email', {
      original: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Send verification magic link (onboarding)
 */
export async function sendVerificationEmail(
  to: string,
  name: string,
  verificationLink: string
): Promise<void> {
  await sendEmail({
    to,
    subject: 'Welcome to UjamaaDAO - Verify Your Email',
    html: `<!-- [Your beautiful HTML template from before] -->`,
    text: `
      Karibu UjamaaDAO, ${name}!
      
      Thank you for joining UjamaaDAO.
      
      Click this link to verify your email: ${verificationLink}
      
      This link expires in 24 hours.
      
      If you didn't sign up, ignore this email.
    `,
  });
}

/**
 * Send login magic link
 */
export async function sendLoginEmail(
  to: string,
  name: string,
  loginLink: string
): Promise<void> {
  await sendEmail({
    to,
    subject: 'Your UjamaaDAO Login Link',
    html: `<!-- [Your beautiful login HTML template] -->`,
    text: `
      Karibu tena, ${name}!
      
      Click this link to log in: ${loginLink}
      
      Expires in 15 minutes.
      
      If you didn't request this, ignore.
    `,
  });
}

/**
 * Verify SMTP configuration on app startup
 */
export async function verifyEmailConfig(): Promise<boolean> {
  try {
    const transport = getTransporter();
    await transport.verify();
    logger.info(
      { operationType: 'GENERAL' },
      'Email service configured successfully'
    );
    return true;
  } catch (error) {
    logger.error(
      {
        operationType: 'GENERAL',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      },
      'Email service configuration failed'
    );
    return false;
  }
}
