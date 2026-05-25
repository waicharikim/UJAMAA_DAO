import { Router } from 'express';
import { PostController } from '../controllers/post.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { authorize } from '../../../core/middleware/authorize.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { asyncHandler } from '../../../core/utils/response.js';
import {
  createPostSchema,
  getPostsSchema,
} from '../validators/post.validators.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validateRequest({ schema: getPostsSchema, target: 'query' }),
  asyncHandler(PostController.getPosts)
);

router.post(
  '/',
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  validateRequest({ schema: createPostSchema, target: 'body' }),
  asyncHandler(PostController.create)
);

export default router;
