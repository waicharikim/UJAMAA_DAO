# Baraza — The Historian & The Values Voice

> **Status:** mixed. **Mhenga (two-scale historian) `implemented + verified`** (`e3f37c0`)
> and **Kadere (the values voice) `implemented` (backend; frontend surfacing pending)** —
> vision-check 2026-07-11 returned CONDITIONAL/proceed, and the build honours all four
> conditions. **The community timeline & curation, the AI-consolidated decision record,
> and the talkable lenses are `design`.**
> Companion to [`baraza-deliberation.md`](./baraza-deliberation.md) (the shipped engine)
> and [`baraza-panels-and-memory.md`](./baraza-panels-and-memory.md) (ADR-059). Build
> gate for the design parts: run `/vision-check` before Kadere or any agent-learning path
> (they touch the AI-agency rule + governance integrity).
> Code: `backend/src/modules/governance/baraza/` + `backend/src/modules/governance/historian/`.

This document covers how the Baraza council carries **values** and **history/context**,
and how the public Telegram assistant relates to the council.

---

## 1. Why two separate voices (the principle)

Values and history have **opposite epistemic disciplines**, so they are separate agents:

- **The historian earns trust through restraint** — facts first, provenance-tagged,
  contested-stays-contested, no agenda. The moment it editorialises, its facts get
  discounted as motivated.
- **The values voice earns trust through disclosure** — openly normative, reasoning from
  the community's *declared* values, labelled so people can push back.

Fusing them would launder advocacy onto the credibility of facts. So: **Mhenga** (history)
stays context/framing; **Kadere** (values) is a labelled, rebuttable participant.

Two framing rules that run through everything below:
- **Shared values, distinct histories.** Values are a *commons* (one shared frame keeps
  communities one movement). History is per-community *and* national — every group keeps
  its own story.
- **The AI never holds its own agenda.** It reasons from what the community *declared*
  and can amend; it never originates a politics no one voted for (the "rogue actor"
  capture risk). AI informs; humans decide.

---

## 2. Mhenga — the two-scale historian  *(SHIPPED — `e3f37c0`)*

Mhenga situates a proposal in time. It is a **run-once framing pass** whose output is
injected into the shared proposal context every agent reads (it is not a round debater).

**Two scales, community-first.** Mhenga holds:
- the **shared national arc** — the `HistoricalEvent` KB (colonial land → independence →
  SAPs → devolution → debt/cost-of-living), and
- **each group's own arc** — that community's local timeline entries **and** its past
  decisions and how they turned out.

