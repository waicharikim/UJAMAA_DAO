/**
 * @file email.service.ts
 *
 * @description
 * Service responsible for sending verification emails.
 * Integrates with notification.service to dispatch email notifications.
 * Currently logs the email content as a placeholder.
 */

import { dispatchNotification } from './notification.service.js';

/**
 * Sends a verification email with a tokenized verification URL.
 *
 * @param email - Recipient's email address
 * @param token - Email verification token
 */
export async function sendVerificationEmail(email: string, token: string) {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  // TODO: Replace this with actual email provider integration (e.g., SendGrid, SES)
  await dispatchNotification(email, 'email', 'verification', { email, token });

  console.log(`Sending verification email to ${email} with link: ${verificationUrl}`);  
}