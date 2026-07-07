/**
 * @file src/modules/governance/current-affairs/current-affairs.service.ts
 * @description
 * The "present conditions" store — fuel prices, cost-of-living, etc. — that the
 * Baraza council reasons against. Populated by best-effort collectors (and by
 * admins). Every value is labelled with its source and the date it refers to,
 * and goes stale if not refreshed. An admin-set value always wins over a scrape.
 */

import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';

export interface CollectedIndicator {
  indicator: string;
  label: string;
  value: string;
  unit?: string;
  source: string;
  sourceUrl?: string;
  asOf: Date;
}

// Sanity ranges keyed by indicator prefix — a scrape outside these is rejected
// (a wrong figure injected into a real decision is worse than no figure).
const SANITY_RANGES: { prefix: string; min: number; max: number }[] = [
  { prefix: 'fuel_', min: 50, max: 500 }, // KES/L
  { prefix: 'cpi_', min: -20, max: 100 }, // % inflation
  { prefix: 'forex_', min: 1, max: 1000 }, // KES per unit
];

/** A figure older than this is shown to the council as "stale". */
const STALE_DAYS = 45;

function passesSanity(indicator: string, value: string): boolean {
  const range = SANITY_RANGES.find((r) => indicator.startsWith(r.prefix));
  if (!range) return true; // no numeric range defined → accept (e.g. free-text events)
  const n = Number(value);
  return Number.isFinite(n) && n >= range.min && n <= range.max;
}

class CurrentAffairsService {
  /**
   * Store a collected indicator. Skips values that fail the sanity range, and
   * never overwrites an admin-set value with a scraped one. Best-effort: logs
   * and continues on error (a broken collector must not break anything).
   */
  async upsertFromCollector(ind: CollectedIndicator): Promise<void> {
    try {
      if (!passesSanity(ind.indicator, ind.value)) {
        logger.warn(
          { indicator: ind.indicator, value: ind.value },
          '[CURRENT_AFFAIRS] Rejected — outside sanity range'
        );
        return;
      }
      const existing = await prisma.currentAffairs.findUnique({
        where: { indicator: ind.indicator },
        select: { adminOverride: true },
      });
      if (existing?.adminOverride) return; // admin value is authoritative

      await prisma.currentAffairs.upsert({
        where: { indicator: ind.indicator },
        create: {
          indicator: ind.indicator,
          label: ind.label,
          value: ind.value,
          unit: ind.unit,
          source: ind.source,
          sourceUrl: ind.sourceUrl,
          asOf: ind.asOf,
          fetchedAt: new Date(),
        },
        update: {
          label: ind.label,
          value: ind.value,
          unit: ind.unit,
          source: ind.source,
          sourceUrl: ind.sourceUrl,
          asOf: ind.asOf,
          fetchedAt: new Date(),
          active: true,
        },
      });
    } catch (err) {
      logger.warn(
        { err, indicator: ind.indicator },
        '[CURRENT_AFFAIRS] upsert failed'
      );
    }
  }

  /** Admin sets/corrects a value. Marked authoritative — collectors won't override it. */
  async setAdminValue(input: {
    indicator: string;
    label: string;
    value: string;
    unit?: string;
    asOf?: Date;
  }): Promise<void> {
    const asOf = input.asOf ?? new Date();
    await prisma.currentAffairs.upsert({
      where: { indicator: input.indicator },
      create: {
        indicator: input.indicator,
        label: input.label,
        value: input.value,
        unit: input.unit,
        source: 'admin',
        asOf,
        adminOverride: true,
      },
      update: {
        label: input.label,
        value: input.value,
        unit: input.unit,
        source: 'admin',
        asOf,
        adminOverride: true,
        active: true,
      },
    });
  }

  /**
   * Build the "current conditions" block injected into a deliberation. Each line
   * is labelled with source + the date it refers to, and flagged when stale.
   * Returns '' when there is nothing on record (the section is then omitted).
   */
  async formatForDeliberation(now: Date = new Date()): Promise<string> {
    const rows = await prisma.currentAffairs.findMany({
      where: { active: true },
      orderBy: { indicator: 'asc' },
    });
    if (rows.length === 0) return '';

    const lines = rows.map((r) => {
      const ageDays = Math.floor(
        (now.getTime() - r.asOf.getTime()) / 86_400_000
      );
      const stale = ageDays > STALE_DAYS ? ' [STALE]' : '';
      const unit = r.unit ? ` ${r.unit}` : '';
      const asOf = r.asOf.toISOString().slice(0, 10);
      return `- ${r.label}: ${r.value}${unit} (source: ${r.source}, as of ${asOf})${stale}`;
    });

    return `CURRENT CONDITIONS (real-world context — weigh the proposal against these; do not treat them as fixed forever):
${lines.join('\n')}`;
  }
}

export const currentAffairsService = new CurrentAffairsService();
export { passesSanity, STALE_DAYS };