`HistoricalEvent.groupId`: **null = shared national** (every group sees it), **set =
that group's local history**. `getRelevantHistory(themes, keywords, proposalText,
groupId?, includeNational?)` scopes retrieval to *national + this group* and tags every
item `scope: 'group' | 'national'`.

**Register gate.** A community's own history is *always* in scope; the national arc is
pulled in **only when it is load-bearing** — `nationalArcIsLoadBearing()`: a `POLICY`
proposal, a `STRATEGIC_DECISION`/`EMERGENCY` type, or text touching land, governance,
rights, taxation or the wider economy. A routine "buy a water tank" proposal stays with
the community's story; "resolve a land dispute" or "adopt a bylaw" earns the national arc.
This replaced the old **year-ordered-sample fallback** (no match now = inject nothing),
which used to inflate mundane local matters into colonial-to-devolution grandeur.

**Narration as a pattern, not a list.** `MHENGA_SYSTEM` leads with the community and reads
its arc as a *pattern* — "each time they did X, Y followed", the recurring gap — rather
than recounting events. `buildHistorianMessage` renders **two registers**: the community
first (past decisions + local events), then a gated national section. When there is little
on record it says so plainly rather than inventing a backdrop.

**Provenance is first-class.** Every entry carries `provenance` (`LLM_SEED` / `COLLECTOR` /
`DELIBERATION` / `ADMIN`) + `verification` (`UNVERIFIED` / `ADMIN_CONFIRMED` / `DISPUTED`),
with supersede-not-delete. `confidenceTag()` maps these to a phrase Mhenga must honour
(lean on confirmed, hedge on unverified, present DISPUTED as contested). Fails open: no
LLM → a scope-aware raw shortlist; nothing on record → empty.

**Prod note:** Mhenga is silent unless `historianService.seedHistoricalBackbone()` has been
run on that instance (unseeded → no national arc).

---

## 3. Kadere — the values voice  *(IMPLEMENTED — backend; `agents/values.ts`)*

A **labelled participant in the deliberation rounds** (in the transcript, rebuttable) —
*not* injected as invisible shared context. That placement is what keeps it legitimate: a
voice people can talk back to, not the frame everyone inherits.

- **Reasons from declared values = the shared Ujamaa constitution** (source **A**, not
  per-group charters — shared values keep communities one movement). Today's artifact is
  the fixed manifesto from `group.service.ts` `generateDeclaration()` (Ujamaa / cooperative
  economics / anti-capture / non-custodial treasury / "we rise or fall together"). Per-group
  charters remain a possible later evolution; Kadere's interface ("cite declared values")
  wouldn't change, only the source.
- **Maps as a cross-cutting agent, not a domain agent.** Domain agents (DAKTARI/LINDA/
  TAJIRI/FOREMAN/MWALIMU, MKURUGENZI/MWANANCHI/FUNDI/HUSTLER) have a *subject* and are
  keyword-selected by `selectDomainPanel`. Kadere is orthogonal (values apply to
  everything), so it is added **unconditionally like the analysts** — `'KADERE'` in
  `AgentKey`, in `allAgentKeys` (never `selectDomainPanel`), surfaced in
  `formatRoundTranscript`.
- **Boundary vs MWANANCHI:** MWANANCHI does *stakeholder-equity* analysis (who pays, who's
  left out); Kadere checks *coherence with the declared constitution*. Scope its prompt
  tightly or the two duplicate.
- **Always present, self-gating.** It always evaluates "does this materially implicate our
  declared values?" → a full labelled position when yes, a brief "no values tension" when
  no. Cadence: state its reading in round 1, optional closing word in round 3 — not a full
  three-round debater (protects salience + cost). `POLICY` → full voice by default.

**As built** (`agents/values.ts` + orchestrator): Kadere is a **stateless, cross-cutting
voice**, not an `AgentKey` domain agent (matches "not a 3-round debater" + avoids the enum
blast radius). It runs once in round 1 (`runKadere` → `{ hasValuesTension, text }`, self-
gating), and gives a brief `runKadereClosing` in round 3 **only if** it flagged a tension.
Its reading is woven into `formatRoundTranscript` as a labelled `KADERE (values voice — one
view, weigh and rebut)` block, so rounds 2–3 can rebut it. **Honouring the vision-check
conditions:** advisory-only — it is **deliberately not passed to `computeReadinessScore`**
(lives only in the transcript); reasons solely from `UJAMAA_DECLARED_VALUES`; labelled +
rebuttable in-transcript; scoped to values-coherence (prompt explicitly defers equity to
Mwananchi). Fails open (no Qwen → no Kadere block). **Follow-up:** surface it to the
frontend — it's persisted in `BarazaDeliberation.transcript`, but `getLatest` doesn't select
`transcript`, so the deliberation card doesn't show it yet.

---

## 4. The community timeline & curation  *(DESIGN)*

Local history has **two sources kept in one store** (two provenance values, not two
systems): **model/feed-supplied** (`UNVERIFIED`, Mhenga hedges) and **community-curated**
(`ADMIN_CONFIRMED`, Mhenga leans on). Conflicts → `DISPUTED`, presented as contested.
Degrades gracefully: baseline context free, richer as a community records its own truth.

**Life-context is in scope, gated.** Include ambient context that *conditions collective
decisions* (climate/season, price shocks, infrastructure, shared events) — the difference
between a historian and a filing clerk. Exclude private individual misfortune, unverified
accusations about named people, and anything that doesn't bear on a shared decision
(mirrors the existing feed-privacy discipline).

**Contribution is tiered to trust, mapped to RBAC.** Admin adds directly
(`ADMIN_CONFIRMED`) → member suggests → historian/admin ratifies (`UNVERIFIED` until
confirmed) → contested goes `DISPUTED`, escalating to a lightweight community vote when it
genuinely matters. An **elected/appointed community historian** (reuse the elections
module) is the human keeper; **Mhenga narrates** what they've verified. **Reward the
ratified entry, not the submission** (IP; Rule 5).

**Anyone can contribute at ANY scope (local *and* national); the ratification bar scales
with blast radius.** Admin-only national curation is rejected — it reproduces the "captured
infrastructure" the founding declaration rails against, and is more dangerous at national
scale (it frames every group). Local → the group's own keeper. National → proposed by
anyone, ratified by a **distributed bar**: a county-coordinator quorum, or the actual
**NATIONAL-scope proposal/vote** machinery for significant/contested entries. Here
**`DISPUTED` is a feature** — much national history *should* stay contested. National facts
also *accrete* when many groups' deliberations reference the same event
(`DELIBERATION` provenance) — bottom-up national memory. *Sequencing:* ship local + an
admin-seeded national backbone first; open national contribution once there are enough
communities to distribute ratification.

**Propose → ratify, never silent learning.** Chat interactions (via Buda, §6) only *surface
candidates* into a review queue; a human ratifies before anything enters the store. Never
fine-tune on chat; aggregate patterns, don't memorise individuals. This guards against
poisoning, provenance collapse, privacy leakage, and drift.

**UI:** an **"Our Story"** tab in the group hub `/groups/[id]` — view the timeline + "+ Add
to our story" (creates an `UNVERIFIED` suggestion) → one review queue (member + Buda-
surfaced) the keeper ratifies. A Feed "mark as history" shortcut is a secondary on-ramp.
National: a "suggest to the national story" affordance in the hierarchy browser → national
review queue. (Avoid the tab name "Kumbukumbu" — it collides with an ADR-059 agent name.)

---

## 5. Community memory & the decision record  *(partly SHIPPED, extension is DESIGN)*

Today's **community memory** (was "ward memory") is **pure human free-text** —
`rationale` / `alternatives` / `outcome` via `updateMemory`/`recordOutcome`, no AI, often
blank. The only AI digest nearby is the separate *pre-vote* `deliberationSummary`. It is the
*atomic ledger* of decisions; the timeline (§4) is the *arc*; Mhenga narrates across both.
A notable outcome can **graduate into the timeline** via `DELIBERATION` provenance
(ledger → story).

**Planned:** an **AI-consolidated decision record at `recordOutcome`** — "what was decided,
why, what alternatives were weighed, what happened" from the human fields +
`deliberationSummary` + the vote result — **fail-open**: LLM when available, a deterministic
template when not. Community memory never depends on AI. (Also rename user-facing "Ward
Memory" → "Community Memory".)

---

## 6. Buda & talkable specialist lenses  *(DESIGN)*

The public Telegram assistant is **Buda** (renamed from the working "Mjamaa" to resolve the
collision — **Mjamaa stays the council's convener**). Buda is a **front desk** that can
*summon* a specialist voice for a member's question — **Mhenga** (our story / precedent),
**Kadere** (what our principles say), **Tajiri** (can the treasury afford it). These are
**advisory lenses, never rulings** — "Tajiri says you can afford it" must never read as
authorization. Internal machinery agents (Shahidi, Mpelelezi, the convener) are not talkable.

---

## 7. The shared knowledge layer & education  *(DESIGN)*

One **provenance-aware knowledge substrate**, many consumers. The corpus = platform
`docs/` + the **education modules** (+ Mhenga's timeline for history, + the constitution
for Kadere's values). It is reached through a single **`search_knowledge`** tool that
slots into `DELIBERATION_TOOLS` (same shape as `get_ward_stats`/`get_group_treasury`), so
the **Q&A bot (Buda)**, the **council agents**, and the **talkable lenses** all draw on the
same source instead of each cramming knowledge into a prompt that can drift from the code.

**Why the council benefits too (not just Buda).** Agents today reason about PR/UT/IP
mechanics, governance flow and treasury rules from their system prompts / model priors,
which can be stale or subtly wrong. Letting them *look it up* grounds those claims (Tajiri
on UT/treasury, MKURUGENZI on dues/repayment, Shahidi checking whether a "how it works
here" premise is actually true). This is the fault-tolerance principle — knowledge lives in
the corpus, not the prompt.

**Two hard rules on how the knowledge is used:**
- **Facts → agents; values → Kadere.** Education contains both mechanics *and* Ujamaa
  values material. Agents use the corpus for "how does X work," never for "what should we
  value" — that stays Kadere's labelled job, or every agent blurs into a values-preacher
  (re-creating the laundering problem).
- **Authority is provenance.** For *agent* grounding, prefer authoritative content (`docs/`
  + verified core modules) over arbitrary community-authored modules; an approved-yet-
  opinionated module must not become gospel the council reasons from.

**Building upon education (later phase).** The AI can *draft* modules and *surface gaps*
(what members keep asking Buda, which quiz questions people keep failing, what
deliberations keep stumbling on) — routed through the **existing** author →
`submitModule` → admin `approveModule`/`rejectModule` pipeline. Guardrails: **never
auto-publish** (AI-drafted modules award nothing until approved — protects Rule 5 against a
reward farm, using the existing `verified`/`submittedAt` + once-per-module `rewardAwarded`
gates), and **admin ratification is the legitimacy gate** (education is quasi-normative;
unsupervised AI-authored curriculum is the same "AI holds an agenda" risk). Prefer
**gap-detection over from-scratch generation**. Result: a knowledge flywheel — education
grounds Buda + the agents → friction reveals gaps → ratified modules → better-informed
proposers → better proposals/deliberations; can go community-specific (Mhenga's "you keep
failing on maintenance" → a suggested maintenance module for that group).

### Cost controls  *(requirements, not afterthoughts)*

Retrieval infra (embeddings + vector search over a small corpus) is negligible and mostly
one-time. The recurring cost is **retrieved-chunk tokens + extra tool round-trips**, which
scales with *how many agents search × how much they pull back*. To keep it near the noise
floor:

- **Scoped** — give `search_knowledge` only to agents where facts matter (Tajiri,
  MKURUGENZI, the analysts), not all ~11 agents × 3 rounds.
- **On-demand** — `completeWithTools` calls the tool only when the agent needs it; never
  forced every round.
- **Small top-k** — return 1–3 chunks, not whole modules.
- **Embed the corpus once** and cache; re-embed only on doc/module change.
- **Council runs async on the worker** (BullMQ) — no user waits on the extra round-trip, so
  only the (bounded) token cost matters.
- **Thin-the-prompt offset** — move volatile mechanics *out* of system prompts into the
  corpus (prompt carries persona/stance, RAG carries facts). This trades "always-pay for a
  big prompt" for "sometimes-pay for a small retrieval"; net can approach neutral. (Static
  prompts are already prompt-cached; retrieved chunks are not — so the offset is real but
  partial.)

Context: Qwen/DashScope is cheap per token and inference is already ~5× optimized
(`reasoning_effort:none`, `BARAZA_BOT_MODEL` split). Measure real token cost once wired —
the unbounded anti-pattern to avoid is an always-on knowledge search for every agent every
round with large retrievals.

---

## Status at a glance

| Piece | Status |
|---|---|
| Mhenga two-scale historian (national + group, register gate, pattern narration) | **implemented + verified** (`e3f37c0`) |
| `HistoricalEvent.groupId` + migration (dev+test) | **implemented** |
| Community memory (human free-text rationale/alternatives/outcome) | **implemented** (pre-existing) |
| Kadere (values voice) — backend | **implemented** — advisory, self-gating, in-transcript, NOT in the readiness score; frontend surfacing pending |
| Community timeline curation + national contribution | design |
| AI-consolidated decision record (fail-open) | design |
| Buda + talkable lenses | design |
| Shared knowledge layer (`docs/` + education → `search_knowledge`) for Buda + council, w/ cost controls | design |
| Build-upon education (AI drafts/gap-detection → existing approval pipeline) | design — later phase |

**See also:** [`baraza-deliberation.md`](./baraza-deliberation.md),
[`baraza-panels-and-memory.md`](./baraza-panels-and-memory.md),
[`baraza-topology.md`](./baraza-topology.md).
