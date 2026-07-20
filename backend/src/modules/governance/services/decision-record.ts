/**
 * @file src/modules/governance/services/decision-record.ts
 * @description
 * Consolidates a passed proposal's community memory into a short, structured
 * DECISION RECORD — { decided, why, alternatives, whatHappened }. Fail-open: an
 * LLM writes it when Qwen is available, otherwise a deterministic template bundles
 * the human-authored fields. The record is a DERIVED convenience — rationale /
 * alternatives / outcome remain authoritative. It is descriptive only: it never
 * gates, scores, or awards anything.
 */

import {
  completeJSON,
  isQwenAvailable,
  QWEN_ANALYST_MODEL,
} from '../../../core/ai/qwen.js';

export interface DecisionRecordInputs {
  title: string;
  description: string;
  rationale: string | null;
  alternatives: string | null;
  outcome: string;
  status: string;
  deliberationSummary: unknown;
}

export interface DecisionRecord {
  decided: string;
  why: string;
  alternatives: string;
  whatHappened: string;
}

const NONE = {
  why: 'No reasoning was recorded.',
  alternatives: 'No alternatives were recorded.',
  whatHappened: 'No outcome was recorded.',
};

/**
 * Deterministic fallback — a faithful bundle of the human-authored fields. Also the
 * base the AI record fills in from, so no field is ever left empty.
 */
export function buildDeterministicDecisionRecord(
  i: DecisionRecordInputs
): DecisionRecord {
  return {
    decided: i.title.trim() || 'Decision recorded.',
    why: i.rationale?.trim() || NONE.why,
    alternatives: i.alternatives?.trim() || NONE.alternatives,
    whatHappened: i.outcome?.trim() || NONE.whatHappened,
  };
}

const DECISION_RECORD_SYSTEM = `You are a neutral clerk writing a community's DECISION RECORD — a short, plain-language summary of a decision they made and how it turned out. Facts only, drawn strictly from what you are given; do not invent details, do not recommend anything, do not editorialise. Keep each field to 1–2 sentences.

Respond with ONLY this JSON: {"decided": "<what the community decided>", "why": "<the reasoning>", "alternatives": "<what else was weighed and why it was set aside>", "whatHappened": "<the recorded outcome>"}`;

function buildDecisionRecordMessage(i: DecisionRecordInputs): string {
  const delib =
    i.deliberationSummary && typeof i.deliberationSummary === 'object'
      ? JSON.stringify(i.deliberationSummary)
      : '(none)';
  return `PROPOSAL: ${i.title}
STATUS: ${i.status}
DESCRIPTION: ${i.description}
STATED REASONING: ${i.rationale ?? '(none recorded)'}
ALTERNATIVES CONSIDERED: ${i.alternatives ?? '(none recorded)'}
RECORDED OUTCOME: ${i.outcome}
COUNCIL DELIBERATION DIGEST: ${delib}

Write the decision record. JSON only.`;
}

/**
 * Produce the decision record. Never throws — falls back to the deterministic
 * bundle on any AI unavailability/error, and fills any missing AI field from it.
 */
export async function generateDecisionRecord(
  i: DecisionRecordInputs
): Promise<DecisionRecord> {
  const deterministic = buildDeterministicDecisionRecord(i);
  if (!isQwenAvailable()) return deterministic;
  try {
    const r = await completeJSON<Partial<DecisionRecord>>({
      system: DECISION_RECORD_SYSTEM,
      userMessage: buildDecisionRecordMessage(i),
      maxTokens: 600,
      model: QWEN_ANALYST_MODEL,
    });
    if (!r || typeof r !== 'object') return deterministic;
    return {
      decided: r.decided?.trim() || deterministic.decided,
      why: r.why?.trim() || deterministic.why,
      alternatives: r.alternatives?.trim() || deterministic.alternatives,
      whatHappened: r.whatHappened?.trim() || deterministic.whatHappened,
    };
  } catch {
    return deterministic;
  }
}
