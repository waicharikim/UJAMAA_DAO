/**
 * @file src/modules/governance/baraza/baraza-deliberation.service.ts
 * @description
 * Baraza deliberation engine — orchestrates the full 7-agent debate cycle.
 *
 * Processing order per deliberation:
 *   1. Context assembly (proposal + treasury + past proposals + agent memory)
 *   2. Round 1  — 5 domain agents in parallel → Shahidi → Mpelelezi
 *   3. Round 2  — 5 domain agents (cross-agent response) → Shahidi → Mpelelezi
 *   4. Round 3  — 5 domain agents (final position) → Shahidi → Mpelelezi
 *   5. Mkutano  — Shahidi reads Mpelelezi transcript, Mpelelezi reads Shahidi transcript
 *   6. Scoring  — readiness score from transcript + Mkutano convergence
 *   7. Persist  — update BarazaDeliberation + all 7 BarazaAgentState records
 *
 * Graceful degradation: if Qwen is unavailable, the job is a no-op.
 * Never throws to the caller — all errors are caught and written to errorLog.
 */

import crypto from 'crypto';
import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';
import {
  complete,
  completeWithSearch,
  completeWithTools,
  completeJSON,
  isQwenAvailable,
  QWEN_MODEL,
  QWEN_ANALYST_MODEL,
} from '../../../core/ai/qwen.js';
import { DELIBERATION_TOOLS, executeDeliberationTool } from './agents/tools.js';
import {
  CONVENER_SYSTEM,
  buildConvenerUserMessage,
  mergeWithPriors,
  formatCastBlock,
  CLOSING_REVIEW_SYSTEM,
  buildClosingReviewMessage,
  normalizeReview,
  EMPTY_REVIEW,
  type ProposalCasting,
  type StructuralSeverity,
  type StructuralReview,
} from './agents/convener.js';
import { currentAffairsService } from '../current-affairs/current-affairs.service.js';
import { historianService } from '../historian/historian.service.js';
import {
  MHENGA_SYSTEM,
  buildHistorianMessage,
  formatFraming,
  type HistorianFraming,
  type PastDecisionItem,
} from './agents/historian.js';
import {
  AGENT_SYSTEM_PROMPTS,
  ANALYST_AGENT_KEYS,
  selectDomainPanel,
  ROUND_INSTRUCTIONS,
  MKUTANO_SHAHIDI_SYSTEM,
  MKUTANO_MPELELEZI_SYSTEM,
  injectPrompt,
  type AgentKey,
} from './agents/prompts.js';
import {
  KADERE_SYSTEM,
  KADERE_CLOSING_SYSTEM,
  buildKadereMessage,
  buildKadereClosingMessage,
  formatKadereForTranscript,
  type KadereReading,
} from './agents/values.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoundOutput {
  roundNumber: 1 | 2 | 3;
  domainPositions: Partial<Record<AgentKey, string>>;
  ukweliAnnotations: string;
  kivuliAnnotations: string;
  /** Kadere (values voice) — round 1 reading + optional round-3 closing. Advisory
   *  only; lives in the transcript, never fed into the readiness score. */
  kadereValues?: string;
}

interface MkutanoOutput {
  ukweliReading: string;
  kivuliReading: string;
  convergencePoints: string[];
  contradictionPoints: string[];
  fixabilityVerdict: string;
}

interface ConflictMap {
  coalitions: Coalition[];
  conflicts: Conflict[];
  consensus: string[];
  unresolved: string[];
  credibilityAnnotations: CredibilityAnnotation[];
  implementabilityRating: string;
  chokepoints: Chokepoint[];
}

interface Coalition {
  agents: AgentKey[];
  strength: number;
  sharedConcern: string;
}

interface Conflict {
  between: AgentKey[];
  intensity: number;
  issue: string;
}

interface CredibilityAnnotation {
  claim: string;
  agent: AgentKey;
  flag: 'SOUND' | 'QUESTIONABLE' | 'CONTESTED' | 'IDEOLOGICAL';
  hiddenPremise: string;
  unansweredQuestion: string;
}

interface Chokepoint {
  location: string;
  mechanism: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  routeAround: string | null;
}

interface ProposalContext {
  id: string;
  title: string;
  description: string;
  problem: string | null;
  solution: string | null;
  budget: string | null;
  fundingSource: string | null;
  rationale: string | null;
  alternatives: string | null;
  risks: unknown;
  timeline: unknown;
  costStructure: unknown;
  proposalType: string;
  proposalScope: string;
  groupName: string;
  isSystemGroup: boolean;
  wardName: string | null;
  constituencyName: string | null;
  countyName: string | null;
  treasuryBalance: number;
  memberCount: number;
  pastProposals: PastProposal[];
  currentAffairs: string;
  historicalContext: string;
}

interface PastProposal {
  title: string;
  status: string;
  outcome: string | null;
  createdAt: string;
}

// ─── Content hash ─────────────────────────────────────────────────────────────

/**
 * Produces a 64-char hex hash of the proposal's material content.
 * Used to detect whether the proposal has changed since last deliberation.
 */
