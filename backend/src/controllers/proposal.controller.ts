import type { Request, Response, NextFunction } from 'express';
import { createProposalSchema, updateProposalSchema } from '../validation/proposal.validation.js';
import { ProposalService } from '../services/proposal.service.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';

export async function createProposalHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createProposalSchema.parse(req.body);
    if (!input.creatorUserId) {
      input.creatorUserId = (req as any).user?.userId;
    }
    const proposal = await ProposalService.createProposal(input);

    res.status(201).json(proposal);
  } catch (err) {
    console.error('createProposalHandler error:', err);
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
  } catch (err: any) {
    if (err instanceof ApiError) {
      logger.warn('updateProposalHandler: ApiError', { message: err.message, statusCode: err.statusCode });
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (err?.name === 'ZodError') {
      const errors = err.errors;
      logger.warn('updateProposalHandler: Validation error', { errors });
      return res.status(400).json({ errors });
    }
    logger.error('updateProposalHandler: Unexpected error', { error: err });
    next(err);
  }
}

export async function getProposalHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const proposalId = req.params.id;
    logger.info('getProposalHandler: Fetching proposal', { proposalId });

    const proposal = await ProposalService.getProposalById(proposalId);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    res.json(proposal);

    logger.info('getProposalHandler: Proposal retrieved', { proposalId });
  } catch (err) {
    logger.error('getProposalHandler: Unexpected error', { error: err });
    next(err);
  }
}