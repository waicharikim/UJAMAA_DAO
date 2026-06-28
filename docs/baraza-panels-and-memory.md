# Baraza — Adaptive Panels & Temporal Memory (design)

> **Status:** `design / draft` — not yet implemented. Companion to
> [`baraza-deliberation.md`](./baraza-deliberation.md) (the shipped 7-agent engine).
> Decision record: ADR-059 (`ai_workflows/DECISIONS.md`).
>
> This document captures the next evolution of the Baraza council: making it fit
> **every** kind of community (not just government-shaped ones) and giving it a
> sense of **time and place** — the past, the present state of the country, and
> the platform's own structure — so its reasoning is grounded, not abstract.

---

## 1. The problem

The shipped council has two limits surfaced in review:

1. **The 5 domain agents are Kenyan-ministry-shaped** (MAISHA/health, ARDHI/lands,
   UCHUMI/economy, MIUNDOMBINU/infrastructure, JAMII/social). That's a *great* fit
   for **system groups** (ward → constituency → county → national — actual devolved
   units). It's a poor fit for **voluntary groups** (SACCOs, business collectives,
   youth groups, project teams): a loan-product decision doesn't need a Ministry of
   Lands voice.
2. **The agents reason in a vacuum.** They have no awareness of the *current state of
   the country* (fuel up, cost of living, drought), of the *national arc* (how we got
   here), or of *UjamaaDAO's own structure* (scope, levels, dues split, review chain) —
   all of which materially shape whether a project is feasible and how governance plays out.

---

## 2. The temporal-memory architecture

The fix is to give the council four grounded dimensions of context. Three are new;
one already shipped:

```
PAST       → Mhenga: national timeline ("how we got here")
PRESENT    → current-affairs collectors → contextSnapshot ("state of affairs now")
STRUCTURE  → Mjamaa: UjamaaDAO's own architecture ("how this proposal flows through the system")
PER-GROUP  → BarazaAgentState episodic memory ("what THIS community did + how it turned out")  ✅ shipped
FUTURE     → Mhenga trajectory read ("where we're headed")
```

**The key loop — the present feeds the past.** Every deliberation's `contextSnapshot`
(fuel was high, harvest failed) accretes over time into Mhenga's timeline. The
collectors capture *now*; Mhenga turns accumulated *nows* into *history*. "How we
got here" is literally built from the record the system keeps.

---

## 3. Adaptive panels (by community type)

The round flow already iterates a generic `DOMAIN_AGENT_KEYS` set, so swapping the
domain *panel* needs no flow change — only the selected key set + prompts.

| Community type (`Group.isSystemGroup` / `voluntaryType`) | Domain panel |
|---|---|
| System group (ward/constituency/county/national) | Daktari · Linda · Tajiri · Foreman · Mwalimu *(relabelled from the shipped 5)* |
| Voluntary group (SACCO, business, youth, project) | Mkurugenzi (finance) · Mwananchi (member-equity) · Fundi (execution) · Hustler (market) *(new)* |

- **Cross-cutting analysts run in every panel:** Shahidi, Mpelelezi, Mhenga, Mjamaa.
- **Common-Kenyan voices:** each domain agent carries two *lived perspectives* — by
  **life situation, not occupation or identity**. See §4 "Citizen voices (the cast)".
- **Proposal-nature selection is a later refinement** (v2): subset/weight the panel by
  proposal type. Panel-by-type ships first; Mjamaa can help choose the panel since it
  understands group type.

---

## 4. New cross-cutting agents

### Mjamaa — structure / system literacy
The only agent whose knowledge is **internal and authoritative**, so it is strongly
**tool-grounded** (reads the real hierarchy, treasury, dues config, existing proposals)
and the least hallucination-prone. It catches what no domain or truth agent can:

- **Mis-scoping** — "filed as a ward GROUP proposal but serves three wards → constituency scope" (`ProposalScope`, level hierarchy)
- **Funding reality** — "asks the ward treasury for more than its 70% dues share sustains → needs `locationFundingRequest` co-funding" (`PlatformConfig.dues_allocation_split`, `groupFundingAmount`/`locationFundingRequest`)
- **Review-chain path** — "COMMUNITY scope → needs location-admin approval, not just group LEADER"
- **Cross-level duplication / coordination** — "neighbouring ward already did this"
- **Group-type fit** — "this is a SACCO; a public governance proposal doesn't fit → cooperative project" (also informs panel selection)

