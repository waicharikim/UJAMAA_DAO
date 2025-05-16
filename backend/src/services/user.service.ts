import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import type { CreateUserInput, UpdateUserInput } from '../validation/user.validation.js';

export async function createUser(input: CreateUserInput) {
  const exists = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.email }, { walletAddress: input.walletAddress }],
    },
  });
  if (exists) {
    throw new ApiError('User with this email or wallet already exists', 409);
  }
  const user = await prisma.user.create({ data: { ...input, nonce: crypto.randomUUID() } });
  return user;
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new ApiError('User not found', 404);
  return user;
}

export async function updateUser(id: string, data: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new ApiError('User not found', 404);
  const updated = await prisma.user.update({
    where: { id },
    data,
  });
  return updated;
}