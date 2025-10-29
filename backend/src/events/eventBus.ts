/**
 * @file eventBus.ts
 *
 * @description
 * UJAMAADAO Enhanced Process-Local Event Bus for Domain Events
 *
 * Comprehensive event bus for the UJAMAADAO platform that provides:
 * - Domain event publishing/subscription with UJAMAADAO context
 * - Geographic event propagation and filtering
 * - Economic system transaction event tracking
 * - Progressive verification workflow events
 * - Community governance event coordination
 * - Enhanced event metadata and context preservation
 *
 * UJAMAADAO SPECIFIC ENHANCEMENTS:
 * - Geographic context in all domain events
 * - Economic system transaction events
 * - Verification workflow progression events
 * - Community governance decision events
 * - Location-based event routing and filtering
 * - Enhanced event metadata for platform operations
 *
 * Event Categories:
 * - USER: User lifecycle and profile events
 * - GEOGRAPHIC: Location-based and hierarchy events
 * - ECONOMIC: Three-tier economic system events
 * - VERIFICATION: Progressive verification workflow events
 * - GOVERNANCE: Community governance and voting events
 * - SECURITY: Security and access control events
 * - SYSTEM: Platform infrastructure events
 *
 * Design Principles:
 * - Process-local for simplicity and testability
 * - Synchronous emission for immediate processing
 * - Extensible for future persistent queue integration
 * - Comprehensive event context preservation
 * - Type-safe event payload definitions
 */

import EventEmitter from 'events';
import logger from '../utils/logger.js'; // Assuming default export from logger.ts

// UJAMAADAO Event Bus Constants
export const DOMAIN_EVENTS = {
  // User Lifecycle Events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_VERIFIED: 'user.verified',
  USER_DEACTIVATED: 'user.deactivated',

  // Geographic Events
  GEOGRAPHIC_CONTEXT_UPDATED: 'geographic.context.updated',
  WARD_MEMBERSHIP_CHANGED: 'ward.membership.changed',
  CONSTITUENCY_MEMBERSHIP_CHANGED: 'constituency.membership.changed',
  COUNTY_MEMBERSHIP_CHANGED: 'county.membership.changed',

  // Economic System Events
  IMPACT_POINTS_AWARDED: 'impact.points.awarded',
  UTILITY_TOKENS_TRANSFERRED: 'utility.tokens.transferred',
  PARTICIPATION_RIGHTS_UPDATED: 'participation.rights.updated',
  ECONOMIC_TIER_CHANGED: 'economic.tier.changed',

  // Verification Events
  PHONE_VERIFICATION_INITIATED: 'phone.verification.initiated',
  PHONE_VERIFICATION_COMPLETED: 'phone.verification.completed',
  COMMUNITY_VERIFICATION_COMPLETED: 'community.verification.completed',
  LOCATION_VERIFICATION_COMPLETED: 'location.verification.completed',
  VERIFICATION_LEVEL_CHANGED: 'verification.level.changed',

  // Governance Events
  PROPOSAL_CREATED: 'proposal.created',
  PROPOSAL_VOTING_STARTED: 'proposal.voting.started',
  PROPOSAL_VOTING_ENDED: 'proposal.voting.ended',
  VOTE_CAST: 'vote.cast',
  GOVERNANCE_DECISION_MADE: 'governance.decision.made',

  // Security Events
  AUTHENTICATION_SUCCESS: 'authentication.success',
  AUTHENTICATION_FAILED: 'authentication.failed',
  ACCESS_CONTROL_VIOLATION: 'access.control.violation',
  GEOGRAPHIC_ACCESS_VIOLATION: 'geographic.access.violation',
  ECONOMIC_SYSTEM_VIOLATION: 'economic.system.violation',

  // System Events
  METRICS_COLLECTED: 'metrics.collected',
  SYSTEM_HEALTH_CHECK: 'system.health.check',
  MAINTENANCE_MODE_CHANGED: 'maintenance.mode.changed'
} as const;

