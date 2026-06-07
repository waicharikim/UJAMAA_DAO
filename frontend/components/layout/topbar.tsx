"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeft, Coins, Award, Zap, ChevronLeft } from "lucide-react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"

// Lazy-load AccountMenu — keeps @privy-io/react-auth (used for wallet) out of
// the topbar bundle. The avatar dropdown holds profile, wallet, and sign-out.
const AccountMenu = dynamic(
  () => import("@/components/layout/account-menu").then((m) => ({ default: m.AccountMenu })),
  { ssr: false, loading: () => <div className="h-8 w-8 rounded-full bg-[#C9922A]/10 animate-pulse" /> },
)
import { NotificationsPopover } from "./notifications-popover"
import { GlobalSearch } from "./global-search"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"

// ── Token stat chip ─────────────────────────────────────────
interface TokenChipProps { icon: React.ElementType; label: string; value: number; color: string }
function TokenChip({ icon: Icon, label, value, color }: TokenChipProps) {
  return (
    <div
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold flex-shrink-0"
      style={{ background: `${color}18`, color }}
    >
      <Icon className="h-3 w-3 flex-shrink-0" />
      <span>{value.toLocaleString()}</span>
      <span className="font-medium opacity-60">{label}</span>
    </div>
  )
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":     "Home",
  "/proposals":     "Governance",
  "/projects":      "Projects",
  "/groups":        "Community",
  "/marketplace":   "Marketplace",
  "/treasury":      "Treasury",
  "/economy":       "Economy",
  "/notifications": "Notifications",
  "/education":     "Learn",
  "/leaderboard":   "Leaderboard",
  "/elections":     "Elections",
  "/governance":    "Governance",
  "/conflicts":     "Conflicts",
  "/profile":       "Profile",
  "/admin":         "Administration",
  "/emergency":     "Emergency",
}

// Pages that have a parent — back button appears on mobile for these
const PARENT_ROUTES: { prefix: string; href: string; label: string }[] = [
  { prefix: "/groups/",     href: "/groups",     label: "Community"  },
  { prefix: "/proposals/",  href: "/proposals",  label: "Governance" },
  { prefix: "/projects/",   href: "/projects",   label: "Projects"   },
  { prefix: "/elections/",  href: "/elections",  label: "Elections"  },
  { prefix: "/education/",  href: "/education",  label: "Learn"      },
  { prefix: "/conflicts/",  href: "/conflicts",  label: "Conflicts"  },
  { prefix: "/profile/",    href: "/profile",    label: "Profile"    },
]

function resolveTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  for (const [prefix, label] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(prefix + "/")) return label
  }
  return "UjamaaDAO"
}

function resolveParent(pathname: string): { href: string; label: string } | null {
  for (const route of PARENT_ROUTES) {
    if (pathname.startsWith(route.prefix)) return { href: route.href, label: route.label }
  }
  return null
}

interface TopbarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Topbar({ collapsed, onToggle }: TopbarProps) {
  const pathname = usePathname()
  const title  = resolveTitle(pathname)
  const parent = resolveParent(pathname)
  const { isAuthenticated, user, isLoading } = useAuth()

  return (
    <header
      className="sticky top-0 z-40 flex h-[52px] items-center gap-3 px-4 md:px-5 flex-shrink-0"
      style={{
        background: "rgba(247,242,232,0.90)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(26,18,11,0.07)",
      }}
    >
      {/* Sidebar toggle — desktop only, when collapsed */}
      {collapsed && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="hidden md:flex h-8 w-8 p-0 rounded-lg hover:bg-[rgba(212,145,30,0.10)] flex-shrink-0"
          aria-label="Expand sidebar"
        >
          <PanelLeft className="h-[17px] w-[17px] text-chai" />
        </Button>
      )}

      {/* Mobile back button — shown on detail/sub pages */}
      {parent && (
        <Link
          href={parent.href}
          className="md:hidden flex items-center gap-1 -ml-1 px-1 py-1 rounded-lg flex-shrink-0 active:bg-[rgba(14,11,8,0.06)] transition-colors"
          aria-label={`Back to ${parent.label}`}
        >
          <ChevronLeft className="h-5 w-5" style={{ color: "#1D4731" }} />
          <span className="text-[13px] font-semibold" style={{ color: "#1D4731" }}>
            {parent.label}
          </span>
        </Link>
      )}

      {/* Page title — hidden on mobile when back button is shown */}
      <h1
        className={`font-serif font-semibold text-[18px] text-chai leading-none tracking-tight flex-shrink-0 ${parent ? "hidden md:block" : ""}`}
      >
        {title}
      </h1>

      {/* Global search — desktop only */}
      <div className="hidden md:flex flex-1 max-w-xs mx-2">
        <GlobalSearch />
      </div>

      {/* Token stats — desktop only, gated on auth ready */}
      {!isLoading && isAuthenticated && user && (
        <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
          <TokenChip icon={Coins} label="PR" value={user.tokenBalance}        color="#C9922A" />
          <TokenChip icon={Award} label="IP" value={user.impactPoints.global}  color="#1D4731" />
          <TokenChip icon={Zap}   label="UT" value={user.utBalance}            color="#7A4F1E" />
        </div>
      )}

      {/* Actions — skeleton during auth hydration */}
      <div className="flex items-center gap-2">
        {isLoading ? (
          <div className="hidden md:flex items-center gap-2">
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
        ) : isAuthenticated ? (
          <>
            <NotificationsPopover />
            <AccountMenu />
          </>
        ) : (
          <>
            <Link href="/auth/register">
              <Button
                size="sm"
                className="h-8 px-4 text-xs font-bold rounded-full"
                style={{ background: "#1D4731", color: "#fff" }}
              >
                Get Started
              </Button>
            </Link>
            <Link href="/auth/callback">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-xs font-semibold rounded-full"
                style={{ color: "#7A4F1E" }}
              >
                Sign In
              </Button>
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
