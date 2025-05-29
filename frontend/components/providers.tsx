"use client"

import type React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/contexts/auth-context"
import { RoleProvider } from "@/contexts/role-context"
import { NotificationProvider } from "@/contexts/notification-context"
import { useState } from "react"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RoleProvider>
          <NotificationProvider>{children}</NotificationProvider>
        </RoleProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
