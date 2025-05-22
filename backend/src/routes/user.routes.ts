/**
 * @file user.routes.ts
 *
 * @description
 * Defines all Express routes pertaining to user operations including:
 * - User registration and public lookups
 * - Protected profile retrieval, updates, and avatar uploads
 * - Middleware integration for authentication and RBAC authorization
 */

import express from 'express';
import * as userController from '../controllers/user.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { attachUserRoles } from '../middlewares/attachUserRoles.middleware.js';
import { authorize } from '../middlewares/rbac.middleware.js';
import { createUploader } from '../middlewares/upload.middleware.js';
import { USER_ACCESS_ROLES } from '../constants/roles.js';

const router = express.Router();

/**
 * Multer uploader middleware for handling avatar image uploads.
 */
export const uploadAvatar = createUploader({
  folder: 'uploads/avatars',
  fieldName: 'avatar',
  allowedExtensions: ['.png', '.jpg', '.jpeg', '.gif'],
  maxSizeMB: 2,
});

// Public routes (no authentication required)
router.post('/', userController.createUserHandler);
router.get('/wallet/:walletAddress', userController.getUserByWalletHandler);

// Protect all routes below with authentication and attach user roles
router.use(authMiddleware);
router.use(attachUserRoles);

// Get current authenticated user's profile (requires appropriate roles)
router.get('/me', authorize(USER_ACCESS_ROLES), userController.getCurrentUserHandler);

// Update current authenticated user's profile (roles enforced)
router.patch('/me', authorize(USER_ACCESS_ROLES), userController.updateUserHandler);

// Avatar upload endpoint (file upload with auth and authorization)
router.post(
  '/me/avatar',
  authorize(USER_ACCESS_ROLES),
  uploadAvatar.single('avatar'),
  userController.uploadAvatarHandler
);

export default router;