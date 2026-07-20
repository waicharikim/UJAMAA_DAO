"use client"

import { createContext, useContext, useState, type ReactNode, type ElementType } from "react"

export interface ContextualNavItem {
  key: string
  label: string
  icon: ElementType
  href?: string
  onClick?: () => void
  active?: boolean
  badge?: number
}

interface BottomNavContextValue {
  contextualItems: ContextualNavItem[] | null
  setContextualItems: (items: ContextualNavItem[] | null) => void
}

const BottomNavContext = createContext<BottomNavContextValue>({
  contextualItems: null,
  setContextualItems: () => {},
})

export function BottomNavProvider({ children }: { children: ReactNode }) {
  const [contextualItems, setContextualItems] = useState<ContextualNavItem[] | null>(null)
  return (
    <BottomNavContext.Provider value={{ contextualItems, setContextualItems }}>
      {children}
    </BottomNavContext.Provider>
  )
}

export function useBottomNav() {
  return useContext(BottomNavContext)
}
