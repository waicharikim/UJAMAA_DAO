"use client"

/**
 * WalletContext — wraps Privy for onchain wallet connectivity.
 *
 * Env var required: NEXT_PUBLIC_PRIVY_APP_ID
 * Get yours at https://dashboard.privy.io
 *
 * When the App ID is present the real PrivyProvider is rendered.
 * When it is missing, a graceful stub is shown instead (build still works).
 *
 * ADR-009: Privy chosen (phone-primary, zero-crypto UX, gasless Pimlico, Base)
 */

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react"
import {
  PrivyProvider,
  usePrivy,
  useWallets,
  useConnectWallet,
  useLogout,
} from "@privy-io/react-auth"
import { useToast } from "@/hooks/use-toast"

// ── Shared interface ──────────────────────────────────────────────────────────

export interface WalletContextType {
  /** Primary connected wallet address, or null */
  walletAddress: string | null
  /** True when at least one wallet is connected */
  isConnected: boolean
  /** True while Privy is still initialising */
  isConnecting: boolean
  /** Open the Privy connect / create wallet modal */
  connectWallet: () => Promise<void>
  /** Disconnect wallet (logs out of Privy; UjamaaDAO session stays) */
  disconnectWallet: () => Promise<void>
}

const WalletContext = createContext<WalletContextType>({
  walletAddress: null,
  isConnected: false,
  isConnecting: false,
  connectWallet: async () => {},
  disconnectWallet: async () => {},
})

// ── Stub — no Privy App ID ────────────────────────────────────────────────────

function StubWalletProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()

  const connectWallet = useCallback(async () => {
    toast({
      title: "Wallet not configured",
      description:
        "Add NEXT_PUBLIC_PRIVY_APP_ID to frontend/.env.local to enable wallet connection.",
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

// ── Real Privy adapter ────────────────────────────────────────────────────────

function PrivyWalletAdapter({ children }: { children: ReactNode }) {
  const { ready } = usePrivy()
  const { wallets } = useWallets()
  const { connectWallet: privyConnect } = useConnectWallet()
  const { logout } = useLogout()

  const walletAddress = wallets[0]?.address ?? null
  const isConnected = wallets.length > 0
  const isConnecting = !ready

  const connectWallet = useCallback(async () => {
    privyConnect()
  }, [privyConnect])

  const disconnectWallet = useCallback(async () => {
    await logout()
  }, [logout])

  return (
    <WalletContext.Provider
      value={{ walletAddress, isConnected, isConnecting, connectWallet, disconnectWallet }}
    >
      {children}
    </WalletContext.Provider>
  )
}

// ── Provider (auto-selects real vs stub) ──────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  if (!appId) {
    return <StubWalletProvider>{children}</StubWalletProvider>
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // Appearance — matches Chai palette
        appearance: {
          theme: "dark",
          accentColor: "#D4911E",
        },
        // Login options shown in the Privy modal
        loginMethods: ["email", "wallet", "google"],
        // Auto-create an embedded wallet for users who log in without one
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      <PrivyWalletAdapter>{children}</PrivyWalletAdapter>
    </PrivyProvider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWallet(): WalletContextType {
  return useContext(WalletContext)
}