export function buildContentHash(proposal: {
  title: string;
  description: string;
  budget?: unknown;
  problem?: string | null;
  solution?: string | null;
}): string {
  const content = JSON.stringify({
    title: proposal.title,
    description: proposal.description,
    budget: proposal.budget ?? null,
    problem: proposal.problem ?? null,
    solution: proposal.solution ?? null,
  });
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ─── Mhenga (the historian) — run-once framing pass ─────────────────────────────

/**
 * Mhenga situates the proposal in time — the community's own arc first, the
 * national arc only when it is load-bearing. Retrieves a scope-aware shortlist,
 * then frames it via the LLM ("how we got here" + "where this is heading") as a
 * pattern; falls back to the raw shortlist when the AI is unavailable, and to ''
 * when there is nothing on record to frame.
 */
async function runMhenga(
  proposalSummary: string,
  themes: string[],
  keywords: string[],
  groupId: string | undefined,
  includeNational: boolean,
  pastDecisions: PastDecisionItem[]
): Promise<string> {
  const events = await historianService.getRelevantHistory(
    themes,
    keywords,
    proposalSummary,
    groupId,
    includeNational
  );
  // Nothing on the (gated) timeline and no past decisions → nothing to frame.
  if (events.length === 0 && pastDecisions.length === 0) return '';
  if (!isQwenAvailable()) return historianService.formatHistory(events);
  try {
    const framing = await completeJSON<HistorianFraming>({
      system: MHENGA_SYSTEM,
      userMessage: buildHistorianMessage(proposalSummary, events, pastDecisions),
      maxTokens: 1024,
      model: QWEN_ANALYST_MODEL,
    });
    return formatFraming(framing) || historianService.formatHistory(events);
  } catch {
    return historianService.formatHistory(events);
  }
}

const NATIONAL_REGISTER_SIGNALS = [
  'land',
  'title deed',
  'tenure',
  'evict',
  'displac',
  'settlement',
  'governance',
  'policy',
  'bylaw',
  'constitution',
  'devolution',
  'rights',
  'election',
  'representation',
  'tax',
  'levy',
  'debt',
  'loan',
  'subsidy',
  'fuel',
  'cost of living',
  'county',
  'constituency',
];

/**
 * Register gate: should Mhenga pull in the shared NATIONAL arc for this proposal,
 * or stay with the community's own history? National framing is reserved for
 * load-bearing matters — policy/rule decisions, strategic or emergency proposals,
 * and anything touching land, governance, rights, taxation or the wider economy —
 * so routine local operational proposals are not inflated into national grandeur.
 */
function nationalArcIsLoadBearing(
  proposal: { kind: string; proposalType: string },
  proposalText: string
): boolean {
  if (proposal.kind === 'POLICY') return true;
  if (
    proposal.proposalType === 'STRATEGIC_DECISION' ||
    proposal.proposalType === 'EMERGENCY'
  ) {
    return true;
  }
  const text = proposalText.toLowerCase();
  return NATIONAL_REGISTER_SIGNALS.some((s) => text.includes(s));
}

// ─── Context assembly ─────────────────────────────────────────────────────────

async function assembleProposalContext(
  proposalId: string
): Promise<ProposalContext | null> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      group: {
        include: {
          ward: true,
          constituency: true,
          county: true,
          treasury: true,
          members: { where: { active: true }, select: { id: true } },
        },
      },
    },
  });

  if (!proposal || !proposal.group) return null;

  // Past proposals from same group — most recent 5 that reached a terminal state
  const pastProposals = await prisma.proposal.findMany({
    where: {
      groupId: proposal.groupId ?? undefined,
      id: { not: proposalId },
      status: { in: ['APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'] as any },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      title: true,
      status: true,
      outcome: true,
      createdAt: true,
    },
  });

  const treasury = proposal.group.treasury[0];
  const currentAffairs = await currentAffairsService.formatForDeliberation();
  const proposalText = `${proposal.title} ${proposal.description} ${proposal.problem ?? ''} ${proposal.solution ?? ''}`;
  const pastDecisions: PastDecisionItem[] = pastProposals.map((p) => ({
    title: p.title,
    outcome: p.outcome ?? p.status,
    year: p.createdAt.getFullYear(),
  }));
  const historicalContext = await runMhenga(
    `${proposal.title}\n${proposal.description}\n${proposal.problem ?? ''}\n${proposal.solution ?? ''}`,
    [proposal.proposalType.toLowerCase()],
    proposalText.split(/\W+/).filter(Boolean),
    proposal.groupId ?? undefined,
    nationalArcIsLoadBearing(proposal, proposalText),
    pastDecisions
  );

  return {
    id: proposal.id,
    title: proposal.title,
    description: proposal.description,
    problem: proposal.problem,
    solution: proposal.solution,
    budget: proposal.budget?.toString() ?? null,
    fundingSource: proposal.fundingSource,
    rationale: proposal.rationale,
    alternatives: proposal.alternatives,
    risks: proposal.risks,
    timeline: proposal.timeline,
    costStructure: proposal.costStructure,
    proposalType: proposal.proposalType,
    proposalScope: proposal.proposalScope,
    groupName: proposal.group.name,
    isSystemGroup: proposal.group.isSystemGroup,
    wardName: proposal.group.ward?.name ?? null,
    constituencyName: proposal.group.constituency?.name ?? null,
    countyName: proposal.group.county?.name ?? null,
    treasuryBalance: treasury ? Number(treasury.balance) : 0,
    memberCount: proposal.group.members.length,
    pastProposals: pastProposals.map((p) => ({
      title: p.title,
      status: p.status,
      outcome: p.outcome,
      createdAt: p.createdAt.toISOString().slice(0, 10),
    })),
    currentAffairs,
    historicalContext,
  };
}

function formatProposalContext(ctx: ProposalContext): string {
  const location = [ctx.wardName, ctx.constituencyName, ctx.countyName]
    .filter(Boolean)
    .join(', ');

  const pastSection =
    ctx.pastProposals.length > 0
      ? `\nPAST PROPOSALS FROM THIS GROUP:\n${ctx.pastProposals
          .map(
            (p) =>
              `- "${p.title}" | ${p.status} | ${p.createdAt}${p.outcome ? ` | Outcome: ${p.outcome}` : ''}`
          )
          .join('\n')}`
      : '\nPAST PROPOSALS: None on record.';

  const currentSection = ctx.currentAffairs ? `\n${ctx.currentAffairs}\n` : '';
  const historicalSection = ctx.historicalContext
    ? `\n${ctx.historicalContext}\n`
    : '';

  return `PROPOSAL: ${ctx.title}
TYPE: ${ctx.proposalType} | SCOPE: ${ctx.proposalScope}
GROUP: ${ctx.groupName} | LOCATION: ${location || 'Not specified'}
MEMBERS: ${ctx.memberCount} | TREASURY BALANCE: KES ${ctx.treasuryBalance.toLocaleString()}
${currentSection}${historicalSection}
DESCRIPTION:
${ctx.description}

PROBLEM BEING ADDRESSED:
${ctx.problem ?? '(not specified)'}

PROPOSED SOLUTION:
${ctx.solution ?? '(not specified)'}

BUDGET: ${ctx.budget ? `KES ${ctx.budget}` : '(not specified)'}
FUNDING SOURCE: ${ctx.fundingSource ?? '(not specified)'}

RATIONALE (why this, not something else):
${ctx.rationale ?? '(not provided)'}

ALTERNATIVES CONSIDERED:
${ctx.alternatives ?? '(not provided)'}

RISKS IDENTIFIED BY AUTHOR:
${ctx.risks ? JSON.stringify(ctx.risks, null, 2) : '(not provided)'}

COST STRUCTURE:
${ctx.costStructure ? JSON.stringify(ctx.costStructure, null, 2) : '(not provided)'}
${pastSection}`;
}

// ─── Agent memory loading ─────────────────────────────────────────────────────

/**
 * Close the deliberation memory loop. When a proposal's real-world outcome is
 * recorded (ward memory), back-fill it into every agent's episodic memory for
 * that group — so the agents learn how their past positions actually turned out,
 * not just what they argued. Best-effort: never throws into the caller.
 *
 * Matches episodic entries by proposalId across all agents that deliberated in
 * the proposal's group; resolves the group from the deliberation record so it
 * always aligns with how the agent state was originally written.
 */
