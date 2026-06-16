# UjamaaDAO — v1 Launch Scope (Phase 1)

> **Purpose:** break the refinement loop by deciding explicitly what ships, what gets
> fixed, and what gets cut before Ujamaa goes in front of a real community (the tech hub).
> **The bar for v1:** *an 18–19-year-old first-timer uses it without dropping off.*
> **Launch:** June 25, 2026 · trailer June 18.

This is a living checklist. Update it as items move.

---

## Decisions

### Cut / defer from v1 (don't let these block launch)
- **AI deliberation layer + Baraza AI bot** — already dormant (needs `CLAUDE_API_KEY` +
  paid credits). Adds nothing for a first group; ships dark. Revisit post-traction.
- **On-chain anchoring polish** (ward-memory / annotation anchoring) — dormant until the
  contract deploy; fine to ship dark.
- **Deeper project-management rework** — the projects module is enough for a first group now
  that the authorization hole is fixed.

### Hide for v1 (the highest-leverage UX call)
- **Wallet / blockchain is invisible.** Privy auto-creates an embedded wallet on login, and
  **`COMMUNITY_VERIFIED` (3 vouches) already unlocks everything an everyday user does**
  (groups, proposals, voting, projects, dues). A wallet is only the last gate to
  `FULL_VERIFIED`. So: remove the prominent "Connect Wallet" CTA from the main flow, let the
  embedded wallet happen silently, and demote "link an external wallet" to an advanced option.
  A 19-year-old should never see a crypto prompt to use the app.

### Ship as-is (the core — it's real)
System groups (the 7 auto-enrolled geographic levels) + voluntary groups, both fully
functional · proposals → voting → tally · projects (with the authorization fix) ·
economy/dues · marketplace discovery.

---

## Verified working (cross-geography sweep, real PWA)

Driven through the actual app via Playwright across four users in distinct geographies
(two wards in one constituency, a third constituency, a different county). Harness:
`frontend/tests/sweep/`.

| Area | Result |
|---|---|
| **Feed/post scope** | ✅ ward/constituency/county isolation + cascade + national all correct |
| **Project listing** | ✅ viewer-scoped (outsiders see none; members see theirs) |
| **Project participation** | ✅ gated by owning-group membership + `participationScope` tiers |
| **Proposal voting eligibility** | ✅ geo/membership-gated (outsider blocked: "Not a member of this group") |
| **Proposal listing** | ✅ now viewer-scoped (was a global firehose) |
| **Impact points (global)** | ✅ awarded + displayed correctly |
| **Impact points (per-location)** | ✅ now populated → ward/constituency/county reputation + geo leaderboards |

---

## Fixed this cycle

- **Projects authorization hole** — non-members could join/claim/complete another group's
  tasks; now membership-gated, with cross-ward `participationScope` + self-verification block.
- **Per-location impact points were dead** — `awardWardPoints` had no callers; wired into
  every global award + hierarchy resolution fix + backfill. Ward reputation now real.
- **Proposal list was global** for regular members — now scoped to their communities
  (transparency `/governance` view stays global).
- **Leaderboard ward/county scope** returned a global ranking — now scopes to the viewer's area.
- **Section tours auto-fired on every page** (stacked overlays, intercepted clicks) — now
  on-demand only, via the "?" button.
- **Getting-started checklist** showed already-satisfied steps (e.g. "Get community verified"
  to a FULL_VERIFIED user) — now reflects live state.
- **Dashboard "1 issue"** — Privy threw `TypeError: e is not a function` in its Base connector
  (stubbed `@base-org/account` was an empty object) — un-stubbed; also un-stubbed `unstorage`
  (real WalletConnect dep, behind the wallet black-screen).
- **Mobile topbar** — notifications + avatar were left-aligned; now right-aligned.

---

## Still to do before / for launch

### Blocking
- [ ] **On-device MetaMask wallet test** — confirm the `unstorage`/`@base-org` fixes resolve
      the installed-PWA black screen. (If not, pull the Sentry `javascript-nextjs` replay.)
- [ ] **Hide the wallet for v1** (per the decision above) — embedded-only, demote Connect CTA.
- [ ] **Tutorials / point-system clarity** — the tours scaffold exists; needs real content and
      a plain-language PR vs IP vs UT explainer. ("Tutorials feel underwhelming.")
- [ ] **Run the IP backfill on deploy** — `ALLOW_BACKFILL=true npx tsx
      src/core/database/backfill-location-impact.ts` so existing users' reputation isn't empty.

### Launch track (from SESSION_STATE)
- [ ] **A1 — deploy contracts to Base mainnet** (ops; `docs/blockchain-deploy.md`).
- [ ] **A4 — load Anthropic credits** (only if the AI layer is wanted at launch; otherwise cut).

### Non-blocking / nice-to-have
- [ ] **Notification coverage** — fires only for governance/emergencies/baraza; gaps in
      projects, economy/dues, verification/vouching, elections, community membership.
- [ ] **Proposal data quirk** — a few COMMUNITY proposals from voluntary groups with no
      location fall into the "national — anyone votes" branch; review.
- [ ] **Sentry `/monitoring` tunnel 500** (dev) — ingestion config.

---

## How v1 is verified
- Cross-geography scope + IP: `cd frontend && npx playwright test --config=playwright.sweep.config.ts`
  (seed first: `docker exec ujamaa_web npx tsx src/core/database/seed-geo-testusers.ts`).
- Backend: `docker exec ujamaa_web npx tsc --noEmit` (0 errors) + `npm run lint`.
- Frontend: `npm run build` (green).
- Full ecosystem for manual QA / filming: `docker exec ujamaa_web npx tsx src/core/database/simulate.ts`.
