/**
 * @file ApiError.ts
 *
 * @description
 * Custom error class for API errors, extending the native Error.
 * Includes HTTP status code for better error handling in API responses.
 */

export class ApiError extends Error {
  statusCode: number;

  /**
   * Constructs an ApiError instance.
   * 
   * @param message - Error message
   * @param statusCode - HTTP status code (default: 400)
   */
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}