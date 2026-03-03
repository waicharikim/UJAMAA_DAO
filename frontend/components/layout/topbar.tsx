"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeft } from "lucide-react"
import { WalletButton } from "@/components/auth/wallet-button"
import { Button } from "@/components/ui/button"
import { NotificationsPopover } from "./notifications-popover"
import { useAuth } from "@/contexts/auth-context"

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

interface TopbarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Topbar({ collapsed, onToggle }: TopbarProps) {
  const pathname = usePathname()
  const title = resolveTitle(pathname)
  const { isAuthenticated } = useAuth()

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
      {/* Sidebar toggle — only shown on md+ when sidebar is collapsed */}
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

      {/* Page title */}
      <h1 className="font-serif font-semibold text-[18px] text-chai leading-none tracking-tight flex-1">
        {title}
      </h1>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <>
            <NotificationsPopover />
            <WalletButton />
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
