"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ConnectWallet } from "@/components/auth/connect-wallet"
import { NotificationsPanel } from "@/components/notifications/notifications-panel"
import { useAuth } from "@/contexts/auth-context"
import { useRole } from "@/contexts/role-context"
import { cn } from "@/lib/utils"
import {
  Home,
  Vote,
  Users,
  FolderOpen,
  User,
  Settings,
  Menu,
  Coins,
  Award,
  Shield,
  BarChart3,
  Heart,
} from "lucide-react"

const navigationItems = [
  {
    title: "Home",
    href: "/",
    icon: Home,
    description: "Platform overview",
    public: true,
  },
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
    description: "Your personal dashboard",
    requiresAuth: true,
  },
  {
    title: "Proposals",
    href: "/proposals",
    icon: Vote,
    description: "Governance and voting",
    badge: "New",
    requiresAuth: true,
  },
  {
    title: "Projects",
    href: "/projects",
    icon: FolderOpen,
    description: "Project management",
    requiresAuth: true,
  },
  {
    title: "Groups",
    href: "/groups",
    icon: Users,
    description: "Community groups",
    requiresAuth: true,
  },
  {
    title: "Profile",
    href: "/profile",
    icon: User,
    description: "Your account settings",
    requiresAuth: true,
  },
]

export function Navigation() {
  const pathname = usePathname()
  const { user, isAuthenticated } = useAuth()
  const { hasAnyRole } = useRole()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Filter navigation items based on auth status
  const getVisibleNavigationItems = () => {
    const items = navigationItems.filter((item) => {
      if (item.public) return true
      if (item.requiresAuth && !isAuthenticated) return false
      return true
    })

    // Add admin navigation item if user has admin roles
    if (hasAnyRole(["admin", "super_admin", "county_admin"])) {
      items.push({
        title: "Admin",
        href: "/admin",
        icon: Shield,
        description: "System administration",
        badge: "Admin",
        requiresAuth: true,
      })
    }

    return items
  }

  const visibleItems = getVisibleNavigationItems()

  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn("flex gap-1", mobile ? "flex-col" : "flex-row")}>
      {visibleItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => mobile && setMobileMenuOpen(false)}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
              mobile ? "w-full justify-start" : "justify-center",
              isActive
                ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg"
                : "text-slate-600 hover:bg-orange-50 hover:text-orange-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
            )}
          >
            <Icon className={cn("h-4 w-4", isActive && "text-white")} />
            {mobile && (
              <>
                <div className="flex-1">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-xs opacity-70">{item.description}</div>
                </div>
                {item.badge && (
                  <Badge variant="secondary" className="text-xs">
                    {item.badge}
                  </Badge>
                )}
              </>
            )}
            {!mobile && item.badge && (
              <Badge variant="secondary" className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
                !
              </Badge>
            )}
            {!mobile && (
              <div className="absolute top-full left-1/2 mt-2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                <div className="bg-slate-900 text-white text-xs rounded-md px-2 py-1 whitespace-nowrap">
                  {item.title}
                </div>
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:bg-slate-950/80 dark:supports-[backdrop-filter]:bg-slate-950/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Heart className="h-4 w-4 text-white" />
              </div>
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 opacity-0 group-hover:opacity-20 transition-opacity duration-200" />
            </div>
            <div className="hidden sm:block">
              <div className="text-xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                UJAMAA
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">African Digital Community</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex">
            <NavItems />
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <>
                {/* User Stats - Desktop Only */}
                <div className="hidden lg:flex items-center gap-4 mr-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Award className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">{user?.impactPoints?.global || 0}</span>
                    <span className="text-slate-500">points</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Coins className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">{user?.tokenBalance || 0}</span>
                    <span className="text-slate-500">tokens</span>
                  </div>
                </div>

                {/* Notifications */}
                <NotificationsPanel />
              </>
            )}

            {/* Connect Wallet */}
            <ConnectWallet />

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 pb-6 border-b">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                      <Heart className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-lg">UJAMAA</div>
                      <div className="text-sm text-slate-500">African Digital Community</div>
                    </div>
                  </div>

                  {isAuthenticated && user && (
                    <div className="py-6 border-b">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-semibold">
                          {user.username?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div>
                          <div className="font-medium">{user.username || "User"}</div>
                          <div className="text-sm text-slate-500">{user.roles?.[0]?.name || "Member"}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <Award className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                          <div className="font-semibold">{user.impactPoints?.global || 0}</div>
                          <div className="text-xs text-slate-500">Impact Points</div>
                        </div>
                        <div className="text-center p-3 bg-yellow-50 rounded-lg">
                          <Coins className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                          <div className="font-semibold">{user.tokenBalance || 0}</div>
                          <div className="text-xs text-slate-500">Tokens</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <nav className="flex-1 py-6">
                    <NavItems mobile />
                  </nav>

                  {isAuthenticated && (
                    <div className="border-t pt-4">
                      <Link
                        href="/settings"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
