/**
 * @file src/modules/governance/baraza/baraza-telegram.service.ts
 * @description
 * Formats and posts Baraza deliberation results to a group's Telegram baraza(s).
 *
 * Bilingual: Kiswahili section headers + English detail. Emoji-coded sections.
 * Splits long messages under Telegram's 4096-char limit. Plain text (the
 * telegram wrapper sends without parse_mode, so no Markdown escaping needed).
 *
 * Graceful degradation: if Telegram is not configured or the group has no
 * active Telegram baraza, every method is a no-op. Never throws.
 */

import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';
import {
  telegramSendMessage,
  isTelegramConfigured,
} from '../../integration/services/telegram.service.js';

// Telegram hard limit is 4096; leave headroom for safety.
const MAX_TELEGRAM_CHARS = 3900;

/** Shape returned by barazaDeliberationService.getLatest(). */
interface DeliberationResult {
  readinessScore: number | null;
  readinessBand: string | null;
  conflictMap: unknown;
  revisionSuggestions: unknown;
  mkutanoConvergence: unknown;
  mkutanoContradictions: unknown;
  mkutanoFixability: string | null;
}

interface Coalition {
  agents?: string[];
  sharedConcern?: string;
}
interface Conflict {
  between?: string[];
  issue?: string;
  intensity?: number;
}
interface Chokepoint {
  location?: string;
  severity?: string;
  routeAround?: string | null;
}

const BAND_LABEL: Record<string, string> = {
  READY: '🟢 TAYARI (Ready)',
  CONDITIONAL: '🟡 KWA MASHARTI (Conditional)',
  SIGNIFICANT_CONCERNS: '🟠 WASIWASI MKUBWA (Significant concerns)',
  NOT_READY: '🔴 HAIJAWA TAYARI (Not ready)',
};

class BarazaTelegramService {
  /** Resolve the active Telegram chat ids for a UjamaaDAO group. */
  private async chatIds(groupId: string): Promise<string[]> {
    const groups = await prisma.barazaGroup.findMany({
      where: { groupId, platform: 'TELEGRAM', isActive: true },
      select: { externalId: true },
    });
    return groups.map((g) => g.externalId);
  }

  /** Send a body to every Telegram baraza of the group, split under the limit. */
  private async broadcast(groupId: string, text: string): Promise<void> {
    if (!isTelegramConfigured()) return;
    const ids = await this.chatIds(groupId);
    if (ids.length === 0) return;

    const chunks = splitForTelegram(text);
    for (const chatId of ids) {
      for (const chunk of chunks) {
        await telegramSendMessage(chatId, chunk);
      }
    }
  }

  /** Posted when a deliberation is queued/started. */
  async postInProgress(groupId: string, proposalTitle: string): Promise<void> {
    try {
      await this.broadcast(
        groupId,
        `🌿 Baraza inaendelea…\n\nThe council of seven is now deliberating on the proposal "${proposalTitle}". This stress-tests the proposal before voting opens. Results will be posted here shortly.`
      );
    } catch (err) {
      logger.warn({ err, groupId }, '[BARAZA_TG] postInProgress failed');
    }
  }

  /** Posted when a deliberation fails. */
  async postFailure(groupId: string, proposalTitle: string): Promise<void> {
    try {
      await this.broadcast(
        groupId,
        `⚠️ Baraza halikukamilika.\n\nThe deliberation for "${proposalTitle}" could not be completed. Voting can still proceed — the engine will retry on the next change.`
      );
    } catch (err) {
      logger.warn({ err, groupId }, '[BARAZA_TG] postFailure failed');
    }
  }

  /** Posted when a deliberation completes — the formatted conflict map. */
  async postResult(
    groupId: string,
    proposalTitle: string,
    result: DeliberationResult
  ): Promise<void> {
    try {
      await this.broadcast(groupId, formatResult(proposalTitle, result));
    } catch (err) {
      logger.warn({ err, groupId }, '[BARAZA_TG] postResult failed');
    }
  }
}

// ─── Formatting ────────────────────────────────────────────────────────────────

