"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useRole } from "@/contexts/role-context"
import { useLanguage } from "@/contexts/language-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import {
  Home,
  Users,
  Store,
  Landmark,
  User,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BookOpen,
  AlertTriangle,
  Scale,
  Globe,
  Vote,
  Coins,
  Briefcase,
  Users2,
  Bell,
  MapPin,
} from "lucide-react"

// ─── Hub definitions ──────────────────────────────────────
const HUBS = [
  {
    id: "governance",
    label: "Governance",
    icon: Scale,
    href: "/proposals",
    items: [
      { label: "Proposals", href: "/proposals", icon: Vote },
      { label: "Elections", href: "/elections", icon: Users2 },
    ],
  },
  {
    id: "economy",
    label: "Economy",
    icon: Coins,
    href: "/treasury",
    items: [
      { label: "Economy",     href: "/economy",     icon: Coins     },
      { label: "Treasury",    href: "/treasury",    icon: Landmark  },
      { label: "Marketplace", href: "/marketplace", icon: Store     },
      { label: "Projects",    href: "/projects",    icon: Briefcase },
    ],
  },
  {
    id: "community",
    label: "Community",
    icon: Users,
    href: "/groups",
    items: [
      { label: "My Ward", href: "/ward",      icon: MapPin   },
      { label: "Groups",  href: "/groups",    icon: Users    },
      { label: "Learn",   href: "/education", icon: BookOpen },
    ],
  },
  {
    id: "personal",
    label: "Personal",
    icon: User,
    href: "/profile",
    items: [
      { label: "Profile",        href: "/profile",        icon: User          },
      { label: "Notifications",  href: "/notifications",  icon: Bell          },
      { label: "Emergency",      href: "/emergency",      icon: AlertTriangle },
    ],
  },
] as const

// Adinkra Gye Nyame motif in amber-on-tea-green
const ADINKRA_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cg fill='none' stroke='rgba(212,145,30,0.07)' stroke-width='1'%3E%3Ccircle cx='40' cy='40' r='28'/%3E%3Ccircle cx='40' cy='40' r='16'/%3E%3Cline x1='40' y1='12' x2='40' y2='0'/%3E%3Cline x1='40' y1='68' x2='40' y2='80'/%3E%3Cline x1='12' y1='40' x2='0' y2='40'/%3E%3Cline x1='68' y1='40' x2='80' y2='40'/%3E%3Cline x1='20' y1='20' x2='12' y2='12'/%3E%3Cline x1='60' y1='20' x2='68' y2='12'/%3E%3Cline x1='20' y1='60' x2='12' y2='68'/%3E%3Cline x1='60' y1='60' x2='68' y2='68'/%3E%3C/g%3E%3C/svg%3E")`

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

