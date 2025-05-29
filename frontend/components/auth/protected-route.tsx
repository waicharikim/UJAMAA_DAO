"use client"

import type { ReactNode } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRole } from "@/contexts/role-context"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

interface ProtectedRouteProps {
  children: ReactNode
  requireAuth?: boolean
  requiredRoles?: string[]
  requiredScopes?: string[]
  fallback?: ReactNode
}

export function ProtectedRoute({
  children,
  requireAuth = true,
  requiredRoles = [],
  requiredScopes = [],
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const { hasAnyRole, hasAnyScope } = useRole()

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (requireAuth && !isAuthenticated) {
    return (
      fallback || (
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
            <p className="text-slate-600">Please connect your wallet to access this content.</p>
          </CardContent>
        </Card>
      )
    )
  }

  if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    return (
      fallback || (
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-slate-600">You don't have the required role to access this content.</p>
          </CardContent>
        </Card>
      )
    )
  }

  if (requiredScopes.length > 0 && !hasAnyScope(requiredScopes)) {
    return (
      fallback || (
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Insufficient Permissions</h3>
            <p className="text-slate-600">You don't have the required permissions to access this content.</p>
          </CardContent>
        </Card>
      )
    )
  }

  return <>{children}</>
}
