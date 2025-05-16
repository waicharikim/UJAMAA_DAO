import type { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service.js';
import { createUserSchema, updateUserSchema } from '../validation/user.validation.js';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

export async function createUserHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createUserSchema.parse(req.body);
    const user = await userService.createUser(input);
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ errors: err.errors });
    if (err instanceof ApiError) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

export async function getCurrentUserHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await userService.getUserById(userId);
    res.json(user);
  } catch (err) {
    if (err instanceof ApiError) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

export async function updateUserHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const input = updateUserSchema.parse(req.body);
    const updatedUser = await userService.updateUser(userId, input);
    res.json(updatedUser);
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ errors: err.errors });
    if (err instanceof ApiError) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}