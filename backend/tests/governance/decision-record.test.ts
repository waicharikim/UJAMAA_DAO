/**
 * @file tests/governance/decision-record.test.ts
 * The community-memory decision record. The deterministic bundle + fail-open path
 * are pure/offline (they run without the AI, which is what executes locally).
 */

import { describe, it, expect, vi } from 'vitest';

// Force the AI-unavailable path so fail-open is deterministic to assert (the
// container carries a DASHSCOPE key, so isQwenAvailable() is otherwise true).
vi.mock('../../src/core/ai/qwen.js', () => ({
  isQwenAvailable: () => false,
  completeJSON: vi.fn(),
  QWEN_ANALYST_MODEL: 'test-model',
}));

import {
  buildDeterministicDecisionRecord,
  generateDecisionRecord,
  type DecisionRecordInputs,
} from '../../src/modules/governance/services/decision-record.js';

const base: DecisionRecordInputs = {
  title: 'Fix the borehole',
  description: 'The borehole that serves the estate is broken.',
  rationale: 'It serves 400 households and the nearest alternative is 3km away.',
  alternatives: 'Trucking water in — rejected as too costly to sustain.',
  outcome: 'Pump replaced; water restored within two weeks.',
  status: 'COMPLETED',
  deliberationSummary: null,
};

describe('decision record — deterministic bundle', () => {
  it('faithfully bundles the human-authored fields', () => {
    const r = buildDeterministicDecisionRecord(base);
    expect(r.decided).toBe('Fix the borehole');
    expect(r.why).toContain('400 households');
    expect(r.alternatives).toContain('Trucking water');
    expect(r.whatHappened).toContain('water restored');
  });

  it('uses explicit "none recorded" text for empty fields', () => {
    const r = buildDeterministicDecisionRecord({
      ...base,
      rationale: null,
      alternatives: '   ',
      outcome: '',
    });
    expect(r.why).toMatch(/no reasoning/i);
    expect(r.alternatives).toMatch(/no alternatives/i);
    expect(r.whatHappened).toMatch(/no outcome/i);
  });
});

describe('decision record — fail-open', () => {
  it('returns the deterministic record when the AI is unavailable', async () => {
    // No DASHSCOPE key in the test env → isQwenAvailable() is false → template path.
    const r = await generateDecisionRecord(base);
    expect(r).toEqual(buildDeterministicDecisionRecord(base));
  });
});
