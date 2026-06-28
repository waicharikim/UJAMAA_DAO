/**
 * @file tests/governance/baraza-panels.test.ts
 * Phase 1: panel selection by community type. Pure-function tests (no DB/AI).
 */

import { describe, it, expect } from 'vitest';
import {
  selectDomainPanel,
  GOVERNANCE_DOMAIN_KEYS,
  COOPERATIVE_DOMAIN_KEYS,
  ANALYST_AGENT_KEYS,
  AGENT_SYSTEM_PROMPTS,
  type AgentKey,
} from '../../src/modules/governance/baraza/agents/prompts.js';

describe('selectDomainPanel()', () => {
  it('uses the governance panel for system groups', () => {
    expect(selectDomainPanel({ isSystemGroup: true })).toEqual(
      GOVERNANCE_DOMAIN_KEYS
    );
  });

  it('uses the cooperative panel for voluntary groups', () => {
    expect(selectDomainPanel({ isSystemGroup: false })).toEqual(
      COOPERATIVE_DOMAIN_KEYS
    );
  });

  it('governance panel is the 5 ministry agents', () => {
    expect(GOVERNANCE_DOMAIN_KEYS).toEqual([
      'DAKTARI',
      'LINDA',
      'TAJIRI',
      'FOREMAN',
      'MWALIMU',
    ]);
  });

  it('cooperative panel is the 4 cooperative agents', () => {
    expect(COOPERATIVE_DOMAIN_KEYS).toEqual([
      'MKURUGENZI',
      'MWANANCHI',
      'FUNDI',
      'HUSTLER',
    ]);
  });

  it('panels are disjoint and every agent has a non-empty system prompt', () => {
    const all: AgentKey[] = [
      ...GOVERNANCE_DOMAIN_KEYS,
      ...COOPERATIVE_DOMAIN_KEYS,
      ...ANALYST_AGENT_KEYS,
    ];
    expect(new Set(all).size).toBe(all.length); // no key appears twice
    expect(all).toHaveLength(11);
    for (const k of all) {
      expect(AGENT_SYSTEM_PROMPTS[k]).toBeTruthy();
      expect(AGENT_SYSTEM_PROMPTS[k]).toContain('{{AGENT_MEMORY}}');
      expect(AGENT_SYSTEM_PROMPTS[k]).toContain('{{PROPOSAL_CONTEXT}}');
    }
  });
});
