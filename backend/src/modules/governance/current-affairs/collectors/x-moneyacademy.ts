/**
 * @file src/modules/governance/current-affairs/collectors/x-moneyacademy.ts
 * @description
 * Best-effort collector for the @moneyacademyKE X handle (a facts-leaning Kenyan
 * finance account). X is hostile to free scraping and we use no paid third party,
 * so this reads a configurable RSS-bridge URL (MONEYACADEMY_FEED_URL) the operator
 * sets up. It is colour on top of the gov indicators — never load-bearing — so it
 * fails open and is labelled clearly as one source's reporting, not ground truth.
 */

import { logger } from '../../../../core/logger/logger.js';
import type { CollectedIndicator } from '../current-affairs.service.js';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_POSTS = 3;
const MAX_VALUE_LEN = 320;

/**
 * Unwrap CDATA, decode the common entities, THEN strip HTML, then collapse
 * whitespace. Order matters: RSS descriptions often carry entity-encoded HTML
 * (`&lt;p&gt;`), so entities must be decoded before tag-stripping can remove them.
 */
function clean(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pull the latest post texts out of an RSS/Atom feed. Exported so the parse can
 * be tested against sample feed text without hitting the network.
 */
export function parseXFeed(xml: string, max = MAX_POSTS): string[] {
  const out: string[] = [];
  const itemRe = /<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi;
  const titleRe = /<title\b[^>]*>([\s\S]*?)<\/title>/i;
  const descRe =
    /<(?:description|summary|content)\b[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/i;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) && out.length < max) {
    const block = m[0];
    const text = clean(
      block.match(titleRe)?.[1] ?? block.match(descRe)?.[1] ?? ''
    );
    if (text) out.push(text);
  }
  return out;
}

export async function collectMoneyAcademy(): Promise<CollectedIndicator[]> {
  const url = process.env.MONEYACADEMY_FEED_URL;
  if (!url) {
    logger.info(
      '[CURRENT_AFFAIRS] MONEYACADEMY_FEED_URL not set — skipping X collector'
    );
    return [];
  }
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, '[CURRENT_AFFAIRS] X feed non-OK');
      return [];
    }
    const posts = parseXFeed(await res.text());
    if (posts.length === 0) {
      logger.warn('[CURRENT_AFFAIRS] X feed fetched but no posts parsed');
      return [];
    }
    const value = posts
      .map((p, i) => `${i + 1}. ${p}`)
      .join(' | ')
      .slice(0, MAX_VALUE_LEN);
    return [
      {
        indicator: 'signal_moneyacademy',
        label: 'MoneyAcademy (X) — recent posts (one source, not verified)',
        value,
        source: 'X:@moneyacademyKE',
        sourceUrl: url,
        asOf: new Date(),
      },
    ];
  } catch (err) {
    logger.warn({ err }, '[CURRENT_AFFAIRS] X collector failed');
    return [];
  }
}
