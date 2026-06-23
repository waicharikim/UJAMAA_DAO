"use client"

/**
 * WalletContext — Coinbase Smart Wallet (passkey-secured self-custody).
 *
 * The signer is the user's device passkey (Face ID / fingerprint); the platform
 * never holds a key and cannot sign for them. Magic-link stays the primary auth;
 * the smart account links to the session via /auth/wallet/link.
 *
 * POPUP RULE: Coinbase opens a popup (keys.coinbase.com) for connect and sign,
 * and browsers only allow a popup that is triggered DIRECTLY by a user gesture.
 * So the whole connect→sign→link sequence runs inside ONE click handler
 * (`connectWallet`), never from a background effect. There is no deploy popup:
 * the backend verifies counterfactual (undeployed) accounts via ERC-6492, so the
 * account never has to be deployed before linking.
 */

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react"
import {
  WagmiProvider,
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
} from "wagmi"
import { wagmiConfig } from "@/lib/wagmi"
import { authApi, tokenStore } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

// ── Shared interface (unchanged — consumers rely on this shape) ───────────────

export interface WalletContextType {
  /** Primary connected smart-account address, or null */
  walletAddress: string | null
  /** True when a smart account is connected */
  isConnected: boolean
  /** True while a connection is in flight */
  isConnecting: boolean
  /** Step 1: connect the Coinbase Smart Wallet (popup 1). Call from a click. */
  connectWallet: () => Promise<void>
  /** Step 2: sign the nonce + link to the session (popup 2). Call from a click. */
  linkAccount: () => Promise<void>
  /** Disconnect the smart account (UjamaaDAO session stays) */
  disconnectWallet: () => Promise<void>
}

const WalletContext = createContext<WalletContextType>({
  walletAddress: null,
  isConnected: false,
  isConnecting: false,
  connectWallet: async () => {},
  linkAccount: async () => {},
  disconnectWallet: async () => {},
})

// ── Inner adapter (inside WagmiProvider) ──────────────────────────────────────

function WalletAdapter({ children }: { children: ReactNode }) {
  const { address, isConnected, isConnecting } = useAccount()
  const { connectAsync, connectors } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const { login } = useAuth()

  // Step 1 — connect only (popup 1). Two-click flow: this is its own gesture, so
  // the connect popup is reliably allowed. No sign here.
  const connectWallet = useCallback(async () => {
    try {
      if (!isConnected) {
        await connectAsync({ connector: connectors[0] })
      }
    } catch (err: any) {
      console.warn("[wallet] connect failed", err)
    }
  }, [isConnected, connectAsync, connectors])

  // Step 2 — sign the nonce + link (popup 2). Its own gesture (a separate button
  // click), so the sign popup is reliably allowed. Device-passkey sig is verified
  // by the backend (ERC-1271/6492 — no deploy needed).
  const linkAccount = useCallback(async () => {
    const addr = address as string | undefined
    if (!addr) return
    try {
      const { message } = await authApi.getWalletNonce(addr)
      const signature = await signMessageAsync({ message })
      if (!tokenStore.getAccess()) {
        await login(addr, signature)
      } else {
        await authApi.linkWallet(addr, signature)
      }
    } catch (err: any) {
      // 409 = already linked — fine. Anything else surfaces upstream.
      if (err?.status !== 409) {
        console.warn("[wallet] link failed", err)
      }
    }
  }, [address, signMessageAsync, login])

  const disconnectWallet = useCallback(async () => {
    await disconnectAsync()
  }, [disconnectAsync])

  return (
    <WalletContext.Provider
      value={{
        walletAddress: address ?? null,
        isConnected,
        isConnecting,
        connectWallet,
        linkAccount,
        disconnectWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <WalletAdapter>{children}</WalletAdapter>
    </WagmiProvider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWallet(): WalletContextType {
  return useContext(WalletContext)
}
