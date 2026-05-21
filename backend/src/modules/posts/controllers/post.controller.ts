import { Response } from 'express';
import { PostScope, PostType } from '../services/post.service.js';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sendSuccess, sendCreated } from '../../../core/utils/response.js';
import { postService } from '../services/post.service.js';

export class PostController {
  static async create(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const {
      content,
      scope,
      type,
      wardId,
      proposalId,
      resourceUrl,
      resourceTitle,
    } = req.body as {
      content: string;
      scope: PostScope;
      type?: PostType;
      wardId?: string;
      proposalId?: string;
      resourceUrl?: string;
      resourceTitle?: string;
    };

    const post = await postService.create({
      content,
      scope,
      type: type ?? 'NOTICE',
      authorId: userId,
      wardId,
      proposalId,
      resourceUrl,
      resourceTitle,
    });
    sendCreated(res, post, 'Post created');
  }

  static async getPosts(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { scope, type, cursor, limit } = req.query as {
      scope?: PostScope;
      type?: PostType;
      cursor?: string;
      limit?: string;
    };
    const result = await postService.getPosts({
      userId,
      scope,
      type,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
    sendSuccess(res, result, 'Posts fetched');
  }
}
