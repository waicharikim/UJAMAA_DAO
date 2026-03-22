/**
 * @file src/modules/elections/services/election.service.ts
 * @description
 * ElectionService — full lifecycle management for democratic elections.
 *
 * Rules:
 * - Only ELECTED roles (per GroupRoleAssignment / SystemRoleAssignment) can have elections
 * - First election only fires after threshold is reached (ElectionThresholds)
 * - Voting is free; PR balance is used as weight (snapshot at cast time)
 * - Nomination costs PR (spent, non-refundable) to deter spam
 * - Quorum: 50%+1 of eligible voters must cast a vote
 * - Current role holder keeps role until winner is declared
 *
 * Version: 1.0 — March 2026
 */

import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';
import { ElectionThresholds } from '../../../core/rbac/roles.js';
import {
  ELECTION_WINDOWS,
  NOMINATION_PR_COST,
  ELECTABLE_GROUP_ROLES,
  type CreateElectionInput,
  type ElectionSummaryDto,
  type ElectionDetailDto,
  type ElectionFilters,
} from '../types.js';

export class ElectionService {
  // ── Scheduling ──────────────────────────────────────────────────────────────

  /**
   * Monthly cron entry point. Scans all active groups and system scopes.
   * Creates elections where threshold is met and no active election exists.
   */
  async scheduleElectionsForEligibleScopes(): Promise<{
    scheduled: number;
    skipped: number;
  }> {
    let scheduled = 0;
    let skipped = 0;

    // ── Group elections ──────────────────────────────────────────────────────
    const activeGroups = await prisma.group.findMany({
      where: { status: { in: ['ACTIVE', 'FORMING'] } },
      select: {
        id: true,
        isSystemGroup: true,
        systemType: true,
        voluntaryType: true,
        wardId: true,
        countyId: true,
      },
    });

    for (const group of activeGroups) {
      for (const roleKey of ELECTABLE_GROUP_ROLES) {
        const threshold = this.getGroupThreshold(roleKey, group);
        const eligibleCount = await this.countGroupEligibleMembers(
          group.id,
          group.isSystemGroup
        );

        if (eligibleCount < threshold) {
          skipped++;
          continue;
        }

        const hasActive = await this.hasActiveOrScheduledElection(
          'GROUP',
          group.id,
          undefined,
          roleKey
        );
        if (hasActive) {
          skipped++;
          continue;
        }

        // Check if last election's term has not expired
        const lastElection = await prisma.election.findFirst({
          where: { groupId: group.id, roleKey, status: 'CLOSED' },
          orderBy: { votingCloseAt: 'desc' },
        });
        if (
          lastElection?.nextElectionAt &&
          lastElection.nextElectionAt > new Date()
        ) {
          skipped++;
          continue;
        }

        await this.createElection({
          scope: 'GROUP',
          groupId: group.id,
          roleKey,
          termMonths: ELECTION_WINDOWS.GROUP_TERM_MONTHS,
        });
        scheduled++;
      }
    }

    // ── System elections: COUNTY_COORDINATOR ────────────────────────────────
    const counties = await prisma.county.findMany({
      select: { id: true, name: true },
    });

    for (const county of counties) {
      const eligibleCount = await this.countCountyEligibleMembers(county.id);

      if (eligibleCount < ElectionThresholds.COUNTY_COORDINATOR) {
        skipped++;
        continue;
      }

      const hasActive = await this.hasActiveOrScheduledElection(
        'SYSTEM',
        undefined,
        county.id,
        'COUNTY_COORDINATOR'
      );
      if (hasActive) {
        skipped++;
        continue;
      }

      const lastElection = await prisma.election.findFirst({
        where: {
          countyId: county.id,
          roleKey: 'COUNTY_COORDINATOR',
          status: 'CLOSED',
        },
        orderBy: { votingCloseAt: 'desc' },
      });
      if (
        lastElection?.nextElectionAt &&
        lastElection.nextElectionAt > new Date()
      ) {
        skipped++;
        continue;
      }

      await this.createElection({
        scope: 'SYSTEM',
        countyId: county.id,
        roleKey: 'COUNTY_COORDINATOR',
        termMonths: ELECTION_WINDOWS.SYSTEM_TERM_MONTHS,
      });
      scheduled++;
    }

    logger.info({ scheduled, skipped }, '[Elections] Scheduling scan complete');
    return { scheduled, skipped };
  }

