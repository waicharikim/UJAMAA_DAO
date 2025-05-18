import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { VoteService } from '../services/vote.service.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';

// Validation schemas for vote inputs
const individualVoteSchema = z.object({
  proposalId: z.string().uuid(),
  vote: z.boolean(),
  tokensSpent: z.number().int().nonnegative(),
});

const groupVoteSchema = z.object({
  proposalId: z.string().uuid(),
  vote: z.boolean(),
  groupId: z.string().uuid(),
});

export async function castIndividualVoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { proposalId, vote, tokensSpent } = individualVoteSchema.parse(req.body);
    const userId = (req as any).user?.userId;
    if (!userId) throw new ApiError('Unauthorized', 401);

    logger.info('Casting individual vote', { userId, proposalId });

    const result = await VoteService.castIndividualVote(proposalId, userId, vote, tokensSpent);

    res.status(201).json(result);
  } catch (err) {
    logger.error('castIndividualVoteHandler error:', {
      message: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined,
      requestBody: req.body,
      user: (req as any).user,
    });
    if (err instanceof ApiError) return res.status(err.statusCode).json({ error: err.message });
    if (err.name === 'ZodError') return res.status(400).json({ errors: err.errors });
    next(err);
  }
}

export async function castGroupVoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { proposalId, vote, groupId } = groupVoteSchema.parse(req.body);

    logger.info('Casting group vote', { groupId, proposalId });

    const result = await VoteService.castGroupVote(proposalId, groupId, vote);

    res.status(201).json(result);
  } catch (err) {
    logger.error('castGroupVoteHandler error:', {
      message: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined,
      requestBody: req.body,
    });
    if (err instanceof ApiError) return res.status(err.statusCode).json({ error: err.message });
    if (err.name === 'ZodError') return res.status(400).json({ errors: err.errors });
    next(err);
  }
}

export async function getVoteTallyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const proposalId = req.params.proposalId;

    logger.info('Fetching vote tally', { proposalId });

    const tally = await VoteService.getVoteTally(proposalId);

    res.json(tally);
  } catch (err) {
    logger.error('getVoteTallyHandler error:', {
      message: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined,
      params: req.params,
    });
    if (err instanceof ApiError) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}