export async function recordProposalOutcomeInMemory(
  proposalId: string,
  proposalOutcome: string
): Promise<void> {
  try {
    const summary = proposalOutcome.trim().slice(0, 300);
    if (!summary) return;

    const deliberation = await prisma.barazaDeliberation.findFirst({
      where: { proposalId },
      select: { groupId: true },
    });
    if (!deliberation) return; // proposal was never deliberated — nothing to learn

    const states = await prisma.barazaAgentState.findMany({
      where: { groupId: deliberation.groupId },
      select: { id: true, episodicLog: true },
    });

    for (const state of states) {
      const log = Array.isArray(state.episodicLog)
        ? (state.episodicLog as any[])
        : [];
      let changed = false;
      const updated = log.map((e: any) => {
        if (e && e.proposalId === proposalId && e.proposalOutcome !== summary) {
          changed = true;
          return { ...e, proposalOutcome: summary };
        }
        return e;
      });
      if (changed) {
        await prisma.barazaAgentState.update({
          where: { id: state.id },
          data: { episodicLog: updated },
        });
      }
    }
  } catch (err) {
    logger.warn(
      { err, proposalId },
      '[BarazaDeliberation] Failed to back-fill proposal outcome into agent memory'
    );
  }
}

async function loadAgentMemory(
  groupId: string,
  agentKey: AgentKey
): Promise<string> {
  const state = await prisma.barazaAgentState.findUnique({
    where: { groupId_agentKey: { groupId, agentKey } },
  });

  if (!state) {
    return `[No prior deliberations on record for ${agentKey} in this group. This is your first deliberation here.]`;
  }

  const episodicSummary =
    state.episodicLog && Array.isArray(state.episodicLog)
      ? `EPISODIC MEMORY (last ${(state.episodicLog as any[]).length} deliberations):\n${(
          state.episodicLog as any[]
        )
          .slice(-10)
          .map((e: any) => {
            const realOutcome =
              e.proposalOutcome && e.proposalOutcome !== 'PENDING'
                ? ` | Real outcome: ${e.proposalOutcome}`
                : '';
            return `- "${e.proposalTitle}" | ${e.date} | Your outcome: ${e.outcome}${realOutcome} | Final position: ${e.finalPosition}`;
          })
          .join('\n')}`
      : 'EPISODIC MEMORY: No prior episodes.';

  const relationalSummary =
    state.relationalMap && Array.isArray(state.relationalMap)
      ? `RELATIONAL MAP (how your understanding has evolved with other agents):\n${(
          state.relationalMap as any[]
        )
          .map(
            (r: any) =>
              `- With ${r.withAgent}: ${(r.interactions as any[])
                .slice(-3)
                .map((i: any) => `${i.type} on "${i.topic}"`)
                .join(', ')}`
          )
          .join('\n')}`
      : 'RELATIONAL MAP: No prior interactions.';

  const specialMemory =
    agentKey === 'SHAHIDI' && state.premisePatterns
      ? `\nPREMISE PATTERN LIBRARY (${(state.premisePatterns as any[]).length} patterns identified across all deliberations):\n${(
          state.premisePatterns as any[]
        )
          .slice(-15)
          .map((p: any) => `- "${p.pattern}" (seen ${p.frequency}x)`)
          .join('\n')}`
      : agentKey === 'MPELELEZI' && state.powerStructureMap
        ? `\nPOWER STRUCTURE MAP:\n${JSON.stringify(state.powerStructureMap, null, 2)}`
        : '';

  return `DELIBERATIONS IN THIS GROUP: ${state.deliberationCount}
BEHAVIOURAL PROFILE: Rigidity ${(state.rigidityScore * 100).toFixed(0)}% | Responsiveness ${(state.responsivenessScore * 100).toFixed(0)}%

${episodicSummary}

${relationalSummary}${specialMemory}`;
}

/** Placeholder stored when a domain agent's AI call returns nothing. */
const AGENT_NO_RESPONSE = '[Agent did not respond]';

// ─── Convener (Mjamaa) ──────────────────────────────────────────────────────────

/**
 * Mjamaa runs once before the rounds: reads the proposal and casts each domain
 * agent's life-stage × exposure voice (whom this proposal most affects), plus a
 * structural note. Falls back to default priors when the AI is unavailable or
 * returns nothing/invalid — the council always ends up with a valid casting.
 */
async function runConvener(
  proposalContextStr: string,
  domainKeys: AgentKey[],
  mjamaaMemory: string
): Promise<ProposalCasting> {
  if (!isQwenAvailable()) return mergeWithPriors(null, domainKeys);
  try {
    const result = await completeJSON<ProposalCasting>({
      system: CONVENER_SYSTEM,
      userMessage: buildConvenerUserMessage(
        proposalContextStr,
        domainKeys,
        mjamaaMemory
      ),
      maxTokens: 1024,
      model: QWEN_ANALYST_MODEL,
    });
    return mergeWithPriors(result, domainKeys);
  } catch {
    return mergeWithPriors(null, domainKeys);
  }
}

// ─── Mjamaa's own per-group memory (structural observations) ────────────────────
// Mjamaa is run-once (the convener), but it remembers each group's structural
// patterns across deliberations so its reads compound over time.

async function loadMjamaaMemory(groupId: string): Promise<string> {
  const state = await prisma.barazaAgentState.findUnique({
    where: { groupId_agentKey: { groupId, agentKey: 'MJAMAA' } },
  });
  const log = Array.isArray(state?.episodicLog)
    ? (state!.episodicLog as any[])
    : [];
  if (log.length === 0) {
    return '[No prior structural observations for this group — this is your first read here.]';
  }
  return log
    .slice(-8)
    .map(
      (e: any) =>
        `- "${e.proposalTitle}" (${e.date}) [${e.structuralSeverity ?? 'NONE'}]: ${e.structuralNote || 'no issues noted'}`
    )
    .join('\n');
}

async function persistMjamaaMemory(
  groupId: string,
  proposalId: string,
  proposalTitle: string,
  casting: ProposalCasting
): Promise<void> {
  try {
    const existing = await prisma.barazaAgentState.findUnique({
      where: { groupId_agentKey: { groupId, agentKey: 'MJAMAA' } },
    });
    const log = Array.isArray(existing?.episodicLog)
      ? (existing!.episodicLog as any[])
      : [];
    const entry = {
      proposalId,
      proposalTitle,
      date: new Date().toISOString().slice(0, 10),
      structuralNote: casting.structuralNote.slice(0, 300),
      structuralSeverity: casting.structuralSeverity,
    };
    const newLog = [...log, entry].slice(-50);
    await prisma.barazaAgentState.upsert({
      where: { groupId_agentKey: { groupId, agentKey: 'MJAMAA' } },
      create: {
        groupId,
        agentKey: 'MJAMAA',
        deliberationCount: 1,
        episodicLog: newLog as any,
      },
      update: {
        deliberationCount: { increment: 1 },
        episodicLog: newLog as any,
      },
    });
  } catch (err) {
    logger.warn(
      { err, groupId, proposalId },
      '[BARAZA] Failed to persist Mjamaa memory'
    );
  }
}

