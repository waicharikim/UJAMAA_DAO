"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useRole } from "@/contexts/role-context"
import { cn } from "@/lib/utils"
import {
  Home,
  Users,
  MoreHorizontal,
  Store,
  Landmark,
  User,
  Shield,
  X,
  BookOpen,
  AlertTriangle,
  Scale,
  Vote,
  Briefcase,
  Plus,
} from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

const primaryNav = [
  { label: "Home",       href: "/dashboard",  icon: Home         },
  { label: "Governance", href: "/proposals",  icon: Scale        },
  { label: "Emergency",  href: "/emergency",  icon: AlertTriangle },
  { label: "Profile",    href: "/profile",    icon: User         },
]

// Grouped drawer nav — each group has a label and items
const drawerGroups = [
  {
    label: "Community",
    items: [
      { label: "Groups",  href: "/groups",    icon: Users    },
      { label: "Learn",   href: "/education", icon: BookOpen },
    ],
  },
  {
    label: "Economy",
    items: [
      { label: "Treasury",    href: "/treasury",    icon: Landmark  },
      { label: "Marketplace", href: "/marketplace", icon: Store     },
      { label: "Projects",    href: "/projects",    icon: Briefcase },
    ],
  },
]

const FAB_ACTIONS = [
  { label: "Start a Proposal", href: "/proposals/create", icon: Vote,          color: "#C9922A", bg: "rgba(201,146,42,0.10)" },
  { label: "Report Emergency",  href: "/emergency",        icon: AlertTriangle, color: "#B03A1E", bg: "rgba(176,58,30,0.08)" },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { hasAnyRole } = useRole()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)
  const showAdmin = hasAnyRole(["super_admin", "compliance_officer", "ward_admin", "constituency_admin", "county_admin"])

  return (
    <>
      {/* "+" FAB — sits above the pill nav */}
      <button
        onClick={() => setFabOpen(true)}
        className="md:hidden fixed z-40 flex items-center justify-center rounded-full shadow-lg transition-all duration-200 active:scale-95"
        style={{
          bottom: "88px",
          right: "16px",
          width: 52,
          height: 52,
          background: "#1D4731",
          border: "1.5px solid rgba(212,145,30,0.40)",
          boxShadow: "0 6px 24px rgba(0,0,0,0.30), 0 0 0 1px rgba(212,145,30,0.15)",
        }}
        aria-label="Quick actions"
      >
        <Plus className="h-5 w-5" style={{ color: "#E9A52E" }} />
      </button>

      {/* FAB action sheet */}
      <Drawer open={fabOpen} onOpenChange={setFabOpen}>
        <DrawerContent
          className="rounded-t-[20px]"
          style={{ background: "#1D4731", border: "1px solid rgba(212,145,30,0.15)" }}
        >
          <DrawerHeader className="flex items-center justify-between px-6 pt-5 pb-3">
            <DrawerTitle className="font-serif text-cream text-lg">Quick Actions</DrawerTitle>
            <button
              onClick={() => setFabOpen(false)}
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(247,242,232,0.07)" }}
            >
              <X className="h-4 w-4 text-cream" />
            </button>
          </DrawerHeader>

          <div className="px-4 pb-10 grid grid-cols-2 gap-3 mt-1">
            {FAB_ACTIONS.map(({ label, href, icon: Icon, color, bg }) => (
              <button
                key={href}
                onClick={() => { setFabOpen(false); router.push(href) }}
                className="flex flex-col items-center justify-center gap-2.5 py-6 rounded-2xl transition-all duration-200 active:scale-95"
                style={{ background: bg, border: `1px solid ${color}30` }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${color}18` }}
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <span className="text-[13px] font-semibold text-center leading-tight" style={{ color: "rgba(247,242,232,0.85)" }}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Floating pill nav */}
      <nav
        className="md:hidden fixed bottom-6 left-4 right-4 z-50 flex items-center justify-around px-2 py-2 rounded-full"
        style={{
          background: "#1D4731",
          border: "1px solid rgba(212,145,30,0.3)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        {primaryNav.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center gap-[3px] px-4 py-2 rounded-full min-w-[52px] transition-all duration-200"
            >
              {active && (
                <span
                  className="absolute top-0 left-[25%] right-[25%] h-[3px] rounded-b-sm"
                  style={{ background: "linear-gradient(to right, #D4911E, #E9A52E)" }}
                />
              )}
              <Icon
                className="h-5 w-5"
                style={{ color: active ? "#E9A52E" : "rgba(247,242,232,0.50)" }}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: active ? "#E9A52E" : "rgba(247,242,232,0.40)" }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* More button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center justify-center gap-[3px] px-4 py-2 rounded-full min-w-[52px]"
        >
          <MoreHorizontal className="h-5 w-5" style={{ color: "rgba(247,242,232,0.50)" }} />
          <span className="text-[10px] font-medium" style={{ color: "rgba(247,242,232,0.40)" }}>
            More
          </span>
        </button>
      </nav>

      {/* More drawer — grouped by hub */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent
          className="rounded-t-[20px]"
          style={{ background: "#1D4731", border: "1px solid rgba(212,145,30,0.15)" }}
        >
          <DrawerHeader className="flex items-center justify-between px-6 pt-5 pb-2">
            <DrawerTitle className="font-serif text-cream text-lg">More</DrawerTitle>
            <button
              onClick={() => setDrawerOpen(false)}
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(247,242,232,0.07)" }}
            >
              <X className="h-4 w-4 text-cream" />
            </button>
          </DrawerHeader>

          <div className="px-4 pb-8 mt-2 space-y-4">
            {drawerGroups.map((group) => (
              <div key={group.label}>
                {/* Section header */}
                <p
                  className="px-1 pb-2 text-[9px] font-bold tracking-[2px] uppercase"
                  style={{ color: "rgba(233,165,46,0.55)" }}
                >
                  {group.label}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const active = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setDrawerOpen(false)}
                        className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl transition-all duration-200"
                        style={{
                          background: active ? "rgba(212,145,30,0.12)" : "rgba(247,242,232,0.04)",
                          border: active ? "1px solid rgba(212,145,30,0.3)" : "1px solid rgba(247,242,232,0.06)",
                        }}
                      >
                        <Icon className="h-5 w-5" style={{ color: active ? "#E9A52E" : "rgba(247,242,232,0.60)" }} />
                        <span className="text-[12px] font-medium" style={{ color: active ? "#E9A52E" : "rgba(247,242,232,0.60)" }}>
                          {item.label}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}

            {showAdmin && (
              <div>
                <p
                  className="px-1 pb-2 text-[9px] font-bold tracking-[2px] uppercase"
                  style={{ color: "rgba(233,165,46,0.55)" }}
                >
                  System
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Link
                    href="/admin"
                    onClick={() => setDrawerOpen(false)}
                    className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl transition-all duration-200"
                    style={{
                      background: pathname.startsWith("/admin") ? "rgba(212,145,30,0.12)" : "rgba(247,242,232,0.04)",
                      border: pathname.startsWith("/admin") ? "1px solid rgba(212,145,30,0.3)" : "1px solid rgba(247,242,232,0.06)",
                    }}
                  >
                    <Shield className="h-5 w-5" style={{ color: pathname.startsWith("/admin") ? "#E9A52E" : "rgba(247,242,232,0.60)" }} />
                    <span className="text-[12px] font-medium" style={{ color: pathname.startsWith("/admin") ? "#E9A52E" : "rgba(247,242,232,0.60)" }}>
                      Admin
                    </span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
