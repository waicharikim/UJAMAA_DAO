/**
 * @file tests/governance/knowledge.test.ts
 * Shared knowledge layer — pure helpers (cosine, chunking) tested offline.
 * (reindex/search are exercised live via reindex-run.ts + a search smoke test.)
 */

import { describe, it, expect } from 'vitest';
import {
  cosine,
  chunkText,
} from '../../src/modules/governance/knowledge/knowledge.service.js';

describe('knowledge — cosine similarity', () => {
  it('is 1 for identical, ~0 for orthogonal vectors', () => {
    expect(cosine([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('guards mismatched-length and zero vectors', () => {
    expect(cosine([1, 2, 3], [1, 2])).toBe(0);
    expect(cosine([0, 0], [0, 0])).toBe(0);
  });
});

describe('knowledge — chunkText', () => {
  it('splits on paragraphs and bounds chunk size', () => {
    const para = 'x'.repeat(800);
    const chunks = chunkText([para, para, para].join('\n\n'));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 1300)).toBe(true);
  });

  it('returns a single chunk for short text and drops empties', () => {
    expect(chunkText('hello world')).toEqual(['hello world']);
    expect(chunkText('\n\n  \n\n')).toEqual([]);
  });
});
