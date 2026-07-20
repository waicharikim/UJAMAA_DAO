/**
 * @file src/modules/governance/knowledge/reindex-run.ts
 * @description
 * Operator-run: (re)build the shared knowledge index from platform docs +
 * verified education modules. Copy docs into the container first, e.g.:
 *   docker cp docs/. ujamaa_web:/usr/src/app/knowledge-docs
 *   docker exec ujamaa_web npx tsx src/modules/governance/knowledge/reindex-run.ts
 */

import { prisma } from '../../../core/database/client.js';
import { knowledgeService } from './knowledge.service.js';

async function main() {
  const n = await knowledgeService.reindex();
  console.log(`[KNOWLEDGE] Indexed ${n} chunk(s).`);
  if (n > 0) {
    const demo =
      'How do Participation Rights (PR) work and can they be transferred?';
    const hits = await knowledgeService.search(demo, 3);
    console.log(`\n[KNOWLEDGE] Smoke search: "${demo}"`);
    for (const h of hits) {
      console.log(`  - [${h.source}] ${h.title} (score ${h.score.toFixed(3)})`);
    }
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
