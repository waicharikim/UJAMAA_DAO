"use client"

import { useState, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/contexts/auth-context"
import { RoleProvider } from "@/contexts/role-context"
import { NotificationProvider } from "@/contexts/notification-context"
import { LanguageProvider } from "@/contexts/language-context"

// The wallet stack (wagmi + Coinbase Smart Wallet) is browser-only and uses
// WebAuthn/passkeys, so it must not run during SSR/static generation.
// next/dynamic with ssr:false keeps it client-only. Children always render
// (WalletContext has safe defaults so useWallet() works without a provider).
const WalletProvider = dynamic(
  () => import("@/contexts/wallet-context").then((m) => ({ default: m.WalletProvider })),
  { ssr: false },
)

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WalletProvider>
          <RoleProvider>
            <LanguageProvider>
              <NotificationProvider>{children}</NotificationProvider>
            </LanguageProvider>
          </RoleProvider>
        </WalletProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
