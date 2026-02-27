# UjamaaDAO — Frontend

> **Status: Active development.** Core shell, auth flow, registration, dashboard, profile, and Privy wallet integration are built and functional. Build: 15 routes green.

---

## Quick Start

```bash
# From repo root — starts everything (backend + frontend + MailHog + DB + Redis)
cd backend && make dev

# OR run frontend alone (needs backend already running)
cd frontend
npm install
npm run dev
```

Frontend runs at **`http://localhost:3000`**

MailHog (email catcher for magic links) runs at **`http://localhost:8025`**

> **Note:** If the Docker container's node_modules are stale (e.g. after adding a new package), run:
> `docker exec ujamaa_frontend npm install` then `docker restart ujamaa_frontend`

---

## Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 15 (App Router) | Framework |
| TypeScript | strict | Language |
| Tailwind CSS | v3 | Styling |
| shadcn/ui | latest | Component library |
| TanStack Query | v5 | Server state / data fetching |
| Privy | `@privy-io/react-auth` v3.14.1 | Embedded wallets (Base L2) |
| Lucide React | 0.294 | Icons |
| Vaul | latest | Mobile drawer (bottom sheet) |

**Fonts:** Inter (sans) + Cormorant Garamond (display/serif) — loaded via `next/font/google`

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api/v1` | Backend API base URL |
| `NEXT_PUBLIC_PRIVY_APP_ID` | — | Privy App ID (App ID only — secret is server-side) |

Add to `frontend/.env.local` for local dev. Do **not** commit `.env.local`.

---

## Project Structure

```
frontend/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Landing page (public)
│   ├── about/page.tsx            # About page (public)
│   ├── auth/
│   │   ├── register/page.tsx     # 4-step registration (public)
│   │   └── callback/page.tsx     # Magic link handler (public)
│   ├── dashboard/page.tsx        # Main dashboard (auth required)
│   ├── profile/page.tsx          # User profile + edit (auth required)
│   ├── projects/
│   │   ├── page.tsx              # Projects list
│   │   └── [id]/page.tsx         # Project detail
│   ├── groups/
│   │   ├── page.tsx              # Groups list
│   │   └── [id]/page.tsx         # Group detail
│   ├── proposals/page.tsx        # Governance proposals
│   ├── marketplace/page.tsx      # Marketplace (discovery only — no payments ever)
│   ├── treasury/page.tsx         # Treasury stub
│   ├── admin/page.tsx            # Admin panel
│   └── layout.tsx                # Root layout (Providers + AppShell)
│
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx         # Root wrapper — bypasses for public routes
│   │   ├── sidebar.tsx           # 272px tea-green sidebar (desktop)
│   │   ├── topbar.tsx            # 52px frosted glass topbar + WalletButton
│   │   └── mobile-bottom-nav.tsx # Floating pill nav (mobile)
│   ├── auth/
│   │   ├── connect-wallet.tsx    # Magic link sign-in dialog
│   │   ├── wallet-button.tsx     # Privy connect/disconnect button (topbar)
│   │   ├── register-form.tsx     # 4-step registration wizard
│   │   ├── protected-route.tsx   # Auth guard component
│   │   └── role-guard.tsx        # RBAC guard component
│   ├── landing/
│   │   └── landing-page.tsx      # Full landing page + LandingNavbar + SignInModal
│   ├── dashboard/
│   │   └── dashboard-content.tsx # Dashboard with live PR balance
│   ├── user/
│   │   ├── user-profile.tsx      # Profile display
│   │   └── profile-edit-form.tsx # Profile edit form
│   ├── providers.tsx             # TanStack Query + Auth + Wallet + Role providers
│   └── ui/                       # shadcn/ui components (do not edit directly)
│
├── contexts/
│   ├── auth-context.tsx          # Auth state + magic link flow
│   ├── wallet-context.tsx        # Privy wallet (PrivyProvider + useWallet hook)
│   └── role-context.tsx          # RBAC role helpers
│
├── lib/
│   ├── api.ts                    # Typed API client (authApi, userApi, economyApi)
│   └── types.ts                  # Frontend type definitions
│
├── stubs/
│   └── empty.js                  # Webpack stub for unused Privy transitive deps
│
└── styles/
    └── globals.css               # Tailwind base + Chai palette CSS variables
