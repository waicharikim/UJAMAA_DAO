/**
 * @file smsProvider.ts
 * * @description
 * UJAMAADAO SMS Provider Service
 * * Handles SMS sending for verification and notifications
 */

import logger from '../utils/logger.js';

export class SMSProvider {
  /**
   * Send verification code via SMS
   * * @param phoneNumber - The phone number to send the code to
   * @param code - The 6-digit verification code
   */
  async sendVerificationCode(phoneNumber: string, code: string): Promise<void> {
    // In production, integrate with SMS gateway like Africa's Talking, Twilio, etc.
    // NOTE: All non-standard log properties (phoneNumber, code, provider) are wrapped
    // inside 'metadata' to comply with UjamaadaoLogContext in logger.ts.
    logger.info('UJAMAADAO SMS: Sending verification code', {
      operationType: 'VERIFICATION',
      metadata: {
        phoneNumber,
        code, // Warning: Remove this in production - only for development logging
        provider: 'MOCK_SMS_PROVIDER'
      }
    });

    // Mock implementation - replace with actual SMS provider
    console.log(`[SMS] To: ${phoneNumber}, Code: ${code}`);
    
    // Simulate SMS sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Send notification SMS
   * * @param phoneNumber - The phone number to send the notification to
   * @param message - The content of the notification message
   */
  async sendNotification(phoneNumber: string, message: string): Promise<void> {
    // NOTE: All non-standard log properties are wrapped inside 'metadata'.
    logger.info('UJAMAADAO SMS: Sending notification', {
      operationType: 'ECONOMIC', // Assuming notifications are often economic/governance related
      metadata: {
        phoneNumber,
        messageLength: message.length,
        provider: 'MOCK_SMS_PROVIDER'
      }
    });

    // Mock implementation
    console.log(`[SMS] To: ${phoneNumber}, Message: ${message}`);
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
