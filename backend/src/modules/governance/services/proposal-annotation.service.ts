import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';
import { getGovernanceContract } from '../../../core/blockchain/client.js';
import { ethers } from 'ethers';

const ANNOTATOR_PALETTE = [
  '#C9922A', // amber
  '#1D4731', // tea-green
  '#2A6B7C', // teal
  '#8B3A2A', // terracotta
  '#2A4A7F', // navy
  '#6B4F9E', // purple
  '#1A6B3C', // emerald
];

const ANNOTATABLE_STATUSES = ['PENDING_REVIEW', 'APPROVED_FOR_VOTING'];

export interface CreateAnnotationDto {
  fieldKey: string;
  startOffset: number;
  endOffset: number;
  quotedText: string;
  comment: string;
}

async function assignAnnotatorColor(
  authorId: string,
  proposalId: string
): Promise<string> {
  const existing = await prisma.proposalAnnotation.findMany({
    where: { proposalId },
    select: { authorId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const seen = new Map<string, number>();
  let nextIndex = 0;
  for (const row of existing) {
    if (!seen.has(row.authorId)) {
      seen.set(row.authorId, nextIndex++);
    }
  }

  const index = seen.has(authorId) ? seen.get(authorId)! : nextIndex;
  return ANNOTATOR_PALETTE[index % ANNOTATOR_PALETTE.length];
}

async function anchorAnnotationOnChain(
  annotationId: string,
  proposalId: string,
  authorId: string,
  quotedText: string
): Promise<string | null> {
  if (process.env.NODE_ENV === 'test') return null;

  const user = await prisma.user.findUnique({
    where: { id: authorId },
    select: { walletAddress: true },
  });
  if (!user?.walletAddress) return null;

  const govContract = getGovernanceContract();
  if (!govContract) return null;

  try {
    const proposalBytes32 = ethers.keccak256(ethers.toUtf8Bytes(proposalId));
    const annotationHash = ethers.keccak256(
      ethers.toUtf8Bytes(
        `${annotationId}:${proposalId}:${user.walletAddress}:${quotedText}`
      )
    );
    const tx = await govContract.recordOpinion(proposalBytes32, annotationHash);
    logger.info(
      { annotationId, proposalId },
      '[GOV] Annotation anchored on-chain'
    );
    return tx.hash as string;
  } catch (err) {
    logger.warn(
      { annotationId, err },
      '[GOV] On-chain annotation anchor failed — off-chain record intact'
    );
    return null;
  }
}

function mapAnnotation(row: any, currentUserId?: string) {
  const upvotes =
    row.reactions?.filter((r: any) => r.type === 'UP').length ?? 0;
  const downvotes =
    row.reactions?.filter((r: any) => r.type === 'DOWN').length ?? 0;
  const myReaction = currentUserId
    ? (row.reactions?.find((r: any) => r.userId === currentUserId)?.type ??
      null)
    : null;

  return {
    id: row.id,
    proposalId: row.proposalId,
    authorId: row.authorId,
    fieldKey: row.fieldKey,
    startOffset: row.startOffset,
    endOffset: row.endOffset,
    quotedText: row.quotedText,
    comment: row.comment,
    color: row.color,
    createdAt: row.createdAt,
    upvotes,
    downvotes,
    myReaction: myReaction as 'UP' | 'DOWN' | null,
    author: row.author ?? null,
  };
}

export const proposalAnnotationService = {
  async create(authorId: string, proposalId: string, dto: CreateAnnotationDto) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { id: true, status: true },
    });
    if (!proposal) throw ApiError.notFound('Proposal');
    if (!ANNOTATABLE_STATUSES.includes(proposal.status)) {
      throw ApiError.forbidden(
        'Annotations can only be added while a proposal is under review or approved for voting'
      );
    }

    const color = await assignAnnotatorColor(authorId, proposalId);

    const annotation = await prisma.proposalAnnotation.create({
      data: {
        proposalId,
        authorId,
        fieldKey: dto.fieldKey,
        startOffset: dto.startOffset,
        endOffset: dto.endOffset,
        quotedText: dto.quotedText,
        comment: dto.comment,
        color,
      },
      include: {
        author: { select: { id: true, name: true } },
        reactions: { select: { userId: true, type: true } },
      },
    });

    await auditService.log(
      authorId,
      AuditAction.ANNOTATION_CREATED,
      'ProposalAnnotation',
      annotation.id,
      { proposalId, fieldKey: dto.fieldKey }
    );

    const txHash = await anchorAnnotationOnChain(
      annotation.id,
      proposalId,
      authorId,
      dto.quotedText
    );
    if (txHash) {
      await prisma.proposalAnnotation.update({
        where: { id: annotation.id },
        data: { anchorTxHash: txHash },
      });
    }

    return mapAnnotation(annotation, authorId);
  },

  async list(proposalId: string, currentUserId?: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { id: true },
    });
    if (!proposal) throw ApiError.notFound('Proposal');

    const rows = await prisma.proposalAnnotation.findMany({
      where: { proposalId },
      include: {
        author: { select: { id: true, name: true } },
        reactions: { select: { userId: true, type: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((r) => mapAnnotation(r, currentUserId));
  },

  async delete(authorId: string, proposalId: string, annotationId: string) {
    const annotation = await prisma.proposalAnnotation.findUnique({
      where: { id: annotationId },
    });
    if (!annotation || annotation.proposalId !== proposalId) {
      throw ApiError.notFound('Annotation');
    }
    if (annotation.authorId !== authorId) {
      throw ApiError.forbidden('You can only delete your own annotations');
    }
    await prisma.proposalAnnotation.delete({ where: { id: annotationId } });
    return { id: annotationId, deleted: true };
  },

  async react(
    userId: string,
    proposalId: string,
    annotationId: string,
    type: 'UP' | 'DOWN' | null
  ) {
    const annotation = await prisma.proposalAnnotation.findUnique({
      where: { id: annotationId },
      include: { proposal: { select: { status: true, id: true } } },
    });
    if (!annotation || annotation.proposalId !== proposalId) {
      throw ApiError.notFound('Annotation');
    }
    if (!ANNOTATABLE_STATUSES.includes(annotation.proposal.status)) {
      throw ApiError.forbidden(
        'Reactions can only be added while a proposal is under review or approved for voting'
      );
    }

    if (type === null) {
      await prisma.proposalAnnotationReaction.deleteMany({
        where: { annotationId, userId },
      });
    } else {
      await prisma.proposalAnnotationReaction.upsert({
        where: { annotationId_userId: { annotationId, userId } },
        create: { annotationId, userId, type },
        update: { type },
      });
    }

    const reactions = await prisma.proposalAnnotationReaction.findMany({
      where: { annotationId },
      select: { userId: true, type: true },
    });
    const upvotes = reactions.filter((r) => r.type === 'UP').length;
    const downvotes = reactions.filter((r) => r.type === 'DOWN').length;
    const myReaction = reactions.find((r) => r.userId === userId)?.type ?? null;

    return {
      upvotes,
      downvotes,
      myReaction: myReaction as 'UP' | 'DOWN' | null,
    };
  },
};
