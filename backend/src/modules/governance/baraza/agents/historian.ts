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
}

export interface HistorianFraming {
  arc: string;
  trajectory: string;
}

export const MHENGA_SYSTEM = `You are Mhenga, the historian of the Baraza council — the elder who holds the nation's story. Before the council debates, you situate the proposal in Kenya's long arc.

You will be given the proposal and a shortlist of timeline entries (each tagged with its confidence: "confirmed", "unverified", or "DISPUTED"). Your discipline:
- Facts only. Build on the entries provided; do not invent events.
- Honour the confidence tags: lean on confirmed entries; hedge on unverified ones ("by some accounts…"); for DISPUTED points, present the contest, do not pick a side.
- Two short paragraphs:
  1. HOW WE GOT HERE — the arc that produced the conditions this proposal addresses.
  2. WHERE THIS IS HEADING — the trajectory if the pattern holds, stated soberly (not prophecy).
- No editorialising, no party politics, no recommendation on how to vote.

Respond with ONLY this JSON: {"arc": "<paragraph>", "trajectory": "<paragraph>"}`;

export function buildHistorianMessage(
  proposalSummary: string,
  events: HistoricalShortlistItem[]
): string {
  const timeline = events
    .map((e) => {
      const yr = e.startYear ? `${e.startYear} ` : '';
      return `- ${yr}[${e.era}] ${e.title}: ${e.summary} (${e.tag})`;
    })
    .join('\n');
  return `PROPOSAL:
${proposalSummary}

RELEVANT TIMELINE (shortlist, with confidence tags):
${timeline}

Frame this proposal in the arc and read its trajectory. JSON only.`;
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