  /**
   * Creates an Election record in PENDING state with computed window dates.
   */
  async createElection(input: CreateElectionInput): Promise<{ id: string }> {
    const now = new Date();
    const nominationsOpenAt = new Date(
      now.getTime() + ELECTION_WINDOWS.NOMINATIONS_LEAD_DAYS * 86400000
    );
    const nominationsCloseAt = new Date(
      nominationsOpenAt.getTime() +
        ELECTION_WINDOWS.NOMINATIONS_DURATION_DAYS * 86400000
    );
    const votingOpenAt = nominationsCloseAt;
    const votingCloseAt = new Date(
      votingOpenAt.getTime() + ELECTION_WINDOWS.VOTING_DURATION_DAYS * 86400000
    );

    const election = await prisma.election.create({
      data: {
        roleKey: input.roleKey,
        scope: input.scope,
        groupId: input.groupId ?? null,
        countyId: input.countyId ?? null,
        status: 'PENDING',
        nominationsOpenAt,
        nominationsCloseAt,
        votingOpenAt,
        votingCloseAt,
        termMonths: input.termMonths ?? ELECTION_WINDOWS.GROUP_TERM_MONTHS,
      },
    });

    await auditService.log(
      'system',
      AuditAction.ELECTION_CREATED,
      'Election',
      election.id,
      {
        roleKey: input.roleKey,
        scope: input.scope,
        groupId: input.groupId,
        countyId: input.countyId,
      }
    );

    logger.info(
      { electionId: election.id, roleKey: input.roleKey, scope: input.scope },
      '[Elections] Election created'
    );

    return { id: election.id };
  }

  // ── Nomination ───────────────────────────────────────────────────────────────