// UJAMAADAO Event Payload Types
export interface UjamaadaoEventPayload {
  /**
   * Fields supplied automatically by the EventBus publisher,
   * made optional here for cleaner service-layer consumption.
   */
  eventId?: string;
  timestamp?: Date;
  version?: string;

  source: string; // MANDATORY for all events
  metadata?: Record<string, any>;
}

export interface UserEventPayload extends UjamaadaoEventPayload {
  userId: string;
  walletAddress?: string;
  verificationLevel?: string;
  geographicContext?: {
    primaryWardId?: string;
    constituencyId?: string;
    countyId?: string;
    locationScope?: string;
  };
  
  // Custom fields added to support user.service.ts payload
  email?: string;
  economicSetup?: any; // Accepting 'any' for the complex economic setup object
  updatedFields?: string[]; // For user.updated event
  changedBy?: string; // For user.updated event
}

export interface GeographicEventPayload extends UjamaadaoEventPayload {
  geographicLevel: 'WARD' | 'CONSTITUENCY' | 'COUNTY' | 'NATIONAL';
  geographicId: string;
  affectedUsers?: string[];
  hierarchyContext?: {
    wardId?: string;
    constituencyId?: string;
    countyId?: string;
  };
}

export interface EconomicEventPayload extends UjamaadaoEventPayload {
  transactionType: string;
  amount: number;
  currency?: string;
  fromUserId?: string;
  toUserId?: string;
  economicTier?: string;
  impactPoints?: number;
  utilityTokens?: number;
  participationRights?: number;
}

export interface VerificationEventPayload extends UjamaadaoEventPayload {
  userId: string;
  verificationType: 'PHONE' | 'COMMUNITY' | 'LOCATION' | 'EMAIL'; // Added 'EMAIL'
  previousLevel?: string;
  newLevel?: string; // Used for new verification level string
  verificationData?: Record<string, any>;
  
  // Custom fields added to support user.service.ts payload
  economicAccessGranted?: boolean;
  impactPointsAwarded?: number;
}

export interface GovernanceEventPayload extends UjamaadaoEventPayload {
  proposalId?: string;
  voteId?: string;
  geographicScope: string;
  decisionType: string;
  votingResults?: Record<string, any>;
  participationMetrics?: {
    totalVoters: number;
    participationRate: number;
    votingWeightUsed: number;
  };
}

export interface SecurityEventPayload extends UjamaadaoEventPayload {
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  violationDetails?: Record<string, any>;
}

// Event Handler Type Definitions
type EventHandler<T = any> = (payload: T) => void | Promise<void>;
type EventFilter = (payload: any) => boolean;

// UJAMAADAO Enhanced Event Bus
const INTERNAL_BUS = new EventEmitter();
INTERNAL_BUS.setMaxListeners(100); // Allow sufficient listeners for platform events

/**
 * UJAMAADAO Enhanced Event Bus
 *
 * Comprehensive event bus with geographic context, economic system integration,
 * and progressive verification support for the community governance platform.
 */
