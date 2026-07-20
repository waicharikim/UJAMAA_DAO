/**
 * @file src/core/utils/eventBus.ts
 * @description
 * UJAMAADAO EVENT BUS
 * In-process pub/sub — simple, fast, type-safe
 * Used for auth.login, user.created, reputation.awarded, etc.
 *
 * Security Features:
 * - Event validation
 * - Listener limits (prevent memory leaks)
 * - Error isolation
 * - Timeout protection
 * - Logging integration
 *
 * Version: 2.0 — December 2025
 * Security Hardened: December 2025
 */

import { logger } from '../logger/logger.js';
import { autoRedactObject, containsPII } from '../logger/log-sanitizer.js';

type Listener<T = any> = (payload: T) => void | Promise<void>;

// Security constants
const MAX_LISTENERS_PER_EVENT = 100; // Prevent memory leaks
const LISTENER_TIMEOUT_MS = 30000; // 30s timeout for async listeners
const MAX_EVENT_NAME_LENGTH = 100; // Prevent DoS

/**
 * Allowed event patterns (whitelist for security)
 * Prevents arbitrary event injection
 */
const ALLOWED_EVENT_PATTERNS = [
  /^auth\./, // auth.login, auth.logout, auth.refresh
  /^user\./, // user.created, user.updated, user.deleted
  /^reputation\./, // reputation.awarded, reputation.revoked
  /^governance\./, // governance.proposal.created, governance.vote.cast
  /^economic\./, // economic.transfer, economic.reward
  /^geographic\./, // geographic.location.updated
  /^wallet\./, // wallet.connected, wallet.signed
  /^security\./, // security.breach, security.alert
  /^system\./, // system.startup, system.shutdown
];

/**
 * Validate event name against whitelist
 */
function isValidEventName(event: string): boolean {
  if (!event || typeof event !== 'string') return false;
  if (event.length > MAX_EVENT_NAME_LENGTH) return false;

  return ALLOWED_EVENT_PATTERNS.some((pattern) => pattern.test(event));
}

/**
 * Execute listener with timeout protection
 */
async function executeWithTimeout<T>(
  listener: Listener<T>,
  payload: T,
  timeout: number
): Promise<void> {
  return Promise.race([
    Promise.resolve(listener(payload)),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Listener timeout')), timeout)
    ),
  ]);
}

class EventBus {
  private listeners = new Map<string, Set<Listener>>();
  private eventCounts = new Map<string, number>(); // Track emissions for monitoring

  /**
   * Subscribe to an event
   */
  on<T = any>(event: string, listener: Listener<T>): void {
    // Validate event name
    if (!isValidEventName(event)) {
      logger.warn(
        {
          operationType: 'SECURITY',
          metadata: { event, reason: 'Invalid event name pattern' },
        },
        'EventBus: Invalid event name rejected'
      );
      throw new Error(`Invalid event name: ${event}`);
    }

    // Validate listener is a function
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }

    // Check listener limit (prevent memory leaks)
    const existingListeners = this.listeners.get(event);
    if (
      existingListeners &&
      existingListeners.size >= MAX_LISTENERS_PER_EVENT
    ) {
      logger.warn(
        {
          operationType: 'SYSTEM_ANOMALY',
          metadata: {
            event,
            currentListeners: existingListeners.size,
            maxAllowed: MAX_LISTENERS_PER_EVENT,
          },
        },
        'EventBus: Max listeners reached'
      );
      throw new Error(
        `Max listeners (${MAX_LISTENERS_PER_EVENT}) reached for event: ${event}`
      );
    }

    // Register listener
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    logger.debug(
      {
        operationType: 'GENERAL',
        metadata: {
          event,
          listenerCount: this.listeners.get(event)!.size,
        },
      },
      'EventBus: Listener registered'
    );
  }

  /**
   * Unsubscribe from an event
   */
  off<T = any>(event: string, listener: Listener<T>): void {
    const removed = this.listeners.get(event)?.delete(listener);

    if (removed) {
      logger.debug(
        {
          operationType: 'GENERAL',
          metadata: {
            event,
            remainingListeners: this.listeners.get(event)?.size || 0,
          },
        },
        'EventBus: Listener unregistered'
      );
    }

    // Clean up empty event sets
    if (this.listeners.get(event)?.size === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emit event and await all listeners (sequential)
   */
  async emit<T = any>(event: string, payload?: T): Promise<void> {
    // Validate event name
    if (!isValidEventName(event)) {
      logger.warn(
        {
          operationType: 'SECURITY',
          metadata: { event, reason: 'Invalid event name' },
        },
        'EventBus: Emit rejected - invalid event name'
      );
      return;
    }

    const listeners = this.listeners.get(event);
    if (!listeners?.size) {
      logger.debug(
        {
          operationType: 'GENERAL',
          metadata: { event, reason: 'No listeners' },
        },
        'EventBus: Event emitted with no listeners'
      );
      return;
    }

    // Track event emissions
    this.eventCounts.set(event, (this.eventCounts.get(event) || 0) + 1);

    // Sanitize payload for logging
    const safePayload =
      payload && containsPII(payload) ? autoRedactObject(payload) : payload;

    logger.debug(
      {
        operationType: 'GENERAL',
        metadata: {
          event,
          listenerCount: listeners.size,
          ...(process.env.LOG_LEVEL === 'debug' && { payload: safePayload }),
        },
      },
      'EventBus: Emitting event'
    );

    let successCount = 0;
    let errorCount = 0;

    // Execute all listeners with timeout protection
    for (const listener of listeners) {
      try {
        await executeWithTimeout(listener, payload as any, LISTENER_TIMEOUT_MS);
        successCount++;
      } catch (error) {
        errorCount++;

        logger.error(
          {
            operationType: 'SYSTEM_ANOMALY',
            metadata: {
              event,
              error: error instanceof Error ? error.message : String(error),
              isTimeout:
                error instanceof Error && error.message === 'Listener timeout',
            },
          },
          `EventBus: Listener error for ${event}`
        );
      }
    }

    // Log summary for events with errors
    if (errorCount > 0) {
      logger.warn(
        {
          operationType: 'GENERAL',
          metadata: {
            event,
            successCount,
            errorCount,
            totalListeners: listeners.size,
          },
        },
        'EventBus: Event completed with errors'
      );
    }
  }

  /**
   * Fire-and-forget event emission
   * Does not wait for listeners, does not throw errors
   */
  publish<T = any>(event: string, payload?: T): void {
    this.emit(event, payload).catch((error) => {
      // Silent failure for fire-and-forget
      logger.debug(
        {
          operationType: 'GENERAL',
          metadata: {
            event,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'EventBus: Publish error (fire-and-forget)'
      );
    });
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
      logger.info(
        {
          operationType: 'GENERAL',
          metadata: { event },
        },
        'EventBus: All listeners removed for event'
      );
    } else {
      this.listeners.clear();
      this.eventCounts.clear();
      logger.info(
        {
          operationType: 'GENERAL',
        },
        'EventBus: All listeners removed'
      );
    }
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }

  /**
   * Get all registered events
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Get event emission statistics
   */
  getStats(): { event: string; listeners: number; emissions: number }[] {
    return Array.from(this.listeners.keys()).map((event) => ({
      event,
      listeners: this.listeners.get(event)?.size || 0,
      emissions: this.eventCounts.get(event) || 0,
    }));
  }

  /**
   * Reset emission counters
   */
  resetStats(): void {
    this.eventCounts.clear();
  }
}

// Export singleton instance
export const eventBus = new EventBus();

// Export class for testing
export { EventBus };

export default eventBus;
