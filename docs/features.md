# UjamaaDAO – Feature Inventory

**Status:** March 2026 – Current Implementation + Planned / Designed Features
**Version:** 1.1 (updated from Feb 2026 draft)

> Use this as the single source of truth for what exists, what is designed, and what is still to come.
> Update the summary table at the end of every session that changes module status.

---

## 1. Identity & Verification

### Major Features (Core to Trust & Participation Rights)

- Phone number verification (OTP via SMS – Africa's Talking / mock mode)
- Email verification (magic link – short-lived JWT or DB token)
- Community verification (ward-based vouching threshold – currently 3 vouches)
- Location verification (residence proof + temporary location support)
- Wallet signature authentication (nonce-based)
- Verification level progression (PHONE_VERIFIED → EMAIL_VERIFIED → COMMUNITY_VERIFIED → LOCATION_VERIFIED)
- One-time PR award on each verification milestone

### Minor / Supporting Features

- Resend OTP cooldown + max attempts limit
- Wrong number correction flow during OTP
- Verification request expiry & timeout to payment fallback
- Admin manual approval override for community/location verification
- Verification badges/icons visible on profile
- Public verification status visibility (toggleable via privacy settings)

---

## 2. User Profile & Personal Data

### Major Features

- Full editable profile (name, avatar, bio, phone, email, wallet address)
- Industry selection (max 3, one primary)
- Goods & Services offered / requested (multi-select with can-provide / can-request flags)
- Primary ward + secondary ward
- Temporary location (valid for up to 6 months)
- Residence change request (cooldown 6 months, 7-day review period)
- Privacy settings (visibility control per field)
- Accessibility settings

### Minor / Supporting Features

- Avatar upload / camera capture
- Profile completion progress bar / checklist
- Profile view vs edit mode
- Last active / joined date display
- Public/private toggle for ward & goods/services
- Admin suspension / shadow-ban flag

---

## 3. Participation Rights (PR) & Economy

### Major Features

- PR token balance display
- PR earning via verification milestones
- Monthly PR regeneration (activity-gated — see ADR-024)
- Commitment dues / penalties (daily check)
- PR award reasons tracked (VERIFICATION_XXX, VOTE, CONTRIBUTION, etc.)
- Utility token balance (fiat-backed pool separate from earned pool — see ADR-004/026)
- Transaction history (awards, penalties, dues payments)

### Minor / Supporting Features

- PR impact breakdown (primary ward vs global)
- PR usage scenarios (voting power, governance weight)
- Manual PR adjustment tool for admins
- PR regeneration audit log
- Commitment breach notification
- Penalty forgiveness request flow (admin)

---

## 4. Community / Wards / Groups

### Major Features

- Ward-based community structure (primary + secondary ward)
- System groups (auto-enroll on email verification)
- Voluntary group creation (costs PR), join, leave
- Group member list with roles (LEADER / MEMBER)
- Single group detail endpoint
- Community announcements feed (planned)
- Ward-level PR pool & performance metrics (planned)

### Minor / Supporting Features

- Ward switch / residence change request workflow
- Vouching system (same ward, verified users only)
- Community leaderboard (top contributors per ward) (planned)
- Ward admin / moderator roles (planned)
- Group discovery / explore endpoint (planned)

---

## 5. Marketplace (Goods & Services Exchange)

### Major Features (designed, partial backend)

- Post offer/request (title, description, category, price in KES, location)
- Filter by goods/services category, distance, price
- Contact seller/buyer (in-app messaging – future)
- Reputation / rating after transaction (future)

### Minor / Supporting Features

- My offers / requests list
- Saved / favorites
- Category & industry tags
- Photo upload for listings

> **Rule 1 reminder**: Marketplace is discovery-only. No payments, no escrow, no in-app transactions.

---

## 6. Governance & Voting

### Major Features

- Create proposal (title, description, type: spending / rule change / etc.)
- Active proposals list with countdown
- Vote (For / Against / Abstain) with PR-weighted voting power
- Vote snapshot at proposal start time
- Proposal tally & results
- Vote history & turnout statistics

### Minor / Supporting Features

- Proposal comments / discussion (planned)
- Quorum & passing threshold rules
- Proposal categories / tags
- Proposal creation fee / PR stake (planned)
- Delegate voting (future)

---

## 7. Education & Onboarding Modules

### Major Features (planned)

- Guided onboarding tour (after sign-up)
- Interactive tutorials / tooltips on PR, verification, voting
- Learning hub / knowledge base:
  - What is PR?
  - How verification works
  - How to participate in governance
  - How to use the marketplace
  - Community guidelines
- UT reward for module completion (earned UT — not cashable; see ADR-004)

### Minor / Supporting Features

- Video / illustrated guides
- Quiz / knowledge check with small PR reward
- Progress tracking (completed modules)
- Role-based learning paths (new user vs active contributor)
- Anti-exploit safeguards (verification required, one reward per module per user)

---

## 8. Notifications & Communication

### Major Features (partial backend)

- In-app notification center
- Email notifications (verification, proposal created, vote ended, PR awarded, penalty warning)
- Push notifications (mobile – future)

### Minor / Supporting Features

- Notification preferences (toggle per type)
- Mark all as read
- Notification history
- In-app messaging (for marketplace & community – future)

---

## 9. Admin & Moderation Tools

### Major Features (partial backend)

- Pending verification queue (community/location)
- Manual PR award / penalty / adjustment
- User suspension / ban
- Proposal moderation
- BullMQ / queue monitoring (Bull Board at `/admin/queues`)
- System health dashboard (future)

### Minor / Supporting Features

- Audit log viewer (`GET /api/v1/audit/search`)
- User search & profile view
- Bulk actions (suspend multiple, award PR batch)

---

## 10. Emergency Response & Mutual Aid

### Major Features (partial backend)

- Verified incident reporting (floods, fires, medical emergencies, food shortages)
- Rapid mobilization of volunteers, supplies, transport
- Trusted information sharing (verification badges, Impact Points)
- Aid distribution coordination
- Post-event debrief & learning

> All scoped to the ward or nearby wards.

---

## 11. Treasury (planned)

- Ward / group treasury funded by dues and M-Pesa contributions
- Platform-wide treasury for grants and operations
- UT as transparent on-chain layer; KES via M-Pesa for real-world spend
- Withdrawal path: fiat-backed UT only (not earned UT) — see ADR-026

---

## 12. Cross-cutting / Platform Features

- Rate limiting (global + per-endpoint)
- Structured logging with `operationType`
- Error handling & user-friendly messages
- Dark/light theme
- Responsive design (mobile-first)
- Accessibility settings (large text, high contrast, screen reader support)
- Internationalization / localization readiness (Swahili first)

---

## Summary Table – Feature Maturity (March 2026)

| Area | Backend Status | Frontend Status | Notes / Next Work |
|---|---|---|---|
| Identity & Verification | tested (104 tests) | functional | Polish admin override |
| Profile & Personal Data | tested (35 tests) | functional | Avatar upload pending |
| Participation Rights (PR) | tested (34 tests) | functional | Add tiers & usage scenarios |
| Community / Wards / Groups | tested (49 tests) | functional | memberCount bug fix pending |
| Governance / Voting | tested (47 tests) | functional | Proposal comments pending |
| Marketplace | partial | stub page | High priority after community |
| Education / Onboarding | partial | stub | Medium priority |
| Notifications | partial | partial (bell UI) | No scheduled jobs yet |
| Emergency | partial | none | Medium priority |
| Admin Tools | partial | none | Expand after core features |
| Treasury | scaffold | stub page | Blocked on M-Pesa |
| Emergency | partial | none | Medium priority |
| Platform / Cross-cutting | complete | complete | Add i18n when needed |