  /**
   * Self-nomination. Validates eligibility, spends PR fee, creates candidacy.
   */
  async nominate(
    userId: string,
    electionId: string,
    statement?: string
  ): Promise<{ id: string }> {
    const election = await prisma.election.findUnique({
      where: { id: electionId },
    });
    if (!election) throw new ApiError('Election not found', 404);
    if (election.status !== 'NOMINATIONS_OPEN') {
      throw new ApiError(
        'Nominations are not currently open for this election',
        409
      );
    }

    // Check eligibility
    await this.assertNominationEligible(userId, election);

    // Check not already nominated
    const existing = await prisma.electionCandidate.findUnique({
      where: { electionId_userId: { electionId, userId } },
    });
    if (existing && !existing.withdrawnAt) {
      throw new ApiError('You have already nominated for this election', 409);
    }

    // Spend PR nomination fee
    const prCost =
      NOMINATION_PR_COST[election.roleKey] ?? NOMINATION_PR_COST.DEFAULT;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { participationRights: true },
    });
    if (!user) throw new ApiError('User not found', 404);
    if (user.participationRights < prCost) {
      throw new ApiError(
        `Insufficient Participation Rights. Need ${prCost} PR to nominate. You have ${user.participationRights} PR.`,
        402
      );
    }

    const candidate = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { participationRights: { decrement: prCost } },
      });
      await tx.participationRightsLog.create({
        data: {
          userId,
          amount: -prCost,
          balance: user.participationRights - prCost,
          reason: 'NOMINATION_FEE',
          metadata: { electionId, roleKey: election.roleKey },
        },
      });
      if (existing?.withdrawnAt) {
        return tx.electionCandidate.update({
          where: { id: existing.id },
          data: {
            statement: statement ?? null,
            withdrawnAt: null,
            totalWeight: 0,
            voteCount: 0,
          },
        });
      }
      return tx.electionCandidate.create({
        data: { electionId, userId, statement: statement ?? null },
      });
    });

    await auditService.log(
      userId,
      AuditAction.ELECTION_NOMINATION_SUBMITTED,
      'Election',
      electionId,
      { roleKey: election.roleKey, prSpent: prCost }
    );

    logger.info(
      { userId, electionId, prSpent: prCost },
      '[Elections] Nomination submitted'
    );
    return { id: candidate.id };
  }

  /**
   * Withdraw nomination before voting opens.
   */
  async withdrawNomination(userId: string, electionId: string): Promise<void> {
    const election = await prisma.election.findUnique({
      where: { id: electionId },
    });
    if (!election) throw new ApiError('Election not found', 404);
    if (election.status !== 'NOMINATIONS_OPEN') {
      throw new ApiError(
        'Can only withdraw during the nominations window',
        409
      );
    }

    const candidate = await prisma.electionCandidate.findUnique({
      where: { electionId_userId: { electionId, userId } },
    });
    if (!candidate || candidate.withdrawnAt) {
      throw new ApiError('No active nomination found', 404);
    }

    await prisma.electionCandidate.update({
      where: { id: candidate.id },
      data: { withdrawnAt: new Date() },
    });

    await auditService.log(
      userId,
      AuditAction.ELECTION_NOMINATION_WITHDRAWN,
      'Election',
      electionId,
      {}
    );
    logger.info({ userId, electionId }, '[Elections] Nomination withdrawn');
  }

  // ── Voting ───────────────────────────────────────────────────────────────────

  /**
   * Cast a weighted vote. Voting is free; weight = voter's current PR balance.
   */
  async castVote(
    voterId: string,
    electionId: string,
    candidateId: string
  ): Promise<{ id: string }> {
    const election = await prisma.election.findUnique({
      where: { id: electionId },
    });
    if (!election) throw new ApiError('Election not found', 404);
    if (election.status !== 'VOTING_OPEN') {
      throw new ApiError('Voting is not currently open for this election', 409);
    }

    // Check eligibility
    await this.assertVoteEligible(voterId, election);

    // Check not already voted
    const existingVote = await prisma.electionVote.findUnique({
      where: { electionId_voterId: { electionId, voterId } },
    });
    if (existingVote)
      throw new ApiError('You have already voted in this election', 409);

    // Validate candidate
    const candidate = await prisma.electionCandidate.findFirst({
      where: { id: candidateId, electionId, withdrawnAt: null },
    });
    if (!candidate)
      throw new ApiError('Candidate not found or has withdrawn', 404);

    // Voter cannot vote for themselves (allowed by design — they're a candidate AND a voter)
    // This is intentional — democratic systems allow this

    // Snapshot PR balance as weight
    const voter = await prisma.user.findUnique({
      where: { id: voterId },
      select: { participationRights: true },
    });
    if (!voter) throw new ApiError('User not found', 404);

    const weight = Math.max(voter.participationRights, 1); // min weight 1 so everyone counts

    const vote = await prisma.electionVote.create({
      data: { electionId, candidateId, voterId, weight },
    });

    await auditService.log(
      voterId,
      AuditAction.ELECTION_VOTE_CAST,
      'Election',
      electionId,
      { candidateId, weight }
    );

    logger.info(
      { voterId, electionId, candidateId, weight },
      '[Elections] Vote cast'
    );
    return { id: vote.id };
  }

  // ── Status transitions (called by jobs) ─────────────────────────────────────

  /**
   * Transition PENDING → NOMINATIONS_OPEN for elections whose window has arrived.
   * Called by the daily open-nominations job.
   */
  async openNominations(): Promise<number> {
    const now = new Date();
    const result = await prisma.election.updateMany({
      where: { status: 'PENDING', nominationsOpenAt: { lte: now } },
      data: { status: 'NOMINATIONS_OPEN' },
    });
    if (result.count > 0) {
      logger.info({ count: result.count }, '[Elections] Nominations opened');
    }
    return result.count;
  }

  /**
   * Transition NOMINATIONS_OPEN → VOTING_OPEN (or schedule retry if 0 candidates).
   * Called by the daily open-voting job.
   */
  async openVoting(): Promise<number> {
    const now = new Date();
    const elections = await prisma.election.findMany({
      where: { status: 'NOMINATIONS_OPEN', nominationsCloseAt: { lte: now } },
      include: { candidates: { where: { withdrawnAt: null } } },
    });

    let opened = 0;
    for (const election of elections) {
      if (election.candidates.length === 0) {
        // No candidates — schedule retry in 14 days
        const retryDate = new Date(
          now.getTime() +
            ELECTION_WINDOWS.RETRY_ON_NO_CANDIDATES_DAYS * 86400000
        );
        await prisma.election.update({
          where: { id: election.id },
          data: {
            status: 'CLOSED',
            quorumReached: false,
            nextElectionAt: retryDate,
          },
        });
        logger.warn(
          { electionId: election.id },
          '[Elections] Election closed — no candidates; retry scheduled'
        );
      } else {
        await prisma.election.update({
          where: { id: election.id },
          data: { status: 'VOTING_OPEN' },
        });
        opened++;
      }
    }
    return opened;
  }

  /**
   * Tally results and close elections whose voting window has ended.
   * Called by the daily tally-results job.
   */
  async tallyAndCloseExpired(): Promise<number> {
    const now = new Date();
    const elections = await prisma.election.findMany({
      where: { status: 'VOTING_OPEN', votingCloseAt: { lte: now } },
    });

    for (const election of elections) {
      await this.tallyAndClose(election.id);
    }
    return elections.length;
  }

  /**
   * Tally a single election, apply result, close.
   */
  async tallyAndClose(electionId: string): Promise<void> {
    const election = await prisma.election.findUnique({
      where: { id: electionId },
    });
    if (!election) throw new ApiError('Election not found', 404);

    // Count eligible voters for quorum
    const eligibleCount =
      election.scope === 'GROUP'
        ? await this.countGroupEligibleMembers(
            election.groupId!,
            election.scope === 'GROUP'
          )
        : await this.countCountyEligibleMembers(election.countyId!);

    // Tally votes per candidate
    const candidates = await prisma.electionCandidate.findMany({
      where: { electionId, withdrawnAt: null },
    });

    const votes = await prisma.electionVote.findMany({
      where: { electionId },
    });

    const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
    const quorumReached = votes.length > eligibleCount / 2; // 50%+1

    // Tally per candidate
    const tally: Map<string, { weight: number; count: number }> = new Map();
    for (const vote of votes) {
      const current = tally.get(vote.candidateId) ?? { weight: 0, count: 0 };
      tally.set(vote.candidateId, {
        weight: current.weight + vote.weight,
        count: current.count + 1,
      });
    }

    // Update candidate tallies
    for (const candidate of candidates) {
      const t = tally.get(candidate.id) ?? { weight: 0, count: 0 };
      await prisma.electionCandidate.update({
        where: { id: candidate.id },
        data: { totalWeight: t.weight, voteCount: t.count },
      });
    }

    // Pick winner (highest weight; ties broken by voteCount, then alphabetical id)
    let winnerId: string | null = null;
    if (quorumReached && candidates.length > 0) {
      const sorted = [...candidates].sort((a, b) => {
        const ta = tally.get(a.id) ?? { weight: 0, count: 0 };
        const tb = tally.get(b.id) ?? { weight: 0, count: 0 };
        if (tb.weight !== ta.weight) return tb.weight - ta.weight;
        if (tb.count !== ta.count) return tb.count - ta.count;
        return a.userId < b.userId ? -1 : 1;
      });
      winnerId = sorted[0].userId;
    }

    const termMs =
      (election.termMonths ?? ELECTION_WINDOWS.GROUP_TERM_MONTHS) *
      30 *
      86400000;
    const retryMs = ELECTION_WINDOWS.RETRY_ON_NO_QUORUM_DAYS * 86400000;
    const nextElectionAt = new Date(
      Date.now() + (quorumReached ? termMs : retryMs)
    );

    await prisma.election.update({
      where: { id: electionId },
      data: {
        status: 'CLOSED',
        winnerId,
        totalVoteWeight: totalWeight,
        quorumReached,
        nextElectionAt,
      },
    });

    await auditService.log(
      'system',
      AuditAction.ELECTION_CLOSED,
      'Election',
      electionId,
      {
        winnerId,
        totalVoteWeight: totalWeight,
        quorumReached,
        eligibleCount,
        voteCount: votes.length,
      }
    );

    // Apply role if quorum reached and winner found
    if (quorumReached && winnerId) {
      await this.applyElectionResult(election, winnerId);
    } else {
      logger.warn(
        {
          electionId,
          quorumReached,
          winnerId,
          voteCount: votes.length,
          eligibleCount,
        },
        '[Elections] Election closed — no winner applied'
      );
    }
  }

  /**
   * Grant elected role to winner. Previous holder keeps role until this runs.
   */
  private async applyElectionResult(
    election: {
      id: string;
      scope: string;
      groupId: string | null;
      countyId: string | null;
      roleKey: string;
    },
    winnerId: string
  ): Promise<void> {
    if (election.scope === 'GROUP' && election.groupId) {
      // Revoke previous holder in this group
      await prisma.groupMember.updateMany({
        where: {
          groupId: election.groupId,
          role: election.roleKey as any,
          userId: { not: winnerId },
        },
        data: { role: 'MEMBER' },
      });

      // Grant role to winner (must be a group member)
      const member = await prisma.groupMember.findFirst({
        where: { groupId: election.groupId, userId: winnerId, active: true },
      });
      if (member) {
        await prisma.groupMember.update({
          where: { id: member.id },
          data: { role: election.roleKey as any },
        });
      }
    } else if (
      election.scope === 'SYSTEM' &&
      election.roleKey === 'COUNTY_COORDINATOR'
    ) {
      // Revoke previous system:county_coordinator for this county
      // UserRole doesn't have countyId; we revoke all existing county_coordinator roles for users in this county
      // For simplicity: upsert UserRole for winner, remove previous
      const previousRoles = await prisma.userRole.findMany({
        where: {
          role: { name: 'system:county_coordinator' },
          active: true,
          user: {
            primaryWard: { countyId: election.countyId! },
          },
        },
        include: { role: true },
      });
      for (const ur of previousRoles) {
        await prisma.userRole.update({
          where: { id: ur.id },
          data: { active: false },
        });
      }

      const coordinatorRole = await prisma.role.findFirst({
        where: { name: 'system:county_coordinator' },
      });
      if (coordinatorRole) {
        await prisma.userRole.upsert({
          where: {
            userId_roleId: { userId: winnerId, roleId: coordinatorRole.id },
          },
          create: {
            userId: winnerId,
            roleId: coordinatorRole.id,
            active: true,
          },
          update: { active: true },
        });
      }
    }

    await auditService.log(
      winnerId,
      AuditAction.ELECTION_ROLE_APPLIED,
      'Election',
      election.id,
      { roleKey: election.roleKey, scope: election.scope }
    );

    logger.info(
      { electionId: election.id, winnerId, roleKey: election.roleKey },
      '[Elections] Role applied to winner'
    );
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  async getElection(
    electionId: string,
    viewerId?: string
  ): Promise<ElectionDetailDto> {
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        candidates: {
          orderBy: { totalWeight: 'desc' },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        winner: { select: { id: true, name: true, avatarUrl: true } },
        group: { select: { id: true, name: true } },
        _count: { select: { votes: true } },
      },
    });
    if (!election) throw new ApiError('Election not found', 404);

    const myVote = viewerId
      ? await prisma.electionVote.findUnique({
          where: { electionId_voterId: { electionId, voterId: viewerId } },
        })
      : null;

    const myNomination = viewerId
      ? await prisma.electionCandidate.findUnique({
          where: {
            electionId_userId: { electionId: electionId, userId: viewerId },
          },
        })
      : null;

    return {
      id: election.id,
      roleKey: election.roleKey,
      scope: election.scope as 'GROUP' | 'SYSTEM',
      groupId: election.groupId ?? undefined,
      groupName: election.group?.name,
      countyId: election.countyId ?? undefined,
      status: election.status as ElectionDetailDto['status'],
      nominationsOpenAt: election.nominationsOpenAt.toISOString(),
      nominationsCloseAt: election.nominationsCloseAt.toISOString(),
      votingOpenAt: election.votingOpenAt.toISOString(),
      votingCloseAt: election.votingCloseAt.toISOString(),
      candidateCount: election.candidates.filter((c) => !c.withdrawnAt).length,
      totalVoteWeight: election.totalVoteWeight,
      quorumReached: election.quorumReached,
      winnerId: election.winnerId ?? undefined,
      winnerName: election.winner?.name ?? undefined,
      myVotedCandidateId: myVote?.candidateId,
      myNominationId:
        myNomination && !myNomination.withdrawnAt ? myNomination.id : undefined,
      candidates: election.candidates
        .filter((c) => !c.withdrawnAt || election.status === 'CLOSED')
        .map((c) => ({
          id: c.id,
          userId: c.userId,
          userName: c.user.name ?? 'Unknown',
          avatarUrl: c.user.avatarUrl ?? undefined,
          statement: c.statement ?? undefined,
          totalWeight: c.totalWeight,
          voteCount: c.voteCount,
          withdrawnAt: c.withdrawnAt?.toISOString(),
        })),
    };
  }

  async listElections(
    filters: ElectionFilters,
    viewerId?: string
  ): Promise<{ items: ElectionSummaryDto[]; total: number }> {
    const where: any = {};
    if (filters.groupId) where.groupId = filters.groupId;
    if (filters.countyId) where.countyId = filters.countyId;
    if (filters.scope) where.scope = filters.scope;
    if (filters.status) where.status = filters.status;

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const [elections, total] = await Promise.all([
      prisma.election.findMany({
        where,
        orderBy: { votingCloseAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          group: { select: { id: true, name: true } },
          winner: { select: { id: true, name: true } },
          _count: { select: { candidates: true, votes: true } },
        },
      }),
      prisma.election.count({ where }),
    ]);

    const myVotes = viewerId
      ? await prisma.electionVote.findMany({
          where: {
            voterId: viewerId,
            electionId: { in: elections.map((e) => e.id) },
          },
        })
      : [];

    const myNominations = viewerId
      ? await prisma.electionCandidate.findMany({
          where: {
            userId: viewerId,
            electionId: { in: elections.map((e) => e.id) },
            withdrawnAt: null,
          },
        })
      : [];

    const voteMap = new Map(myVotes.map((v) => [v.electionId, v.candidateId]));
    const nominationMap = new Map(
      myNominations.map((n) => [n.electionId, n.id])
    );

    return {
      total,
      items: elections.map((e) => ({
        id: e.id,
        roleKey: e.roleKey,
        scope: e.scope as 'GROUP' | 'SYSTEM',
        groupId: e.groupId ?? undefined,
        groupName: e.group?.name,
        countyId: e.countyId ?? undefined,
        status: e.status as ElectionSummaryDto['status'],
        nominationsOpenAt: e.nominationsOpenAt.toISOString(),
        nominationsCloseAt: e.nominationsCloseAt.toISOString(),
        votingOpenAt: e.votingOpenAt.toISOString(),
        votingCloseAt: e.votingCloseAt.toISOString(),
        candidateCount: e._count.candidates,
        totalVoteWeight: e.totalVoteWeight,
        quorumReached: e.quorumReached,
        winnerId: e.winnerId ?? undefined,
        winnerName: e.winner?.name ?? undefined,
        myVotedCandidateId: voteMap.get(e.id),
        myNominationId: nominationMap.get(e.id),
      })),
    };
  }

  async getMyActiveElections(userId: string): Promise<ElectionSummaryDto[]> {
    // Elections where the user is a group member or county member
    const userWithWard = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        primaryWardId: true,
        primaryWard: { select: { countyId: true } },
        groupMemberships: {
          where: { active: true },
          select: { groupId: true },
        },
      },
    });
    if (!userWithWard) return [];

    const groupIds = userWithWard.groupMemberships.map((m) => m.groupId);
    const countyId = userWithWard.primaryWard?.countyId;

    const where: any = {
      status: { in: ['NOMINATIONS_OPEN', 'VOTING_OPEN'] },
      OR: [
        ...(groupIds.length > 0
          ? [{ scope: 'GROUP', groupId: { in: groupIds } }]
          : []),
        ...(countyId ? [{ scope: 'SYSTEM', countyId }] : []),
      ],
    };
    if (!where.OR.length) return [];

    const result = await this.listElections(
      { status: undefined, ...{ page: 1, limit: 50 } },
      userId
    );
    return result.items.filter(
      (e) =>
        (e.scope === 'GROUP' && groupIds.includes(e.groupId!)) ||
        (e.scope === 'SYSTEM' && e.countyId === countyId)
    );
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private getGroupThreshold(
    roleKey: string,
    group: {
      isSystemGroup: boolean;
      systemType?: string | null;
      voluntaryType?: string | null;
    }
  ): number {
    if (!group.isSystemGroup) return ElectionThresholds.VOLUNTARY_GROUP_LEADER;
    if (group.systemType === 'WARD') return ElectionThresholds.WARD_LEADER;
    if (group.systemType === 'CONSTITUENCY')
      return ElectionThresholds.CONSTITUENCY_LEADER;
    if (group.systemType === 'COUNTY' || group.systemType === 'NATIONAL')
      return ElectionThresholds.COUNTY_LEADER;
    return ElectionThresholds.WARD_LEADER;
  }

  private async countGroupEligibleMembers(
    groupId: string,
    isSystemGroup: boolean
  ): Promise<number> {
    if (isSystemGroup) {
      return prisma.groupMember.count({
        where: {
          groupId,
          active: true,
          user: { communityVerified: true },
        },
      });
    }
    return prisma.groupMember.count({ where: { groupId, active: true } });
  }

  private async countCountyEligibleMembers(countyId: string): Promise<number> {
    return prisma.user.count({
      where: {
        communityVerified: true,
        primaryWard: { countyId },
      },
    });
  }

  private async hasActiveOrScheduledElection(
    scope: string,
    groupId?: string,
    countyId?: string,
    roleKey?: string
  ): Promise<boolean> {
    const where: any = {
      scope,
      status: { notIn: ['CLOSED'] },
    };
    if (groupId) where.groupId = groupId;
    if (countyId) where.countyId = countyId;
    if (roleKey) where.roleKey = roleKey;

    const count = await prisma.election.count({ where });
    return count > 0;
  }

  private async assertNominationEligible(
    userId: string,
    election: { scope: string; groupId: string | null; countyId: string | null }
  ): Promise<void> {
    if (election.scope === 'GROUP' && election.groupId) {
      const membership = await prisma.groupMember.findFirst({
        where: { userId, groupId: election.groupId, active: true },
      });
      if (!membership)
        throw new ApiError(
          'You must be a member of this group to nominate',
          403
        );
    } else if (election.scope === 'SYSTEM') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          communityVerified: true,
          primaryWard: { select: { countyId: true } },
        },
      });
      if (!user?.communityVerified)
        throw new ApiError(
          'You must be community verified to nominate for a system role',
          403
        );
      if (
        election.countyId &&
        user.primaryWard?.countyId !== election.countyId
      ) {
        throw new ApiError(
          'You must be a resident of this county to nominate',
          403
        );
      }
    }
  }

  private async assertVoteEligible(
    voterId: string,
    election: { scope: string; groupId: string | null; countyId: string | null }
  ): Promise<void> {
    if (election.scope === 'GROUP' && election.groupId) {
      const membership = await prisma.groupMember.findFirst({
        where: { userId: voterId, groupId: election.groupId, active: true },
      });
      if (!membership)
        throw new ApiError('You must be a member of this group to vote', 403);
    } else if (election.scope === 'SYSTEM') {
      const user = await prisma.user.findUnique({
        where: { id: voterId },
        select: {
          communityVerified: true,
          primaryWard: { select: { countyId: true } },
        },
      });
      if (!user?.communityVerified)
        throw new ApiError('You must be community verified to vote', 403);
      if (
        election.countyId &&
        user.primaryWard?.countyId !== election.countyId
      ) {
        throw new ApiError(
          'You must be a resident of this county to vote',
          403
        );
      }
    }
  }
}

export const electionService = new ElectionService();
