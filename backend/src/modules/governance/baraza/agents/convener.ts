/**
 * @file src/modules/governance/baraza/agents/convener.ts
 * @description
 * The CONVENER (Mjamaa) — the casting layer between agents and voices.
 *
 * Before the council debates, Mjamaa reads the proposal and decides, per domain
 * agent, which lived reality to foreground: one life-stage voice × one
 * economic-exposure voice, chosen by who the proposal actually affects. Voices
 * are NOT fixed to agents — they are cast per proposal. The static table below
 * is the default prior, used when the AI is unavailable or returns nothing.
 *
 * The cast block is prepended to each domain agent's system prompt at runtime
 * (no rewrite of the agent prompt bodies), and the full casting is recorded on
 * the deliberation as the "resolved identity" of each agent for that proposal.
 */

import type { AgentKey } from './prompts.js';

// ─── Voice taxonomy (life situation, not occupation/identity) ──────────────────

export const LIFE_STAGES = [
  'Student',
  'Young single',
  'Young couple / new family',
  'Squeezed parent',
  'Older parents',
  'Elder',
] as const;
export type LifeStage = (typeof LIFE_STAGES)[number];

export const EXPOSURES = ['Cushioned', 'Exposed', 'Dependent'] as const;
export type Exposure = (typeof EXPOSURES)[number];

/** How serious Mjamaa judges the proposal's structural problems to be. */
export const STRUCTURAL_SEVERITIES = ['NONE', 'MINOR', 'MAJOR'] as const;
export type StructuralSeverity = (typeof STRUCTURAL_SEVERITIES)[number];

export interface CastVoice {
  lifeStage: LifeStage;
  exposure: Exposure;
  why: string;
}

export interface ProposalCasting {
  casting: Partial<Record<AgentKey, CastVoice>>;
  structuralNote: string;
  structuralSeverity: StructuralSeverity;
}

// ─── Default priors (the §4 table) ─────────────────────────────────────────────
// Sensible baseline per domain agent, spanning all 6 stages × all 3 exposures so
// even the fallback hears everyone. The convener overrides these per proposal.

export const DEFAULT_VOICE_PRIORS: Record<
  AgentKey,
  { lifeStage: LifeStage; exposure: Exposure }
> = {
  // governance
  DAKTARI: { lifeStage: 'Squeezed parent', exposure: 'Dependent' },
  LINDA: { lifeStage: 'Older parents', exposure: 'Exposed' },
  TAJIRI: { lifeStage: 'Young single', exposure: 'Cushioned' },
  FOREMAN: { lifeStage: 'Young couple / new family', exposure: 'Exposed' },
  MWALIMU: { lifeStage: 'Student', exposure: 'Dependent' },
  // cooperative
  MKURUGENZI: { lifeStage: 'Older parents', exposure: 'Cushioned' },
  MWANANCHI: { lifeStage: 'Elder', exposure: 'Dependent' },
  FUNDI: { lifeStage: 'Young single', exposure: 'Exposed' },
  HUSTLER: { lifeStage: 'Squeezed parent', exposure: 'Exposed' },
  // analysts carry no cast voice (own characters) — present for completeness
  SHAHIDI: { lifeStage: 'Elder', exposure: 'Dependent' },
  MPELELEZI: { lifeStage: 'Elder', exposure: 'Dependent' },
};

/** Casting built purely from the default priors (AI-free fallback). */
export function defaultCasting(domainKeys: AgentKey[]): ProposalCasting {
  const casting: Partial<Record<AgentKey, CastVoice>> = {};
  for (const key of domainKeys) {
    const prior = DEFAULT_VOICE_PRIORS[key];
    casting[key] = {
      ...prior,
      why: 'Default panel assignment (convener unavailable).',
    };
  }
  return { casting, structuralNote: '', structuralSeverity: 'NONE' };
}

// ─── Mjamaa, the convener ───────────────────────────────────────────────────────

export const CONVENER_SYSTEM = `You are Mjamaa, the convener of the Baraza council and its structure-and-system voice. You know how UjamaaDAO actually works — system groups (ward → constituency → county → national) and voluntary groups (SACCOs, businesses, projects); proposal scope; the dues split; the review chain; who is eligible and who is affected.

Your job runs BEFORE the council debates. You do two things:

1. CAST THE VOICES. For each domain agent listed below, decide whose lived reality they should foreground for THIS specific proposal — because a proposal about school fees lands on students and young families, while a land-succession proposal lands on elders. Choose, per agent:
   - one LIFE STAGE from exactly: ${LIFE_STAGES.join(' | ')}
   - one ECONOMIC EXPOSURE from exactly: ${EXPOSURES.join(' | ')}
   - a one-sentence "why" tying that person to this proposal's repercussions.
   Spread the voices — the council should hear different stages and exposures, not the same person seven times. Centre whoever this proposal most affects.

2. ASSESS THE STRUCTURE. In one or two sentences, flag any structural issue: mis-scoping (e.g. a ward proposal that serves three wards), funding that exceeds what the group/treasury can sustain, the wrong review path, or duplication of something at another level. Then rate severity: NONE (no real issue), MINOR (worth noting, not blocking), or MAJOR (a serious structural flaw the council should weigh heavily). Draw on your memory of this group's past structural patterns where relevant.

Respond with ONLY this JSON shape (agent keys exactly as given):
{"casting": {"<AGENT_KEY>": {"lifeStage": "...", "exposure": "...", "why": "..."}}, "structuralNote": "...", "structuralSeverity": "NONE|MINOR|MAJOR"}`;