export const EventBus = {
  DOMAIN_EVENTS,

  /**
   * Publish a UJAMAADAO domain event with comprehensive context
   *
   * @param eventName - UJAMAADAO domain event identifier
   * @param payload - Event payload with platform context
   * @param options - Publishing options for event handling
   */
  publish<T extends UjamaadaoEventPayload>(
    eventName: string,
    payload: T,
    options: {
      asyncHandling?: boolean;
      errorHandling?: 'throw' | 'log' | 'ignore';
      geographicFilter?: string;
    } = {}
  ) {
    const eventId = `${eventName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // --- CRITICAL: The EventBus automatically populates the required fields ---
    const enhancedPayload = {
      ...payload,
      eventId,
      timestamp: new Date(),
      version: '1.0.0'
    };
    // --------------------------------------------------------------------------

    logger.debug(`UJAMAADAO EventBus: Publishing event [${eventName}]`, {
      userId: (payload as any).userId,
      geographicContext: (payload as any).geographicContext,
      metadata: {
        eventName,
        eventId,
      }
    });

    try {
      if (options.asyncHandling) {
        // Non-blocking event emission
        setImmediate(() => {
          INTERNAL_BUS.emit(eventName, enhancedPayload);
        });
      } else {
        // Synchronous event emission (default)
        INTERNAL_BUS.emit(eventName, enhancedPayload);
      }

      // Emit wildcard event for global listeners
      INTERNAL_BUS.emit('*', { eventName, payload: enhancedPayload });

    } catch (error) {
      logger.error('UJAMAADAO EventBus: Event publication failed', {
        metadata: {
          eventName,
          eventId,
          error: error instanceof Error ? error.message : String(error)
        }
      });

      if (options.errorHandling === 'throw') {
        throw error;
      }
    }
  },

  /**
   * Subscribe to UJAMAADAO domain events with enhanced filtering
   *
   * @param eventName - Event name or pattern to subscribe to
   * @param handler - Event handler function
   * @param options - Subscription options for filtering and context
   * @returns Unsubscribe function
   */
  subscribe<T = any>(
    eventName: string | string[],
    handler: EventHandler<T>,
    options: {
      filter?: EventFilter;
      geographicScope?: string;
      once?: boolean;
      context?: string;
    } = {}
  ): () => void {
    const eventNames = Array.isArray(eventName) ? eventName : [eventName];
    const names = Array.isArray(eventName) ? eventName : [eventName]; // Use `names` internally for clarity
    const wrappedHandler = (payload: T) => {
      try {
        // Apply geographic filtering if specified
        if (options.geographicScope && (payload as any).geographicContext) {
          const eventScope = (payload as any).geographicContext?.locationScope;
          if (eventScope && eventScope !== options.geographicScope) {
            return; // Skip events outside geographic scope
          }
        }

        // Apply custom filter if provided
        if (options.filter && !options.filter(payload)) {
          return; // Skip events that don't match filter
        }

        // Execute handler
        if (options.once) {
          this.unsubscribe(names, wrappedHandler); // Use wrappedHandler for correct removal
        }

        const result = handler(payload);

        // Handle async handlers
        if (result instanceof Promise) {
          result.catch(error => {
            logger.error('UJAMAADAO EventBus: Async handler failed', {
              metadata: {
                eventNames: names.join(','),
                error: error.message,
                context: options.context
              }
            });
          });
        }

      } catch (error) {
        logger.error('UJAMAADAO EventBus: Handler execution failed', {
          metadata: {
            eventNames: names.join(','),
            error: error instanceof Error ? error.message : String(error),
            context: options.context
          }
        });
      }
    };

    // Subscribe to all specified events
    eventNames.forEach(name => {
      if (options.once) {
        INTERNAL_BUS.once(name, wrappedHandler);
      } else {
        INTERNAL_BUS.on(name, wrappedHandler);
      }
    });

    logger.debug('UJAMAADAO EventBus: Subscribed to events', {
      metadata: {
        eventNames: eventNames.join(','),
        context: options.context,
        hasFilter: !!options.filter,
        geographicScope: options.geographicScope
      }
    });

    // Return unsubscribe function
    return () => this.unsubscribe(eventNames, wrappedHandler);
  },

  /**
   * Unsubscribe from specific events
   */
  unsubscribe(eventNames: string | string[], handler: EventHandler) {
    const names = Array.isArray(eventNames) ? eventNames : [eventNames];
    names.forEach(name => {
      INTERNAL_BUS.off(name, handler);
    });
  },

  /**
   * Subscribe to all UJAMAADAO domain events (wildcard)
   */
  subscribeToAll(handler: EventHandler<{ eventName: string; payload: any }>) {
    INTERNAL_BUS.on('*', handler);
    return () => INTERNAL_BUS.off('*', handler);
  },

  /**
   * Remove all listeners for specific events or all events
   */
  clearListeners(eventName?: string) {
    if (eventName) {
      INTERNAL_BUS.removeAllListeners(eventName);
      logger.debug('UJAMAADAO EventBus: Cleared listeners for event', { metadata: { eventName } });
    } else {
      INTERNAL_BUS.removeAllListeners();
      logger.debug('UJAMAADAO EventBus: Cleared all listeners');
    }
  },

  /**
   * Get listener count for specific event
   */
  getListenerCount(eventName: string): number {
    return INTERNAL_BUS.listenerCount(eventName);
  },

  /**
   * Get all registered event names
   */
  getEventNames(): string[] {
    return INTERNAL_BUS.eventNames().map(name => name.toString());
  },

  /**
   * UJAMAADAO Specific Event Publishing Helpers
   */

  /**
   * Publish user lifecycle event with geographic context
   */
  publishUserEvent(
    eventName: string,
    payload: UserEventPayload,
    options?: { asyncHandling?: boolean }
  ) {
    this.publish(eventName, payload, options);
  },

  /**
   * Publish geographic event with hierarchy context
   */
  publishGeographicEvent(
    eventName: string,
    payload: GeographicEventPayload,
    options?: { asyncHandling?: boolean }
  ) {
    this.publish(eventName, payload, options);
  },

  /**
   * Publish economic system event
   */
  publishEconomicEvent(
    eventName: string,
    payload: EconomicEventPayload,
    options?: { asyncHandling?: boolean }
  ) {
    this.publish(eventName, payload, options);
  },

  /**
   * Publish verification workflow event
   */
  publishVerificationEvent(
    eventName: string,
    payload: VerificationEventPayload,
    options?: { asyncHandling?: boolean }
  ) {
    this.publish(eventName, payload, options);
  },

  /**
   * Publish governance event with participation metrics
   */
  publishGovernanceEvent(
    eventName: string,
    payload: GovernanceEventPayload,
    options?: { asyncHandling?: boolean }
  ) {
    this.publish(eventName, payload, options);
  },

  /**
   * Publish security event with severity classification
   */
  publishSecurityEvent(
    eventName: string,
    payload: SecurityEventPayload,
    options?: { errorHandling?: 'throw' | 'log' | 'ignore' }
  ) {
    this.publish(eventName, payload, { ...options, asyncHandling: true });
  },

  // Expose raw emitter for advanced usage (use sparingly)
  _emitter: INTERNAL_BUS,
};

/**
 * UJAMAADAO Event Bus Utility Functions
 */

/**
 * Create geographic event filter for location-based event handling
 */
export function createGeographicFilter(geographicScope: string): EventFilter {
  return (payload: any) => {
    const eventScope = payload.geographicContext?.locationScope;
    return eventScope === geographicScope;
  };
}

/**
 * Create economic event filter for tier-based event handling
 */
export function createEconomicTierFilter(tier: string): EventFilter {
  return (payload: any) => {
    const eventTier = payload.economicTier;
    return eventTier === tier;
  };
}

/**
 * Create verification event filter for level-based event handling
 */
export function createVerificationFilter(level: string): EventFilter {
  return (payload: any) => {
    const eventLevel = payload.verificationLevel || payload.newLevel;
    return eventLevel === level;
  };
}

/**
 * Event Bus Initialization and Health Monitoring
 */

// Monitor event bus health and performance
INTERNAL_BUS.on('error', (error) => {
  logger.error('UJAMAADAO EventBus: Internal error', {
    metadata: {
      error: error instanceof Error ? error.message : String(error)
    }
  });
});

// Periodically report event bus statistics
setInterval(() => {
  const eventCounts = EventBus.getEventNames().reduce((acc, eventName) => {
    acc[eventName] = EventBus.getListenerCount(eventName);
    return acc;
  }, {} as Record<string, number>);

  logger.debug('UJAMAADAO EventBus: Health check', {
    metadata: {
      totalEvents: EventBus.getEventNames().length,
      listenerCounts: eventCounts,
      timestamp: new Date().toISOString()
    }
  });
}, 300000); // Every 5 minutes

export default EventBus;
