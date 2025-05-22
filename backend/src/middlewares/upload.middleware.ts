/**
 * @file upload.middleware.ts
 *
 * @description
 * Middleware factory for handling file uploads using Multer.
 * - Supports configurable storage folder, field name, allowed extensions, and file size.
 * - Generates unique filenames to avoid collisions.
 * - Enforces allowed file extensions and max file size limits.
 */

import multer from 'multer';
import path from 'path';
import type { Express } from 'express';

interface UploadOptions {
  folder: string;                 // Storage directory for uploaded files
  fieldName: string;              // Expected form field name
  allowedExtensions?: string[];  // Allowed file extensions (default: common image types)
  maxSizeMB?: number;             // Max file size in megabytes (default: 2MB)
}

/**
 * Creates a Multer upload middleware configured with specified options.
 *
 * @param options Upload configuration
 * @returns Configured multer instance
 */
export function createUploader(options: UploadOptions) {
  const {
    folder,
    fieldName,
    allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    maxSizeMB = 2,
  } = options;

  const storage = multer.diskStorage({
    destination: (_req: any, _file: Express.Multer.File, cb) => {
      cb(null, folder);
    },
    filename: (_req: any, file: Express.Multer.File, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${fieldName}-${uniqueSuffix}${ext}`);
    },
  });

  const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed extensions: ${allowedExtensions.join(', ')}`));
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: maxSizeMB * 1024 * 1024 }, // Convert MB to bytes
  });
}