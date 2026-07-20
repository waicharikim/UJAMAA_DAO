// @ts-nocheck — scaffold: stale types, alignment deferred
"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useAuth } from "./auth-context"
import type { Role } from "@/lib/types"

interface RoleContextType {
  hasRole: (roleName: string) => boolean
  hasScope: (scope: string) => boolean
  hasAnyRole: (roleNames: string[]) => boolean
  hasAnyScope: (scopes: string[]) => boolean
  userRoles: Role[]
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const userRoles = user?.roles || [
    {
      id: "1",
      name: "User",
      scopes: ["profile:read", "profile:write", "groups:read", "proposals:read", "proposals:create", "proposals:vote"],
    },
  ]

  // Normalize role names: strip namespace prefix so "super_admin" matches "system:super_admin"
  const normalizeRole = (name: string) => name.includes(":") ? name.split(":")[1] : name

  const hasRole = (roleName: string): boolean => {
    const normalized = normalizeRole(roleName)
    return userRoles.some((role) => normalizeRole(role.name) === normalized)
  }

  const hasScope = (scope: string): boolean => {
    return userRoles.some((role) => role.scopes.includes(scope))
  }

  const hasAnyRole = (roleNames: string[]): boolean => {
    return roleNames.some((roleName) => hasRole(roleName))
  }

  const hasAnyScope = (scopes: string[]): boolean => {
    return scopes.some((scope) => hasScope(scope))
  }

  return (
    <RoleContext.Provider
      value={{
        hasRole,
        hasScope,
        hasAnyRole,
        hasAnyScope,
        userRoles,
      }}
    >
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const context = useContext(RoleContext)
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider")
  }
  return context
}
