# UjamaaDAO Ecosystem – Overview & Improvement Roadmap

**Document Version:** 1.0
**Date:** February 11, 2026
**Purpose:** Holistic definition of the UjamaaDAO ecosystem, its components, and a prioritised improvement roadmap for real-world impact.

---

## 1. Ecosystem Definition

UjamaaDAO is a **decentralized autonomous organization (DAO) platform** inspired by the African principle of Ujamaa (cooperative economics and community building). It combines blockchain-native mechanics with real-world community verification to create a system where users earn economic incentives (PR tokens and Utility Tokens) for verified contributions, while fostering local governance, marketplaces, and education.

### Core Philosophy

- **Community-Centric**: Ward-based (local neighbourhood) verification and collaboration as the foundation of trust.
- **Economic Incentives**: Reward participation with PR (governance power) and UT (internal utility) to drive engagement.
- **Meritocratic Governance**: Users with more PR (earned through activity) have weighted voting power in decisions.
- **Real-World Applicability**: Designed for emerging markets like Kenya — mobile-first, M-Pesa-native, low-data-friendly.
- **Sustainability**: Activity-gated monthly PR regeneration + daily penalties encourage participation without free-riding.

### How the Ecosystem Works (User Journey)

1. **Onboarding**: New user verifies phone → earns initial PR → sets profile & ward.
2. **Community Building**: Gets vouched by ward members → unlocks community verification + more PR.
3. **Economic Activity**: Posts marketplace offers → pays dues → contributes to projects.
4. **Governance**: Votes on proposals with PR-weighted power → earns more PR for participation.
5. **Reputation Growth**: Accumulates Impact Points from vouches/contributions → visible trust signal.
6. **Sustainability**: Monthly PR regen (activity-gated) keeps users engaged; cleanups remove expired data.

---

## 2. Improvement Roadmap

### High-Impact

**1. M-Pesa Integration (Fiat on-ramp)**
- Users fund ward projects and pay dues via M-Pesa till numbers to platform-controlled accounts.
- M-Pesa deposits convert to fiat-backed UT (cashable). Earned UT is never cashable (ADR-004/026).
- Impact: Makes the platform accessible to all Kenyan users, not just crypto-native ones.
- Effort: Medium (Daraja B2C + B2B API integration).

**2. Activity-Gated PR Regeneration**
- Only users who meet a minimum activity threshold receive monthly PR regen (ADR-024).
- Prevents inactive users accumulating governance power over active contributors.
- Effort: Low (update monthly regen job).

**3. Soft Inactivity Decay**
- After 60 days of no qualifying activity → -5% PR per month (minimum floor: 100 PR).
- Keeps governance power tied to ongoing engagement, not historical accumulation.
- Effort: Low (add to user-cleanup job).

**4. Ward-Level PR Pools & Rewards**
- Allocate a portion of monthly regen to ward pools; distribute based on ward activity metrics.
- Encourages collective ward improvement rather than individual hoarding.
- Effort: Medium (add ward stats calculation job).

### Medium-Impact

**5. Mobile App (React Native)**
- Better push notifications, camera for avatar/proof uploads.
- Kenya's high mobile usage makes a native app essential for scale.
- Effort: High (new frontend).

**6. Decentralised Storage for Proofs (IPFS)**
- Residence proof and avatars stored on IPFS instead of central storage.
- Builds trust in verification without relying on central servers.
- Effort: Medium.

**7. Referral System with PR Bonuses**
- Unique referral links → award PR to referrer on successful new user verification.
- Viral growth via existing social networks in communities.
- Effort: Low (add route + event listener).

**8. Impact Points → PR Milestone Bonuses**
- Unlock bonus PR when Impact Points hit milestones (e.g., 1,000 IP = +50 PR).
- Ties reputation to governance power directly.
- Effort: Low (add event listener).

### Real-World Applicability

- **Pilot in real wards**: Start with 1–2 Kenyan wards. Partner with local leaders for vouching training. Track: verification rate, marketplace transactions, proposal participation.
- **Integration with local services**: M-Pesa for UT cash-out, government ID APIs for residence proof, local co-ops for marketplace listings.
- **Offline-first features**: Service workers for offline profile access, sync when online.
- **Cultural localisation**: Swahili support, Ujamaa-themed icons, education drawing from African cooperative history.
- **Partnerships**: NGOs or government for ward-level grants funded by PR pools.

---

## 3. Things Explicitly Out of Scope

Per the non-negotiable rules:

- Marketplace payment processing, escrow, or in-app transactions — ever.
- PR→UT conversion (would create a speculative PR market; rejected).
- Cash-out of earned UT (only fiat-backed/deposited UT is cashable).
- P2P money movement of any kind.
