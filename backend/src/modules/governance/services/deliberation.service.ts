/**
 * @file src/modules/governance/services/deliberation.service.ts
 * @description
 * Deliberation layer — distils community annotations into a NEUTRAL digest
 * (support / concerns / open questions) so voters can see what the community
 * actually said before they vote.
 *
 * Hard guardrail: the AI is a neutral clerk. It summarises only what annotators
 * wrote. It never recommends how to vote, never adds opinions, never predicts
 * outcomes. The binding step remains a human vote ("AI never decides").
 *
 * Dormant until CLAUDE_API_KEY is set: generateAndStore() stores null and
 * returns when the client is unavailable or there are no annotations.
 */

import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';
import { getClaudeClient, complete } from '../../../core/ai/claude.js';
import { proposalAnnotationService } from './proposal-annotation.service.js';

export interface DeliberationSummary {
  support: string[];
  concerns: string[];
  openQuestions: string[];
  note?: string;
}

interface RankableAnnotation {
  comment: string;
  quotedText: string;
  fieldKey: string;
  upvotes: number;
  downvotes: number;
}

/** Sort annotations by net score (upvotes - downvotes), descending. */
export function rankAnnotations<T extends RankableAnnotation>(
  annotations: T[],
  topN?: number
): T[] {
  const sorted = [...annotations].sort(
    (a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes)
  );
  return topN ? sorted.slice(0, topN) : sorted;
}

const SYSTEM_PROMPT = `You are a neutral clerk recording a community's deliberation on a governance proposal.

Your ONLY job is to summarise what community members wrote in their annotations — nothing more.

Rules:
- Group what people said into three buckets: points of SUPPORT, CONCERNS, and OPEN QUESTIONS.
- Summarise ONLY the annotations provided. Do NOT invent points nobody raised.
- Do NOT recommend how to vote. Do NOT add your own opinion. Do NOT predict the outcome.
- Be concise — each point one short sentence. Merge near-duplicate points.
- If the deliberation is thin or one-sided, reflect that honestly (e.g. leave a bucket empty).
- Respond with ONLY a JSON object, no prose, in exactly this shape:
  {"support": string[], "concerns": string[], "openQuestions": string[]}`;

function buildUserMessage(
  proposal: {
    title: string;
    description: string | null;
    rationale: string | null;
    alternatives: string | null;
  },
  ranked: RankableAnnotation[]
): string {
  const annotationLines = ranked
    .map(
      (a, i) =>
        `${i + 1}. [on ${a.fieldKey}, net ${a.upvotes - a.downvotes}] re "${a.quotedText.slice(0, 120)}": ${a.comment}`
    )
    .join('\n');

  return `PROPOSAL: ${proposal.title}

DESCRIPTION: ${proposal.description ?? '(none)'}
RATIONALE: ${proposal.rationale ?? '(none)'}
ALTERNATIVES: ${proposal.alternatives ?? '(none)'}

COMMUNITY ANNOTATIONS (most-reacted first):
${annotationLines}

Produce the JSON digest now.`;
}

function parseSummary(raw: string): DeliberationSummary {
  try {
    // Tolerate fenced code blocks or surrounding text.
    const match = raw.match(/\{[\s\S]*\}/);
    const json = JSON.parse(match ? match[0] : raw);
    return {
      support: Array.isArray(json.support) ? json.support.map(String) : [],
      concerns: Array.isArray(json.concerns) ? json.concerns.map(String) : [],
      openQuestions: Array.isArray(json.openQuestions)
        ? json.openQuestions.map(String)
        : [],
    };
  } catch {
    // Model didn't return clean JSON — keep the raw text rather than lose it.
    return { support: [], concerns: [], openQuestions: [], note: raw };
  }
}

class DeliberationService {
  /**
   * Generate a neutral deliberation digest from a proposal's annotations and
   * store it. No-op (stores null) when the AI is unavailable or there are no
   * annotations. Never throws — failures leave deliberationSummary null.
   */
  async generateAndStore(proposalId: string): Promise<void> {
    if (!getClaudeClient()) {
      logger.info(
        { proposalId },
        '[DELIB] Claude unavailable — skipping deliberation summary'
      );
      return;
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        id: true,
        title: true,
        description: true,
        rationale: true,
        alternatives: true,
      },
    });
    if (!proposal) {
      logger.warn({ proposalId }, '[DELIB] Proposal not found');
      return;
    }

    const annotations = await proposalAnnotationService.list(proposalId);
    if (annotations.length === 0) {
      logger.info(
        { proposalId },
        '[DELIB] No annotations — nothing to summarise'
      );
      return;
    }

    const ranked = rankAnnotations(annotations);
    const raw = await complete({
      system: SYSTEM_PROMPT,
      userMessage: buildUserMessage(proposal, ranked),
      maxTokens: 1024,
    });
    if (!raw) {
      logger.warn(
        { proposalId },
        '[DELIB] Claude returned no content — summary not stored'
      );
      return;
    }

    const summary = parseSummary(raw);
    await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        deliberationSummary: summary as unknown as object,
        deliberationSummaryAt: new Date(),
      },
    });
    logger.info(
      {
        proposalId,
        support: summary.support.length,
        concerns: summary.concerns.length,
        openQuestions: summary.openQuestions.length,
      },
      '[DELIB] Deliberation summary stored'
    );
  }
}

export const deliberationService = new DeliberationService();
