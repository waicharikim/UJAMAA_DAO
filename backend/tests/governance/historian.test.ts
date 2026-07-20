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
import {
  formatFraming,
  buildHistorianMessage,
} from '../../src/modules/governance/baraza/agents/historian.js';

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

  it('returns nothing when nothing matches (no grandiose sample fallback)', async () => {
    await historianService.addEvent(
      { era: 'X', title: 'A', summary: 'something', themes: [] },
      'LLM_SEED'
    );
    const out = await historianService.getRelevantHistory(
      ['unrelated'],
      ['zzzz']
    );
    expect(out).toHaveLength(0); // no forced sample onto an unrelated proposal
  });

  it('matches an event when its own theme word appears in the proposal text', async () => {
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
    // No explicit themes/keywords passed — retrieval must derive relevance from
    // the proposal text alone (the third arg).
    const out = await historianService.getRelevantHistory(
      [],
      [],
      'We want to resolve a long-running land dispute in the ward.'
    );
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Land alienation');
  });

  it('scopes retrieval to shared national + this group, excluding other groups', async () => {
    const GROUP_A = '11111111-1111-1111-1111-111111111111';
    const GROUP_B = '22222222-2222-2222-2222-222222222222';
    await historianService.addEvent(
      { era: 'National', title: 'Shared arc', summary: 'x', themes: ['land'] },
      'LLM_SEED'
    ); // groupId null = national
    await historianService.addEvent(
      {
        era: 'Local',
        title: 'Our borehole ran dry',
        summary: 'x',
        themes: ['land'],
        groupId: GROUP_A,
      },
      'ADMIN',
      'ADMIN_CONFIRMED'
    );
    await historianService.addEvent(
      {
        era: 'Local',
        title: "Another group's market",
        summary: 'x',
        themes: ['land'],
        groupId: GROUP_B,
      },
      'ADMIN',
      'ADMIN_CONFIRMED'
    );

    const out = await historianService.getRelevantHistory(
      ['land'],
      [],
      '',
      GROUP_A
    );
    const titles = out.map((o) => o.title);
    expect(titles).toContain('Shared arc'); // national visible to all
    expect(titles).toContain('Our borehole ran dry'); // this group's own
    expect(titles).not.toContain("Another group's market"); // other group hidden

    // With no group in context, only the shared national timeline is returned.
    const national = await historianService.getRelevantHistory(['land'], []);
    const nationalTitles = national.map((o) => o.title);
    expect(nationalTitles).toContain('Shared arc');
    expect(nationalTitles).not.toContain('Our borehole ran dry');
  });

  it('suppresses the national arc when it is not load-bearing (includeNational=false)', async () => {
    const G = '33333333-3333-3333-3333-333333333333';
    await historianService.addEvent(
      { era: 'National', title: 'Shared arc', summary: 'x', themes: ['land'] },
      'LLM_SEED'
    );
    await historianService.addEvent(
      {
        era: 'Local',
        title: 'Our own event',
        summary: 'x',
        themes: ['land'],
        groupId: G,
      },
      'ADMIN',
      'ADMIN_CONFIRMED'
    );
    const gated = await historianService.getRelevantHistory(
      ['land'],
      [],
      '',
      G,
      false
    );
    expect(gated.map((o) => o.title)).toEqual(['Our own event']);
    expect(gated[0].scope).toBe('group');
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

describe('buildHistorianMessage', () => {
  it('leads with community history and puts the national arc after it', () => {
    const msg = buildHistorianMessage(
      'Build a water tank',
      [
        {
          era: 'Local',
          title: 'Old borehole',
          startYear: 2024,
          summary: 'ran dry',
          consequences: null,
          tag: 'confirmed',
          scope: 'group',
        },
        {
          era: 'SAPs',
          title: 'Fuel subsidy removed',
          startYear: 1993,
          summary: 'prices rose',
          consequences: null,
          tag: 'unverified',
          scope: 'national',
        },
      ],
      [{ title: 'Buy a pump', outcome: 'FAILED — no maintenance', year: 2023 }]
    );
    expect(msg).toContain("THIS COMMUNITY'S OWN HISTORY");
    // community section precedes the national arc
    expect(msg.indexOf("THIS COMMUNITY'S OWN HISTORY")).toBeLessThan(
      msg.indexOf('NATIONAL ARC')
    );
    expect(msg).toContain('Buy a pump'); // past decision
    expect(msg).toContain('Old borehole'); // group event
    expect(msg).toContain('Fuel subsidy removed'); // national event
  });

  it('says none-on-record and omits the national section when empty', () => {
    const msg = buildHistorianMessage('X', [], []);
    expect(msg).toContain('none on record yet');
    expect(msg).not.toContain('NATIONAL ARC');
  });
});
