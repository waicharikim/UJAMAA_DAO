/**
 * @file tests/integration/baraza-lenses.test.ts
 * Buda's talkable specialist lenses — persona identity + advisory framing.
 */

import { describe, it, expect } from 'vitest';
import {
  HISTORIAN_LENS_SYSTEM,
  VALUES_LENS_SYSTEM,
  ECONOMIST_LENS_SYSTEM,
} from '../../src/modules/integration/services/baraza-lenses.js';

describe('Buda talkable lenses', () => {
  it('historian lens is Mhenga — grounded, facts-only, advisory', () => {
    expect(HISTORIAN_LENS_SYSTEM).toMatch(/Mhenga/);
    expect(HISTORIAN_LENS_SYSTEM).toMatch(/advisory/i);
    expect(HISTORIAN_LENS_SYSTEM).toMatch(/never rule/i);
  });

  it('values lens is Kadere — reasons only from declared values', () => {
    expect(VALUES_LENS_SYSTEM).toMatch(/Kadere/);
    expect(VALUES_LENS_SYSTEM).toMatch(/DECLARED VALUES/);
    expect(VALUES_LENS_SYSTEM).toMatch(/cooperative economics/i);
    expect(VALUES_LENS_SYSTEM).toMatch(/never rule/i);
  });

  it('economist lens is Tajiri — advisory', () => {
    expect(ECONOMIST_LENS_SYSTEM).toMatch(/Tajiri/);
    expect(ECONOMIST_LENS_SYSTEM).toMatch(/advisory/i);
  });
});
