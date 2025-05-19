import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';

import {
  createProjectFromProposalHandler,
  getProjectByIdHandler,
  listProjectsHandler,
  updateProjectHandler,
  deleteProjectHandler,
} from '../controllers/project.controller.js';

const router = Router();

// Create a new project from an approved proposal
router.post('/', authMiddleware, createProjectFromProposalHandler);

// Get a project by its ID
router.get('/:id', authMiddleware, getProjectByIdHandler);

// List projects, could accept filters (query params)
router.get('/', authMiddleware, listProjectsHandler);

// Update a project (partial or full)
router.patch('/:id', authMiddleware, updateProjectHandler);

// Delete or cancel a project
router.delete('/:id', authMiddleware, deleteProjectHandler);

export default router;