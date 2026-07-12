/**
 * @file src/modules/governance/historian/historian.service.ts
 * @description
 * The national timeline knowledge base that Mhenga (the historian) reasons from.
 * Provenance is first-class: every entry knows whether it was LLM-seeded, fed by
 * a source, accreted from a deliberation, or admin-confirmed — so the historian
 * cites with calibrated confidence and contested history stays contested.
 *
 * Retrieval is deliberately coarse (theme/keyword prefilter, capped, ordered
 * along the arc); Mhenga does the relevance reasoning over the shortlist.
 */

import { HistoryProvenance, HistoryVerification } from '@prisma/client';
import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';
import {
  isQwenAvailable,
  completeJSON,
  QWEN_ANALYST_MODEL,
} from '../../../core/ai/qwen.js';

export interface HistoricalEventInput {
  era: string;
  title: string;
  startYear?: number;
  endYear?: number;
  summary: string;
  causes?: string;
  consequences?: string;
  themes?: string[];
  sourceRef?: string;
  /** null/omitted = shared national timeline; set = this group's own local history. */
  groupId?: string;
}

const RETRIEVAL_CAP = 15;

/** A confidence tag for the historian, derived from provenance + verification. */
function confidenceTag(
  provenance: HistoryProvenance,
  verification: HistoryVerification
): string {
  if (verification === 'DISPUTED') return 'DISPUTED';
  if (verification === 'ADMIN_CONFIRMED') return 'confirmed';
  if (provenance === 'LLM_SEED') return 'per model knowledge, unverified';
  return 'unverified';
}

class HistorianService {
  /** Store a timeline entry with explicit provenance. */
  async addEvent(
    input: HistoricalEventInput,
    provenance: HistoryProvenance,
    verification: HistoryVerification = 'UNVERIFIED'
  ) {
    return prisma.historicalEvent.create({
      data: {
        era: input.era,
        title: input.title,
        startYear: input.startYear,
        endYear: input.endYear,
        summary: input.summary,
        causes: input.causes,
        consequences: input.consequences,
        themes: input.themes ?? [],
        provenance,
        verification,
        sourceRef: input.sourceRef,
        groupId: input.groupId,
      },
    });
  }

  /** A community member proposes a local timeline entry — pending ratification. */
  async proposeLocalEvent(
    groupId: string,
    input: Omit<HistoricalEventInput, 'groupId'>
  ) {
    return this.addEvent({ ...input, groupId }, 'MEMBER', 'UNVERIFIED');
  }

