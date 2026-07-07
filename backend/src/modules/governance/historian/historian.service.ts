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
      },
    });
  }

  /**
   * Shortlist timeline entries relevant to a proposal. Matches on theme overlap
   * or keyword hits in title/summary; if nothing matches, returns a year-ordered
   * sample so Mhenga still has a backbone to frame against. Superseded and
   * inactive entries are excluded.
   */
  async getRelevantHistory(
    themes: string[],
    keywords: string[]
  ): Promise<
    {
      era: string;
      title: string;
      startYear: number | null;
      summary: string;
      consequences: string | null;
      tag: string;
    }[]
  > {
    const all = await prisma.historicalEvent.findMany({
      where: { active: true, supersededById: null },
      orderBy: [{ startYear: 'asc' }, { createdAt: 'asc' }],
    });
    if (all.length === 0) return [];

    const themeSet = new Set(themes.map((t) => t.toLowerCase()));
    const kw = keywords
      .map((k) => k.toLowerCase())
      .filter((k) => k.length >= 4);

    const scored = all
      .map((e) => {
        const hay = `${e.title} ${e.summary}`.toLowerCase();
        const themeHits = e.themes.filter((t) =>
          themeSet.has(t.toLowerCase())
        ).length;
        const kwHits = kw.filter((k) => hay.includes(k)).length;
        return { e, score: themeHits * 2 + kwHits };
      })
      .sort((a, b) => b.score - a.score);

    const matched = scored.filter((s) => s.score > 0).map((s) => s.e);
    // fall back to a year-ordered sample when nothing matches
    const chosen = (matched.length > 0 ? matched : all).slice(0, RETRIEVAL_CAP);
    chosen.sort((a, b) => (a.startYear ?? 0) - (b.startYear ?? 0));

    return chosen.map((e) => ({
      era: e.era,
      title: e.title,
      startYear: e.startYear,
      summary: e.summary,
      consequences: e.consequences,
      tag: confidenceTag(e.provenance, e.verification),
    }));
  }

  /** Raw, year-ordered rendering of a shortlist — the fallback when Mhenga's LLM
   *  framing is unavailable. Each line is tagged with its confidence. */
  formatHistory(
    events: Awaited<ReturnType<HistorianService['getRelevantHistory']>>
  ): string {
    if (events.length === 0) return '';
    const lines = events.map((e) => {
      const yr = e.startYear ? `${e.startYear} ` : '';
      return `- ${yr}[${e.era}] ${e.title} — ${e.summary} (${e.tag})`;
    });
    return `HISTORICAL CONTEXT (how we got here — confirmed vs unverified noted; weigh, don't take as settled):
${lines.join('\n')}`;
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
