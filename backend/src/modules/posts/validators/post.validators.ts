import { z } from 'zod';

const scopeEnum = z.enum(['WARD', 'CONSTITUENCY', 'COUNTY', 'NATIONAL']);
const typeEnum = z.enum(['NOTICE', 'ANNOUNCEMENT', 'RESOURCE']);

export const createPostSchema = z.object({
  content: z
    .string()
    .min(1, 'Post cannot be empty')
    .max(500, 'Post cannot exceed 500 characters')
    .trim(),
  scope: scopeEnum.default('WARD'),
  type: typeEnum.default('NOTICE'),
  wardId: z.string().uuid().optional(),
  proposalId: z.string().uuid().optional(),
  resourceUrl: z.string().url().optional().or(z.literal('')),
  resourceTitle: z.string().max(200).optional(),
});

export const getPostsSchema = z.object({
  scope: scopeEnum.optional(),
  type: typeEnum.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(30).default(20).optional(),
});
