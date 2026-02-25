# UjamaaDAO — Frontend

> **Status: Active development.** Core shell, auth flow, registration, dashboard, and profile are built and functional. Backend is reachable at `http://localhost:4000/api/v1`.

---

## Quick Start

```bash
# From repo root — starts everything (backend + frontend + MailHog + DB + Redis)
cd backend && make dev

# OR run frontend alone (needs backend already running)
cd frontend
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL if needed
npm run dev
```

Frontend runs at **`http://localhost:3000`**

MailHog (email catcher for magic links) runs at **`http://localhost:8025`**

---

## Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 15 (App Router) | Framework |
| TypeScript | strict | Language |
| Tailwind CSS | v3 | Styling |
| shadcn/ui | latest | Component library |
| TanStack Query | v5 | Server state / data fetching |
| Lucide React | latest | Icons |
| Vaul | latest | Mobile drawer (bottom sheet) |

**Fonts:** Outfit (sans) + Cormorant Garamond (display/serif) — loaded via `next/font/google`

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api/v1` | Backend API base URL |

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
│   ├── marketplace/page.tsx      # Marketplace stub (discovery only)
│   ├── treasury/page.tsx         # Treasury stub
│   ├── admin/page.tsx            # Admin panel
│   └── layout.tsx                # Root layout (Providers + AppShell)
│
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx         # Root wrapper — bypasses for public routes
│   │   ├── sidebar.tsx           # 272px dark sidebar (desktop)
│   │   ├── topbar.tsx            # 52px frosted glass topbar
│   │   └── mobile-bottom-nav.tsx # Floating pill nav (mobile)
│   ├── auth/
│   │   ├── connect-wallet.tsx    # Sign-in dialog (magic link)
│   │   ├── register-form.tsx     # 4-step registration wizard
│   │   ├── protected-route.tsx   # Auth guard component
│   │   └── role-guard.tsx        # RBAC guard component
│   ├── landing/
│   │   └── landing-page.tsx      # Full landing page + LandingNav
│   ├── dashboard/
│   │   └── dashboard-content.tsx # Dashboard with PR balance
│   ├── user/
│   │   ├── user-profile.tsx      # Profile display
│   │   └── profile-edit-form.tsx # Profile edit form
│   ├── providers.tsx             # TanStack Query + Auth + Role providers
│   └── ui/                       # shadcn/ui components (do not edit directly)
│
├── contexts/
│   ├── auth-context.tsx          # Auth state + magic link flow
│   └── role-context.tsx          # RBAC role helpers
│
├── lib/
│   ├── api.ts                    # Typed API client (authApi, userApi, economyApi)
│   └── types.ts                  # Frontend type definitions
│
├── hooks/
│   └── use-toast.ts              # Toast notification hook
│
└── styles/
    └── globals.css               # Tailwind base + custom CSS variables
```

---

## Authentication Flow

UjamaaDAO uses **email magic links** — no passwords.

### New User (Registration)
```
/auth/register                    # 4-step form
  Step 1: email + name + phone
  Step 2: primary ward (where you live — county → constituency → ward)
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
  → Enter email in dialog
  → POST /api/v1/auth/magic-link/send  (sends login link)
  → Click link → /auth/callback?token=...
  → Redirect to /dashboard
```

### Token Storage
Tokens stored in `localStorage` (`access_token`, `refresh_token`). Auto-refresh on 401. See `frontend/lib/api.ts` → `tokenStore` and `tryRefresh()`.

---

## API Client

All backend calls go through `frontend/lib/api.ts`. Never use raw `fetch()` in components.

```ts
import { authApi, userApi, economyApi } from "@/lib/api"

// Auth
await authApi.requestMagicLink({ email, name, phoneNumber, primaryWardId, secondaryWardId, industryIds, goodsServiceIds })
await authApi.verifyMagicLink(token)
await authApi.logout()

// User profile
const me = await userApi.getMe()
await userApi.updateProfile({ name, avatarUrl })

// Reference data (public, no auth)
const counties = await userApi.getCounties()
const constituencies = await userApi.getConstituencies(countyId)
const wards = await userApi.getWards(constituencyId)
const industries = await userApi.getIndustries()
const goods = await userApi.getGoodsServices(industryId?)

// Economy
const { balance } = await economyApi.getPRBalance()
```

### Using TanStack Query in components

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

## Design System

### Brand Colours
| Token | Value | Usage |
|---|---|---|
| Ink (sidebar bg) | `#0E0B08` | Sidebar, dark sections |
| Gold primary | `#C9922A` | Buttons, active states |
| Gold light | `#E8B84B` | Text accents, icons on dark |
| Parchment (app bg) | `#F4EFE6` | Authenticated app background |
| Green accent | `rgba(30,100,50,0.25)` | Hero glow |

### Typography
- **Headings / display:** `font-display` → Cormorant Garamond
- **Body / UI:** `font-sans` → Outfit
- Applied via CSS variables `--font-outfit` and `--font-cormorant` in `layout.tsx`

### Layout Zones
- **Public routes** (`/`, `/about`, `/auth/*`): full-width, no sidebar/topbar — AppShell bypasses
- **Authenticated routes** (`/dashboard`, `/profile`, etc.): sidebar (272px) + topbar (52px) + main + mobile pill nav

### Component Library
Uses [shadcn/ui](https://ui.shadcn.com) components in `components/ui/`. Do not edit these files directly — regenerate via `npx shadcn-ui@latest add <component>`.

---

## Page Inventory

| Route | Status | Data Source |
|---|---|---|
| `/` | ✅ Real | Static content + auth state |
| `/about` | ✅ Built | Static |
| `/auth/register` | ✅ Real | `/users/reference/*` + `/auth/magic-link/send` |
| `/auth/callback` | ✅ Real | `/auth/login?token=...` |
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
Visit **`http://localhost:8025`** — MailHog catches all emails sent by the backend in development.

### Build check
```bash
cd frontend && npm run build  # must pass 0 errors before committing
```

### Useful commands
```bash
npm run lint        # ESLint
npm run type-check  # tsc --noEmit (if configured)
```

---

## Adding a New Authenticated Page

1. Create `app/<route>/page.tsx`
2. Add `"use client"` if it uses hooks
3. Use `useAuth()` to check `isAuthenticated`
4. Add the route to the sidebar nav in `components/layout/sidebar.tsx` if needed
5. The page is automatically wrapped in AppShell (sidebar + topbar)

Example:
```tsx
// app/mypage/page.tsx
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
- [ ] Community: groups list, group detail, join/leave
- [ ] Dashboard: activity feed, recent projects, community stats (live data)
- [ ] Profile: phone verification flow (`/auth/phone/send-code`)
- [ ] Community verification status banner (prompt user for next verification step)

Medium priority:
- [ ] Projects: create project, milestone tracking
- [ ] Notifications: bell icon → notification drawer
- [ ] Admin: user management, verification approvals

Blocked on backend:
- [ ] Marketplace: listings, search (backend `partial` status)
- [ ] Treasury: fund allocation (backend scaffold only)

Blocked on contracts:
- [ ] Wallet connection (Privy — ADR-009 decided)
- [ ] On-chain PR/UT balance display

---

*Last updated: 2026-02-24 (session 9)*
*See [`ai_workflows/PROGRESS_LOG.md`](../ai_workflows/PROGRESS_LOG.md) for session history.*
