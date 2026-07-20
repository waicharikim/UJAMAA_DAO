/**
 * @file src/modules/integration/listeners/integration-events.listener.ts
 * @description
 * Integration event listeners — sends baraza invites when a user verifies their email.
 */

import { eventBus } from '../../../core/utils/eventBus.js';
import { logger } from '../../../core/logger/logger.js';
import { barazaBotService } from '../services/baraza-bot.service.js';

export function registerIntegrationListeners(): void {
  // When a user verifies their email, send invite links for any existing baraza groups
  // in the user's ward(s) that match their platform preferences.
  eventBus.on('user.email.verified', async (payload: { userId: string }) => {
    const { userId } = payload;
    try {
      await barazaBotService.sendInvitesToUser(userId);
    } catch (err) {
      logger.warn(
        { operationType: 'INTEGRATION', userId, error: String(err) },
        '[Integration] Failed to send baraza invites on email verification — non-fatal'
      );
    }
  });
}
