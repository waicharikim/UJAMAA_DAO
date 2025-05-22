/**
 * @file referenceData.service.ts
 *
 * @description
 * Service providing access to static enums and cached reference data
 * such as counties, constituencies, industries, and goods/services.
 * Caches results to improve performance.
 */

import prisma from '../prismaClient.js';
import NodeCache from 'node-cache';

// Static enum values
export const GROUP_ROLES = ['MEMBER', 'ADMIN', 'TREASURER', 'AUDITOR'];
export const SYSTEM_ROLES = ['SUPER_ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER', 'SUPPORT_STAFF', 'GENERAL_USER'];
export const PARTICIPANT_ROLES = ['MEMBER', 'ADMIN', 'MILESTONE_VERIFIER'];
export const PROPOSAL_TYPES = ['BUSINESS', 'NON_PROFIT', 'BILL'];
export const PROPOSAL_STATUSES = ['DRAFT', 'VOTING', 'APPROVED', 'REJECTED', 'EXECUTING', 'COMPLETED'];
export const LOCATION_SCOPES = ['LOCAL', 'CONSTITUENCY', 'COUNTY', 'NATIONAL'];
export const PROJECT_STATUSES = ['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];
export const MILESTONE_STATUSES = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

async function cacheFetch<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached) {
    return cached;
  }
  const value = await fetchFn();
  cache.set(key, value);
  return value;
}

export async function getIndustries() {
  return cacheFetch('industries', () =>
    prisma.industry.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  );
}

export async function getGoodsServices() {
  return cacheFetch('goodsServices', () =>
    prisma.goodsService.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  );
}

export async function getCounties() {
  return cacheFetch('counties', () =>
    prisma.county.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  );
}

export async function getConstituencies(countyId?: string) {
  const key = countyId ? `constituencies_${countyId}` : 'constituencies_all';
  return cacheFetch(key, () =>
    prisma.constituency.findMany({
      where: countyId ? { countyId } : undefined,
      select: { id: true, name: true, countyId: true },
      orderBy: { name: 'asc' },
    }),
  );
}