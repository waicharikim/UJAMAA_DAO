"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useRole } from "@/contexts/role-context"
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
  ChevronRight,
  Coins,
  Bell,
  MapPin,
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

const drawerGroups = [
  {
    label: "Community",
    color: "#2A6B7C",
    items: [
      { label: "My Ward", href: "/ward",      icon: MapPin   },
      { label: "Groups",  href: "/groups",    icon: Users    },
      { label: "Learn",   href: "/education", icon: BookOpen },
    ],
  },
  {
    label: "Economy",
    color: "#C9922A",
    items: [
      { label: "Economy",     href: "/economy",     icon: Coins     },
      { label: "Treasury",    href: "/treasury",    icon: Landmark  },
      { label: "Marketplace", href: "/marketplace", icon: Store     },
      { label: "Projects",    href: "/projects",    icon: Briefcase },
    ],
  },
]

const FAB_ACTIONS = [
  {
    label: "Start a Proposal",
    subtitle: "Bring a motion to your community",
    href: "/proposals/create",
    icon: Vote,
    color: "#C9922A",
    bg: "rgba(201,146,42,0.07)",
  },
  {
    label: "Report Emergency",
    subtitle: "Flag an urgent community issue",
    href: "/emergency",
    icon: AlertTriangle,
    color: "#B03A1E",
    bg: "rgba(176,58,30,0.07)",
  },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { hasAnyRole } = useRole()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const lastScrollY = useRef(0)
  const showAdmin = hasAnyRole(["super_admin", "compliance_officer", "ward_admin", "constituency_admin", "county_admin"])

  useEffect(() => {
    const main = document.querySelector("main")
    if (!main) return
    const onScroll = () => {
      const y = main.scrollTop
      if (y < 40) { setHidden(false); lastScrollY.current = y; return }
      if (y > lastScrollY.current + 6) setHidden(true)
      else if (y < lastScrollY.current - 6) setHidden(false)
      lastScrollY.current = y
    }
    main.addEventListener("scroll", onScroll, { passive: true })
    return () => main.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <>
      {/* "+" FAB — sits above the pill nav */}
      <button
        onClick={() => setFabOpen(true)}
        className="md:hidden fixed z-40 flex items-center justify-center rounded-full active:scale-95"
        style={{
          bottom: "88px",
          right: "16px",
          width: 52,
          height: 52,
          background: "linear-gradient(135deg, #1D4731 0%, #2A5C3F 100%)",
          border: "1.5px solid rgba(212,145,30,0.45)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.32), 0 0 0 1px rgba(212,145,30,0.12)",
          transform: hidden ? "translateY(160px)" : "translateY(0)",
          transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
        }}
        aria-label="Quick actions"
      >
        <Plus className="h-5 w-5" style={{ color: "#E9A52E" }} />
      </button>

      {/* FAB action sheet */}
      <Drawer open={fabOpen} onOpenChange={setFabOpen}>
        <DrawerContent
          className="rounded-t-[24px]"
          style={{ background: "#17382A", border: "1px solid rgba(212,145,30,0.12)" }}
        >
          <DrawerHeader className="flex items-center justify-between px-5 pt-6 pb-4">
            <div>
              <DrawerTitle className="font-serif text-cream text-[18px] leading-tight">Quick Actions</DrawerTitle>
              <p className="text-[12px] mt-0.5" style={{ color: "rgba(247,242,232,0.40)" }}>What would you like to do?</p>
            </div>
            <button
              onClick={() => setFabOpen(false)}
              className="h-8 w-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(247,242,232,0.07)", border: "1px solid rgba(247,242,232,0.06)" }}
            >
              <X className="h-3.5 w-3.5 text-cream opacity-60" />
            </button>
          </DrawerHeader>

          <div className="px-4 pb-10 space-y-2.5 mt-1">
            {FAB_ACTIONS.map(({ label, subtitle, href, icon: Icon, color, bg }) => (
              <button
                key={href}
                onClick={() => { setFabOpen(false); router.push(href) }}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-150 active:scale-[0.98]"
                style={{ background: bg, border: `1px solid ${color}22` }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}20` }}
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[14px] font-semibold" style={{ color: "rgba(247,242,232,0.95)" }}>{label}</p>
                  <p className="text-[12px] mt-0.5" style={{ color: "rgba(247,242,232,0.45)" }}>{subtitle}</p>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: "rgba(247,242,232,0.25)" }} />
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Floating pill nav */}
      <nav
        className="md:hidden fixed bottom-5 left-4 right-4 z-50 flex items-center justify-around px-1 py-1.5 rounded-full"
        style={{
          background: "linear-gradient(135deg, #1D4731 0%, #1A3D2B 100%)",
          border: "1px solid rgba(212,145,30,0.28)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.38), 0 4px 16px rgba(0,0,0,0.20)",
          transform: hidden ? "translateY(120px)" : "translateY(0)",
          transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {primaryNav.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center gap-[3px] px-3.5 py-2 rounded-full min-w-[60px] transition-all duration-200"
              style={{
                background: active ? "rgba(233,165,46,0.14)" : "transparent",
              }}
            >
              <Icon
                className="h-[18px] w-[18px]"
                style={{ color: active ? "#E9A52E" : "rgba(247,242,232,0.48)" }}
              />
              <span
                className="text-[10px] font-semibold"
                style={{ color: active ? "#E9A52E" : "rgba(247,242,232,0.38)" }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* More button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center justify-center gap-[3px] px-3.5 py-2 rounded-full min-w-[60px] transition-all duration-200"
        >
          <MoreHorizontal className="h-[18px] w-[18px]" style={{ color: "rgba(247,242,232,0.48)" }} />
          <span className="text-[10px] font-semibold" style={{ color: "rgba(247,242,232,0.38)" }}>
            More
          </span>
        </button>
      </nav>

      {/* More drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent
          className="rounded-t-[24px]"
          style={{ background: "#17382A", border: "1px solid rgba(212,145,30,0.12)" }}
        >
          <DrawerHeader className="flex items-center justify-between px-5 pt-6 pb-4">
            <DrawerTitle className="font-serif text-cream text-[18px]">More</DrawerTitle>
            <button
              onClick={() => setDrawerOpen(false)}
              className="h-8 w-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(247,242,232,0.07)", border: "1px solid rgba(247,242,232,0.06)" }}
            >
              <X className="h-3.5 w-3.5 text-cream opacity-60" />
            </button>
          </DrawerHeader>

          <div className="px-4 pb-10 mt-1 space-y-5">
            {drawerGroups.map((group) => (
              <div key={group.label}>
                <p
                  className="px-1 pb-2 text-[9px] font-bold tracking-[2.5px] uppercase"
                  style={{ color: `${group.color}99` }}
                >
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const active = pathname === item.href
                    const tint = group.color
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setDrawerOpen(false)}
                        className="flex items-center gap-3.5 px-2 py-3 rounded-xl transition-all duration-150 active:scale-[0.99]"
                        style={{
                          background: active ? `${tint}18` : "transparent",
                        }}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            background: active ? `${tint}28` : `${tint}18`,
                          }}
                        >
                          <Icon
                            className="h-[18px] w-[18px]"
                            style={{ color: active ? "#E9A52E" : tint }}
                          />
                        </div>
                        <span
                          className="flex-1 text-[14px] font-medium"
                          style={{ color: active ? "#E9A52E" : "rgba(247,242,232,0.78)" }}
                        >
                          {item.label}
                        </span>
                        <ChevronRight
                          className="h-4 w-4 flex-shrink-0"
                          style={{ color: "rgba(247,242,232,0.20)" }}
                        />
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}

            {showAdmin && (
              <div>
                <p
                  className="px-1 pb-2 text-[9px] font-bold tracking-[2.5px] uppercase"
                  style={{ color: "rgba(233,165,46,0.45)" }}
                >
                  System
                </p>
                <div className="space-y-0.5">
                  <Link
                    href="/admin"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3.5 px-2 py-3 rounded-xl transition-all duration-150"
                    style={{
                      background: pathname.startsWith("/admin") ? "rgba(212,145,30,0.10)" : "transparent",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: pathname.startsWith("/admin") ? "rgba(212,145,30,0.18)" : "rgba(247,242,232,0.07)",
                      }}
                    >
                      <Shield
                        className="h-[18px] w-[18px]"
                        style={{ color: pathname.startsWith("/admin") ? "#E9A52E" : "rgba(247,242,232,0.60)" }}
                      />
                    </div>
                    <span
                      className="flex-1 text-[14px] font-medium"
                      style={{ color: pathname.startsWith("/admin") ? "#E9A52E" : "rgba(247,242,232,0.78)" }}
                    >
                      Admin
                    </span>
                    <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: "rgba(247,242,232,0.20)" }} />
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
