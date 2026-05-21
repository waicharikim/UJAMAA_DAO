import { z } from 'zod';

const scopeEnum = z.enum(['WARD', 'CONSTITUENCY', 'COUNTY', 'NATIONAL']);

export const createPostSchema = z.object({
  content: z
    .string()
    .min(1, 'Post cannot be empty')
    .max(500, 'Post cannot exceed 500 characters')
    .trim(),
  scope: scopeEnum.default('WARD'),
});

export const getPostsSchema = z.object({
  scope: scopeEnum.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(30).default(20).optional(),
});
