/**
 * @file tests/governance/baraza-convener.test.ts
 * Phase 2: the convener (Mjamaa) casting logic. Pure-function tests (no AI/DB).
 */

import { describe, it, expect } from 'vitest';
import {
  defaultCasting,
  mergeWithPriors,
  formatCastBlock,
  normalizeReview,
  EMPTY_REVIEW,
  LIFE_STAGES,
  EXPOSURES,
  type ProposalCasting,
  type StructuralReview,
} from '../../src/modules/governance/baraza/agents/convener.js';
import {
  GOVERNANCE_DOMAIN_KEYS,
  COOPERATIVE_DOMAIN_KEYS,
} from '../../src/modules/governance/baraza/agents/prompts.js';

describe('convener casting', () => {
  it('defaultCasting gives every panel agent a valid voice', () => {
    for (const panel of [GOVERNANCE_DOMAIN_KEYS, COOPERATIVE_DOMAIN_KEYS]) {
      const { casting } = defaultCasting(panel);
      for (const key of panel) {
        const v = casting[key]!;
        expect(v).toBeTruthy();
        expect(LIFE_STAGES).toContain(v.lifeStage);
        expect(EXPOSURES).toContain(v.exposure);
      }
    }
  });

  it('mergeWithPriors(null) falls back entirely to priors', () => {
    expect(mergeWithPriors(null, GOVERNANCE_DOMAIN_KEYS)).toEqual(
      defaultCasting(GOVERNANCE_DOMAIN_KEYS)
    );
  });

  it('uses a valid AI cast and fills the rest from priors', () => {
    const ai: ProposalCasting = {
      casting: {
        DAKTARI: {
          lifeStage: 'Student',
          exposure: 'Cushioned',
          why: 'This proposal is about school fees.',
        },
      },
      structuralNote: 'Ward proposal serves three wards.',
      structuralSeverity: 'MAJOR',
    };
    const merged = mergeWithPriors(ai, GOVERNANCE_DOMAIN_KEYS);
    // AI value honoured for DAKTARI
    expect(merged.casting.DAKTARI).toEqual({
      lifeStage: 'Student',
      exposure: 'Cushioned',
      why: 'This proposal is about school fees.',
    });
    // others fall back to priors (valid voices)
    expect(LIFE_STAGES).toContain(merged.casting.LINDA!.lifeStage);
    expect(merged.structuralNote).toBe('Ward proposal serves three wards.');
    expect(merged.structuralSeverity).toBe('MAJOR');
  });

  it('defaults structuralSeverity to NONE when missing or invalid', () => {
    const noSeverity = {
      casting: {},
      structuralNote: 'x',
    } as unknown as ProposalCasting;
    expect(mergeWithPriors(noSeverity, GOVERNANCE_DOMAIN_KEYS).structuralSeverity).toBe(
      'NONE'
    );
    const badSeverity = {
      casting: {},
      structuralNote: 'x',
      structuralSeverity: 'CATASTROPHIC',
    } as unknown as ProposalCasting;
    expect(mergeWithPriors(badSeverity, GOVERNANCE_DOMAIN_KEYS).structuralSeverity).toBe(
      'NONE'
    );
  });

  it('rejects an invalid AI voice and uses the prior instead', () => {
    const ai = {
      casting: {
        DAKTARI: { lifeStage: 'Astronaut', exposure: 'Rich', why: 'nope' },
      },
      structuralNote: '',
    } as unknown as ProposalCasting;
    const merged = mergeWithPriors(ai, GOVERNANCE_DOMAIN_KEYS);
    // invalid → prior used (a valid voice from the taxonomy)
    expect(LIFE_STAGES).toContain(merged.casting.DAKTARI!.lifeStage);
    expect(merged.casting.DAKTARI!.lifeStage).not.toBe('Astronaut');
  });

  it('formatCastBlock embeds the cast voice; empty for undefined', () => {
    const block = formatCastBlock({
      lifeStage: 'Squeezed parent',
      exposure: 'Exposed',
      why: 'They carry the cost.',
    });
    expect(block).toContain('squeezed parent');
    expect(block).toContain('exposed');
    expect(block).toContain('They carry the cost.');
    expect(formatCastBlock(undefined)).toBe('');
  });
});

describe('closing structural review', () => {
  it('normalizeReview(null) returns the empty review', () => {
    expect(normalizeReview(null)).toEqual(EMPTY_REVIEW);
  });

  it('coerces a valid review', () => {
    const r = normalizeReview({
      reviews: [
        {
          revision: 'Rescope to constituency',
          sound: false,
          note: 'Still exceeds the 15% constituency share.',
        },
      ],
      verdict: 'Needs rescoping before it is fundable.',
    });
    expect(r.reviews).toHaveLength(1);
    expect(r.reviews[0].sound).toBe(false);
    expect(r.reviews[0].revision).toBe('Rescope to constituency');
    expect(r.verdict).toBe('Needs rescoping before it is fundable.');
  });

  it('defaults sound=true and tolerates junk fields', () => {
    const r = normalizeReview({
      reviews: [{ revision: 'Phase the rollout' }],
      verdict: 123,
    } as unknown as StructuralReview);
    expect(r.reviews[0].sound).toBe(true);
    expect(r.verdict).toBe('');
  });
});
