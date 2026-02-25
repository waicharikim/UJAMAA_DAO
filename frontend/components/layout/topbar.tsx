"use client"

import { usePathname } from "next/navigation"
import { Bell } from "lucide-react"
import { ConnectWallet } from "@/components/auth/connect-wallet"
import { Button } from "@/components/ui/button"

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/proposals": "Governance",
  "/projects": "Projects",
  "/groups": "Community",
  "/marketplace": "Marketplace",
  "/treasury": "Treasury",
  "/profile": "Profile",
  "/admin": "Administration",
}

function resolveTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  for (const [prefix, label] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(prefix + "/")) return label
  }
  return "UjamaaDAO"
}

export function Topbar() {
  const pathname = usePathname()
  const title = resolveTitle(pathname)

  return (
    <header
      className="sticky top-0 z-40 flex h-[52px] items-center gap-4 px-6 md:px-7 flex-shrink-0"
      style={{
        background: "rgba(250,247,242,0.88)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(14,11,8,0.06)",
      }}
    >
      {/* Page title */}
      <h1 className="font-display font-semibold text-[18px] text-[#0E0B08] leading-none tracking-tight flex-1">
        {title}
      </h1>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <Button
          variant="ghost"
          size="sm"
          className="relative h-8 w-8 p-0 rounded-lg hover:bg-[rgba(201,146,42,0.08)]"
          aria-label="Notifications"
        >
          <Bell className="h-[17px] w-[17px] text-[#0E0B08]" />
          {/* Ember dot */}
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ background: "#B03A1E" }}
          />
        </Button>

        <ConnectWallet />
      </div>
    </header>
  )
}
