/**
 * @file tests/governance/baraza-convener.test.ts
 * Phase 2: the convener (Mjamaa) casting logic. Pure-function tests (no AI/DB).
 */

import { describe, it, expect } from 'vitest';
import {
  defaultCasting,
  mergeWithPriors,
  formatCastBlock,
  LIFE_STAGES,
  EXPOSURES,
  type ProposalCasting,
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
      structuralNote: 'Scope looks correct.',
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
    expect(merged.structuralNote).toBe('Scope looks correct.');
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
