/**
 * @file src/modules/governance/knowledge/knowledge.service.ts
 * @description
 * Shared knowledge layer (RAG). Chunks + embeds the platform docs and VERIFIED
 * education modules into `KnowledgeChunk`, and answers `search_knowledge` queries
 * by cosine similarity. One provenance-aware substrate the Q&A bot and the council
 * agents retrieve from — so knowledge lives in the corpus, not drift-prone prompts.
 *
 * Authority = provenance: only *verified* education modules are indexed (an
 * approved-yet-opinionated module should not become gospel the council reasons from).
 * Fails open: no AI or no index → empty results.
 */

import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';
import { embed, isQwenAvailable } from '../../../core/ai/qwen.js';

export interface KnowledgeHit {
  source: string;
  title: string;
  text: string;
  score: number;
}

const CHUNK_CHARS = 1200;
const EMBED_BATCH = 10;

export function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Split text into ~CHUNK_CHARS chunks on paragraph boundaries. */
export function chunkText(text: string): string[] {
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let cur = '';
  for (const p of paras) {
    if (cur && (cur + '\n\n' + p).length > CHUNK_CHARS) {
      chunks.push(cur);
      cur = p;
    } else {
      cur = cur ? `${cur}\n\n${p}` : p;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

interface RawDoc {
  source: string;
  sourceRef: string;
  title: string;
  text: string;
}

async function collectEducation(): Promise<RawDoc[]> {
  const mods = await prisma.educationalModule.findMany({
    where: { verified: true },
    select: { id: true, title: true, description: true, content: true },
  });
  return mods.map((m) => ({
    source: 'education',
    sourceRef: m.id,
    title: m.title,
    text: `${m.title}\n\n${m.description}\n\n${m.content}`,
  }));
}

function collectDocs(dir: string): RawDoc[] {
  if (!fs.existsSync(dir)) return [];
  const out: RawDoc[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    out.push({
      source: 'docs',
      sourceRef: f,
      title: f.replace(/\.md$/, ''),
      text,
    });
  }
  return out;
}

class KnowledgeService {
  /**
   * Rebuild the whole knowledge index. Operator-run. Reads docs from
   * `KNOWLEDGE_DOCS_DIR` (default `knowledge-docs`) + verified education modules,
   * chunks + embeds them, and replaces the `KnowledgeChunk` table. No-op without AI.
   */
  async reindex(
    docsDir = process.env.KNOWLEDGE_DOCS_DIR ?? 'knowledge-docs'
  ): Promise<number> {
    if (!isQwenAvailable()) {
      logger.info('[KNOWLEDGE] Qwen unavailable — skipping reindex');
      return 0;
    }
    const raw = [...collectDocs(docsDir), ...(await collectEducation())];
    const rows: Omit<RawDoc, never>[] = [];
    for (const d of raw) {
      for (const c of chunkText(d.text)) {
        rows.push({
          source: d.source,
          sourceRef: d.sourceRef,
          title: d.title,
          text: c,
        });
      }
    }
    if (rows.length === 0) return 0;

    const embeddings: number[][] = [];
    for (let i = 0; i < rows.length; i += EMBED_BATCH) {
      const vecs = await embed(
        rows.slice(i, i + EMBED_BATCH).map((r) => r.text)
      );
      if (!vecs) throw new Error('Embedding failed during reindex');
      embeddings.push(...vecs);
    }

    await prisma.knowledgeChunk.deleteMany({});
    await prisma.knowledgeChunk.createMany({
      data: rows.map((r, i) => ({
        ...r,
        embedding: embeddings[i] as unknown as Prisma.InputJsonValue,
      })),
    });
    logger.info({ chunks: rows.length }, '[KNOWLEDGE] Reindexed');
    return rows.length;
  }

  /** Top-k most relevant chunks for a query. Empty on no AI / no index. */
  async search(query: string, topK = 3): Promise<KnowledgeHit[]> {
    if (!isQwenAvailable() || !query.trim()) return [];
    const qv = await embed([query]);
    if (!qv) return [];
    const chunks = await prisma.knowledgeChunk.findMany({
      select: { source: true, title: true, text: true, embedding: true },
    });
    const scored = chunks.map((c) => ({
      source: c.source,
      title: c.title,
      text: c.text,
      score: cosine(qv[0], c.embedding as unknown as number[]),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}

export const knowledgeService = new KnowledgeService();
