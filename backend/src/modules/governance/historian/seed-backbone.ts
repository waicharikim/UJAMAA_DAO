/**
 * @file src/modules/governance/historian/seed-backbone.ts
 * @description
 * Operator-run: bootstrap the national historical timeline backbone (LLM_SEED,
 * UNVERIFIED) so Mhenga has a national arc to reason from. Idempotent — skips if a
 * seed already exists. No-op when the AI is unavailable.
 *
 * Run: docker exec ujamaa_web npx tsx src/modules/governance/historian/seed-backbone.ts
 */

import { prisma } from '../../../core/database/client.js';
import { historianService } from './historian.service.js';

async function main() {
  const n = await historianService.seedHistoricalBackbone();
  console.log(`[HISTORIAN] Seeded ${n} national backbone event(s).`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
