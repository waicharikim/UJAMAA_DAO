/**
 * User-related routes for UjamaaDAO backend API.
 *
 * This module handles individual user registration and related user endpoints,
 * now integrated with Prisma Client for database persistence.
 */

import { Router, Request, Response } from 'express';
import prisma from '../prismaClient.js'; // Prisma client instance (make sure the path and extension match your setup)

const router = Router();

/**
 * POST /api/users/register
 *
 * Registers a new individual user in the database.
 *
 * Expected Request Body (JSON):
 * {
 *   walletAddress: string;      // Blockchain wallet address (required)
 *   email: string;              // User email (required)
 *   name: string;               // Full name (required)
 *   constituency: string;       // Constituency of residence (required)
 *   county: string;             // County of residence (required)
 *   industry?: string;          // Industry user identifies with (optional)
 *   goodsServices?: string[];   // Goods and services offered (optional)
 * }
 *
 * Validation:
 * - Required fields must be present and non-empty.
 * - Rejects registration if walletAddress or email already exists.
 *
 * Responses:
 * - 201 Created with JSON { success: true, userId: string } on success.
 * - 400 Bad Request with JSON { success: false, error: string } if validation fails.
 * - 409 Conflict if user already exists.
 * - 500 Internal Server Error on unexpected failures.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Extract required and optional fields from the request body
    const {
      walletAddress,
      email,
      name,
      constituency,
      county,
      industry,
      goodsServices,
    } = req.body;

    // Validate presence of mandatory fields
    if (!walletAddress || !email || !name || !constituency || !county) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: walletAddress, email, name, constituency, county',
      });
    }

    // Check if a user with the same wallet address or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ walletAddress }, { email }],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User with this wallet address or email already exists',
      });
    }

    // Create a new user record in the database
    const newUser = await prisma.user.create({
      data: {
        walletAddress,
        email,
        name,
        constituency,
        county,
        industry: industry || null,
        goodsServices: goodsServices || [],
      },
    });

    // Respond with success and the new user's ID
    return res.status(201).json({
      success: true,
      userId: newUser.id,
    });
  } catch (error) {
    // Log the error for debugging purposes on server side
    // eslint-disable-next-line no-console
    console.error('User registration error:', error);

    // Respond with a generic internal server error message
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;