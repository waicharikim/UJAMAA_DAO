/**
 * Proposal-related API routes for UjamaaDAO backend.
 *
 * Handles creation, retrieval, listing, and updating of proposals.
 * Fully integrated with Prisma for real DB persistence.
 */

import { Router, Request, Response } from 'express';
import prisma from '../prismaClient.js'; // Note `.js` extension for ESM runtime
import { ProposalType, ProposalStatus, LocationScope } from '@prisma/client';

const router = Router();

/**
 * POST /api/proposals/create
 *
 * Creates a new proposal.
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const {
      creatorUserId,
      creatorGroupId,
      proposalType,
      funded,
      title,
      description,
      budget,
      timeline,
      locationScope,
      constituency,
      county,
      purposeDetails,
    } = req.body;

    if (!creatorUserId && !creatorGroupId) {
      return res.status(400).json({
        success: false,
        error: 'Either creatorUserId or creatorGroupId must be provided',
      });
    }
    if (!proposalType || !title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: proposalType, title, description',
      });
    }
    if (funded && (!budget || budget <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'Budget must be specified and positive for funded proposals',
      });
    }
    if (!Object.values(LocationScope).includes(locationScope)) {
      return res.status(400).json({ success: false, error: 'Invalid locationScope' });
    }
    if (locationScope === LocationScope.LOCAL && (!constituency || !county)) {
      return res.status(400).json({ success: false, error: 'Constituency and county required for Local scope' });
    }
    if (locationScope === LocationScope.COUNTY && !county) {
      return res.status(400).json({ success: false, error: 'County required for County scope' });
    }

    // Save proposal to DB
    const newProposal = await prisma.proposal.create({
      data: {
        creatorUserId: creatorUserId || null,
        creatorGroupId: creatorGroupId || null,
        proposalType,
        funded,
        title,
        description,
        budget: funded ? budget : null,
        timeline,
        locationScope,
        constituency: locationScope === LocationScope.LOCAL ? constituency : null,
        county: [LocationScope.LOCAL, LocationScope.COUNTY].includes(locationScope) ? county : null,
        purposeDetails: purposeDetails || null,
        status: ProposalStatus.DRAFT,
      },
    });

    return res.status(201).json({ success: true, proposalId: newProposal.id });
  } catch (error) {
    console.error('Proposal creation error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/proposals/:id
 *
 * Retrieves proposal details by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const proposalId = req.params.id;
    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
    if (!proposal) {
      return res.status(404).json({ success: false, error: 'Proposal not found' });
    }
    return res.status(200).json(proposal);
  } catch (error) {
    console.error('Get proposal error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/proposals
 *
 * List proposals, optionally filtered by query parameters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters: Partial<Record<string, any>> = {};
    const allowedFilters = [
      'locationScope',
      'constituency',
      'county',
      'proposalType',
      'status',
    ];

    for (const key of allowedFilters) {
      if (req.query[key]) filters[key] = req.query[key];
    }

    const proposals = await prisma.proposal.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.status(200).json(proposals);
  } catch (error) {
    console.error('List proposals error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PATCH /api/proposals/:id
 *
 * Updates proposal status or details
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const proposalId = req.params.id;
    const { status, title, description, budget, timeline, purposeDetails } = req.body;

    if (status && !Object.values(ProposalStatus).includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    const updateData = {
      ...(status && { status }),
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(budget !== undefined && { budget }),
      ...(timeline !== undefined && { timeline }),
      ...(purposeDetails !== undefined && { purposeDetails }),
    };

    const updatedProposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      proposalId: updatedProposal.id,
      updatedStatus: updatedProposal.status,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Proposal not found' });
    }
    console.error('Update proposal error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;