  /** This group's own timeline. `includePending` reveals unratified (member-proposed)
   *  entries — only for members/keepers; others see confirmed + disputed only. */
  async listGroupHistory(groupId: string, includePending = true) {
    const events = await prisma.historicalEvent.findMany({
      where: {
        groupId,
        active: true,
        supersededById: null,
        ...(includePending ? {} : { verification: { not: 'UNVERIFIED' } }),
      },
      orderBy: [{ startYear: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        era: true,
        title: true,
        startYear: true,
        summary: true,
        themes: true,
        provenance: true,
        verification: true,
        createdAt: true,
      },
    });
    return events.map((e) => ({
      id: e.id,
      era: e.era,
      title: e.title,
      startYear: e.startYear,
      summary: e.summary,
      themes: e.themes,
      tag: confidenceTag(e.provenance, e.verification),
      status:
        e.verification === 'ADMIN_CONFIRMED'
          ? 'confirmed'
          : e.verification === 'DISPUTED'
            ? 'disputed'
            : 'pending',
      createdAt: e.createdAt,
    }));
  }

  /** A keeper reviews a proposed/contested entry: confirm, dispute, or reject. */
  async ratifyEvent(id: string, action: 'confirm' | 'dispute' | 'reject') {
    const data =
      action === 'confirm'
        ? { verification: 'ADMIN_CONFIRMED' as const }
        : action === 'dispute'
          ? { verification: 'DISPUTED' as const }
          : { active: false };
    return prisma.historicalEvent.update({
      where: { id },
      data,
      select: { id: true, verification: true, active: true },
    });
  }

  /**
   * Shortlist timeline entries relevant to a proposal. Matches on theme overlap
   * (either explicitly-passed themes OR an event's own theme word appearing in
   * the proposal text) or keyword hits in title/summary. If nothing genuinely
   * matches, returns [] — we do NOT force an irrelevant year-ordered sample onto
   * an unrelated proposal (that produced grandiose, off-topic framing). Superseded
   * and inactive entries are excluded.
   */
  async getRelevantHistory(
    themes: string[],
    keywords: string[],
    proposalText = '',
    groupId?: string,
    includeNational = true
  ): Promise<
    {
      era: string;
      title: string;
      startYear: number | null;
      summary: string;
      consequences: string | null;
      tag: string;
      scope: 'group' | 'national';
    }[]
  > {
    // Register gate. A group's OWN history is always in scope (it's their story).
    // The shared national arc is only pulled in when it is load-bearing for this
    // proposal (includeNational) — so routine local decisions are not dressed up in
    // colonial-to-devolution framing.
    const scopeWhere = groupId
      ? includeNational
        ? { OR: [{ groupId: null }, { groupId }] } // national + this group
        : { groupId } // this group's own history only
      : includeNational
        ? { groupId: null } // national only
        : undefined; // no group and national suppressed → nothing to frame
    if (!scopeWhere) return [];

    const all = await prisma.historicalEvent.findMany({
      where: {
        active: true,
        supersededById: null,
        // Prompt-injection guard + propose→ratify: an unratified member proposal
        // must NOT reach the LLM. Member-contributed entries influence Mhenga only
        // after a keeper confirms or disputes them.
        NOT: { provenance: 'MEMBER', verification: 'UNVERIFIED' },
        ...scopeWhere,
      },
      orderBy: [{ startYear: 'asc' }, { createdAt: 'asc' }],
    });
    if (all.length === 0) return [];

    const themeSet = new Set(themes.map((t) => t.toLowerCase()));
    const text = proposalText.toLowerCase();
    const kw = keywords
      .map((k) => k.toLowerCase())
      .filter((k) => k.length >= 4);

    const scored = all
      .map((e) => {
        const hay = `${e.title} ${e.summary}`.toLowerCase();
        // A theme counts if it was passed explicitly OR the event's own theme
        // word appears in the proposal text — so themes actually contribute
        // (previously only the proposalType was passed, which never matched).
        const themeHits = e.themes.filter(
          (t) =>
            themeSet.has(t.toLowerCase()) ||
            (text.length > 0 && text.includes(t.toLowerCase()))
        ).length;
        const kwHits = kw.filter((k) => hay.includes(k)).length;
        return { e, score: themeHits * 2 + kwHits };
      })
      .sort((a, b) => b.score - a.score);

    // No fuzzy fallback: if nothing genuinely matches, return nothing rather than
    // forcing an irrelevant year-ordered sample onto an unrelated proposal (that
    // produced grandiose, off-topic historical framing).
    const chosen = scored
      .filter((s) => s.score > 0)
      .map((s) => s.e)
      .slice(0, RETRIEVAL_CAP);
    chosen.sort((a, b) => (a.startYear ?? 0) - (b.startYear ?? 0));

    return chosen.map((e) => ({
      era: e.era,
      title: e.title,
      startYear: e.startYear,
      summary: e.summary,
      consequences: e.consequences,
      tag: confidenceTag(e.provenance, e.verification),
      scope: e.groupId ? ('group' as const) : ('national' as const),
    }));
  }

  /** Raw, year-ordered rendering of a shortlist — the fallback when Mhenga's LLM
   *  framing is unavailable. Each line is tagged with its confidence. */
  formatHistory(
    events: Awaited<ReturnType<HistorianService['getRelevantHistory']>>
  ): string {
    if (events.length === 0) return '';
    const line = (e: (typeof events)[number]) => {
      const yr = e.startYear ? `${e.startYear} ` : '';
      return `- ${yr}[${e.era}] ${e.title} — ${e.summary} (${e.tag})`;
    };
    // Lead with this community's own history; the national arc is secondary.
    const group = events.filter((e) => e.scope === 'group').map(line);
    const national = events.filter((e) => e.scope === 'national').map(line);
    const sections = [
      group.length ? `THIS COMMUNITY'S OWN HISTORY:\n${group.join('\n')}` : '',
      national.length
        ? `NATIONAL ARC (shared — weigh only where it bears on this decision):\n${national.join('\n')}`
        : '',
    ].filter(Boolean);
    return `HISTORICAL CONTEXT (confirmed vs unverified noted; weigh, don't take as settled):
${sections.join('\n\n')}`;
  }

  /**
   * Bootstrap the timeline backbone from the model's own knowledge. Operator-run
   * (it produces UNVERIFIED, contestable content that should be reviewed). No-op
   * when the AI is unavailable. Idempotent-ish: skips if a seed already exists.
   */
  async seedHistoricalBackbone(): Promise<number> {
    if (!isQwenAvailable()) {
      logger.info('[HISTORIAN] Qwen unavailable — skipping seed');
      return 0;
    }
    const existingSeed = await prisma.historicalEvent.count({
      where: { provenance: 'LLM_SEED' },
    });
    if (existingSeed > 0) {
      logger.info(
        { existingSeed },
        '[HISTORIAN] LLM seed already present — skipping'
      );
      return 0;
    }

    const result = await completeJSON<{ events: HistoricalEventInput[] }>({
      system: `You are a careful historian of Kenya. Produce a factual backbone timeline of the major events, eras and turning points that shape how Kenyans experience governance and economy today — from the colonial period to the present. Facts only. Where an interpretation is genuinely contested, state it neutrally as contested rather than taking a side. No editorialising.

Respond with ONLY JSON: {"events": [{"era": "...", "title": "...", "startYear": 1900, "endYear": 1963, "summary": "...", "causes": "...", "consequences": "...", "themes": ["land","governance"]}]}`,
      userMessage:
        'Produce 15–25 backbone events spanning colonial land alienation, independence, single-party era, structural adjustment, the 2010 constitution/devolution, the Eurobond/debt era, and recent cost-of-living/taxation. JSON only.',
      maxTokens: 4000,
      model: QWEN_ANALYST_MODEL,
    });

    const rawEvents = result?.events;
    const events = Array.isArray(rawEvents) ? rawEvents : [];
    let stored = 0;
    for (const ev of events) {
      if (!ev?.title || !ev?.summary || !ev?.era) continue;
      await this.addEvent(
        {
          ...ev,
          sourceRef: `LLM seed ${new Date().toISOString().slice(0, 10)}`,
        },
        'LLM_SEED',
        'UNVERIFIED'
      );
      stored++;
    }
    logger.info({ stored }, '[HISTORIAN] Seeded historical backbone');
    return stored;
  }
}

export const historianService = new HistorianService();
export { confidenceTag };
