"use client"

import { useState } from "react"
import { useWallet } from "@/contexts/wallet-context"
import { useAuth } from "@/contexts/auth-context"
import { userApi } from "@/lib/api"
import {
  Wallet,
  Loader2,
  Copy,
  LogOut,
  Check,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function WalletButton() {
  const { walletAddress, isConnected, isConnecting, connectWallet, disconnectWallet } = useWallet()
  const { refreshUser } = useAuth()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!walletAddress) return
    await navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConnect = async () => {
    await connectWallet()
    // Give the auto-link effect a moment to save the wallet to the backend,
    // then refresh so walletAddress + verificationLevel propagate to auth context.
    setTimeout(() => refreshUser().catch(() => {}), 1500)
  }

  if (isConnected && walletAddress) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all hover:scale-[1.02]"
            style={{
              background: "rgba(56,160,99,0.12)",
              border: "1px solid rgba(56,160,99,0.25)",
              color: "#38A063",
            }}
          >
            {/* Green dot */}
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: "#38A063", boxShadow: "0 0 6px rgba(56,160,99,0.6)" }}
            />
            {shortAddress(walletAddress)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
            {copied ? (
              <><Check className="h-4 w-4 mr-2 text-leaf" />Copied!</>
            ) : (
              <><Copy className="h-4 w-4 mr-2" />Copy address</>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={disconnectWallet}
            className="cursor-pointer text-ember"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all hover:scale-[1.02] disabled:opacity-60"
      style={{
        background: "rgba(212,145,30,0.10)",
        border: "1px solid rgba(212,145,30,0.25)",
        color: "#D4911E",
      }}
    >
      {isConnecting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Wallet className="h-3.5 w-3.5" />
      )}
      {isConnecting ? "Connecting…" : "Connect Wallet"}
    </button>
  )
}
