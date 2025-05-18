import prisma from '../prismaClient.js';
import type { CreateProposalInput, UpdateProposalInput } from '../validation/proposal.validation.js';
import { ApiError } from '../utils/ApiError.js';
import * as ImpactPointService from './impactPoint.service.js';

export class ProposalService {
  static async createProposal(data: CreateProposalInput) {
    try {
      if (!data.creatorUserId && !data.creatorGroupId) {
        throw new ApiError('A proposal must have either a creatorUserId or a creatorGroupId.', 400);
      }
      if (data.creatorUserId && data.creatorGroupId) {
        throw new ApiError('Proposal cannot have both creatorUserId and creatorGroupId.', 400);
      }

      this.validateLocationScope(data);

      if (data.creatorUserId) {
        await this.checkUserProposalEligibility(
          data.creatorUserId,
          data.locationScope,
          data.constituency,
          data.county
        );
      } else if (data.creatorGroupId) {
        await this.checkGroupProposalEligibility(data.creatorGroupId, data.locationScope);
      }

      return await prisma.proposal.create({ data: { ...data, status: 'DRAFT' } });
    } catch (error) {
      console.error('Error in createProposal:', error);
      throw error;
    }
  }

  static async updateProposal(id: string, data: UpdateProposalInput) {
    const proposal = await prisma.proposal.findUnique({ where: { id } });
    if (!proposal) {
      throw new ApiError('Proposal not found', 404);
    }

    return await prisma.proposal.update({
      where: { id },
      data,
    });
  }

  static async getProposalById(id: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        creatorUser: true,
        creatorGroup: true,
        votes: true,
        project: true,
      },
    });
    if (!proposal) {
      throw new ApiError('Proposal not found', 404);
    }
    return proposal;
  }

  static validateLocationScope(data: CreateProposalInput | UpdateProposalInput) {
    const { locationScope, constituency, county, isPrivate } = data;

    switch (locationScope) {
      case 'LOCAL':
        if (constituency || county) {
          throw new ApiError('Local scope proposals cannot have constituency or county set.', 400);
        }
        if (!isPrivate) {
          throw new ApiError('Local proposals must be private.', 400);
        }
        break;

      case 'CONSTITUENCY':
        if (!constituency) {
          throw new ApiError('Constituency scope proposals must specify a constituency.', 400);
        }
        break;

      case 'COUNTY':
        if (!county) {
          throw new ApiError('County scope proposals must specify a county.', 400);
        }
        break;

      case 'NATIONAL':
        if (constituency || county) {
          throw new ApiError('National proposals cannot specify constituency or county.', 400);
        }
        break;
    }
  }

  static async checkUserProposalEligibility(
    userId: string,
    locationScope: string,
    constituency?: string,
    county?: string
  ) {
    let minPoints: number;

    switch (locationScope) {
      case 'CONSTITUENCY':
        minPoints = 1000;
        break;
      case 'COUNTY':
        minPoints = 2000;
        break;
      case 'NATIONAL':
        minPoints = 3000;
        break;
      case 'LOCAL':
        return;
      default:
        throw new ApiError('Invalid location scope for eligibility.', 400);
    }

    // You might want to update ImpactPointService.getImpactPoints() to accept constituency & county for filtering
    const points = await ImpactPointService.getImpactPoints('USER', userId, locationScope /* Optionally add constituency, county */);

    if (points < minPoints) {
      throw new ApiError(
        `User must have at least ${minPoints} impact points to create proposals at this level.`,
        403
      );
    }
  }

  static async checkGroupProposalEligibility(groupId: string, locationScope: string) {
    // Placeholder for group eligibility checks - e.g., backing
    return;
  }
}