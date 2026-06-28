/**
 * @file tests/governance/historian.test.ts
 * Phase 5: the historian (Mhenga) timeline KB + framing. Pure helpers tested
 * directly; retrieval uses the test DB.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import {
  historianService,
  confidenceTag,
} from '../../src/modules/governance/historian/historian.service.js';
import { formatFraming } from '../../src/modules/governance/baraza/agents/historian.js';

describe('confidenceTag', () => {
  it('maps provenance + verification to a confidence phrase', () => {
    expect(confidenceTag('LLM_SEED', 'UNVERIFIED')).toBe(
      'per model knowledge, unverified'
    );
    expect(confidenceTag('ADMIN', 'ADMIN_CONFIRMED')).toBe('confirmed');
    expect(confidenceTag('COLLECTOR', 'DISPUTED')).toBe('DISPUTED');
    expect(confidenceTag('COLLECTOR', 'UNVERIFIED')).toBe('unverified');
  });
});

describe('historian service', () => {
  beforeEach(async () => {
    await prisma.historicalEvent.deleteMany({});
  });

  it('retrieves by theme/keyword overlap', async () => {
    await historianService.addEvent(
      {
        era: 'Colonial',
        title: 'Land alienation',
        startYear: 1902,
        summary: 'Settlers took the highland farms.',
        themes: ['land'],
      },
      'LLM_SEED'
    );
    await historianService.addEvent(
      {
        era: 'Eurobond',
        title: 'Eurobond era',
        startYear: 2014,
        summary: 'Sovereign borrowing rose sharply.',
        themes: ['debt'],
      },
      'LLM_SEED'
    );
    const out = await historianService.getRelevantHistory(['land'], []);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Land alienation');
    expect(out[0].tag).toBe('per model knowledge, unverified');
  });

  it('falls back to a sample when nothing matches', async () => {
    await historianService.addEvent(
      { era: 'X', title: 'A', summary: 'something', themes: [] },
      'LLM_SEED'
    );
    const out = await historianService.getRelevantHistory(
      ['unrelated'],
      ['zzzz']
    );
    expect(out).toHaveLength(1); // sample fallback, not empty
  });

  it('excludes superseded entries', async () => {
    const old = await historianService.addEvent(
      { era: 'Colonial', title: 'Old account', summary: 'x', themes: ['land'] },
      'LLM_SEED'
    );
    await prisma.historicalEvent.update({
      where: { id: old.id },
      data: { supersededById: old.id },
    });
    const out = await historianService.getRelevantHistory(['land'], []);
    expect(out).toHaveLength(0);
  });

  it('formatHistory renders tags; empty for []', async () => {
    await historianService.addEvent(
      {
        era: 'Colonial',
        title: 'Land alienation',
        startYear: 1902,
        summary: 'x',
        themes: ['land'],
      },
      'LLM_SEED'
    );
    const out = await historianService.getRelevantHistory(['land'], []);
    const s = historianService.formatHistory(out);
    expect(s).toContain('Land alienation');
    expect(s).toContain('unverified');
    expect(historianService.formatHistory([])).toBe('');
  });
});

describe('formatFraming', () => {
  it('renders arc + trajectory; empty for null/blank', () => {
    const s = formatFraming({
      arc: 'colonial land theft set the pattern',
      trajectory: 'land pressure persists',
    });
    expect(s).toContain('How we got here');
    expect(s).toContain('Where this is heading');
    expect(formatFraming(null)).toBe('');
    expect(formatFraming({ arc: '', trajectory: '' })).toBe('');
  });
});
