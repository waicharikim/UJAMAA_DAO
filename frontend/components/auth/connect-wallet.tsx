"use client"

import { useState } from "react"
import { useConnect, useDisconnect } from "@/lib/wagmi"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { formatAddress } from "@/lib/utils"
import { Wallet, LogOut, User } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function ConnectWallet() {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { user, isAuthenticated, login, logout, isLoading } = useAuth()

  const handleConnect = async (connector: any) => {
    try {
      connect(connector)
      // Mock connection for demonstration
      setIsConnected(true)
      setAddress("0x1234567890123456789012345678901234567890")
    } catch (error) {
      console.error("Failed to connect wallet:", error)
    }
  }

  const handleLogin = async () => {
    if (address) {
      await login(address)
    }
  }

  const handleLogout = () => {
    logout()
    disconnect()
    setIsConnected(false)
    setAddress(null)
  }

  if (isLoading || isPending) {
    return (
      <Button disabled>
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading...
      </Button>
    )
  }

  if (!isConnected) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            <Wallet className="h-4 w-4 mr-2" />
            Connect Wallet
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {connectors.map((connector) => (
            <DropdownMenuItem key={connector.id} onClick={() => handleConnect(connector)} className="cursor-pointer">
              {connector.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (isConnected && !isAuthenticated) {
    return (
      <Button onClick={handleLogin}>
        <User className="h-4 w-4 mr-2" />
        Sign In
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={user?.avatar || "/placeholder.svg"} />
            <AvatarFallback>{user?.username?.[0]?.toUpperCase() || formatAddress(address || "")[0]}</AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline">{user?.username || formatAddress(address || "")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <User className="h-4 w-4 mr-2" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