```

---

## Authentication Flow

UjamaaDAO uses **email magic links** — no passwords.

### New User (Registration)
```
/auth/register                    # 4-step form
  Step 1: email + name + phone
  Step 2: primary ward (county → constituency → ward)
  Step 3: secondary ward (origin/home ward)
  Step 4: industry + goods/services
  → POST /api/v1/auth/magic-link/send  (creates account + sends email)
  → Check email (or MailHog at localhost:8025 in dev)
  → Click link → /auth/callback?token=...
  → Redirect to /dashboard
```

### Returning User (Sign In)
```
Landing page "Sign In" button
  → Enter email in SignInModal
  → POST /api/v1/auth/magic-link/send  (sends login link)
  → Click link → /auth/callback?token=...
  → Redirect to /dashboard
```

### Token Storage
Tokens stored in `localStorage` (`access_token`, `refresh_token`). Auto-refresh on 401. See `frontend/lib/api.ts` → `tokenStore` and `tryRefresh()`.

### Wallet (Privy)
Privy embedded wallet is created automatically when a user first connects. Users never see seed phrases or gas warnings. The `WalletButton` in the topbar handles connect/disconnect.

---

## API Client

All backend calls go through `frontend/lib/api.ts`. Never use raw `fetch()` in components.

```ts
import { authApi, userApi, economyApi } from "@/lib/api"

// Auth
await authApi.requestMagicLink({ email, name?, phoneNumber?, primaryWardId?, ... })
await authApi.verifyMagicLink(token)
await authApi.logout()

// User profile
const me = await userApi.getMe()
await userApi.updateProfile({ name, avatarUrl })

// Reference data (public, no auth required)
const counties = await userApi.getCounties()
const constituencies = await userApi.getConstituencies(countyId)
const wards = await userApi.getWards(constituencyId)
const industries = await userApi.getIndustries()

// Economy
const { balance } = await economyApi.getPRBalance()
```

### TanStack Query in components

```tsx
"use client"
import { useQuery } from "@tanstack/react-query"
import { economyApi } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

export function PRBalance() {
  const { isAuthenticated } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ["pr-balance"],
    queryFn: () => economyApi.getPRBalance(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })
  if (isLoading) return <Skeleton />
  return <div>{data?.balance ?? 0} PR</div>
}
```

---

## Design System — Chai Palette

| Token | Tailwind class | Hex | Usage |
|---|---|---|---|
| Tea Green | `bg-tea-green` | `#1D4731` | Sidebar, nav pills, section backgrounds |
| Tea Dark | `bg-tea-dark` | `#142F22` | Register page bg, dark overlays |
| Cream | `bg-cream` | `#F7F2E8` | App background, cards |
| Amber | `bg-amber` / `text-amber` | `#D4911E` | Primary buttons, active states, CTAs |
| Amber Bright | `bg-amber-bright` | `#E9A52E` | Hover states, gradient ends |
| Leaf | `text-leaf` | `#38A063` | Success, positive indicators |
| Chai | `text-chai` | `#1A120B` | Primary text on light backgrounds |
| Ember | `text-ember` | `#C43D28` | Error states, destructive actions |
| Warm Gray | `text-warm-gray` | `#7A6E60` | Muted text, placeholder text |

### Typography
- **Headings / display:** `font-serif` or `font-display` → Cormorant Garamond
- **Body / UI:** `font-sans` → Inter
- Applied via CSS variables `--font-inter` and `--font-cormorant` in `layout.tsx`

### Layout Zones
- **Public routes** (`/`, `/about`, `/auth/*`): full-width, no sidebar/topbar — AppShell bypasses
- **Authenticated routes** (`/dashboard`, `/profile`, etc.): tea-green sidebar (272px) + frosted topbar (52px) + main content + mobile pill nav

