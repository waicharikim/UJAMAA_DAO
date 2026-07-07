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

  it('v2: falls back to the group-type panel for neutral text', () => {
    expect(selectDomainPanel({ isSystemGroup: true }, 'hello there')).toEqual(
      GOVERNANCE_DOMAIN_KEYS
    );
    expect(selectDomainPanel({ isSystemGroup: false }, 'hello there')).toEqual(
      COOPERATIVE_DOMAIN_KEYS
    );
  });

  it('v2: pulls cooperative agents into a system group for an economic proposal', () => {
    const panel = selectDomainPanel(
      { isSystemGroup: true },
      'a community savings and loan fund with bulk-buying for the market'
    );
    expect(panel).toContain('MKURUGENZI'); // finance
    expect(panel).toContain('HUSTLER'); // market
  });

  it('v2: pulls governance lenses into a voluntary group for a health/water proposal', () => {
    const panel = selectDomainPanel(
      { isSystemGroup: false },
      'build a health clinic and a water borehole for the community'
    );
    expect(panel).toContain('DAKTARI'); // health
    expect(panel).toContain('LINDA'); // water / land
  });

  it('v2: bounds the panel size to 4..6', () => {
    const big = selectDomainPanel(
      { isSystemGroup: true },
      'health clinic water borehole road construction school bursary savings loan market business rent'
    );
    expect(big.length).toBeGreaterThanOrEqual(4);
    expect(big.length).toBeLessThanOrEqual(6);
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
