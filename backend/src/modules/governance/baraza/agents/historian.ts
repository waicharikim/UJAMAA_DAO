/**
 * @file src/modules/governance/baraza/agents/historian.ts
 * @description
 * Mhenga, the historian — a run-once framing voice. Given a proposal and a
 * shortlist of relevant timeline entries, Mhenga situates it in the national arc
 * ("how we got here") and reads its trajectory ("where this is heading").
 *
 * Held to the truth discipline: facts only, attribute, present contested
 * interpretations as contested, never fabricate. Entries are tagged with their
 * confidence (confirmed / unverified / disputed) — Mhenga must respect that.
 */

export interface HistoricalShortlistItem {
  era: string;
  title: string;
  startYear: number | null;
  summary: string;
  consequences: string | null;
  tag: string;
  scope: 'group' | 'national';
}

/** One of the community's own past decisions and how it turned out. */
export interface PastDecisionItem {
  title: string;
  outcome: string; // recorded outcome, or the status when no outcome yet
  year: number | null;
}

export interface HistorianFraming {
  arc: string;
  trajectory: string;
}

export const MHENGA_SYSTEM = `You are Mhenga, the historian of the Baraza council — the elder who holds THIS COMMUNITY'S story first, and the nation's behind it. Before the council debates, you situate the proposal in time.

You will be given the proposal, THIS COMMUNITY'S OWN HISTORY (its past decisions and how they turned out, and its local events), and — only when it bears on the matter — a NATIONAL ARC. Every entry is tagged with its confidence: "confirmed", "unverified", or "DISPUTED". Your discipline:
- Facts only. Build on the entries provided; do not invent events or outcomes.
- Honour the confidence tags: lean on confirmed entries; hedge on unverified ones ("by some accounts…"); for DISPUTED points, present the contest, do not pick a side.
- LEAD WITH THIS COMMUNITY. Read their own arc as a PATTERN, not a list — what they keep trying, what keeps working or failing, the recurring gap ("each time they did X, Y followed"). Name the pattern; do not merely recount events.
- Bring in the national arc ONLY where it genuinely bears on this decision. If none is given, or it does not bear, stay with the community's story. Never inflate a routine local matter into national grandeur.
- If there is little or no history on record, say so plainly and briefly rather than inventing a backdrop.
- Two short paragraphs:
  1. HOW WE GOT HERE — the community's own arc as a pattern, situated against the national arc only where it bears.
  2. WHERE THIS IS HEADING — the trajectory if the pattern holds, stated soberly (not prophecy).
- No editorialising, no party politics, no recommendation on how to vote.

Respond with ONLY this JSON: {"arc": "<paragraph>", "trajectory": "<paragraph>"}`;

export function buildHistorianMessage(
  proposalSummary: string,
  events: HistoricalShortlistItem[],
  pastDecisions: PastDecisionItem[] = []
): string {
  const line = (e: HistoricalShortlistItem) => {
    const yr = e.startYear ? `${e.startYear} ` : '';
    return `- ${yr}[${e.era}] ${e.title}: ${e.summary} (${e.tag})`;
  };
  const groupEvents = events.filter((e) => e.scope === 'group').map(line);
  const nationalEvents = events.filter((e) => e.scope === 'national').map(line);

  const decisions = pastDecisions.map((d) => {
    const yr = d.year ? `${d.year} ` : '';
    return `- ${yr}"${d.title}" → ${d.outcome}`;
  });

  const communityParts = [
    decisions.length
      ? `Past decisions and how they turned out:\n${decisions.join('\n')}`
      : '',
    groupEvents.length
      ? `Local events on record:\n${groupEvents.join('\n')}`
      : '',
  ].filter(Boolean);
  const communitySection = communityParts.length
    ? `THIS COMMUNITY'S OWN HISTORY:\n${communityParts.join('\n')}`
    : `THIS COMMUNITY'S OWN HISTORY: none on record yet.`;

  const nationalSection = nationalEvents.length
    ? `\n\nNATIONAL ARC (shared — weigh only where it bears on this decision):\n${nationalEvents.join('\n')}`
    : '';

  return `PROPOSAL:
${proposalSummary}

${communitySection}${nationalSection}

Lead with THIS COMMUNITY'S arc as a pattern; bring in the national arc only where it genuinely bears. JSON only.`;
}

/** Render Mhenga's framing into the block injected into the deliberation. '' if empty. */
export function formatFraming(framing: HistorianFraming | null): string {
  if (!framing) return '';
  const arc = typeof framing.arc === 'string' ? framing.arc.trim() : '';
  const trajectory =
    typeof framing.trajectory === 'string' ? framing.trajectory.trim() : '';
  if (!arc && !trajectory) return '';
  return `HISTORICAL CONTEXT (Mhenga — facts/contested noted; weigh, do not take as settled):
How we got here: ${arc}
Where this is heading: ${trajectory}`;
}
