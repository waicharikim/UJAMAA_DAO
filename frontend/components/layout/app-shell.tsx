"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { MobileBottomNav } from "./mobile-bottom-nav"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"

interface AppShellProps {
  children: ReactNode
}

// Routes that render full-width without the app chrome
const PUBLIC_ROUTES = ["/", "/about", "/auth/register", "/auth/callback", "/dev/login"]

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  if (PUBLIC_ROUTES.includes(pathname)) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#F7F2E8" }}>
      {/* Desktop sidebar */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        {/* Page content — extra bottom padding on mobile for pill nav */}
        <main className="flex-1 overflow-y-auto pb-28 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile floating pill nav */}
      <MobileBottomNav />

      {/* First-time walkthrough wizard — shown once to new users; sets both wizard + audit-gate keys */}
      <OnboardingWizard />
    </div>
  )
}
