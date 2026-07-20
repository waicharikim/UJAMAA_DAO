/**
 * @file src/modules/governance/baraza/benchmark.ts
 * @description
 * Baseline benchmark: a SINGLE generic evaluator vs the full Baraza council.
 *
 * The council side is FREE — it reuses the stored COMPLETE deliberations
 * (conflictMap / revisionSuggestions / readiness), so we only spend calls on the
 * single-agent evaluation + an LLM judge that lists what the council caught and the
 * single agent missed. Read-only; dev-only.
 *
 * Run: docker exec ujamaa_web npx tsx src/modules/governance/baraza/benchmark.ts
 */

import { prisma } from '../../../core/database/client.js';
import {
  completeJSON,
  isQwenAvailable,
  QWEN_MODEL,
} from '../../../core/ai/qwen.js';

interface SingleEval {
  readinessScore: number;
  concerns: string[];
  tradeoffs: string[];
  chokepoints: string[];
  suggestedChanges: string[];
}

interface Judge {
  missedBySingle: string[];
  caughtByBoth: string[];
  singleOnly: string[];
}

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];

const SINGLE_SYSTEM = `You are an experienced, plain-spoken evaluator of community proposals in Kenya. Read the proposal and assess whether it is ready to fund/act on. Be specific and concrete — name real risks and trade-offs, not generic ones. Respond with ONLY JSON: {"readinessScore": <0-100>, "concerns": string[], "tradeoffs": string[], "chokepoints": string[], "suggestedChanges": string[]}`;

const JUDGE_SYSTEM = `You are a neutral evaluator comparing two reviews of the SAME proposal: a MULTI-AGENT COUNCIL review and a SINGLE-AGENT review. Compare on substance, not wording. Identify concretely: (1) points the council surfaced that the single agent MISSED, (2) points both caught, (3) points only the single agent caught. Respond with ONLY JSON: {"missedBySingle": string[], "caughtByBoth": string[], "singleOnly": string[]}`;

