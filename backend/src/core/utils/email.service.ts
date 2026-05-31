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
import { Resend } from 'resend';
import { logger } from '../logger/logger.js';
import { ApiError } from '../errors/ApiError.js';

const FROM_EMAIL =
  process.env.FROM_EMAIL || process.env.SMTP_FROM || 'noreply@ujamaadao.org';
const FROM_NAME = process.env.FROM_NAME || 'UjamaaDAO';

// ── Resend HTTP API (preferred in prod — bypasses SMTP port blocks) ──────────
const resendApiKey = process.env.RESEND_API_KEY;
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

// ── Nodemailer SMTP (dev / MailHog fallback) ─────────────────────────────────
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASSWORD;
const hasAuth = !!(smtpUser && smtpPass);

const EMAIL_CONFIG: nodemailer.TransportOptions = {
  host: process.env.SMTP_HOST || 'mailhog',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: process.env.SMTP_SECURE === 'true',
  ...(hasAuth ? { auth: { user: smtpUser, pass: smtpPass } } : {}),
} as nodemailer.TransportOptions;

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    if (!hasAuth) {
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
 * Send email — uses Resend HTTP API when RESEND_API_KEY is set, SMTP otherwise.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const to = Array.isArray(options.to) ? options.to : [options.to];
  try {
    if (resendClient) {
      const payload: Record<string, unknown> = {
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to,
        subject: options.subject,
      };
      if (options.html) payload.html = options.html;
      if (options.text) payload.text = options.text;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await resendClient.emails.send(payload as any);
      if (error) throw new Error(error.message);
      logger.info(
        {
          operationType: 'GENERAL',
          metadata: { to, subject: options.subject },
        },
        'Email sent via Resend'
      );
    } else {
      const transport = getTransporter();
      const info = await transport.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: to.join(', '),
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });
      logger.info(
        {
          operationType: 'GENERAL',
          metadata: { messageId: info.messageId, to, subject: options.subject },
        },
        'Email sent via SMTP'
      );
    }
  } catch (error) {
    logger.error(
      {
        operationType: 'GENERAL',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          to,
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
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#F7F2E8;padding:40px 20px;margin:0">
  <div style="max-width:480px;margin:0 auto;background:#142F22;border-radius:16px;padding:40px;text-align:center">
    <h2 style="color:#F7F2E8;font-size:22px;margin:0 0 8px">Karibu UjamaaDAO, ${name}!</h2>
    <p style="color:rgba(247,242,232,0.65);font-size:15px;margin:0 0 32px">Thank you for joining. Click the button below to verify your email address. This link expires in 24 hours.</p>
    <a href="${verificationLink}" style="display:inline-block;background:#D4911E;color:#142F22;font-weight:700;font-size:15px;padding:14px 36px;border-radius:50px;text-decoration:none">Verify Email</a>
    <p style="color:rgba(247,242,232,0.35);font-size:12px;margin:32px 0 0">If you didn't sign up for UjamaaDAO, you can safely ignore this email.</p>
  </div>
</body>
</html>`,
    text: `Karibu UjamaaDAO, ${name}!\n\nVerify your email here: ${verificationLink}\n\nExpires in 24 hours. If you didn't sign up, ignore this.`,
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
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#F7F2E8;padding:40px 20px;margin:0">
  <div style="max-width:480px;margin:0 auto;background:#142F22;border-radius:16px;padding:40px;text-align:center">
    <h2 style="color:#F7F2E8;font-size:22px;margin:0 0 8px">Karibu tena, ${name}!</h2>
    <p style="color:rgba(247,242,232,0.65);font-size:15px;margin:0 0 32px">Click the button below to sign in to UjamaaDAO. This link expires in 15 minutes.</p>
    <a href="${loginLink}" style="display:inline-block;background:#D4911E;color:#142F22;font-weight:700;font-size:15px;padding:14px 36px;border-radius:50px;text-decoration:none">Sign In to UjamaaDAO</a>
    <p style="color:rgba(247,242,232,0.35);font-size:12px;margin:32px 0 0">If you didn't request this, you can safely ignore it.</p>
  </div>
</body>
</html>`,
    text: `Karibu tena, ${name}!\n\nSign in here: ${loginLink}\n\nExpires in 15 minutes. If you didn't request this, ignore it.`,
  });
}

/**
 * Verify email configuration on app startup.
 * Resend: no network check needed — API key presence is sufficient.
 * SMTP: calls transport.verify() to confirm connectivity.
 */
export async function verifyEmailConfig(): Promise<boolean> {
  if (resendClient) {
    logger.info(
      { operationType: 'GENERAL' },
      'Email service configured (Resend HTTP API)'
    );
    return true;
  }
  try {
    const transport = getTransporter();
    await transport.verify();
    logger.info(
      { operationType: 'GENERAL' },
      'Email service configured (SMTP)'
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
