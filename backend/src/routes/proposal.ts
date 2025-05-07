/**
 * Proposal-related API routes for UjamaaDAO backend.
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * POST /api/proposals/create
 * Create a new proposal.
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

    // Basic validation
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
    if (!['Local', 'County', 'National'].includes(locationScope)) {
      return res.status(400).json({ success: false, error: 'Invalid locationScope' });
    }
    if (locationScope === 'Local' && (!constituency || !county)) {
      return res.status(400).json({ success: false, error: 'Constituency and county required for Local scope' });
    }
    if (locationScope === 'County' && !county) {
      return res.status(400).json({ success: false, error: 'County required for County scope' });
    }

    // TODO: Add eligibility checks based on Impact Points ranking
    // TODO: Save proposal to DB, generate UUID

    const proposalId = 'dummy-uuid'; // Placeholder

    return res.status(201).json({ success: true, proposalId });
  } catch (err) {
    console.error('Proposal creation error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/proposals/:id
 * Retrieve proposal details.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const proposalId = req.params.id;

    // TODO: Fetch proposal from DB, handle not found

    if (proposalId !== 'dummy-uuid') {
      return res.status(404).json({ success: false, error: 'Proposal not found' });
    }

    return res.status(200).json({
      proposalId: 'dummy-uuid',
      creatorUserId: null,
      creatorGroupId: 'dummy-group-uuid',
      proposalType: 'Business',
      funded: true,
      title: 'Build a community library',
      description: 'Detailed proposal description',
      budget: 50000,
      timeline: '6 months',
      locationScope: 'Local',
      constituency: 'Nairobi West',
      county: 'Nairobi',
      purposeDetails: {
        businessModel: 'Earn revenue through book sales',
        profitProjection: 'Estimated 10% ROI yearly',
        communityBenefit: 'Create jobs and education center',
      },
      status: 'Draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Get proposal error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/proposals
 * List proposals with optional filters.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Use query params for filtering general props
    // TODO: Implement DB filtering

    // Return dummy list
    const proposals = [
      {
        proposalId: 'uuid-1',
        title: 'Community Park Revamp',
        status: 'Voting',
        locationScope: 'Local',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        proposalType: 'Non-Profit',
      },
      {
        proposalId: 'uuid-2',
        title: 'Mobile Learning App',
        status: 'Approved',
        locationScope: 'County',
        constituency: null,
        county: 'Kisumu',
        proposalType: 'Business',
      },
    ];

    return res.status(200).json(proposals);
  } catch (err) {
    console.error('List proposals error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PATCH /api/proposals/:id
 * Update proposal status or details (admin or system actions).
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const proposalId = req.params.id;
    const { status } = req.body;

    // TODO: Validate status transitions
    if (!status) {
      return res.status(400).json({ success: false, error: 'Missing status field' });
    }

    // TODO: Update status in DB

    return res.status(200).json({ success: true, proposalId, updatedStatus: status });
  } catch (err) {
    console.error('Update proposal error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;