import { Response } from 'express';
import { PostScope } from '../services/post.service.js';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sendSuccess, sendCreated } from '../../../core/utils/response.js';
import { postService } from '../services/post.service.js';

export class PostController {
  static async create(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { content, scope } = req.body as { content: string; scope: PostScope };
    const post = await postService.create({ content, scope, authorId: userId });
    sendCreated(res, post, 'Post created');
  }

  static async getPosts(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { scope, cursor, limit } = req.query as {
      scope?: PostScope;
      cursor?: string;
      limit?: string;
    };
    const result = await postService.getPosts({
      userId,
      scope,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
    sendSuccess(res, result, 'Posts fetched');
  }
}
