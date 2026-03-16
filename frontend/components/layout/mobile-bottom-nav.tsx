"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRole } from "@/contexts/role-context"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Vote,
  Briefcase,
  Users,
  MoreHorizontal,
  Store,
  Landmark,
  User,
  Shield,
  X,
  BookOpen,
} from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

const primaryNav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Governance", href: "/proposals", icon: Vote },
  { label: "Projects", href: "/projects", icon: Briefcase },
  { label: "Community", href: "/groups", icon: Users },
]

const drawerNav = [
  { label: "Learn", href: "/education", icon: BookOpen },
  { label: "Marketplace", href: "/marketplace", icon: Store },
  { label: "Treasury", href: "/treasury", icon: Landmark },
  { label: "Profile", href: "/profile", icon: User },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const { hasAnyRole } = useRole()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const showAdmin = hasAnyRole(["admin", "super_admin", "county_coordinator", "compliance_officer"])

  return (
    <>
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
          className={cn(
            "flex flex-col items-center justify-center gap-[3px] px-4 py-2 rounded-full min-w-[52px] transition-all duration-200"
          )}
        >
          <MoreHorizontal className="h-5 w-5" style={{ color: "rgba(247,242,232,0.50)" }} />
          <span className="text-[10px] font-medium" style={{ color: "rgba(247,242,232,0.40)" }}>
            More
          </span>
        </button>
      </nav>

      {/* More drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent
          className="rounded-t-[20px]"
          style={{ background: "#1D4731", border: "1px solid rgba(212,145,30,0.15)" }}
        >
          <DrawerHeader className="flex items-center justify-between px-6 pt-5 pb-2">
            <DrawerTitle className="font-serif text-cream text-lg">More</DrawerTitle>
            <button
              onClick={() => setDrawerOpen(false)}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "rgba(247,242,232,0.07)" }}
            >
              <X className="h-4 w-4 text-cream" />
            </button>
          </DrawerHeader>

          <div className="px-4 pb-8 grid grid-cols-3 gap-3 mt-2">
            {drawerNav.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  className="flex flex-col items-center justify-center gap-2 py-5 rounded-xl transition-all duration-200"
                  style={{
                    background: active ? "rgba(212,145,30,0.12)" : "rgba(247,242,232,0.04)",
                    border: active ? "1px solid rgba(212,145,30,0.3)" : "1px solid rgba(247,242,232,0.06)",
                  }}
                >
                  <Icon
                    className="h-5 w-5"
                    style={{ color: active ? "#E9A52E" : "rgba(247,242,232,0.60)" }}
                  />
                  <span
                    className="text-[12px] font-medium"
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
                onClick={() => setDrawerOpen(false)}
                className="flex flex-col items-center justify-center gap-2 py-5 rounded-xl transition-all duration-200"
                style={{
                  background: pathname.startsWith("/admin")
                    ? "rgba(212,145,30,0.12)"
                    : "rgba(247,242,232,0.04)",
                  border: pathname.startsWith("/admin")
                    ? "1px solid rgba(212,145,30,0.3)"
                    : "1px solid rgba(247,242,232,0.06)",
                }}
              >
                <Shield
                  className="h-5 w-5"
                  style={{
                    color: pathname.startsWith("/admin") ? "#E9A52E" : "rgba(247,242,232,0.60)",
                  }}
                />
                <span
                  className="text-[12px] font-medium"
                  style={{
                    color: pathname.startsWith("/admin") ? "#E9A52E" : "rgba(247,242,232,0.60)",
                  }}
                >
                  Admin
                </span>
              </Link>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
