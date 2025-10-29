/**
 * @file verification.validation.ts
 * 
 * @description
 * UJAMAADAO Verification Validation Schemas
 * 
 * Validation schemas for verification operations including:
 * - Phone verification
 * - Community verification
 * - Location verification
 * - Verification status checks
 */

import { z } from 'zod';

/**
 * Phone Verification Validation
 */
export const phoneVerificationSchema = {
  initiatePhoneVerification: z.object({
    body: z.object({
      phoneNumber: z.string()
        .min(10, 'Phone number must be at least 10 digits')
        .max(15, 'Phone number too long')
        .regex(/^\+?[0-9]\d{1,14}$/, 'Invalid phone number format')
    })
  }),

  completePhoneVerification: z.object({
    body: z.object({
      verificationId: z.string().uuid('Invalid verification ID format'),
      code: z.string()
        .length(6, 'Verification code must be 6 digits')
        .regex(/^\d+$/, 'Verification code must contain only digits')
    })
  }),

  resendPhoneVerification: z.object({
    body: z.object({
      phoneNumber: z.string()
        .min(10, 'Phone number must be at least 10 digits')
        .max(15, 'Phone number too long')
        .regex(/^\+?[0-9]\d{1,14}$/, 'Invalid phone number format')
    })
  })
};

/**
 * Community Verification Validation
 */
export const communityVerificationSchema = {
  initiateCommunityVerification: z.object({
    body: z.object({
      verifierIds: z.array(z.string().uuid('Invalid verifier ID format'))
        .min(2, 'At least 2 verifiers required')
        .max(10, 'Maximum 10 verifiers allowed')
    })
  }),

  submitCommunityVerificationVote: z.object({
    body: z.object({
      verificationId: z.string().uuid('Invalid verification ID format'),
      approve: z.boolean()
    })
  })
};

/**
 * Location Verification Validation
 */
export const locationVerificationSchema = {
  verifyLocation: z.object({
    body: z.object({
      coordinates: z.object({
        latitude: z.number()
          .min(-90, 'Invalid latitude')
          .max(90, 'Invalid latitude'),
        longitude: z.number()
          .min(-180, 'Invalid longitude')
          .max(180, 'Invalid longitude')
      }),
      wardId: z.string().uuid('Invalid ward ID format'),
      evidence: z.string().url('Invalid evidence URL').optional()
    })
  })
};

/**
 * Verification Status Validation
 */
export const verificationStatusSchema = {
  getVerificationStatus: z.object({}), // No params/body needed
  
  getUserVerificationStatus: z.object({
    params: z.object({
      userId: z.string().uuid('Invalid user ID format')
    })
  })
};

/**
 * Combined validation schemas
 */
export const verificationValidations = {
  ...phoneVerificationSchema,
  ...communityVerificationSchema,
  ...locationVerificationSchema,
  ...verificationStatusSchema
};

/**
 * Custom validators for verification
 */
export const verificationValidators = {
  /**
   * Validate phone number format for specific regions
   */
  validatePhoneNumber: (phoneNumber: string, countryCode: string = 'KE'): boolean => {
    const patterns = {
      'KE': /^(?:\+254|0)[17]\d{8}$/, // Kenya phone numbers
      'default': /^\+?[1-9]\d{1,14}$/
    };

    const pattern = patterns[countryCode as keyof typeof patterns] || patterns.default;
    return pattern.test(phoneNumber);
  },

  /**
   * Validate coordinates are within reasonable bounds for the region
   */
  validateCoordinatesInRegion: (
    latitude: number, 
    longitude: number, 
    region: string = 'KE'
  ): boolean => {
    const bounds = {
      'KE': {
        minLat: -4.9, maxLat: 5.0,
        minLng: 33.9, maxLng: 41.9
      },
      'default': {
        minLat: -90, maxLat: 90,
        minLng: -180, maxLng: 180
      }
    };

    const regionBounds = bounds[region as keyof typeof bounds] || bounds.default;
    
    return (
      latitude >= regionBounds.minLat &&
      latitude <= regionBounds.maxLat &&
      longitude >= regionBounds.minLng &&
      longitude <= regionBounds.maxLng
    );
  }
};

export default verificationValidations;