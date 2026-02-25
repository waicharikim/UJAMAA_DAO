"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { MobileBottomNav } from "./mobile-bottom-nav"

interface AppShellProps {
  children: ReactNode
}

// Routes that render full-width without the app chrome
const PUBLIC_ROUTES = ["/", "/about", "/auth/register", "/auth/callback"]

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()

  if (PUBLIC_ROUTES.includes(pathname)) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#F4EFE6" }}>
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        {/* Page content — extra bottom padding on mobile for pill nav */}
        <main className="flex-1 overflow-y-auto pb-28 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile floating pill nav */}
      <MobileBottomNav />
    </div>
  )
}
