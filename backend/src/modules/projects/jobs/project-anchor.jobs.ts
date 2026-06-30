/**
 * @file src/modules/projects/jobs/project-anchor.jobs.ts
 * @description
 * On-demand worker job that mirrors a project lifecycle event on-chain — the
 * thesis of UjamaaDAO is "money + labor → outcomes, traceable," and projects are
 * where labor (verified work sessions) and outcomes live.
 *
 * Enqueued by project.service / work-session.service after the DB write. The
 * anchor is signed with the RECORDER_ROLE minter key which lives on the WORKER
 * only — so an event that happened on the web process still gets anchored here.
 * Mirrors the treasury ANCHOR_TREASURY_TX_JOB and the governance close job.
 *
 * Best-effort + null-guarded: a no-op when the chain is unconfigured
 * (getProjectRegistryContract() === null, i.e. no PROJECT_REGISTRY_ADDRESS /
 * minter key). The off-chain record is always the source of truth; anchoring is
 * a tamper-evident mirror that activates the moment the env is set — no code change.
 */

import { ethers } from 'ethers';
import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';
import { getProjectRegistryContract } from '../../../core/blockchain/client.js';
import { projectQueue } from '../../../core/queue/index.js';
import { ProjectJobName, type ProjectEventKind } from '../types.js';

/**
 * Enqueue a project lifecycle event to be mirrored on-chain by the worker (which
 * holds the minter key). Best-effort: a failed enqueue never blocks the DB write;
 * the job itself is a no-op until the chain is configured. jobId dedupes retries.
 */
export function enqueueProjectAnchor(
  kind: ProjectEventKind,
  entityId: string
): void {
  if (process.env.NODE_ENV === 'test') return;
  try {
    projectQueue
      .add(
        ProjectJobName.ANCHOR_PROJECT_EVENT,
        { kind, entityId },
        { jobId: `anchor-${kind}-${entityId}` }
      )
      .catch((err) =>
        logger.warn(
          { kind, entityId, err },
          '[PROJECT] Failed to enqueue on-chain anchor job'
        )
      );
  } catch (err) {
    logger.warn(
      { kind, entityId, err },
      '[PROJECT] Failed to enqueue on-chain anchor job'
    );
  }
}

const KIND_CODE: Record<ProjectEventKind, number> = {
  PROJECT_CREATED: 0,
  MILESTONE_VERIFIED: 1,
  WORK_APPROVED: 2,
  PROJECT_COMPLETED: 3,
};

/**
 * Anchor a single project lifecycle event on-chain and store the tx hash on the
 * source row. Skips if the row already carries an anchor for this event.
 */
export async function processAnchorProjectEvent(
  kind: ProjectEventKind,
  entityId: string
): Promise<void> {
  const registry = getProjectRegistryContract();
  if (!registry) return; // dormant — chain not configured

  try {
    const resolved = await resolveEvent(kind, entityId);
    if (!resolved || resolved.alreadyAnchored) return;

    const eventIdBytes32 = ethers.keccak256(
      ethers.toUtf8Bytes(`${KIND_CODE[kind]}:${entityId}`)
    );
    const projectIdBytes32 = ethers.keccak256(
      ethers.toUtf8Bytes(resolved.projectId)
    );
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes(resolved.payload));

    const chainTx = await registry.recordEvent(
      projectIdBytes32,
      eventIdBytes32,
      KIND_CODE[kind],
      dataHash
    );

    await resolved.persist(chainTx.hash);

    logger.info(
      { job: 'ANCHOR_PROJECT_EVENT', kind, entityId, txHash: chainTx.hash },
      '[PROJECT] Lifecycle event anchored on-chain'
    );
  } catch (err) {
    logger.warn(
      { job: 'ANCHOR_PROJECT_EVENT', kind, entityId, err },
      '[PROJECT] On-chain anchor failed — off-chain record intact'
    );
  }
}

interface ResolvedEvent {
  projectId: string;
  payload: string; // canonical event payload to hash
  alreadyAnchored: boolean;
  persist: (txHash: string) => Promise<unknown>;
}

/**
 * Load the source row for an event kind, build its canonical payload, and return
 * a persist() that writes the tx hash to the right column.
 */
async function resolveEvent(
  kind: ProjectEventKind,
  entityId: string
): Promise<ResolvedEvent | null> {
  switch (kind) {
    case 'PROJECT_CREATED':
    case 'PROJECT_COMPLETED': {
      const p = await prisma.project.findUnique({ where: { id: entityId } });
      if (!p) return null;
      return {
        projectId: p.id,
        payload: `${kind}:${p.id}:${p.proposalId ?? ''}:${p.ownerGroupId ?? ''}:${p.status}:${p.createdAt.toISOString()}`,
        alreadyAnchored: kind === 'PROJECT_CREATED' && !!p.anchorTxHash,
        persist: (txHash) =>
          prisma.project.update({
            where: { id: p.id },
            data: { anchorTxHash: txHash },
          }),
      };
    }
    case 'MILESTONE_VERIFIED': {
      const m = await prisma.milestone.findUnique({ where: { id: entityId } });
      if (!m) return null;
      return {
        projectId: m.projectId,
        payload: `MILESTONE_VERIFIED:${m.id}:${m.projectId}:${m.status}:${new Date().toISOString().slice(0, 10)}`,
        alreadyAnchored: !!m.anchorTxHash,
        persist: (txHash) =>
          prisma.milestone.update({
            where: { id: m.id },
            data: { anchorTxHash: txHash },
          }),
      };
    }
    case 'WORK_APPROVED': {
      const w = await prisma.workSession.findUnique({ where: { id: entityId } });
      if (!w) return null;
      return {
        projectId: w.projectId,
        payload: `WORK_APPROVED:${w.id}:${w.projectId}:${w.milestoneId}:${w.status}:${w.closedAt?.toISOString() ?? ''}`,
        alreadyAnchored: !!w.anchorTxHash,
        persist: (txHash) =>
          prisma.workSession.update({
            where: { id: w.id },
            data: { anchorTxHash: txHash },
          }),
      };
    }
    default:
      return null;
  }
}