/**
 * Mjamaa's closing pass: vet the council's PROPOSED REVISIONS for structural
 * soundness. Run-once at the end — the only new structural surface to react to is
 * the fixes the council invents (the proposal text itself is fixed across rounds).
 * No-op when there are no revisions or the AI is unavailable.
 */
async function runClosingReview(
  proposalContextStr: string,
  casting: ProposalCasting,
  revisions: string[],
  mjamaaMemory: string
): Promise<StructuralReview> {
  if (revisions.length === 0 || !isQwenAvailable()) return EMPTY_REVIEW;
  try {
    const result = await completeJSON<StructuralReview>({
      system: CLOSING_REVIEW_SYSTEM,
      userMessage: buildClosingReviewMessage(
        proposalContextStr,
        casting,
        revisions,
        mjamaaMemory
      ),
      maxTokens: 1024,
      model: QWEN_ANALYST_MODEL,
    });
    return normalizeReview(result);
  } catch {
    return EMPTY_REVIEW;
  }
}

// ─── Round runner ─────────────────────────────────────────────────────────────

async function runDomainAgentsRound(
  roundNumber: 1 | 2 | 3,
  proposalContextStr: string,
  agentMemories: Record<AgentKey, string>,
  previousRounds: RoundOutput[],
  groupId: string,
  domainKeys: AgentKey[],
  casting: ProposalCasting
): Promise<Partial<Record<AgentKey, string>>> {
  const roundKey = `round${roundNumber}` as keyof typeof ROUND_INSTRUCTIONS;
  const roundInstruction = ROUND_INSTRUCTIONS[roundKey];

  // Build transcript injection for rounds 2 and 3
  const round1Transcript = previousRounds[0]
    ? formatRoundTranscript(previousRounds[0])
    : '';
  const round2Transcript = previousRounds[1]
    ? formatRoundTranscript(previousRounds[1])
    : '';

  const userMessage = roundInstruction
    .replace('{{ROUND_1_TRANSCRIPT}}', round1Transcript)
    .replace('{{ROUND_2_TRANSCRIPT}}', round2Transcript);

  // Run the selected panel's domain agents in parallel
  const results = await Promise.all(
    domainKeys.map(async (agentKey) => {
      const systemPrompt =
        formatCastBlock(casting.casting[agentKey]) +
        injectPrompt(AGENT_SYSTEM_PROMPTS[agentKey], {
          AGENT_MEMORY: agentMemories[agentKey],
          PROPOSAL_CONTEXT: proposalContextStr,
        });

      // Round 1: agents may fetch real group data to ground their initial
      // position. Rounds 2–3 react to the transcript (which already carries the
      // grounded round-1 positions), so no extra fetches — keeps cost bounded.
      const response =
        roundNumber === 1
          ? await completeWithTools({
              system: systemPrompt,
              userMessage,
              tools: DELIBERATION_TOOLS,
              executeTool: (name, args) =>
                executeDeliberationTool(name, args, groupId),
              maxRounds: 1,
              maxTokens: 2048,
              model: QWEN_MODEL,
            })
          : await complete({
              system: systemPrompt,
              userMessage,
              maxTokens: 2048, // 2–4 paragraphs per the prompts — avoid truncation
              model: QWEN_MODEL,
            });

      return [agentKey, response ?? AGENT_NO_RESPONSE] as const;
    })
  );

  return Object.fromEntries(results);
}

async function runShahidi(
  roundNumber: 1 | 2 | 3,
  proposalContextStr: string,
  agentMemory: string,
  currentRoundPositions: Partial<Record<AgentKey, string>>,
  previousRounds: RoundOutput[]
): Promise<string> {
  const roundTranscript = formatDomainPositions(currentRoundPositions);

  // Shahidi sees all previous round transcripts for context evolution tracking
  const fullContext =
    previousRounds.length > 0
      ? previousRounds.map(formatRoundTranscript).join('\n\n---\n\n') +
        '\n\n---\n\nCURRENT ROUND:\n' +
        roundTranscript
      : roundTranscript;

  const systemPrompt = injectPrompt(AGENT_SYSTEM_PROMPTS.SHAHIDI, {
    AGENT_MEMORY: agentMemory,
    PROPOSAL_CONTEXT: proposalContextStr,
    ROUND_N_TRANSCRIPT: fullContext,
  });

  // Shahidi uses web search for premise interrogation
  const response = await completeWithSearch({
    system: systemPrompt,
    userMessage: `Round ${roundNumber} — produce your credibility annotations for the positions above.`,
    maxTokens: 1500,
    model: QWEN_ANALYST_MODEL,
  });

  return response ?? '[Shahidi did not respond]';
}

async function runMpelelezi(
  roundNumber: 1 | 2 | 3,
  proposalContextStr: string,
  agentMemory: string,
  currentRoundPositions: Partial<Record<AgentKey, string>>,
  ukweliAnnotations: string,
  previousRounds: RoundOutput[],
  groupId: string
): Promise<string> {
  const roundTranscript = formatDomainPositions(currentRoundPositions);

  const fullContext =
    previousRounds.length > 0
      ? previousRounds.map(formatRoundTranscript).join('\n\n---\n\n') +
        '\n\n---\n\nCURRENT ROUND:\n' +
        roundTranscript
      : roundTranscript;

  const systemPrompt = injectPrompt(AGENT_SYSTEM_PROMPTS.MPELELEZI, {
    AGENT_MEMORY: agentMemory,
    PROPOSAL_CONTEXT: proposalContextStr,
    ROUND_N_TRANSCRIPT: fullContext,
    SHAHIDI_ANNOTATIONS: `SHAHIDI'S ANNOTATIONS FOR THIS ROUND:\n${ukweliAnnotations}`,
  });

  // Mpelelezi grounds its implementability/power analysis in the group's real
  // treasury, precedent and leadership data every round.
  const response = await completeWithTools({
    system: systemPrompt,
    userMessage: `Round ${roundNumber} — produce your implementability assessment.`,
    tools: DELIBERATION_TOOLS,
    executeTool: (name, args) => executeDeliberationTool(name, args, groupId),
    maxRounds: 2,
    maxTokens: 1500,
    model: QWEN_ANALYST_MODEL,
  });

  return response ?? '[Mpelelezi did not respond]';
}