function formatResult(title: string, r: DeliberationResult): string {
  const band = r.readinessBand
    ? (BAND_LABEL[r.readinessBand] ?? r.readinessBand)
    : 'Haijatathminiwa (Not assessed)';
  const score = r.readinessScore ?? '—';

  const map = (r.conflictMap ?? {}) as {
    coalitions?: Coalition[];
    conflicts?: Conflict[];
    consensus?: string[];
    unresolved?: string[];
    implementabilityRating?: string;
    chokepoints?: Chokepoint[];
  };

  const lines: string[] = [];
  lines.push(`🌿 BARAZA — Deliberation Result`);
  lines.push(`Proposal: ${title}`);
  lines.push('');
  lines.push(`📊 Utayari (Readiness): ${score}/100 — ${band}`);

  const consensus = asStrings(map.consensus);
  if (consensus.length) {
    lines.push('');
    lines.push('🤝 Makubaliano (Consensus):');
    consensus.slice(0, 5).forEach((c) => lines.push(`• ${c}`));
  }

  if (map.coalitions?.length) {
    lines.push('');
    lines.push('🔗 Muungano (Coalitions):');
    map.coalitions
      .slice(0, 5)
      .forEach((c) =>
        lines.push(
          `• ${(c.agents ?? []).join(' + ')}${c.sharedConcern ? ` — ${c.sharedConcern}` : ''}`
        )
      );
  }

  if (map.conflicts?.length) {
    lines.push('');
    lines.push('⚔️ Mivutano (Conflicts):');
    map.conflicts
      .slice(0, 5)
      .forEach((c) =>
        lines.push(
          `• ${(c.between ?? []).join(' ↔ ')}${c.issue ? `: ${c.issue}` : ''}`
        )
      );
  }

  const unresolved = asStrings(map.unresolved);
  if (unresolved.length) {
    lines.push('');
    lines.push('❓ Bila kutatuliwa (Unresolved):');
    unresolved.slice(0, 5).forEach((u) => lines.push(`• ${u}`));
  }

  if (map.chokepoints?.length) {
    lines.push('');
    lines.push('🚧 Vikwazo (Chokepoints):');
    map.chokepoints
      .slice(0, 5)
      .forEach((c) =>
        lines.push(
          `• [${c.severity ?? '—'}] ${c.location ?? 'unspecified'}${c.routeAround ? ` → Route around: ${c.routeAround}` : ' → no route around identified'}`
        )
      );
  }

  const convergence = asStrings(r.mkutanoConvergence);
  if (convergence.length) {
    lines.push('');
    lines.push('🔬 Mkutano — convergence (Shahidi + Mpelelezi agree):');
    convergence.slice(0, 5).forEach((c) => lines.push(`• ${c}`));
  }

  if (r.mkutanoFixability) {
    lines.push('');
    lines.push(`🛠️ Fixability: ${r.mkutanoFixability}`);
  }

  const revisions = asStrings(r.revisionSuggestions);
  if (revisions.length) {
    lines.push('');
    lines.push('✍️ Mapendekezo ya marekebisho (Revision suggestions):');
    revisions.slice(0, 6).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  }

  lines.push('');
  lines.push(
    'This is an AI council stress-test — guidance, not a verdict. The binding decision is your vote.'
  );

  return lines.join('\n');
}

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
}

/**
 * Split text into <=MAX_TELEGRAM_CHARS chunks on line boundaries where possible.
 */
function splitForTelegram(text: string): string[] {
  if (text.length <= MAX_TELEGRAM_CHARS) return [text];

  const chunks: string[] = [];
  let current = '';
  for (const line of text.split('\n')) {
    // A single line longer than the limit — hard-split it.
    if (line.length > MAX_TELEGRAM_CHARS) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let i = 0; i < line.length; i += MAX_TELEGRAM_CHARS) {
        chunks.push(line.slice(i, i + MAX_TELEGRAM_CHARS));
      }
      continue;
    }
    if (current.length + line.length + 1 > MAX_TELEGRAM_CHARS) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export const barazaTelegramService = new BarazaTelegramService();
