# UjamaaDAO – Feature Inventory

**Status:** May 2026 – Current Implementation + Planned / Designed Features
**Version:** 1.3 (updated May 2026 — session 55)

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
- Group discovery / explore endpoint with `isMember` + `myRole` per user
- Group admin tools: updateSettings, changeMemberRole, removeMember (LEADER-only)
- Baraza messaging integration (Telegram/WhatsApp/Discord attendance tracking + PR rewards)
- Community leaderboard (top contributors per ward) (planned)

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

### Major Features

- Verified incident reporting (FIRE, FLOOD, MEDICAL, SECURITY, ACCIDENT, OTHER)
- Alert lifecycle management: ACTIVE → IN_PROGRESS → RESOLVED / FALSE_ALARM
- Responder registration (ward admin or verifier)
- Reporter notifications: on response and on resolution
- Audit trail for every status transition
- Rapid mobilization of volunteers, supplies, transport (via group membership)
- Aid distribution coordination (planned)

> All scoped to the ward or nearby wards.

---

## 11. Treasury

### Major Features (implemented)

- Group treasury ledger (`GroupTreasury` per group, `WalletTransaction` audit trail — credit/debit with referenceType)
- Dues allocation: dues fan out across geographic hierarchy (Ward 70% / Constituency 15% / County 10% / National 5% by default); split configurable via `PlatformConfig` key `dues_allocation_split`; missing system groups skipped gracefully
- Proposal disbursement: transitioning a proposal to EXECUTING with `groupFundingAmount > 0` pre-validates and debits the group treasury (`PROPOSAL` referenceType)
- Project contributions: `contributeToProject` credits the project's group treasury (`PROJECT` referenceType)
- M-Pesa `TREASURY_DEPOSIT` payment: Buni callback credits the target group treasury and mints on-chain UT for the payer
- Manual deposit / withdraw (SUPER_ADMIN only, with balance guard on withdrawals)
- Transaction history with filters (type, referenceType, date range, pagination)
- My-groups summary: `GET /treasury/my-groups` returns balance + metadata for all groups the user belongs to that have a treasury

### Planned

- On-chain treasury mirroring (`GroupTreasury.sol`) — blocked on minter wallet funding + Base Sepolia deploy
- Platform-wide treasury for grants and operations
- UT cash-out: fiat-backed UT only, 1% fee, daily/weekly limits, BullMQ B2C job — see ADR-004

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

## Summary Table – Feature Maturity (May 2026)

**Total: 1017 green tests across 15 tested modules**

| Area | Backend Status | Frontend Status | Notes / Next Work |
|---|---|---|---|
| Identity & Verification | tested (104 auth + 36 verification = 140 tests) | functional | WebAuthn/passkeys live; SMS AT credentials → real |
| Profile & Personal Data | tested (35 tests) | functional | Avatar upload pending |
| Participation Rights (PR) + Economy (UT) | tested (66 tests) | functional | On-chain mint wired; UT cash-out idempotency tested; Base Sepolia deploy pending |
| Community / Wards / Groups | tested (147 tests) | functional | Baraza integration live; conflict protocol live |
| Governance / Voting | tested (111 tests) | functional | Proposal disbursement wired; 2-stage review + memory layer live |
| Projects & Milestones | tested (127 tests) | functional | QR witness-chain work sessions; task board; contribution flows |
| Marketplace | tested (35 tests) | functional | Discovery-only per Rule 1 |
| Education | tested (42 tests) | functional | Module completion, react-markdown prose rendering |
| Onboarding | tested (22 tests) | functional | Auto-completion via AUTO_CONDITIONS map |
| Notifications | tested (43 tests) | functional | Dues-reminder job + governance hooks live |
| Emergency | tested (30 tests) | functional | Alert lifecycle (ACTIVE→IN_PROGRESS→RESOLVED) live |
| Reputation / Impact Points | tested (23 tests) | functional | Ward-level impact tracking, leaderboard live |
| Elections | tested (63 tests) | functional | Full backend lifecycle; frontend list + detail pages |
| Treasury | tested (40 tests) | functional | Geographic dues split (70/15/10/5) live; proposal disbursement + my-groups summary; GroupTreasury.sol pending |
| Payments (M-Pesa) | tested (50 tests) | functional | Buni STK push + B2C payout (UT cash-out) wired end-to-end; 50K KES daily limit; BullMQ job with 3× retry + refund on exhaustion; completePayout/refundPayout idempotency verified |
| Admin Tools | tested (50 tests) | functional | stats/users/config; PR adjust; suspend; role management; report generation (CSV) |
| Audit / Feed | tested (31 tests) | functional | 6+ audit events active; feed cursor-paginated stream; geographic personalisation |
| Integration (Baraza) | partial (no tests) | functional | Telegram/Discord/WhatsApp; attendance + invite jobs |
| Platform / Cross-cutting | complete | complete | EN/SW i18n live; PWA installable |
