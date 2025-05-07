/**
 * Group-related routes for UjamaaDAO backend API.
 *
 * This module handles creation of groups, adding users to groups,
 * and fetching group details with full database persistence using Prisma.
 */

import { Router, Request, Response } from 'express';
import prisma from '../prismaClient.js'; // Import Prisma client instance with .js extension for ESM runtime

const router = Router();

/**
 * POST /api/groups/create
 *
 * Create a new legally recognized group.
 * Receives group details in the request body, validates, then saves to DB.
 *
 * Expected fields in JSON:
 * {
 *   name: string;               // Group name (required)
 *   description?: string;       // Group description (optional)
 *   walletAddress: string;      // Group's wallet address (required)
 *   constituency: string;       // Constituency where group belongs (required)
 *   county: string;             // County where group belongs (required)
 *   industryFocus: string;      // Industry focus (required)
 *   productsServices: string[]; // Offered products/services (optional)
 * }
 *
 * Responses:
 * - 201 Created with groupId on success
 * - 400 Bad Request if required fields missing
 * - 500 Internal Server Error for unexpected failures
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      walletAddress,
      constituency,
      county,
      industryFocus,
      productsServices,
    } = req.body;

    // Basic validation of required fields
    if (!name || !walletAddress || !constituency || !county || !industryFocus) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, walletAddress, constituency, county, industryFocus',
      });
    }

    // Check if group with same walletAddress or name already exists
    const existingGroup = await prisma.group.findFirst({
      where: {
        OR: [{ walletAddress }, { name }],
      },
    });

    if (existingGroup) {
      return res.status(409).json({
        success: false,
        error: 'Group with this wallet address or name already exists',
      });
    }

    // Create group record in DB
    const newGroup = await prisma.group.create({
      data: {
        name,
        description: description || null,
        walletAddress,
        constituency,
        county,
        industryFocus,
        productsServices: productsServices || [],
      },
    });

    return res.status(201).json({
      success: true,
      groupId: newGroup.id,
    });
  } catch (error) {
    // Log error server side for debugging
    // eslint-disable-next-line no-console
    console.error('Group creation error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/groups/join
 *
 * Add a user to a group via invitation.
 * Expects userId and groupId in JSON request body.
 *
 * Responses:
 * - 200 OK on successful addition
 * - 400 Bad Request if missing fields or invalid IDs
 * - 409 Conflict if user already a member
 * - 500 Internal Server Error for other errors
 */
router.post('/join', async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.body;

    // Validate required fields presence
    if (!groupId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: groupId, userId',
      });
    }

    // Check if group exists
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if user already member of the group
    const existingMembership = await prisma.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });

    if (existingMembership) {
      return res.status(409).json({
        success: false,
        error: 'User is already a member of this group',
      });
    }

    // Add user as member of the group
    await prisma.groupMember.create({
      data: {
        userId,
        groupId,
        role: 'MEMBER', // default role
      },
    });

    return res.status(200).json({
      success: true,
      message: 'User added to group',
    });
  } catch (error) {
    // Log error server side
    // eslint-disable-next-line no-console
    console.error('Group join error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/groups/:id
 *
 * Retrieve full group details by group ID.
 * Includes member count.
 *
 * Responses:
 * - 200 OK with group details on success
 * - 404 Not Found if group does not exist
 * - 500 Internal Server Error on unexpected errors
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const groupId = req.params.id;

    // Fetch group and count members
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: true,
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }

    return res.status(200).json({
      groupId: group.id,
      name: group.name,
      description: group.description,
      constituency: group.constituency,
      county: group.county,
      industryFocus: group.industryFocus,
      productsServices: group.productsServices,
      memberCount: group.members.length,
    });
  } catch (error) {
    // Log error server side
    // eslint-disable-next-line no-console
    console.error('Get group error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;