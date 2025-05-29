"use client"

import type { ReactNode } from "react"
import { useRole } from "@/contexts/role-context"

interface RoleGuardProps {
  children: ReactNode
  roles?: string[]
  scopes?: string[]
  fallback?: ReactNode
  requireAll?: boolean
}

export function RoleGuard({ children, roles = [], scopes = [], fallback = null, requireAll = false }: RoleGuardProps) {
  const { hasRole, hasScope, hasAnyRole, hasAnyScope } = useRole()

  const hasRequiredRoles = requireAll ? roles.every((role) => hasRole(role)) : roles.length === 0 || hasAnyRole(roles)

  const hasRequiredScopes = requireAll
    ? scopes.every((scope) => hasScope(scope))
    : scopes.length === 0 || hasAnyScope(scopes)

  if (hasRequiredRoles && hasRequiredScopes) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
