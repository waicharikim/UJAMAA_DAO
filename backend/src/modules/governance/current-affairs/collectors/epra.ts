/**
 * @file src/modules/governance/current-affairs/collectors/epra.ts
 * @description
 * Best-effort EPRA fuel-price collector. EPRA publishes monthly pump prices.
 * Reads EPRA_SOURCE_URL (a press-release / HTML page) and extracts the petrol,
 * diesel and kerosene figures. Returns [] on any failure (no URL, network error,
 * timeout, parse miss) — never throws. The live page layout changes, so the
 * parse is deliberately forgiving and the whole thing fails open.
 */

import { logger } from '../../../../core/logger/logger.js';
import type { CollectedIndicator } from '../current-affairs.service.js';

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Parse fuel prices out of EPRA page text. Exported so the parse can be tested
 * against sample text without hitting the network.
 */
export function parseEpraText(
  text: string,
  asOf: Date,
  url = ''
): CollectedIndicator[] {
  const out: CollectedIndicator[] = [];
  const grab = (re: RegExp, indicator: string, label: string) => {
    const m = text.match(re);
    if (m && m[1]) {
      out.push({
        indicator,
        label,
        value: m[1],
        unit: 'KES/L',
        source: 'EPRA',
        sourceUrl: url || undefined,
        asOf,
      });
    }
  };
  // Forgiving patterns: "Super Petrol … 217.43", "Diesel … 205.47", etc.
  grab(
    /(?:super\s*)?petrol[^0-9]{0,40}(\d{2,3}\.\d{2})/i,
    'fuel_petrol',
    'Petrol pump price'
  );
  grab(/diesel[^0-9]{0,40}(\d{2,3}\.\d{2})/i, 'fuel_diesel', 'Diesel pump price');
  grab(
    /kerosene[^0-9]{0,40}(\d{2,3}\.\d{2})/i,
    'fuel_kerosene',
    'Kerosene price'
  );
  return out;
}

export async function collectEpraFuel(): Promise<CollectedIndicator[]> {
  const url = process.env.EPRA_SOURCE_URL;
  if (!url) {
    logger.info(
      '[CURRENT_AFFAIRS] EPRA_SOURCE_URL not set — skipping EPRA collector'
    );
    return [];
  }
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn(
        { status: res.status },
        '[CURRENT_AFFAIRS] EPRA fetch non-OK'
      );
      return [];
    }
    const text = await res.text();
    const parsed = parseEpraText(text, new Date(), url);
    if (parsed.length === 0) {
      logger.warn('[CURRENT_AFFAIRS] EPRA page fetched but no prices parsed');
    }
    return parsed;
  } catch (err) {
    logger.warn({ err }, '[CURRENT_AFFAIRS] EPRA collector failed');
    return [];
  }
}
