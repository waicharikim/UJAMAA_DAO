"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { User as UserIcon, Wallet, LogOut, Copy, Check, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useWallet } from "@/contexts/wallet-context"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/**
 * Account menu — the top-right avatar that consolidates profile, wallet, and
 * sign-out into a single dropdown (the familiar "normal app" pattern), replacing
 * the standalone wallet button and the Profile tab in the bottom nav.
 */
export function AccountMenu() {
  const router = useRouter()
  const { user, logout, refreshUser } = useAuth()
  const { walletAddress, isConnected, isConnecting, connectWallet, linkAccount, disconnectWallet } =
    useWallet()
  const [copied, setCopied] = useState(false)
  const [linking, setLinking] = useState(false)

  const displayName = user?.username ?? user?.email ?? "Account"
  const initial = (displayName[0] ?? "U").toUpperCase()

  // Backend-linked = the session has this wallet bound to it.
  const isLinked = isConnected && !!user?.walletAddress

  // Step 1 — connect only (its own click → its own popup).
  const handleConnect = async () => {
    await connectWallet()
  }

  // Step 2 — sign + link (a separate click → a separate popup), then refresh so
  // walletAddress + verificationLevel propagate to the auth context.
  const handleFinish = async () => {
    setLinking(true)
    try {
      await linkAccount()
      setTimeout(() => refreshUser().catch(() => {}), 1200)
    } finally {
      setLinking(false)
    }
  }

  const handleCopy = async () => {
    if (!walletAddress) return
    await navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSignOut = async () => {
    await logout()
    router.push("/")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center rounded-full transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9922A]/50"
          aria-label="Account menu"
        >
          <Avatar className="h-8 w-8 border border-[rgba(29,71,49,0.15)]">
            {user?.avatar && <AvatarImage src={user.avatar} alt={displayName} />}
            <AvatarFallback
              className="text-[12px] font-bold"
              style={{ background: "rgba(29,71,49,0.10)", color: "#1D4731" }}
            >
              {initial}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {/* Identity header */}
        <DropdownMenuLabel className="flex items-center gap-2.5 py-2">
          <Avatar className="h-9 w-9">
            {user?.avatar && <AvatarImage src={user.avatar} alt={displayName} />}
            <AvatarFallback
              className="text-[13px] font-bold"
              style={{ background: "rgba(29,71,49,0.10)", color: "#1D4731" }}
            >
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#0E0B08] truncate">{displayName}</p>
            {user?.email && (
              <p className="text-[11px] font-normal text-[#0E0B08]/50 truncate">{user.email}</p>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/profile">
            <UserIcon className="h-4 w-4 mr-2" />
            Profile
          </Link>
        </DropdownMenuItem>

        {/* Wallet — 3-state: connect (popup 1) → finish setup (popup 2) → linked */}
        {isLinked ? (
          <>
            <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
              <span
                className="h-2 w-2 rounded-full mr-2 flex-shrink-0"
                style={{ background: "#38A063", boxShadow: "0 0 6px rgba(56,160,99,0.6)" }}
              />
              <span className="flex-1 font-mono text-[12px]">
                {walletAddress ? shortAddress(walletAddress) : "Wallet"}
              </span>
              {copied ? <Check className="h-3.5 w-3.5 text-leaf" /> : <Copy className="h-3.5 w-3.5 opacity-60" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={disconnectWallet} className="cursor-pointer text-ember">
              <Wallet className="h-4 w-4 mr-2" />
              Disconnect wallet
            </DropdownMenuItem>
          </>
        ) : isConnected ? (
          // Connected but not yet linked — step 2 (its own click → sign popup)
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              handleFinish()
            }}
            disabled={linking}
            className="cursor-pointer"
          >
            {linking ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wallet className="h-4 w-4 mr-2" />
            )}
            {linking ? "Finishing…" : "Finish wallet setup"}
          </DropdownMenuItem>
        ) : (
          // Not connected — step 1 (its own click → connect popup)
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              handleConnect()
            }}
            disabled={isConnecting}
            className="cursor-pointer"
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wallet className="h-4 w-4 mr-2" />
            )}
            {isConnecting ? "Connecting…" : "Connect wallet"}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-ember">
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
