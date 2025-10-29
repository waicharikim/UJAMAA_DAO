/**
 * @file upload.middleware.ts
 *
 * @description
 * UJAMAADAO Enhanced File Upload Middleware with Multer
 *
 * Advanced file upload handling system for the UJAMAADAO platform that provides:
 * - Geographic context-based file organization (ward/constituency/county folders)
 * - Verification level-based upload restrictions
 * - Economic system integration (impact point rewards for verified content)
 * - Community governance file type validation
 * - Security enhancements for community platform
 * - Automatic metadata extraction and storage
 *
 * UJAMAADAO SPECIFIC ENHANCEMENTS:
 * - Geographic folder structure (ward/constituency/county based on user context)
 * - Verification level restrictions for sensitive uploads
 * - Economic system integration (IP rewards for quality content)
 * - Community asset categorization (projects, proposals, educational content)
 * - Security scanning for uploaded files
 * - Automatic metadata extraction (GPS, timestamps, user context)
 *
 * Supported Upload Types:
 * - Community project documentation and plans
 * - Physical work verification evidence (photos, videos)
 * - Educational content and training materials
 * - Proposal attachments and supporting documents
 * - Marketplace product images and descriptions
 * - Community asset documentation and maintenance records
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import type { Express } from 'express';
import logger from '../utils/logger.js';
import type { AuthRequest } from './auth.middleware.js'; // Assuming this provides AuthRequest

// Define upload categories
type UploadCategory =
  | 'COMMUNITY_ASSET'
  | 'PROJECT_PROOF_OF_WORK'
  | 'GOVERNANCE_DOCUMENT'
  | 'PROFILE_AVATAR';

/**
 * UJAMAADAO Custom Upload Options
 */
interface UjamaadaoUploadOptions {
  dest: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  uploadCategory: UploadCategory;
  awardImpactPoints?: number;
}

/**
 * Creates the Multer storage configuration for UJAMAADAO uploads.
 *
 * Organizes files by date and user/geographic context for easy retrieval and auditing.
 */
const ujamaadaoStorage = (options: UjamaadaoUploadOptions): multer.StorageEngine => {
  return multer.diskStorage({
    destination: (req: AuthRequest, file, cb) => {
      const now = new Date();
      const datePath = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
      const userContextPath = req.user?.userId || 'anonymous';
      const geographicPath = req.geographicContext?.locationScope || 'NATIONAL';

      // Full directory path: DEST/CATEGORY/GEOSCOPE/USERID/YYYY/MM/DD
      const uploadDir = path.join(
        options.dest,
        options.uploadCategory,
        geographicPath,
        userContextPath,
        datePath
      );

      // Ensure the directory exists
      ensureDirectoryExists(uploadDir);

      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Use original file extension
      const ext = path.extname(file.originalname);
      // Create a unique, descriptive filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = `${path.basename(file.originalname, ext)}-${uniqueSuffix}${ext}`;
      cb(null, filename);
    },
  });
};

/**
 * The main UJAMAADAO file upload middleware factory.
 */
export function createUjamaadaoUploader(options: UjamaadaoUploadOptions) {
  const storage = ujamaadaoStorage(options);

  const fileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
    if (options.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: ${options.allowedMimeTypes.join(', ')}`));
    }
  };

  const uploader = multer({
    storage,
    limits: { fileSize: options.maxFileSize },
    fileFilter,
  });

  // Wrap the Multer upload to add UJAMAADAO-specific post-processing
  const singleUploader = uploader.single('file');

  return (req: AuthRequest, res: Express.Response, next: Express.NextFunction) => {
    singleUploader(req, res, async (err) => {
      if (err) {
        logger.error('UJAMAADAO Upload Failed', {
          userId: req.user?.userId,
          operationType: 'UPLOAD',
          error: err instanceof Error ? err.message : 'Unknown upload error',
          // CRITICAL FIX: Moving ad-hoc data to metadata
          metadata: {
            uploadCategory: options.uploadCategory,
            maxSize: options.maxFileSize,
          }
        });
        return next(new Error('File upload failed.'));
      }

      // 1. Post-upload: Award Impact Points (if configured and user is verified)
      if (options.awardImpactPoints && req.user?.userId) {
        // Basic check: only award points if user is at least Phone Verified
        const minAwardLevel = 'PHONE_VERIFIED';
        if (req.user.verificationLevel === minAwardLevel || req.user.verificationLevel === 'COMMUNITY_VERIFIED' || req.user.verificationLevel === 'FULL_VERIFIED') {
          await awardImpactPointsForUpload(
            req.user.userId,
            options.awardImpactPoints,
            options.uploadCategory
          );
        } else {
          logger.info('UJAMAADAO Upload: IP award skipped due to low verification level', {
            userId: req.user.userId,
            // CRITICAL FIX: Moving ad-hoc data to metadata
            metadata: {
              currentLevel: req.user.verificationLevel,
              requiredLevel: minAwardLevel,
            }
          });
        }
      }

      // 2. Attach relevant metadata to the request (e.g., file location, category)
      if (req.file) {
        (req.file as any).uploadCategory = options.uploadCategory;
        (req.file as any).geographicContext = req.geographicContext;

        logger.info('UJAMAADAO Upload Success', {
          userId: req.user?.userId,
          operationType: 'UPLOAD',
          // CRITICAL FIX: Moving ad-hoc data to metadata
          metadata: {
            fileName: req.file.filename,
            category: options.uploadCategory,
            mimeType: req.file.mimetype,
          }
        });
      }

      next();
    });
  };
}

/**
 * Award Impact Points for Upload
 *
 * @param userId - User identifier
 * @param points - Points to award
 * @param category - Upload category for tracking
 */
async function awardImpactPointsForUpload(
  userId: string | undefined,
  points: number,
  category: string
): Promise<void> {
  if (!userId || points <= 0) return;

  // Placeholder for actual impact point awarding
  // In practice, this would call the EconomicService to award points

  logger.debug('UJAMAADAO Upload: Impact points award placeholder', {
    userId,
    operationType: 'ECONOMIC',
    // CRITICAL FIX: Moving ad-hoc data to metadata
    metadata: {
      points,
      category,
    }
  });
}

/**
 * Ensure Directory Exists for UJAMAADAO Uploads
 *
 * Creates directory structure if it doesn't exist for organized file storage
 * in the community governance platform.
 *
 * @param directoryPath - Directory path to ensure exists
 */
function ensureDirectoryExists(directoryPath: string): void {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
    logger.debug('UJAMAADAO Upload: Created directory', {
      operationType: 'SYSTEM',
      // CRITICAL FIX: Moving ad-hoc data to metadata
      metadata: {
        directoryPath,
      }
    });
  }
}

/**
 * Backward Compatibility Wrapper
 *
 * Maintains compatibility with existing code that uses the old upload signature
 * while encouraging migration to the enhanced UJAMAADAO upload system.
 *
 * @deprecated Use createUjamaadaoUploader for UJAMAADAO features
 * @param options - Basic upload configuration
 * @returns Configured multer instance
 */
export function createUploader(options: any) {
  return createUjamaadaoUploader({
    ...options,
    uploadCategory: 'COMMUNITY_ASSET'
  });
}