**Mjamaa is also the CONVENER** (the casting layer between agents and voices — see §4
"Citizen voices"). Before the council debates, Mjamaa runs once to: read the proposal and
its repercussions → map who it actually affects (with Mpelelezi feeding the "who quietly
gains / loses" read) → **cast** each domain agent's life-stage × exposure voices for *this*
proposal → pick the panel. Voices are no longer set in stone; they're cast per proposal.

### Mhenga — history / time / trajectory
Maintains a national timeline and acts as a **framing voice**: situates a proposal in
the long arc (a land proposal against colonial alienation → post-independence grabbing →
2010 reforms; a debt proposal against SAPs → Eurobond → current distress) and offers a
sober "where are we headed" read. See §6.

**Both Mhenga and Mjamaa are framing/analyst-tier**, not domain debaters — they set
the stage before the council argues.

### Consolidated roster

| Tier | Agents |
|---|---|
| Domain — governance (system groups) | Daktari · Linda · Tajiri · Foreman · Mwalimu |
| Domain — cooperative (voluntary groups) | Mkurugenzi · Mwananchi · Fundi · Hustler |
| Cross-cutting analysts (every panel) | Shahidi · Mpelelezi · **Mhenga** · **Mjamaa** |
| Context (data, not agents) | current-affairs collectors → `contextSnapshot` · per-community memory ✅ |

### Naming (labels only)

Names are **cosmetic labels** — each agent's role, persona, and system-prompt substance is
unchanged. Grounded in everyday Kenyan identities (professions, archetypes, sheng). The
shipped 7 get relabelled (enum + persona token + memory key), which is cheapest **now**
while `BarazaAgentState` is still effectively empty.

| Role | Label | Shipped agent it renames (or *new*) |
|---|---|---|
| Health / welfare | **Daktari** | MAISHA |
| Land / environment / water | **Linda** | ARDHI |
| Economy / trade / treasury | **Tajiri** | UCHUMI |
| Infrastructure / works | **Foreman** | MIUNDOMBINU |
| Education / social / youth | **Mwalimu** | JAMII |
| Truth / fact-checking | **Shahidi** | UKWELI |
| Power / hidden interests | **Mpelelezi** | KIVULI |
| Cooperative finance | **Mkurugenzi** | *new* |
| Cooperative member-equity | **Mwananchi** | *new* |
| Cooperative execution | **Fundi** | *new* |
| Cooperative market | **Hustler** | *new* |
| History / trajectory | **Mhenga** | *new* |
| Structure / system literacy | **Mjamaa** | *new* |

### Citizen voices (the cast)

Each **domain agent** (the 9 governance + cooperative agents) carries **two lived
perspectives** — not occupations or identities, but **life situations**, so every proposal
is stress-tested against how it actually lands on real people. Two axes:

- **Axis A — life stage:** Mwanafunzi (student) · Young single · Young couple / new family ·
  Mzazi (squeezed parent — kids *and* aging parents) · Older parents (kids grown) ·
  Mzee (elder / retiree).
- **Axis B — economic exposure:** Cushioned (stable income, has a buffer) · Exposed
  (irregular / daily cash, no cushion) · Dependent (no income of their own).

Each domain agent carries **one life-stage + one exposure** voice = a specific person
(e.g. *a squeezed parent who is financially exposed*). **Urban vs rural is a texture note**
the agent applies situationally, not a fixed voice. The four **analysts** (Shahidi,
Mpelelezi, Mhenga, Mjamaa) carry no cast voices — they are their own characters
(Mhenga already embodies the elder-sage; Mjamaa the community insider).

#### The convener: voices are cast per proposal, not fixed

Voices are **not bound to agents permanently.** **Mjamaa, as convener** (see §4), runs first
on each proposal — reads its repercussions, maps who it actually affects (with Mpelelezi's
gains/losses read), and **casts** the most-relevant life-stage × exposure voice onto each
domain agent for *that* deliberation. A bursary proposal pulls student / young-family /
dependent voices forward; a land-succession proposal pulls elder / older-parent voices.

The table below is therefore the **default prior** — the sensible baseline the convener
starts from and overrides per proposal (it spans all 6 stages × all 3 exposure levels so the
fallback alone still hears everyone):

| Agent | Default life stage | Default exposure |
|---|---|---|
| Daktari (health) | Mzazi | Dependent |
| Linda (land) | Older parents | Exposed |
| Tajiri (economy) | Young single | Cushioned |
| Foreman (infrastructure) | Young couple | Exposed |
| Mwalimu (education/social) | Mwanafunzi (student) | Dependent |
| Mkurugenzi (cooperative finance) | Older parents | Cushioned |
| Mwananchi (member-equity) | Mzee (elder) | Dependent |
| Fundi (execution) | Young single | Exposed |
| Hustler (market) | Mzazi | Exposed |

#### Resolved agent identity

For any deliberation, an agent's **full identity = role + cast + temperament**, and is
recorded per deliberation (fits the existing `contextSnapshot` / `agentMemorySnapshot`) so a
member can later see exactly who argued and from whose shoes:

```
Daktari (health)                       ← role / label (fixed)
  + a rural, exposed young family       ← voices the convener cast for THIS proposal
  + 18% more rigid here over 7 rounds   ← temperament from BarazaAgentState memory
```

> Nuance hook (§8): an agent's `rigidityScore`/`responsivenessScore` should colour *how* it
> speaks, so the persona evolves with the community over time rather than staying static.

---

## 5. Current-affairs collectors (the PRESENT)

A small set of **targeted indicator collectors** (not a news firehose), normalised into
one snapshot and injected into each deliberation's existing `contextSnapshot`.

| Indicator | Source | Method |
|---|---|---|
| Fuel prices | EPRA (monthly) | scrape (PDF/press release) — **first collector** |
| Inflation / cost of living | KNBS CPI | scrape |
| Forex (KES/USD) | CBK | structured/downloadable |
| Weather / drought / season | free weather API (e.g. open-meteo) | API |
| Finance/economy signal | **X: @moneyacademyKE** | free/best-effort (RSS bridge); fail-open |
| Major levies / policy events | — | **admin-curated** (too risky to scrape) |

**Rules for all collectors:**
- BullMQ scheduled job on the **worker** (slow-moving data → daily/weekly).
- Per-collector `try/catch`, **fail-open** — a broken collector goes stale/omitted, never
  blocks a deliberation. Staleness alarm (reuse the Baraza demand-scan alert pattern).
- **Accuracy guard:** sanity-range validation + always label "as of {date}, source {X}" +
  **admin override** before a value influences deliberations. Automation drafts; a human
  can correct.
- **X is best-effort only** (no paid third party): drop it the moment it misbehaves; it's
  colour on top of the gov indicators, never load-bearing. Optionally summarise posts to
  neutral factual bullets before injecting. "Build up sources over time."

---

## 6. Mhenga's timeline KB — multi-provenance (the PAST)

Two intakes, one curated store — **provenance is a first-class field**, so LLM-seeding and
source-ingestion are not modes but parallel intakes.

`HistoricalEvent` (new model):
- `provenance`: `LLM_SEED` · `COLLECTOR` (EPRA, @moneyacademyKE) · `DELIBERATION` (accreted from a `contextSnapshot`) · `ADMIN`
- `sourceRef` (URL / handle / `deliberationId` / model+date)
- `verificationStatus`: `UNVERIFIED` · `ADMIN_CONFIRMED` · `DISPUTED`
- content: era / date-range, event, causes, consequences, themes
- `supersededBy` (history gets corrected — same pattern as on-chain ward-memory)

Intakes:
1. **LLM seed pass** — generate the deep backbone "as far back as possible" → `LLM_SEED / UNVERIFIED`.
2. **Source ingestion (continuous)** — collectors + deliberation snapshots → `COLLECTOR / DELIBERATION`.
3. **Admin curation** overlays both → `ADMIN_CONFIRMED` / `DISPUTED`.

At deliberation time Mhenga **cites with calibrated confidence** ("confirmed: fuel
levy 2023" vs "per model knowledge, unverified: …"). Where an LLM-seed and a source
**conflict**, source/admin-confirmed wins and the disagreement is *surfaced, not silently
resolved* — the neutrality guardrail enforced by the schema.

---

## 7. Integrity & neutrality guardrails (non-negotiable)

- **Kenyan history is contested** (land, ethnicity, post-election violence). Mhenga is
  held to Shahidi's (truth) discipline: facts only, attribute, present contested interpretations *as
  contested* — never assert one narrative. Sourcing + admin curation required. Done
  carelessly this is a propaganda surface; done well it is the council's wisdom.
- **External inputs are inputs, never ground truth.** Scraped/handle/LLM data is labelled,
  dated, and overridable; the binding decision remains the **human vote** (Baraza is
  guidance, never a verdict — unchanged).
- **No paid third parties** (current constraint). Everything free/best-effort.

---

## 8. Cost / latency

The council grows with each agent (LLM calls × rounds). To keep Qwen cost and latency
sane: **framing agents (Mhenga, Mjamaa) run once** to set the stage, not in every
round. Domain agents + analysts keep the existing round structure.

---

## 9. Per-community outcome feedback loop ✅ (shipped)

Already implemented (this branch): when a proposal's real outcome is recorded
(`recordOutcome`), `recordProposalOutcomeInMemory()` back-fills it into every agent's
`episodicLog` for that group, and the episodic memory renders `Real outcome: …` so agents
learn how their past positions actually turned out. 5 tests; tsc clean.

---

## 10. Build order (phased, smallest-first)

0. ✅ **DONE** (`e09d245`) — **Relabelled the shipped 7** to the locked names: enum +
   `AgentKey` type + prompts + all code refs; dev & test DB enums renamed in place
   (`ALTER TYPE RENAME VALUE`, preserving the 14 existing agent-state rows + remapped
   embedded `relationalMap` keys). tsc 0; deliberation suite 12/12.
1. ✅ **DONE** (`94a25f5`) — **Panels by community type**: `selectDomainPanel(group)` on
   `isSystemGroup` (governance vs cooperative); 4 cooperative agent prompts + 4 additive
   enum values (dev+test DBs); panel threaded through the round runner. baraza suite 17/17.
2. ✅ **DONE** (`4106fb3`) — **Mjamaa convener/casting pass**: runs once before the rounds,
   casts each domain agent's life-stage × exposure voice + a structural note; cast block
   prepended to agent prompts at runtime; default-prior fallback; casting recorded in
   `contextSnapshot` (resolved identity). Mjamaa is now a **stateful structural analyst**
   (`019d9b2`): emits a structural severity that feeds the readiness score (MAJOR −15 /
   MINOR −6), and keeps its own per-group memory (`BarazaAgentState`, agentKey=MJAMAA) so
   its structural reads compound. Also runs a **closing structural review** (`63d482c`):
   after scoring, it vets each proposed *revision* for structural soundness (scope/dues/
   review-path) + a closing verdict, stored in `contextSnapshot`. baraza suite green.
   *(Run-once at start + close, not per-round — the proposal text is fixed across rounds,
   so full per-round debating would just repeat; deferred by design.)*
3. ✅ **DONE** (`a2138ad`) — **Current-affairs pipeline**: `CurrentAffairs` store +
   best-effort collector framework + EPRA fuel collector + weekly job + sanity/staleness/
   admin-override + injection into `formatProposalContext`/`contextSnapshot`. +7 tests.
   *(Live EPRA parse unverified against the live page — needs `EPRA_SOURCE_URL`; store stays
   empty & section omitted until a verified scrape or admin value. Admin HTTP endpoint TODO.)*
4. ✅ **DONE** (`5aca39a`) — **@moneyacademyKE (X) collector** via configurable RSS bridge
   (`MONEYACADEMY_FEED_URL`), best-effort/fail-open, labelled "one source, not verified",
   added to the weekly run. +3 parser tests. *(Inactive until the bridge URL is set.)*
5. **Mhenga**: `HistoricalEvent` KB with provenance → LLM seed pass → framing voice →
   trajectory; wire the now→history accretion last.
6. Proposal-nature panel refinement (v2).

---

## 11. Open questions

- Agent labels: **locked** (see §4 Naming). Roles/personas unchanged.
- Cooperative archetype "voices inside" each agent (mama mboga, boda rider, etc.) — to be drafted with the prompts.
- RSS-bridge choice for @moneyacademyKE (free, must be reliable enough to be worth it).
- `detectOutcome` (agent-memory) is English-only lexical — revisit if agents deliberate in Swahili.