export function buildConvenerUserMessage(
  proposalContextStr: string,
  domainKeys: AgentKey[],
  mjamaaMemory: string
): string {
  return `DOMAIN AGENTS TO CAST (use these exact keys): ${domainKeys.join(', ')}

YOUR MEMORY OF THIS GROUP (past structural observations):
${mjamaaMemory}

${proposalContextStr}

Cast each agent's voice and assess the structure now. JSON only.`;
}

// ─── Validation + merge ─────────────────────────────────────────────────────────

function isValidVoice(v: unknown): v is CastVoice {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return (
    LIFE_STAGES.includes(c.lifeStage as LifeStage) &&
    EXPOSURES.includes(c.exposure as Exposure)
  );
}

/**
 * Merge the convener's (possibly partial/invalid) output with the priors so
 * every panel agent always ends up with a valid cast voice.
 */
export function mergeWithPriors(
  result: ProposalCasting | null,
  domainKeys: AgentKey[]
): ProposalCasting {
  const base = defaultCasting(domainKeys);
  if (!result || typeof result !== 'object') return base;

  const casting = { ...base.casting };
  for (const key of domainKeys) {
    const candidate = result.casting?.[key];
    if (isValidVoice(candidate)) {
      casting[key] = {
        lifeStage: candidate.lifeStage,
        exposure: candidate.exposure,
        why: String(candidate.why ?? '').slice(0, 300),
      };
    }
  }
  const structuralSeverity = STRUCTURAL_SEVERITIES.includes(
    result.structuralSeverity as StructuralSeverity
  )
    ? (result.structuralSeverity as StructuralSeverity)
    : 'NONE';

  return {
    casting,
    structuralNote:
      typeof result.structuralNote === 'string'
        ? result.structuralNote.slice(0, 600)
        : '',
    structuralSeverity,
  };
}

// ─── Closing structural review ─────────────────────────────────────────────────
// Mjamaa runs once more at the end to check the council's PROPOSED REVISIONS for
// structural soundness — a fix that itself breaks the scope/dues-split/review path
// should not pass unflagged. (The proposal text is fixed during the rounds, so the
// only new structural surface to react to is the revisions the council invents.)

export interface RevisionReview {
  revision: string;
  sound: boolean;
  note: string;
}

export interface StructuralReview {
  reviews: RevisionReview[];
  verdict: string;
}

export const EMPTY_REVIEW: StructuralReview = { reviews: [], verdict: '' };

export const CLOSING_REVIEW_SYSTEM = `You are Mjamaa, the convener and structure-and-system voice of the Baraza council. The deliberation has finished and the council has proposed revisions to the proposal. Your closing job is to check each proposed revision for STRUCTURAL soundness within UjamaaDAO:
- Does it fit the proposal's scope and level (ward → constituency → county → national)?
- Does it stay within what the group/treasury and the dues split (ward 70 / constituency 15 / county 10 / national 5) can actually sustain?
- Does it follow the correct review path, and avoid duplicating or colliding with another level?

For each revision, say whether it is structurally sound and, if not, exactly what breaks. Then give a single-sentence closing structural verdict on the proposal given these fixes. Use your memory of this group where relevant.

Respond with ONLY this JSON:
{"reviews": [{"revision": "<the revision text>", "sound": true|false, "note": "<why / what breaks>"}], "verdict": "<one sentence>"}`;

export function buildClosingReviewMessage(
  proposalContextStr: string,
  casting: ProposalCasting,
  revisions: string[],
  mjamaaMemory: string
): string {
  return `YOUR MEMORY OF THIS GROUP (past structural observations):
${mjamaaMemory}

YOUR EARLIER STRUCTURAL READ: ${casting.structuralNote || '(none)'} [severity: ${casting.structuralSeverity}]

${proposalContextStr}

PROPOSED REVISIONS TO REVIEW:
${revisions.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Review each revision for structural soundness and give your closing verdict. JSON only.`;
}

/** Validate/normalise the model's closing review; never throws. */
export function normalizeReview(result: StructuralReview | null): StructuralReview {
  if (!result || typeof result !== 'object') return EMPTY_REVIEW;
  const reviews = Array.isArray(result.reviews)
    ? result.reviews
        .filter((r) => r && typeof r === 'object')
        .map((r) => ({
          revision: String(r.revision ?? '').slice(0, 300),
          sound: r.sound !== false, // default to sound unless explicitly false
          note: String(r.note ?? '').slice(0, 300),
        }))
    : [];
  return {
    reviews,
    verdict:
      typeof result.verdict === 'string' ? result.verdict.slice(0, 400) : '',
  };
}

/** The block prepended to a domain agent's system prompt for this deliberation. */
export function formatCastBlock(voice: CastVoice | undefined): string {
  if (!voice) return '';
  return `## Whose lived reality to foreground for THIS proposal
The convener has cast you to argue your domain position with this person centred: **a ${voice.lifeStage.toLowerCase()} who is financially ${voice.exposure.toLowerCase()}**. ${voice.why}
Hold your domain expertise, but weigh everything through what this proposal means for them.

`;
}
