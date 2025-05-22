/**
 * @file referenceData.controller.ts
 *
 * @description
 * Controller for serving static enums and cached reference data
 * like counties, constituencies, industries, and goods/services.
 * Handles input validation and error management.
 */

import { validate as isValidUUID } from 'uuid';
import * as referenceService from '../services/referenceData.service.js';
import type { Request, Response, NextFunction } from 'express';

// Static enum handlers

export function getGroupRolesHandler(_req: Request, res: Response) {
  res.json(referenceService.GROUP_ROLES);
}

export function getSystemRolesHandler(_req: Request, res: Response) {
  res.json(referenceService.SYSTEM_ROLES);
}

export function getParticipantRolesHandler(_req: Request, res: Response) {
  res.json(referenceService.PARTICIPANT_ROLES);
}

export function getProposalTypesHandler(_req: Request, res: Response) {
  res.json(referenceService.PROPOSAL_TYPES);
}

export function getProposalStatusesHandler(_req: Request, res: Response) {
  res.json(referenceService.PROPOSAL_STATUSES);
}

export function getLocationScopesHandler(_req: Request, res: Response) {
  res.json(referenceService.LOCATION_SCOPES);
}

export function getProjectStatusesHandler(_req: Request, res: Response) {
  res.json(referenceService.PROJECT_STATUSES);
}

export function getMilestoneStatusesHandler(_req: Request, res: Response) {
  res.json(referenceService.MILESTONE_STATUSES);
}

// Dynamic data handlers with error handling

export async function getIndustriesHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const industries = await referenceService.getIndustries();
    res.json(industries);
  } catch (err) {
    next(err);
  }
}

export async function getGoodsServicesHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const goodsServices = await referenceService.getGoodsServices();
    res.json(goodsServices);
  } catch (err) {
    next(err);
  }
}

export async function getCountiesHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const counties = await referenceService.getCounties();
    res.json(counties);
  } catch (err) {
    next(err);
  }
}

export async function getConstituenciesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const countyId = req.query.countyId as string | undefined;

    if (countyId && !isValidUUID(countyId)) {
      return res.status(400).json({ error: 'Invalid countyId parameter, must be a valid UUID' });
    }
    const constituencies = await referenceService.getConstituencies(countyId);
    res.json(constituencies);
  } catch (err) {
    next(err);
  }
}