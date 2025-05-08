// backend/src/routes/project.ts

import { Router, Request, Response } from 'express';
import {
  createProjectFromProposal,
  addParticipantToProject,
  listProjectParticipants,
} from '../services/projectService.js';

const router = Router();

/**
 * POST /api/projects/from-proposal
 * Create a project from an approved proposal.
 * Request body: { proposalId: string }
 */
router.post('/from-proposal', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.body;

    if (!proposalId) {
      return res.status(400).json({ success: false, error: 'Missing proposalId' });
    }

    const project = await createProjectFromProposal(proposalId);

    return res.status(201).json({ success: true, project });
  } catch (error: any) {
    console.error('Create project error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/projects/:projectId/participants
 * Add participant to a project.
 * Request body: { userId: string, role?: string }
 */
router.post('/:projectId/participants', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { userId, role } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    const participant = await addParticipantToProject(projectId, userId, role);

    return res.status(200).json({ success: true, participant });
  } catch (error: any) {
    console.error('Add participant error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/projects/:projectId/participants
 * List participants of a project.
 */
router.get('/:projectId/participants', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const participants = await listProjectParticipants(projectId);

    return res.status(200).json({ success: true, participants });
  } catch (error: any) {
    console.error('List participants error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

export default router;