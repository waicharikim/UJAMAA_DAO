/**
 * @file src/core/errors/BaseError.ts
 * @description
 * Base class for all internal errors in UjamaaDAO
 * PII-safe, production-ready
 *
 * Version: 2.0 — December 2025
 * Security Hardened: December 2025
 */

import { autoRedactObject, containsPII } from '../logger/log-sanitizer.js';

export interface BaseErrorOptions {
  statusCode?: number;
  code?: string;
  details?: Record<string, any>;
  correlationId?: string;
  cause?: Error;
}

export class BaseError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: Record<string, any>;
  public readonly correlationId?: string;
  public readonly timestamp: Date;
  public readonly cause?: Error;

  constructor(message: string, statusCode = 500, options?: BaseErrorOptions) {
    // Truncate long messages (prevent log flooding)
    super(message.slice(0, 500));

    // Validate status code
    this.statusCode = this.validateStatusCode(statusCode);
    this.timestamp = new Date();

    if (options) {
      this.code = options.code;

      // Sanitize details if they contain PII
      this.details =
        options.details && containsPII(options.details)
          ? autoRedactObject(options.details)
          : options.details;

      this.correlationId = options.correlationId;
      this.cause = options.cause;
    }

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace (excluding constructor)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Validate and correct invalid status codes
   */
  private validateStatusCode(code: number): number {
    if (typeof code !== 'number' || code < 100 || code >= 600) {
      console.warn(
        `[BaseError] Invalid status code ${code}, defaulting to 500`
      );
      return 500;
    }
    return code;
  }

  /**
   * Convert error to JSON for logging and responses
   * NEVER includes stack traces in production
   */
  toJSON() {
    const json: Record<string, any> = {
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      correlationId: this.correlationId,
      timestamp: this.timestamp.toISOString(),
    };

    // Include details only if safe
    if (this.details) {
      // In production, hide details for server errors (5xx)
      if (process.env.NODE_ENV === 'production' && this.statusCode >= 500) {
        // Don't include details for server errors in production
      } else {
        json.details = this.details;
      }
    }

    // Include cause message (but not full cause object)
    if (this.cause?.message) {
      json.causeMessage = this.cause.message.slice(0, 200);
    }

    // Stack traces ONLY in development
    if (process.env.NODE_ENV === 'development') {
      json.stack = this.stack;

      // Include full cause in development
      if (this.cause) {
        json.causeStack = this.cause.stack;
      }
    }

    return json;
  }

  /**
   * Convert error to safe string for logging
   */
  toString(): string {
    return `[${this.code || 'ERROR'}] ${this.message} (Status: ${this.statusCode})`;
  }

  /**
   * Get a sanitized version suitable for client responses
   */
  toClientJSON() {
    return {
      message: this.message,
      code: this.code,
      correlationId: this.correlationId,
      // Never include details, cause, or stack for clients
    };
  }

  /**
   * Create BaseError from any error type
   */
  static fromError(
    err: unknown,
    overrides?: Partial<BaseErrorOptions>
  ): BaseError {
    if (err instanceof BaseError) return err;

    // Extract message safely
    let message = 'Unknown error';
    if (err instanceof Error) {
      message = err.message;
    } else if (typeof err === 'string') {
      message = err;
    } else if (err && typeof err === 'object' && 'message' in err) {
      message = String((err as any).message);
    }

    // Truncate and sanitize message
    message = message.slice(0, 500);

    return new BaseError(message, overrides?.statusCode || 500, {
      code: overrides?.code || 'SYSTEM_ERROR',
      details: overrides?.details,
      correlationId: overrides?.correlationId,
      cause: err instanceof Error ? err : undefined,
    });
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.statusCode >= 500 && this.statusCode < 600;
  }

  /**
   * Check if error should be logged at error level (vs warn)
   */
  shouldLogAsError(): boolean {
    return this.isServerError();
  }
}

export default BaseError;