### Components
Uses [shadcn/ui](https://ui.shadcn.com) components in `components/ui/`. Do not edit these files directly — regenerate via `npx shadcn-ui@latest add <component>`.

---

## Page Inventory

| Route | Status | Data Source |
|---|---|---|
| `/` | ✅ Built | Static content + auth state |
| `/about` | ✅ Built | Static |
| `/auth/register` | ✅ Real | `/users/reference/*` + `/auth/magic-link/send` |
| `/auth/callback` | ✅ Real | `/auth/verify-email` or `/auth/login` (token type detection) |
| `/dashboard` | ✅ Partial | PR balance live; other cards stubbed |
| `/profile` | ✅ Partial | `/users/me` live; edit form wired |
| `/projects` | 🔶 Stub | Static data |
| `/projects/[id]` | 🔶 Stub | Static data |
| `/groups` | 🔶 Stub | Static data |
| `/groups/[id]` | 🔶 Stub | Static data |
| `/proposals` | 🔶 Stub | Static data |
| `/marketplace` | 🔶 Empty state | Discovery only — no payments ever |
| `/treasury` | 🔶 Empty state | Coming later |
| `/admin` | 🔶 Partial | Role-gated |

---

## Non-Negotiable Rules

These are absolute — do not build UI that violates them:

1. **Marketplace = discovery only.** No checkout, cart, payment, or escrow UI.
2. **No UT cash-out.** Utility tokens cannot be withdrawn or sold — do not build any interface suggesting this.
3. **PR is not transferable.** No send/trade/gift UI for Participation Rights.
4. **Blockchain is invisible.** Users see "account" not "wallet". No seed phrases, no gas warnings.
5. **`NEXT_PUBLIC_API_URL` env var** must configure the backend URL — never hardcode `localhost:4000`.

---

## Development Workflow

### Run everything
```bash
cd backend && make dev        # starts web, worker, postgres, redis, mailhog, frontend
```

### Frontend only (backend already running)
```bash
cd frontend && npm run dev
```

### Check magic link emails (dev)
Visit **`http://localhost:8025`** — MailHog catches all emails sent by the backend.

### Build check (must pass before committing)
```bash
cd frontend && npm run build
```

---

## Adding a New Authenticated Page

1. Create `app/<route>/page.tsx`
2. Add `"use client"` if it uses hooks
3. Use `useAuth()` to check `isAuthenticated`
4. Add the route to the sidebar nav in `components/layout/sidebar.tsx` if needed
5. AppShell wraps it automatically in sidebar + topbar

```tsx
"use client"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function MyPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/")
  }, [isAuthenticated, isLoading, router])

  if (isLoading || !isAuthenticated) return null
  return <div className="p-6">My Page</div>
}
```

---

## What's Left to Build

High priority (backend endpoints exist):
- [ ] Governance: proposals list, proposal detail, voting UI
- [ ] Community: groups list, group detail, join/leave flows
- [ ] Dashboard: activity feed, recent projects, community stats (live data)
- [ ] Profile: phone verification flow (`/auth/phone/send-code`)
- [ ] Community verification status banner

Medium priority:
- [ ] Projects: create project, milestone tracking
- [ ] Notifications: bell icon → notification drawer
- [ ] Admin: user management, verification approvals
- [ ] Extend Chai palette to dashboard/profile/proposals (currently partial)

Blocked on backend:
- [ ] Marketplace: listings, search (backend `partial` status)
- [ ] Treasury: fund allocation (backend scaffold only)

Blocked on contracts:
- [ ] On-chain PR/UT balance display (needs deployed `PrToken.sol` + `UtToken.sol`)

---

*Last updated: 2026-02-26 (session 13)*
*See [`ai_workflows/PROGRESS_LOG.md`](../ai_workflows/PROGRESS_LOG.md) for full session history.*