// ─── Hub section (expanded sidebar only) ─────────────────
function HubSection({
  hub,
  pathname,
  collapsed,
}: {
  hub: (typeof HUBS)[number]
  pathname: string
  collapsed: boolean
}) {
  const isHubActive = hub.items.some((item) => pathname.startsWith(item.href))
  const [open, setOpen] = useState(true)

  const HubIcon = hub.icon

  if (collapsed) {
    // Collapsed: single hub icon, clicks to hub primary page
    return (
      <Link
        href={hub.href}
        title={hub.label}
        className={cn(
          "relative flex items-center justify-center rounded-lg overflow-hidden transition-all duration-200 py-[10px]",
          isHubActive ? "bg-[rgba(212,145,30,0.12)]" : "hover:bg-[rgba(247,242,232,0.06)]"
        )}
      >
        {isHubActive && (
          <span
            className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-sm"
            style={{ background: "linear-gradient(to bottom, #D4911E, #E9A52E)" }}
          />
        )}
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: isHubActive ? "rgba(212,145,30,0.18)" : "rgba(247,242,232,0.06)" }}
        >
          <HubIcon
            className="h-[15px] w-[15px]"
            style={{ color: isHubActive ? "#E9A52E" : "rgba(247,242,232,0.55)" }}
          />
        </span>
      </Link>
    )
  }

  return (
    <div>
      {/* Hub header row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-[10px] py-[7px] rounded-lg transition-all duration-200 hover:bg-[rgba(247,242,232,0.04)] group"
      >
        <HubIcon
          className="h-[13px] w-[13px] flex-shrink-0"
          style={{ color: isHubActive ? "#E9A52E" : "rgba(247,242,232,0.35)" }}
        />
        <span
          className="flex-1 text-left text-[10px] font-bold tracking-[1.5px] uppercase"
          style={{ color: isHubActive ? "rgba(233,165,46,0.75)" : "rgba(247,242,232,0.30)" }}
        >
          {hub.label}
        </span>
        {open
          ? <ChevronUp  className="h-3 w-3 flex-shrink-0" style={{ color: "rgba(247,242,232,0.20)" }} />
          : <ChevronDown className="h-3 w-3 flex-shrink-0" style={{ color: "rgba(247,242,232,0.20)" }} />
        }
      </button>

      {/* Sub-items */}
      {open && (
        <div className="flex flex-col gap-[1px] pl-[18px] pb-1">
          {hub.items.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-[10px] rounded-lg overflow-hidden transition-all duration-200 px-2.5 py-[8px]",
                  active ? "bg-[rgba(212,145,30,0.10)]" : "hover:bg-[rgba(247,242,232,0.05)]"
                )}
              >
                {active && (
                  <span
                    className="absolute left-0 top-[22%] bottom-[22%] w-[2.5px] rounded-r-sm"
                    style={{ background: "linear-gradient(to bottom, #D4911E, #E9A52E)" }}
                  />
                )}
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: active ? "rgba(212,145,30,0.15)" : "rgba(247,242,232,0.05)" }}
                >
                  <Icon
                    className="h-[13px] w-[13px]"
                    style={{ color: active ? "#E9A52E" : "rgba(247,242,232,0.50)" }}
                  />
                </span>
                <span
                  className="text-[12.5px] font-medium whitespace-nowrap"
                  style={{ color: active ? "#E9A52E" : "rgba(247,242,232,0.58)" }}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { user, isAuthenticated, logout } = useAuth()
  const { hasAnyRole } = useRole()
  const { lang, setLang } = useLanguage()

  const showAdmin = hasAnyRole(["super_admin", "compliance_officer", "ward_admin", "constituency_admin", "county_admin"])
  const dashActive = pathname === "/dashboard"

  return (
    <aside
      className={cn(
        "hidden md:flex min-h-screen flex-col flex-shrink-0 relative overflow-hidden transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[272px]"
      )}
      style={{ background: "#1D4731" }}
    >
      {/* Adinkra pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 0%, rgba(212,145,30,0.10) 0%, transparent 60%), ${ADINKRA_SVG}`,
          backgroundSize: "auto, 80px 80px",
        }}
      />

      {/* Amber right-edge gradient line */}
      <div
        className="absolute top-0 right-0 w-px h-full pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(212,145,30,0.4) 20%, rgba(212,145,30,0.65) 50%, rgba(212,145,30,0.4) 80%, transparent 100%)",
        }}
      />

      {/* Logo + collapse toggle */}
      <div
        className="relative z-10 flex items-center px-[14px] py-[22px]"
        style={{ borderBottom: "1px solid rgba(247,242,232,0.08)" }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center font-serif font-bold text-[22px] flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #D4911E 0%, #E9A52E 100%)",
            color: "#142F22",
            boxShadow: "0 4px 16px rgba(212,145,30,0.35)",
            letterSpacing: "-1px",
          }}
        >
          UJ
        </div>

        <div
          className={cn(
            "flex flex-col ml-[14px] transition-all duration-200 overflow-hidden",
            collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          )}
        >
          <span
            className="font-serif font-bold text-cream leading-none whitespace-nowrap"
            style={{ fontSize: 20, letterSpacing: "0.3px" }}
          >
            UjamaaDAO
          </span>
          <span
            className="font-sans font-medium uppercase whitespace-nowrap"
            style={{ fontSize: 9, color: "rgba(233,165,46,0.7)", letterSpacing: "1.5px", marginTop: 3 }}
          >
            Ward Platform
          </span>
        </div>

        <button
          onClick={onToggle}
          className={cn(
            "relative z-10 flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200 hover:bg-[rgba(247,242,232,0.10)] flex-shrink-0",
            collapsed ? "ml-0 mt-0" : "ml-auto"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{ border: "1px solid rgba(247,242,232,0.12)" }}
        >
          {collapsed
            ? <ChevronRight className="h-3.5 w-3.5" style={{ color: "rgba(247,242,232,0.45)" }} />
            : <ChevronLeft  className="h-3.5 w-3.5" style={{ color: "rgba(247,242,232,0.45)" }} />
          }
        </button>
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex-1 flex flex-col px-[10px] pt-4 pb-4 gap-[2px] overflow-y-auto overflow-x-hidden">

        {/* Dashboard — standalone */}
        <Link
          href="/dashboard"
          title={collapsed ? "Dashboard" : undefined}
          className={cn(
            "relative flex items-center gap-[11px] rounded-lg overflow-hidden transition-all duration-200 mb-2",
            collapsed ? "justify-center px-0 py-[10px]" : "px-3 py-[10px]",
            dashActive ? "bg-[rgba(212,145,30,0.12)]" : "hover:bg-[rgba(247,242,232,0.06)]"
          )}
        >
          {dashActive && (
            <span
              className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-sm"
              style={{ background: "linear-gradient(to bottom, #D4911E, #E9A52E)" }}
            />
          )}
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: dashActive ? "rgba(212,145,30,0.18)" : "rgba(247,242,232,0.06)" }}
          >
            <Home
              className="h-[15px] w-[15px]"
              style={{ color: dashActive ? "#E9A52E" : "rgba(247,242,232,0.55)" }}
            />
          </span>
          {!collapsed && (
            <span
              className="text-[13.5px] font-medium whitespace-nowrap"
              style={{ color: dashActive ? "#E9A52E" : "rgba(247,242,232,0.60)" }}
            >
              Dashboard
            </span>
          )}
        </Link>

        {/* Hub separator */}
        {!collapsed && (
          <div className="my-1 mx-[10px] h-px" style={{ background: "rgba(247,242,232,0.07)" }} />
        )}

        {/* Hub sections */}
        <div className="flex flex-col gap-[3px]">
          {HUBS.map((hub) => (
            <HubSection key={hub.id} hub={hub} pathname={pathname} collapsed={collapsed} />
          ))}
        </div>

        {/* Admin — conditional, standalone */}
        {showAdmin && (
          <>
            {collapsed && <div className="my-2 h-px" style={{ background: "rgba(247,242,232,0.08)" }} />}
            <Link
              href="/admin"
              title={collapsed ? "Admin" : undefined}
              className={cn(
                "relative flex items-center gap-[11px] rounded-lg overflow-hidden transition-all duration-200 mt-2",
                collapsed ? "justify-center px-0 py-[10px]" : "px-3 py-[10px]",
                pathname.startsWith("/admin")
                  ? "bg-[rgba(212,145,30,0.12)]"
                  : "hover:bg-[rgba(247,242,232,0.06)]"
              )}
            >
              {pathname.startsWith("/admin") && (
                <span
                  className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-sm"
                  style={{ background: "linear-gradient(to bottom, #D4911E, #E9A52E)" }}
                />
              )}
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: pathname.startsWith("/admin")
                    ? "rgba(212,145,30,0.18)"
                    : "rgba(247,242,232,0.06)",
                }}
              >
                <Shield
                  className="h-[15px] w-[15px]"
                  style={{ color: pathname.startsWith("/admin") ? "#E9A52E" : "rgba(247,242,232,0.55)" }}
                />
              </span>
              {!collapsed && (
                <span
                  className="text-[13.5px] font-medium whitespace-nowrap"
                  style={{ color: pathname.startsWith("/admin") ? "#E9A52E" : "rgba(247,242,232,0.60)" }}
                >
                  Admin
                </span>
              )}
            </Link>
          </>
        )}
      </nav>

      {/* Language toggle */}
      <div
        className={cn(
          "relative z-10 px-[10px] py-2 flex",
          collapsed ? "justify-center" : "justify-start"
        )}
        style={{ borderTop: "1px solid rgba(247,242,232,0.07)" }}
      >
        {collapsed ? (
          <button
            onClick={() => setLang(lang === "en" ? "sw" : "en")}
            title={lang === "en" ? "Switch to Swahili" : "Switch to English"}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[rgba(247,242,232,0.08)] transition-colors"
          >
            <Globe className="h-[14px] w-[14px]" style={{ color: "rgba(247,242,232,0.40)" }} />
          </button>
        ) : (
          <div className="flex items-center gap-1 px-[10px]">
            <Globe className="h-[12px] w-[12px] flex-shrink-0" style={{ color: "rgba(247,242,232,0.30)" }} />
            <button
              onClick={() => setLang("en")}
              className="text-[11px] font-semibold px-1.5 py-0.5 rounded transition-colors"
              style={{
                color: lang === "en" ? "#E9A52E" : "rgba(247,242,232,0.30)",
                background: lang === "en" ? "rgba(212,145,30,0.12)" : "transparent",
              }}
            >
              EN
            </button>
            <span style={{ color: "rgba(247,242,232,0.15)", fontSize: 10 }}>|</span>
            <button
              onClick={() => setLang("sw")}
              className="text-[11px] font-semibold px-1.5 py-0.5 rounded transition-colors"
              style={{
                color: lang === "sw" ? "#E9A52E" : "rgba(247,242,232,0.30)",
                background: lang === "sw" ? "rgba(212,145,30,0.12)" : "transparent",
              }}
            >
              SW
            </button>
          </div>
        )}
      </div>

      {/* Footer — user card + logout */}
      <div
        className="relative z-10 px-[10px] pb-3 pt-2"
        style={{ borderTop: "1px solid rgba(247,242,232,0.07)" }}
      >
        {isAuthenticated && user ? (
          <>
            <div
              className={cn(
                "flex items-center gap-[10px] px-[10px] py-3 rounded-lg",
                !collapsed && "mb-1"
              )}
            >
              <Avatar
                className="h-9 w-9 rounded-xl flex-shrink-0"
                style={{ border: "1.5px solid rgba(212,145,30,0.35)" }}
              >
                <AvatarImage src={user.avatar || "/placeholder.svg"} />
                <AvatarFallback
                  className="rounded-xl font-semibold text-cream text-sm"
                  style={{ background: "linear-gradient(135deg, #38A063, #1D4731)" }}
                >
                  {(user.username || user.email || "U")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: "rgba(247,242,232,0.85)" }}>
                    {user.username || user.email || "Member"}
                  </p>
                  <p className="text-[10px] mt-[1px] truncate" style={{ color: "rgba(247,242,232,0.35)" }}>
                    {user.roles?.[0]?.name || "Member"}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => logout()}
              title="Sign out"
              className={cn(
                "w-full flex items-center gap-[10px] rounded-lg px-[10px] py-[9px] transition-all duration-200 hover:bg-[rgba(196,61,40,0.12)] group",
                collapsed && "justify-center"
              )}
            >
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(196,61,40,0.08)" }}
              >
                <LogOut
                  className="h-[14px] w-[14px] transition-colors"
                  style={{ color: "rgba(196,61,40,0.6)" }}
                />
              </span>
              {!collapsed && (
                <span
                  className="text-[13px] font-medium"
                  style={{ color: "rgba(196,61,40,0.65)" }}
                >
                  Sign out
                </span>
              )}
            </button>
          </>
        ) : (
          <div className={cn("px-[10px] py-3", collapsed && "flex justify-center")}>
            <span className="text-[13px]" style={{ color: "rgba(247,242,232,0.35)" }}>
              {collapsed ? "—" : "Not signed in"}
            </span>
          </div>
        )}
      </div>
    </aside>
  )
}
