"use client"

/**
 * WalletContext — wraps Privy wallet functionality.
 *
 * Requires env var: NEXT_PUBLIC_PRIVY_APP_ID
 * Get your App ID from https://dashboard.privy.io
 *
 * When the App ID is missing the context returns safe defaults
 * and connectWallet() shows an actionable error toast.
 */

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react"
import { useToast } from "@/hooks/use-toast"

export interface WalletContextType {
  /** Connected wallet address, or null if not connected */
  walletAddress: string | null
  /** Whether a wallet is currently connected */
  isConnected: boolean
  /** Whether a wallet connection is in progress */
  isConnecting: boolean
  /** Open the Privy connect modal */
  connectWallet: () => Promise<void>
  /** Disconnect current wallet */
  disconnectWallet: () => Promise<void>
}

const WalletContext = createContext<WalletContextType>({
  walletAddress: null,
  isConnected: false,
  isConnecting: false,
  connectWallet: async () => {},
  disconnectWallet: async () => {},
})

/**
 * If Privy is not installed yet we export a stub provider
 * that renders children and provides the safe default context above.
 */
function StubWalletProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()

  const connectWallet = useCallback(async () => {
    toast({
      title: "Wallet connection",
      description:
        "Add NEXT_PUBLIC_PRIVY_APP_ID to .env.local to enable wallet connection. Get your key at dashboard.privy.io",
      variant: "destructive",
    })
  }, [toast])

  return (
    <WalletContext.Provider
      value={{
        walletAddress: null,
        isConnected: false,
        isConnecting: false,
        connectWallet,
        disconnectWallet: async () => {},
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

/**
 * When NEXT_PUBLIC_PRIVY_APP_ID is set, swap StubWalletProvider
 * for the real Privy implementation (see wallet-context.privy.tsx).
 * For now exports the stub so the app builds and runs without Privy.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  return <StubWalletProvider>{children}</StubWalletProvider>
}

export function useWallet(): WalletContextType {
  return useContext(WalletContext)
}
