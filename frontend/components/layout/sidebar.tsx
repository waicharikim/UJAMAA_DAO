"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useRole } from "@/contexts/role-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Vote,
  Briefcase,
  Users,
  Store,
  Landmark,
  User,
  Shield,
  MoreHorizontal,
} from "lucide-react"

const primaryNav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Governance", href: "/proposals", icon: Vote },
  { label: "Projects", href: "/projects", icon: Briefcase },
  { label: "Community", href: "/groups", icon: Users },
]

const secondaryNav = [
  { label: "Marketplace", href: "/marketplace", icon: Store },
  { label: "Treasury", href: "/treasury", icon: Landmark },
  { label: "Profile", href: "/profile", icon: User },
]

// Adinkra Gye Nyame motif in amber-on-tea-green
const ADINKRA_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cg fill='none' stroke='rgba(212,145,30,0.07)' stroke-width='1'%3E%3Ccircle cx='40' cy='40' r='28'/%3E%3Ccircle cx='40' cy='40' r='16'/%3E%3Cline x1='40' y1='12' x2='40' y2='0'/%3E%3Cline x1='40' y1='68' x2='40' y2='80'/%3E%3Cline x1='12' y1='40' x2='0' y2='40'/%3E%3Cline x1='68' y1='40' x2='80' y2='40'/%3E%3Cline x1='20' y1='20' x2='12' y2='12'/%3E%3Cline x1='60' y1='20' x2='68' y2='12'/%3E%3Cline x1='20' y1='60' x2='12' y2='68'/%3E%3Cline x1='60' y1='60' x2='68' y2='68'/%3E%3C/g%3E%3C/svg%3E")`

export function Sidebar() {
  const pathname = usePathname()
  const { user, isAuthenticated } = useAuth()
  const { hasAnyRole } = useRole()

  const showAdmin = hasAnyRole(["admin", "super_admin", "county_admin"])

  return (
    <aside
      className="hidden md:flex w-[272px] min-h-screen flex-col flex-shrink-0 relative overflow-hidden"
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

      {/* Logo */}
      <div
        className="relative z-10 flex items-center gap-[14px] px-6 py-8"
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
        <div className="flex flex-col">
          <span
            className="font-serif font-bold text-cream leading-none"
            style={{ fontSize: 20, letterSpacing: "0.3px" }}
          >
            UjamaaDAO
          </span>
          <span
            className="font-sans font-medium uppercase"
            style={{ fontSize: 9, color: "rgba(233,165,46,0.7)", letterSpacing: "1.5px", marginTop: 3 }}
          >
            Ward Platform
          </span>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="relative z-10 flex-1 flex flex-col px-[14px] pt-5 pb-4 gap-[2px] overflow-y-auto">
        <span
          className="px-[10px] pb-[6px] pt-3 text-[9px] font-bold tracking-[2px] uppercase"
          style={{ color: "rgba(247,242,232,0.25)" }}
        >
          Main
        </span>

        {primaryNav.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-[11px] px-3 py-[10px] rounded-lg overflow-hidden transition-all duration-200 group",
                active ? "bg-[rgba(212,145,30,0.12)]" : "hover:bg-[rgba(247,242,232,0.06)]"
              )}
            >
              {active && (
                <span
                  className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-sm"
                  style={{ background: "linear-gradient(to bottom, #D4911E, #E9A52E)" }}
                />
              )}
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200"
                style={{
                  background: active ? "rgba(212,145,30,0.18)" : "rgba(247,242,232,0.06)",
                }}
              >
                <Icon
                  className="h-[15px] w-[15px]"
                  style={{ color: active ? "#E9A52E" : "rgba(247,242,232,0.55)" }}
                />
              </span>
              <span
                className="text-[13.5px] font-medium transition-colors duration-200"
                style={{ color: active ? "#E9A52E" : "rgba(247,242,232,0.60)" }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}

        <span
          className="px-[10px] pb-[6px] pt-5 text-[9px] font-bold tracking-[2px] uppercase"
          style={{ color: "rgba(247,242,232,0.25)" }}
        >
          More
        </span>

        {secondaryNav.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-[11px] px-3 py-[10px] rounded-lg overflow-hidden transition-all duration-200",
                active ? "bg-[rgba(212,145,30,0.12)]" : "hover:bg-[rgba(247,242,232,0.06)]"
              )}
            >
              {active && (
                <span
                  className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-sm"
                  style={{ background: "linear-gradient(to bottom, #D4911E, #E9A52E)" }}
                />
              )}
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: active ? "rgba(212,145,30,0.18)" : "rgba(247,242,232,0.06)" }}
              >
                <Icon
                  className="h-[15px] w-[15px]"
                  style={{ color: active ? "#E9A52E" : "rgba(247,242,232,0.55)" }}
                />
              </span>
              <span
                className="text-[13.5px] font-medium"
                style={{ color: active ? "#E9A52E" : "rgba(247,242,232,0.60)" }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}

        {showAdmin && (
          <Link
            href="/admin"
            className={cn(
              "relative flex items-center gap-[11px] px-3 py-[10px] rounded-lg overflow-hidden transition-all duration-200",
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
                style={{
                  color: pathname.startsWith("/admin") ? "#E9A52E" : "rgba(247,242,232,0.55)",
                }}
              />
            </span>
            <span
              className="text-[13.5px] font-medium"
              style={{
                color: pathname.startsWith("/admin") ? "#E9A52E" : "rgba(247,242,232,0.60)",
              }}
            >
              Admin
            </span>
          </Link>
        )}
      </nav>

      {/* Sidebar footer — user card */}
      <div
        className="relative z-10 flex items-center gap-[10px] mx-1 mb-2 px-[14px] py-4 rounded-lg cursor-pointer transition-colors duration-200 hover:bg-[rgba(247,242,232,0.05)]"
        style={{ borderTop: "1px solid rgba(247,242,232,0.07)" }}
      >
        {isAuthenticated && user ? (
          <>
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
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate" style={{ color: "rgba(247,242,232,0.85)" }}>
                {user.username || user.email || "Member"}
              </p>
              <p className="text-[10px] mt-[1px] truncate" style={{ color: "rgba(247,242,232,0.35)" }}>
                {user.roles?.[0]?.name || "Member"}
              </p>
            </div>
            <MoreHorizontal
              className="h-[14px] w-[14px] flex-shrink-0"
              style={{ color: "rgba(247,242,232,0.25)" }}
            />
          </>
        ) : (
          <span className="text-[13px]" style={{ color: "rgba(247,242,232,0.35)" }}>
            Not signed in
          </span>
        )}
      </div>
    </aside>
  )
}
