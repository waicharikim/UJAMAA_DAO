import { z } from 'zod';

// User creation schema
export const createUserSchema = z.object({
  walletAddress: z.string().min(10, 'Invalid wallet address'),
  email: z.string().email('Invalid email'),
  name: z.string().min(2, 'Name is too short'),
  phoneNumber: z.string().optional(),
  constituencyOrigin: z.string().min(1),
  countyOrigin: z.string().min(1),
  constituencyLive: z.string().min(1),
  countyLive: z.string().min(1),
  industry: z.string().optional(),
  goodsServices: z.array(z.string()).optional(),
});

// User update schema (partial, for PATCH)
export const updateUserSchema = createUserSchema.partial();
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;