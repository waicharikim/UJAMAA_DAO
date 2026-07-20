# Baraza baseline benchmark — single agent vs the council

> **Why:** the hackathon requirement to show the multi-agent council earns its cost over a
> single LLM call. **Method:** the council side is *free* — it reuses the **stored** results
> of completed deliberations (`conflictMap` / `revisionSuggestions` / readiness). Only the
> **single-agent** evaluation (one `qwen-plus` call with a generic "evaluate this proposal"
> prompt) and an **LLM judge** (which lists what the council caught and the single agent
> missed, comparing on substance) cost calls. Read-only, dev-only.
> **Re-run:** `docker exec ujamaa_web npx tsx src/modules/governance/baraza/benchmark.ts`
> Harness: `backend/src/modules/governance/baraza/benchmark.ts`.

## Result (6 completed deliberations, dev — 2026-07-11)

| Proposal | Council rdy | Single rdy | Council points | Both caught | **Single missed** | Single-only |
|---|---|---|---|---|---|---|
| National disaster mutual-aid fund | 32 | 25 | 14 | 8 | 6 | 8 |
| County-wide drought/flood mutual-aid | 50 | 35 | 11 | 9 | 7 | 10 |
| Night-security & street-lighting scheme | 35 | 45 | 10 | 9 | 10 | 9 |
| Pool savings to buy a 2-acre plot | 55 | 35 | 14 | 7 | 6 | 13 |
| Monthly youth mentorship day | 50 | 42 | 11 | 9 | 5 | 7 |
| Politicians' pay cuts | 50 | 20 | 10 | 9 | 7 | 5 |

**Aggregate:** across 6 proposals the single agent **missed 41 of the 70** concrete points the
council surfaced (**59%**). Mean readiness delta (single − council): **−11.7**.

## What the council catches that a single pass flattens

The misses cluster on the **contextual, relational, and sequencing** layer — exactly what a
lone generic model tends to skip:

- **Land tenure / ownership complexity** — participatory mapping, written rights-holder
  consent, "legally admissible, seasonally grounded" land-use mapping (recurs in almost
  every proposal).
- **Sequencing & prerequisites** — what must happen before disbursement/build; immediate
  relief vs. administrative setup.
- **Who is carried** — integrating elders/caregivers with upfront recognition/compensation;
  prioritising older/vulnerable residents; exemptions for Inua Jamii households.
- **Kenyan-context mechanisms** — dual digital+paper baraza records in vernacular for
  non-literate access; voice-recorded "I'm in" pledges as a disbursement condition;
  community-verified performance bonds with clawback.
- **Community-trust & coordination dynamics** — surfaced by the Mkutano phase as top
  concerns, absent from the single review.

## Honest caveats (so the result isn't oversold)

1. **The single agent is not useless — it's complementary.** It caught *single-only* points
   the council missed: budget-arithmetic errors, specific regulatory bodies (SRC, NEMA,
   NDMA/Kenya Met), and standard pilot-study/RCT recommendations. A hybrid (council +
   a procedural/regulatory checker) would beat either alone.
2. **Part of the council's edge is tool-grounding, not just debate.** The council calls real
   DB tools (treasury balance, past decisions, ward stats); the single call was ungrounded.
   So this compares "the full grounded pipeline" vs "one ungrounded call" — which *is* the
   realistic deployment comparison, but the multi-agent structure is not the only variable.
3. **Misses are judged by an LLM** (same model family), so there is judge subjectivity and
   some noise in the exact counts; the *pattern* (contextual/sequencing/tenure misses) is
   consistent across all six and is the load-bearing finding.

## Appendix — per-proposal "council caught, single missed"

(Representative; full run in the harness output.)

- **National disaster fund:** national-vs-hyperlocal viability conflict; land/resource
  management chokepoint; incorporating informal/traditional ownership; dual paper+digital
  vernacular records; land-use/flood mapping as a grounding requirement.
- **Pool savings → 2-acre plot:** students' immediate needs vs. older members' long horizon;
  tenurial/social complexity needing participatory mapping + written agreements; the
  KES 2,000/month contribution-consistency assumption; immediate youth employment during
  construction.
- **Politicians' pay cuts:** implementation-chain & political-economy chokepoints; a
  community-verified performance bond with automatic clawback; verification infrastructure
  (photos/timestamps/signed handover logs) as a prerequisite; three-month KPI compliance
  before any salary suspension.
