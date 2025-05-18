import type { Request, Response, NextFunction } from 'express';
import { createProposalSchema, updateProposalSchema } from '../validation/proposal.validation.js';
import { ProposalService } from '../services/proposal.service.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';

export async function createProposalHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createProposalSchema.parse(req.body);

    // Use authenticated userId if no creatorUserId or creatorGroupId provided
    if (!input.creatorUserId && !input.creatorGroupId) {
      input.creatorUserId = (req as any).user?.userId;
      if (!input.creatorUserId) {
        throw new ApiError('Authentication required if no creatorGroupId provided', 401);
      }
    }

    logger.info('createProposalHandler: Creating proposal', { input });

    const proposal = await ProposalService.createProposal(input);

    res.status(201).json(proposal);

    logger.info('createProposalHandler: Proposal created', { proposalId: proposal.id });
  } catch (err) {
    logger.error('createProposalHandler error:', err);

    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if ((err as any)?.name === 'ZodError') {
      return res.status(400).json({ errors: (err as any).errors });
    }
    next(err);
  }
}

export async function updateProposalHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const proposalId = req.params.id;
    const input = updateProposalSchema.parse(req.body);

    logger.info('updateProposalHandler: Updating proposal', { proposalId });

    const updatedProposal = await ProposalService.updateProposal(proposalId, input);
    res.json(updatedProposal);

    logger.info('updateProposalHandler: Proposal updated', { proposalId });
  } catch (err) {
    logger.error('updateProposalHandler error:', err);

    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if ((err as any)?.name === 'ZodError') {
      return res.status(400).json({ errors: (err as any).errors });
    }
    next(err);
  }
}

export async function getProposalHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const proposalId = req.params.id;

    logger.info('getProposalHandler: Fetching proposal', { proposalId });

    const proposal = await ProposalService.getProposalById(proposalId);

    res.json(proposal);

    logger.info('getProposalHandler: Proposal retrieved', { proposalId });
  } catch (err) {
    logger.error('getProposalHandler error:', err);

    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
}