function summarizeCouncil(d: {
  readinessScore: number | null;
  readinessBand: string | null;
  conflictMap: unknown;
  revisionSuggestions: unknown;
  mkutanoConvergence: unknown;
}): {
  text: string;
  chokepoints: string[];
  conflicts: string[];
  revisions: string[];
} {
  const cm = (d.conflictMap ?? {}) as {
    conflicts?: { issue?: string; between?: string[] }[];
    unresolved?: string[];
    chokepoints?: { location?: string; issue?: string; severity?: string }[];
  };
  const chokepoints = (cm.chokepoints ?? []).map((c) =>
    `[${c.severity ?? '?'}] ${c.location ?? c.issue ?? ''}`.trim()
  );
  const conflicts = (cm.conflicts ?? []).map(
    (c) => c.issue || (c.between ?? []).join(' vs ')
  );
  const unresolved = arr(cm.unresolved);
  const revisions = arr(d.revisionSuggestions);
  const convergence = arr(d.mkutanoConvergence);
  const text = [
    `Readiness: ${d.readinessScore}/100 (${d.readinessBand ?? '?'})`,
    chokepoints.length ? `Chokepoints: ${chokepoints.join('; ')}` : '',
    conflicts.length ? `Conflicts/trade-offs: ${conflicts.join('; ')}` : '',
    unresolved.length ? `Unresolved questions: ${unresolved.join('; ')}` : '',
    convergence.length
      ? `Top concerns (Mkutano): ${convergence.join('; ')}`
      : '',
    revisions.length ? `Revision suggestions: ${revisions.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return { text, chokepoints, conflicts, revisions };
}

async function main() {
  if (!isQwenAvailable()) {
    console.error(
      'Qwen unavailable (no DASHSCOPE_API_KEY) — cannot benchmark.'
    );
    process.exit(1);
  }

  const delibs = await prisma.barazaDeliberation.findMany({
    where: { status: 'COMPLETE' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      proposalId: true,
      readinessScore: true,
      readinessBand: true,
      conflictMap: true,
      revisionSuggestions: true,
      mkutanoConvergence: true,
    },
  });

  const rows: string[] = [];
  const detail: string[] = [];
  let totMissed = 0;
  let totCouncilPoints = 0;
  let totReadinessDelta = 0;
  let counted = 0;

  for (const d of delibs) {
    const p = await prisma.proposal.findUnique({
      where: { id: d.proposalId },
      select: {
        title: true,
        description: true,
        problem: true,
        solution: true,
        budget: true,
        proposalType: true,
      },
    });
    if (!p) continue;

    const council = summarizeCouncil(d);
    const councilPoints =
      council.chokepoints.length +
      council.conflicts.length +
      council.revisions.length;

    const single = await completeJSON<SingleEval>({
      system: SINGLE_SYSTEM,
      userMessage: `PROPOSAL: ${p.title}\nTYPE: ${p.proposalType}\nDESCRIPTION: ${p.description}\nPROBLEM: ${p.problem ?? '(not specified)'}\nSOLUTION: ${p.solution ?? '(not specified)'}\nBUDGET: ${p.budget ?? 'n/a'}\n\nEvaluate. JSON only.`,
      maxTokens: 1200,
      model: QWEN_MODEL,
    });
    if (!single) continue;

    const singleText = [
      `Readiness: ${single.readinessScore}/100`,
      `Concerns: ${arr(single.concerns).join('; ')}`,
      `Trade-offs: ${arr(single.tradeoffs).join('; ')}`,
      `Chokepoints: ${arr(single.chokepoints).join('; ')}`,
      `Suggested changes: ${arr(single.suggestedChanges).join('; ')}`,
    ].join('\n');

    const judge = await completeJSON<Judge>({
      system: JUDGE_SYSTEM,
      userMessage: `MULTI-AGENT COUNCIL REVIEW:\n${council.text}\n\nSINGLE-AGENT REVIEW:\n${singleText}\n\nCompare. JSON only.`,
      maxTokens: 1000,
      model: QWEN_MODEL,
    });

    const missed = arr(judge?.missedBySingle);
    const both = arr(judge?.caughtByBoth);
    const singleOnly = arr(judge?.singleOnly);
    const readinessDelta =
      (single.readinessScore ?? 0) - (d.readinessScore ?? 0);

    totMissed += missed.length;
    totCouncilPoints += councilPoints;
    totReadinessDelta += readinessDelta;
    counted++;

    rows.push(
      `| ${p.title.slice(0, 40)} | ${d.readinessScore ?? '?'} | ${single.readinessScore ?? '?'} | ${councilPoints} | ${both.length} | ${missed.length} | ${singleOnly.length} |`
    );
    detail.push(
      `### ${p.title}\n` +
        `- **Readiness:** council ${d.readinessScore}/100 vs single ${single.readinessScore}/100 (Δ ${readinessDelta >= 0 ? '+' : ''}${readinessDelta})\n` +
        (missed.length
          ? `- **Council caught, single MISSED:**\n${missed.map((m) => `  - ${m}`).join('\n')}\n`
          : `- **Council caught, single MISSED:** (none)\n`) +
        (singleOnly.length
          ? `- **Single-only points:** ${singleOnly.join('; ')}\n`
          : '')
    );
  }

  const report =
    `# Baraza baseline benchmark — single agent vs the council\n\n` +
    `Sample: ${counted} completed deliberations (dev). Council side = stored results; ` +
    `single side = one \`${QWEN_MODEL}\` call; misses judged by an LLM.\n\n` +
    `| Proposal | Council rdy | Single rdy | Council points | Both caught | **Single missed** | Single-only |\n` +
    `|---|---|---|---|---|---|---|\n` +
    rows.join('\n') +
    `\n\n**Aggregate:** across ${counted} proposals the single agent **missed ${totMissed}** of the ` +
    `${totCouncilPoints} concrete points the council surfaced ` +
    `(${totCouncilPoints ? Math.round((totMissed / totCouncilPoints) * 100) : 0}%). ` +
    `Mean readiness delta (single − council): ${counted ? (totReadinessDelta / counted).toFixed(1) : 0}.\n\n` +
    `---\n\n` +
    detail.join('\n');

  console.log(
    '\n===BENCHMARK_REPORT_START===\n' +
      report +
      '\n===BENCHMARK_REPORT_END===\n'
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