// ─── Kadere (the values voice) ──────────────────────────────────────────────────

/**
 * Kadere reads whether the proposal coheres with the community's DECLARED values.
 * A labelled, rebuttable voice — advisory only, deliberately NOT fed into the
 * readiness score. Self-gates: brief "no values tension" when values aren't
 * materially implicated, a short reading when they are. Fails open (no Qwen → no
 * Kadere block). Runs once in round 1.
 */
async function runKadere(
  proposalContextStr: string,
  round1Positions: Partial<Record<AgentKey, string>>
): Promise<KadereReading> {
  if (!isQwenAvailable()) return { hasValuesTension: false, text: '' };
  try {
    const reading = await completeJSON<KadereReading>({
      system: KADERE_SYSTEM,
      userMessage: buildKadereMessage(
        proposalContextStr,
        formatDomainPositions(round1Positions)
      ),
      maxTokens: 700,
      model: QWEN_ANALYST_MODEL,
    });
    if (!reading || typeof reading.text !== 'string') {
      return { hasValuesTension: false, text: '' };
    }
    return {
      hasValuesTension: reading.hasValuesTension === true,
      text: reading.text,
    };
  } catch {
    return { hasValuesTension: false, text: '' };
  }
}

/**
 * Kadere's brief closing word — only when it flagged a values tension in round 1.
 * Reads the deliberation so far and says whether that tension was addressed.
 */
async function runKadereClosing(
  proposalContextStr: string,
  previousRounds: RoundOutput[]
): Promise<string> {
  if (!isQwenAvailable()) return '';
  try {
    const transcript = previousRounds.map(formatRoundTranscript).join('\n\n---\n\n');
    const text = await complete({
      system: KADERE_CLOSING_SYSTEM,
      userMessage: buildKadereClosingMessage(proposalContextStr, transcript),
      maxTokens: 400,
      model: QWEN_ANALYST_MODEL,
    });
    return text ?? '';
  } catch {
    return '';
  }
}

// ─── Mkutano ──────────────────────────────────────────────────────────────────

