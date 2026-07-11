/**
 * @file tests/governance/baraza-kadere.test.ts
 * Kadere — the values voice. Pure helpers/prompt discipline tested directly
 * (the LLM behaviour is exercised only when Qwen is available).
 */

import { describe, it, expect } from 'vitest';
import {
  KADERE_SYSTEM,
  UJAMAA_DECLARED_VALUES,
  buildKadereMessage,
  buildKadereClosingMessage,
  formatKadereForTranscript,
} from '../../src/modules/governance/baraza/agents/values.js';

describe('Kadere — declared values + prompt discipline', () => {
  it('reasons from the shared Ujamaa constitution (not an invented politics)', () => {
    expect(UJAMAA_DECLARED_VALUES).toMatch(/cooperative economics/i);
    expect(UJAMAA_DECLARED_VALUES).toMatch(/anti-capture|non-custodial/i);
    // the system prompt embeds the declared values and forbids importing outside values
    expect(KADERE_SYSTEM).toContain('DECLARED VALUES');
    expect(KADERE_SYSTEM).toMatch(/do not import an outside ideology|invent values/i);
  });

  it('is advisory and stays off equity analysis (that is Mwananchi)', () => {
    expect(KADERE_SYSTEM).toMatch(/advisory/i);
    expect(KADERE_SYSTEM).toMatch(/never cast it|decide nothing|control no funds/i);
    expect(KADERE_SYSTEM).toMatch(/Mwananchi/);
  });

  it('self-gates via a structured hasValuesTension flag', () => {
    expect(KADERE_SYSTEM).toContain('hasValuesTension');
    expect(KADERE_SYSTEM).toMatch(/one sentence if false/i);
  });
});

describe('Kadere — message + transcript helpers', () => {
  it('buildKadereMessage carries the proposal context and round-1 positions', () => {
    const msg = buildKadereMessage('PROPOSAL: Build a water tank', 'DAKTARI: looks fine');
    expect(msg).toContain('Build a water tank');
    expect(msg).toContain('DAKTARI: looks fine');
    expect(msg).toContain('JSON only');
  });

  it('buildKadereClosingMessage carries the transcript', () => {
    const msg = buildKadereClosingMessage('PROPOSAL: X', '=== ROUND 1 === ...');
    expect(msg).toContain('DELIBERATION SO FAR');
    expect(msg).toContain('ROUND 1');
  });

  it('formatKadereForTranscript renders a labelled, rebuttable block; empty for blank', () => {
    const block = formatKadereForTranscript('This concentrates control in one office.');
    expect(block).toMatch(/KADERE \(values voice/);
    expect(block).toContain('concentrates control');
    expect(formatKadereForTranscript('   ')).toBe('');
  });
});
