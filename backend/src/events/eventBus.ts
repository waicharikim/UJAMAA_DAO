/**
 * @file eventBus.ts
 *
 * @description
 * Minimal process-local event bus for domain events.
 * - Provides publish/subscribe abstraction so services can emit domain events
 *   (e.g., 'user.created', 'user.updated') without blocking request handlers.
 * - This is intentionally simple and in-memory to make testing easy and to
 *   decouple the rest of the app. In production you can replace this with
 *   a persistent queue (BullMQ/Redis, RabbitMQ, etc.) by swapping this module.
 */

import EventEmitter from 'events';

const INTERNAL_BUS = new EventEmitter();

/**
 * Publish a domain event.
 * - eventName: string identifier, e.g., 'user.created'
 * - payload: arbitrary serializable object
 *
 * Note: Publishing is synchronous on this process-local EventEmitter.
 * Background workers can subscribe and offload heavy work to queues.
 */
export const EventBus = {
  publish(eventName, payload) {
    INTERNAL_BUS.emit(eventName, payload);
  },

  /**
   * Subscribe to a domain event.
   * - handler will receive the event payload.
   * Returns a function to unsubscribe (convenience).
   */
  subscribe(eventName, handler) {
    INTERNAL_BUS.on(eventName, handler);
    return () => INTERNAL_BUS.off(eventName, handler);
  },

  /**
   * For tests and graceful shutdown: remove all listeners for an event.
   */
  clearListeners(eventName) {
    INTERNAL_BUS.removeAllListeners(eventName);
  },

  // Expose raw emitter for advanced usages (use sparingly)
  _emitter: INTERNAL_BUS,
};

export default EventBus;