async function runMkutano(
  rounds: RoundOutput[],
  ukweliMemory: string,
  kivuliMemory: string
): Promise<MkutanoOutput> {
  const ukweliFullTranscript = rounds
    .map((r) => `Round ${r.roundNumber}:\n${r.ukweliAnnotations}`)
    .join('\n\n---\n\n');

  const kivuliFullTranscript = rounds
    .map((r) => `Round ${r.roundNumber}:\n${r.kivuliAnnotations}`)
    .join('\n\n---\n\n');

  // Run in parallel — they read each other's complete transcripts simultaneously
  const [ukweliReading, kivuliReading] = await Promise.all([
    complete({
      system: MKUTANO_SHAHIDI_SYSTEM.replace(
        '{{MPELELEZI_TRANSCRIPT}}',
        kivuliFullTranscript
      ),
      userMessage:
        'Produce your Mkutano analysis: convergence points, contradiction points, and fixability assessment.',
      maxTokens: 1500,
      model: QWEN_ANALYST_MODEL,
    }),
    complete({
      system: MKUTANO_MPELELEZI_SYSTEM.replace(
        '{{SHAHIDI_TRANSCRIPT}}',
        ukweliFullTranscript
      ),
      userMessage:
        'Produce your Mkutano analysis: convergence points, contradiction points, and routing opportunities.',
      maxTokens: 1500,
      model: QWEN_ANALYST_MODEL,
    }),
  ]);

  // Extract structured convergence/contradiction from both readings
  const mkutanoStructure = await completeJSON<{
    convergencePoints: string[];
    contradictionPoints: string[];
    fixabilityVerdict: string;
  }>({
    system: `You are a synthesis engine. Read the two Mkutano analyses and extract structured data.`,
    userMessage: `Extract from these two analyses:
1. All convergence points (where both analyses agree on a weakness)
2. All contradiction points (where they diverge)
3. A fixability verdict (are the core weaknesses fixable by changing the proposal, or do they require changing the conditions?)

SHAHIDI'S MKUTANO READING:
${ukweliReading ?? '(unavailable)'}

MPELELEZI'S MKUTANO READING:
${kivuliReading ?? '(unavailable)'}

Return JSON: { "convergencePoints": string[], "contradictionPoints": string[], "fixabilityVerdict": string }`,
    maxTokens: 2000,
    model: QWEN_ANALYST_MODEL,
  });

  return {
    ukweliReading: ukweliReading ?? '[Shahidi Mkutano unavailable]',
    kivuliReading: kivuliReading ?? '[Mpelelezi Mkutano unavailable]',
    convergencePoints: mkutanoStructure?.convergencePoints ?? [],
    contradictionPoints: mkutanoStructure?.contradictionPoints ?? [],
    fixabilityVerdict:
      mkutanoStructure?.fixabilityVerdict ?? 'Assessment unavailable.',
  };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

async function computeReadinessScore(
  rounds: RoundOutput[],
  mkutano: MkutanoOutput,
  agentStates: Partial<Record<AgentKey, any>>,
  structuralSeverity: StructuralSeverity = 'NONE'
): Promise<{
  score: number;
  band: string;
  conflictMap: ConflictMap;
  revisionSuggestions: string[];
}> {
  const fullTranscript = rounds.map(formatRoundTranscript).join('\n\n---\n\n');

  const structured = await completeJSON<{
    coalitions: Coalition[];
    conflicts: Conflict[];
    consensus: string[];
    unresolved: string[];
    credibilityAnnotations: CredibilityAnnotation[];
    implementabilityRating: string;
    chokepoints: Chokepoint[];
    revisionSuggestions: string[];
    baseConsensusRatio: number;
  }>({
    system: `You are a governance analysis engine. Extract structured conflict map data from a multi-agent deliberation transcript. Return only valid JSON matching the requested schema exactly.`,
    userMessage: `Extract the conflict map from this deliberation transcript.

TRANSCRIPT:
${fullTranscript}

MKUTANO CONVERGENCE POINTS:
${mkutano.convergencePoints.join('\n')}

MKUTANO CONTRADICTION POINTS:
${mkutano.contradictionPoints.join('\n')}

Return JSON with this exact shape:
{
  "coalitions": [{ "agents": AgentKey[], "strength": 0-1, "sharedConcern": string }],
  "conflicts": [{ "between": AgentKey[], "intensity": 0-1, "issue": string }],
  "consensus": string[],
  "unresolved": string[],
  "credibilityAnnotations": [{ "claim": string, "agent": AgentKey, "flag": "SOUND"|"QUESTIONABLE"|"CONTESTED"|"IDEOLOGICAL", "hiddenPremise": string, "unansweredQuestion": string }],
  "implementabilityRating": string,
  "chokepoints": [{ "location": string, "mechanism": string, "severity": "HIGH"|"MEDIUM"|"LOW", "routeAround": string|null }],
  "revisionSuggestions": string[],
  "baseConsensusRatio": 0-1
}`,
    // qwen-max + a larger budget: the conflict map is a big structured object;
    // qwen-plus / a tight token cap was under-extracting (empty coalitions/conflicts).
    maxTokens: 4000,
    model: QWEN_ANALYST_MODEL,
  });

  // ── Readiness score calculation ─────────────────────────────────────────────
  const base = Math.round((structured?.baseConsensusRatio ?? 0.5) * 100);

  // Coalition bonus: +5 per coalition, max +15
  const coalitionBonus = Math.min(
    (structured?.coalitions?.length ?? 0) * 5,
    15
  );

  // Isolation penalty: -10 for each HIGH-intensity solo conflict
  const highConflicts =
    structured?.conflicts?.filter(
      (c) => c.intensity > 0.7 && c.between.length === 2
    ) ?? [];
  const isolationPenalty = Math.min(highConflicts.length * 10, 20);

  // Mkutano convergence: if Shahidi and Mpelelezi agree on serious weaknesses,
  // penalise based on convergence count
  const convergencePenalty = Math.min(mkutano.convergencePoints.length * 8, 24);

  // Mkutano contradiction bonus: genuine divergence means the proposal has
  // aspects that are either more complex or more resilient than they appear
  const contradictionBonus = Math.min(
    mkutano.contradictionPoints.length * 3,
    9
  );

  // HIGH chokepoints with no route around: -8 each
  const unchannelledChokepoints = (structured?.chokepoints ?? []).filter(
    (c) => c.severity === 'HIGH' && !c.routeAround
  );
  const chokepointPenalty = Math.min(unchannelledChokepoints.length * 8, 16);

  // Mjamaa's structural verdict: a MAJOR structural flaw (mis-scoping, unfundable,
  // wrong review path) weighs heavily on readiness; MINOR is a nudge.
  const structuralPenalty =
    structuralSeverity === 'MAJOR'
      ? 15
      : structuralSeverity === 'MINOR'
        ? 6
        : 0;

  const rawScore =
    base +
    coalitionBonus -
    isolationPenalty -
    convergencePenalty +
    contradictionBonus -
    chokepointPenalty -
    structuralPenalty;

  const score = Math.max(0, Math.min(100, rawScore));

  const band =
    score >= 85
      ? 'READY'
      : score >= 65
        ? 'CONDITIONAL'
        : score >= 40
          ? 'SIGNIFICANT_CONCERNS'
          : 'NOT_READY';

  return {
    score,
    band,
    conflictMap: {
      coalitions: structured?.coalitions ?? [],
      conflicts: structured?.conflicts ?? [],
      consensus: structured?.consensus ?? [],
      unresolved: structured?.unresolved ?? [],
      credibilityAnnotations: structured?.credibilityAnnotations ?? [],
      implementabilityRating:
        structured?.implementabilityRating ?? 'Not assessed.',
      chokepoints: structured?.chokepoints ?? [],
    },
    revisionSuggestions: structured?.revisionSuggestions ?? [],
  };
}

// ─── Memory update ────────────────────────────────────────────────────────────

async function updateAgentMemory(
  groupId: string,
  deliberationId: string,
  proposalId: string,
  proposalTitle: string,
  rounds: RoundOutput[],
  agentKey: AgentKey
): Promise<void> {
  const existing = await prisma.barazaAgentState.findUnique({
    where: { groupId_agentKey: { groupId, agentKey } },
  });

  // Build episodic entry for this deliberation
  const roundSummaries = rounds.map(
    (r) =>
      r.domainPositions[agentKey] ??
      r.ukweliAnnotations ??
      r.kivuliAnnotations ??
      ''
  );

  // Detect outcome: did this agent concede, ally, or hold?
  // Simple heuristic: compare Round 1 and Round 3 positions for domain agents
  const round1 = rounds[0]?.domainPositions[agentKey] ?? '';
  const round3 = rounds[2]?.domainPositions[agentKey] ?? '';
  const outcome = detectOutcome(round1, round3);

  const newEntry = {
    proposalId,
    proposalTitle,
    deliberationId,
    date: new Date().toISOString().slice(0, 10),
    roundSummaries: roundSummaries.map((s) => s.slice(0, 300)),
    finalPosition: round3.slice(0, 500),
    outcome,
    proposalOutcome: 'PENDING',
  };

  const existingLog = (existing?.episodicLog as any[]) ?? [];
  const newLog = [...existingLog, newEntry].slice(-50); // prune to last 50

  // Update relational map based on cross-agent challenges in Round 2
  const round2 = rounds[1];
  const updatedRelationalMap = updateRelationalMap(
    (existing?.relationalMap as any[]) ?? [],
    agentKey,
    round2,
    proposalId,
    deliberationId
  );

  // Update behavioural scores
  const conceded = outcome === 'CONCEDED';
  const held = outcome === 'HELD';
  const currentRigidity = existing?.rigidityScore ?? 0.5;
  const currentResponsiveness = existing?.responsivenessScore ?? 0.5;

  // Nudge scores based on outcome — small adjustments accumulate over time
  const newRigidity = held
    ? Math.min(1.0, currentRigidity + 0.02)
    : Math.max(0.0, currentRigidity - 0.01);
  const newResponsiveness = conceded
    ? Math.min(1.0, currentResponsiveness + 0.02)
    : Math.max(0.0, currentResponsiveness - 0.01);

  await prisma.barazaAgentState.upsert({
    where: { groupId_agentKey: { groupId, agentKey } },
    create: {
      groupId,
      agentKey: agentKey as any,
      deliberationCount: 1,
      concessionCount: conceded ? 1 : 0,
      holdCount: held ? 1 : 0,
      allianceCount: outcome === 'ALLIED' ? 1 : 0,
      rigidityScore: newRigidity,
      responsivenessScore: newResponsiveness,
      episodicLog: newLog,
      relationalMap: updatedRelationalMap,
    },
    update: {
      deliberationCount: { increment: 1 },
      concessionCount: conceded ? { increment: 1 } : undefined,
      holdCount: held ? { increment: 1 } : undefined,
      allianceCount: outcome === 'ALLIED' ? { increment: 1 } : undefined,
      rigidityScore: newRigidity,
      responsivenessScore: newResponsiveness,
      episodicLog: newLog,
      relationalMap: updatedRelationalMap,
    },
  });
}

function detectOutcome(
  round1: string,
  round3: string
): 'CONCEDED' | 'ALLIED' | 'HELD' {
  if (!round1 || !round3) return 'HELD';
  const r3Lower = round3.toLowerCase();

  // Simple lexical heuristic — good enough for memory scoring
  const concessionWords = [
    'concede',
    'acknowledge',
    'valid point',
    'i was wrong',
    'revise',
    'agree with',
  ];
  const allianceWords = [
    'align with',
    'share',
    'together with',
    'both',
    'coalition',
    'join',
  ];

  if (concessionWords.some((w) => r3Lower.includes(w))) return 'CONCEDED';
  if (allianceWords.some((w) => r3Lower.includes(w))) return 'ALLIED';
  return 'HELD';
}

function updateRelationalMap(
  existing: any[],
  thisAgent: AgentKey,
  round2: RoundOutput | undefined,
  proposalId: string,
  deliberationId: string
): any[] {
  if (!round2) return existing;

  const map = new Map<string, any>(existing.map((e) => [e.withAgent, e]));

  // Look for cross-agent challenges in Round 2 positions, across whichever
  // domain panel actually deliberated (governance or cooperative).
  const otherAgents = Object.keys(round2.domainPositions) as AgentKey[];
  for (const otherAgent of otherAgents) {
    if (otherAgent === thisAgent) continue;

    const thisPosition = round2.domainPositions[thisAgent] ?? '';
    const otherName = otherAgent.toLowerCase();

    if (!thisPosition.toLowerCase().includes(otherName)) continue;

    const entry = map.get(otherAgent) ?? {
      withAgent: otherAgent,
      interactions: [],
    };
    const interactions = [...(entry.interactions ?? [])];

    interactions.push({
      proposalId,
      deliberationId,
      type: 'CHALLENGED',
      topic: thisPosition.slice(0, 100),
      outcome: 'recorded',
    });

    // Prune to last 20 interactions per pair
    map.set(otherAgent, {
      ...entry,
      interactions: interactions.slice(-20),
    });
  }

  return Array.from(map.values());
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatDomainPositions(
  positions: Partial<Record<AgentKey, string>>
): string {
  // Iterate the agents that actually ran (panel-agnostic), not a fixed list.
  return Object.entries(positions)
    .map(([key, v]) => `${key}:\n${v ?? '(no response)'}`)
    .join('\n\n');
}

function formatRoundTranscript(round: RoundOutput): string {
  return `=== ROUND ${round.roundNumber} ===

DOMAIN AGENT POSITIONS:
${formatDomainPositions(round.domainPositions)}

SHAHIDI'S ANNOTATIONS:
${round.ukweliAnnotations}

MPELELEZI'S ASSESSMENT:
${round.kivuliAnnotations}${
    round.kadereValues
      ? `\n\n${formatKadereForTranscript(round.kadereValues)}`
      : ''
  }`;
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

class BarazaDeliberationService {
  /**
   * Primary entry point. Runs a full deliberation for the given proposal.
   * Called by the BullMQ job processor.
   *
   * Checks for an existing COMPLETE deliberation with the same contentHash
   * before running — returns early if the proposal hasn't changed.
   */
  async run(
    proposalId: string,
    groupId: string,
    triggeredBy: 'AUTHOR' | 'ADMIN' | 'AUTO' = 'AUTO'
  ): Promise<string | null> {
    if (!isQwenAvailable()) {
      logger.info(
        { proposalId },
        '[BARAZA] Qwen unavailable — skipping deliberation'
      );
      return null;
    }

    // Build content hash for deduplication
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        title: true,
        description: true,
        budget: true,
        problem: true,
        solution: true,
      },
    });
    if (!proposal) return null;

    const contentHash = buildContentHash(proposal);

    // Check for existing complete deliberation with same content
    const existing = await prisma.barazaDeliberation.findFirst({
      where: { proposalId, contentHash, status: 'COMPLETE' },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      logger.info(
        { proposalId, deliberationId: existing.id },
        '[BARAZA] Returning existing deliberation — proposal unchanged'
      );
      return existing.id;
    }

    // Create deliberation record
    const deliberation = await prisma.barazaDeliberation.create({
      data: {
        proposalId,
        groupId,
        contentHash,
        status: 'RUNNING',
        triggeredBy: triggeredBy as any,
        startedAt: new Date(),
      },
    });

    logger.info(
      { proposalId, deliberationId: deliberation.id },
      '[BARAZA] Deliberation started'
    );

    try {
      const result = await this._runDeliberation(
        deliberation.id,
        proposalId,
        groupId
      );

      await prisma.barazaDeliberation.update({
        where: { id: deliberation.id },
        data: {
          status: 'COMPLETE',
          readinessScore: result.score,
          readinessBand: result.band,
          transcript: result.transcript as any,
          conflictMap: result.conflictMap as any,
          revisionSuggestions: result.revisionSuggestions,
          mkutanoConvergence: result.mkutano.convergencePoints,
          mkutanoContradictions: result.mkutano.contradictionPoints,
          mkutanoFixability: result.mkutano.fixabilityVerdict,
          contextSnapshot: result.contextSnapshot as any,
          agentMemorySnapshot: result.agentMemorySnapshot as any,
          completedAt: new Date(),
        },
      });

      logger.info(
        {
          proposalId,
          deliberationId: deliberation.id,
          score: result.score,
          band: result.band,
        },
        '[BARAZA] Deliberation complete'
      );

      return deliberation.id;
    } catch (err) {
      logger.error(
        { err, proposalId, deliberationId: deliberation.id },
        '[BARAZA] Deliberation failed'
      );

      await prisma.barazaDeliberation.update({
        where: { id: deliberation.id },
        data: {
          status: 'FAILED',
          errorLog: err instanceof Error ? err.message : String(err),
        },
      });

      return null;
    }
  }

  private async _runDeliberation(
    deliberationId: string,
    proposalId: string,
    groupId: string
  ) {
    // ── 1. Assemble context ──────────────────────────────────────────────────
    const ctx = await assembleProposalContext(proposalId);
    if (!ctx) throw new Error('Could not assemble proposal context');
    const proposalContextStr = formatProposalContext(ctx);

    // ── 2. Select the panel + load its agent memories ────────────────────────
    // System groups deliberate with the governance panel; voluntary groups with
    // the cooperative panel. Analysts (Shahidi, Mpelelezi) run in both.
    const domainKeys = selectDomainPanel(
      { isSystemGroup: ctx.isSystemGroup },
      `${ctx.title} ${ctx.description} ${ctx.problem ?? ''} ${ctx.solution ?? ''} ${ctx.proposalType}`
    );
    const allAgentKeys: AgentKey[] = [...domainKeys, ...ANALYST_AGENT_KEYS];
    logger.info(
      {
        deliberationId,
        panel: ctx.isSystemGroup ? 'governance' : 'cooperative',
        domainKeys,
      },
      '[BARAZA] Selected domain panel'
    );

    // ── 2b. Convener (Mjamaa) casts each agent's voice for this proposal ──────
    const mjamaaMemory = await loadMjamaaMemory(groupId);
    const casting = await runConvener(
      proposalContextStr,
      domainKeys,
      mjamaaMemory
    );
    logger.info(
      {
        deliberationId,
        casting: Object.fromEntries(
          Object.entries(casting.casting).map(([k, v]) => [
            k,
            v ? `${v.lifeStage} / ${v.exposure}` : null,
          ])
        ),
        structuralNote: casting.structuralNote || undefined,
      },
      '[BARAZA] Convener cast voices'
    );
    const agentMemories = Object.fromEntries(
      await Promise.all(
        allAgentKeys.map(async (key) => [
          key,
          await loadAgentMemory(groupId, key),
        ])
      )
    ) as Record<AgentKey, string>;

    // ── 3. Three debate rounds ───────────────────────────────────────────────
    const rounds: RoundOutput[] = [];
    let kadereFlaggedTension = false;

    for (const roundNumber of [1, 2, 3] as const) {
      logger.info({ deliberationId, roundNumber }, '[BARAZA] Running round');

      const domainPositions = await runDomainAgentsRound(
        roundNumber,
        proposalContextStr,
        agentMemories,
        rounds,
        groupId,
        domainKeys,
        casting
      );

      const ukweliAnnotations = await runShahidi(
        roundNumber,
        proposalContextStr,
        agentMemories.SHAHIDI,
        domainPositions,
        rounds
      );

      const kivuliAnnotations = await runMpelelezi(
        roundNumber,
        proposalContextStr,
        agentMemories.MPELELEZI,
        domainPositions,
        ukweliAnnotations,
        rounds,
        groupId
      );

      // Kadere (values voice): a labelled, rebuttable reading in round 1; a brief
      // closing in round 3 only if it flagged a values tension. Advisory only — it
      // enters the transcript (so the council can rebut it) but is never fed into
      // the readiness score.
      let kadereValues: string | undefined;
      if (roundNumber === 1) {
        const reading = await runKadere(proposalContextStr, domainPositions);
        kadereFlaggedTension = reading.hasValuesTension;
        kadereValues = reading.text || undefined;
      } else if (roundNumber === 3 && kadereFlaggedTension) {
        kadereValues =
          (await runKadereClosing(proposalContextStr, rounds)) || undefined;
      }

      rounds.push({
        roundNumber,
        domainPositions,
        ukweliAnnotations,
        kivuliAnnotations,
        kadereValues,
      });
    }

    // Total-failure guard: if EVERY domain-agent response is the no-response
    // placeholder, the AI calls all failed (unavailable / misconfigured / out of
    // quota). Throw so run() records FAILED + errorLog instead of a misleading
    // COMPLETE with a default score.
    const anyRealDomainResponse = rounds.some((r) =>
      domainKeys.some((k) => {
        const v = r.domainPositions[k];
        return !!v && v !== AGENT_NO_RESPONSE;
      })
    );
    if (!anyRealDomainResponse) {
      throw new Error(
        'All domain-agent calls failed — no deliberation produced (Qwen unavailable, misconfigured, or out of quota)'
      );
    }

    // ── 4. Mkutano ───────────────────────────────────────────────────────────
    logger.info({ deliberationId }, '[BARAZA] Running Mkutano');
    const mkutano = await runMkutano(
      rounds,
      agentMemories.SHAHIDI,
      agentMemories.MPELELEZI
    );

    // ── 5. Score ─────────────────────────────────────────────────────────────
    const { score, band, conflictMap, revisionSuggestions } =
      await computeReadinessScore(
        rounds,
        mkutano,
        {},
        casting.structuralSeverity
      );

    // ── 5b. Mjamaa's closing structural review of the proposed revisions ──────
    const structuralReview = await runClosingReview(
      proposalContextStr,
      casting,
      revisionSuggestions,
      mjamaaMemory
    );
    if (structuralReview.verdict) {
      logger.info(
        { deliberationId, verdict: structuralReview.verdict },
        '[BARAZA] Mjamaa closing structural review'
      );
    }

    // ── 6. Update all agent memories ─────────────────────────────────────────
    await Promise.all(
      allAgentKeys.map((key) =>
        updateAgentMemory(
          groupId,
          deliberationId,
          proposalId,
          ctx.title,
          rounds,
          key
        )
      )
    );
    // Mjamaa (the run-once convener) records its structural observation so its
    // reads of this group compound over time.
    await persistMjamaaMemory(groupId, proposalId, ctx.title, casting);

    return {
      score,
      band,
      conflictMap,
      revisionSuggestions,
      mkutano,
      transcript: {
        rounds,
        mkutano,
      },
      contextSnapshot: {
        ...ctx,
        casting: casting.casting,
        structuralNote: casting.structuralNote,
        structuralSeverity: casting.structuralSeverity,
        structuralReview,
      },
      agentMemorySnapshot: agentMemories,
    };
  }

  /**
   * Fetch the most recent complete deliberation for a proposal.
   * Used by the proposal controller to surface results to the author/voters.
   */
  async getLatest(proposalId: string) {
    return prisma.barazaDeliberation.findFirst({
      where: { proposalId, status: 'COMPLETE' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        readinessScore: true,
        readinessBand: true,
        conflictMap: true,
        revisionSuggestions: true,
        mkutanoConvergence: true,
        mkutanoContradictions: true,
        mkutanoFixability: true,
        triggeredBy: true,
        completedAt: true,
      },
    });
  }

  /**
   * Returns true if a complete deliberation exists for the current proposal content.
   * Used by startVoting to gate the voting window.
   */
  async hasCurrentDeliberation(proposalId: string): Promise<boolean> {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        title: true,
        description: true,
        budget: true,
        problem: true,
        solution: true,
      },
    });
    if (!proposal) return false;

    const contentHash = buildContentHash(proposal);
    const existing = await prisma.barazaDeliberation.findFirst({
      where: { proposalId, contentHash, status: 'COMPLETE' },
    });

    return !!existing;
  }
}

export const barazaDeliberationService = new BarazaDeliberationService();
