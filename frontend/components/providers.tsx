"use client"

import { useState, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/contexts/auth-context"
import { RoleProvider } from "@/contexts/role-context"
import { NotificationProvider } from "@/contexts/notification-context"

// @privy-io/react-auth calls useContext at module-load time which breaks
// SSR/static-generation. next/dynamic with ssr:false ensures the module is
// never evaluated on the server. Children always render (WalletContext has
// safe defaults so useWallet() works without a provider during SSR).
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
            <NotificationProvider>{children}</NotificationProvider>
          </RoleProvider>
        </WalletProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
