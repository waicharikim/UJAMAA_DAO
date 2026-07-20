"use client"

import { useEffect, type DependencyList } from "react"
import { useBottomNav, type ContextualNavItem } from "@/contexts/bottom-nav-context"

/**
 * Register a contextual bottom nav for the current page.
 * Items replace the global nav while this component is mounted.
 * Pass deps to re-register when active state or labels change.
 */
export function useContextualNav(
  getItems: () => ContextualNavItem[],
  deps: DependencyList = []
) {
  const { setContextualItems } = useBottomNav()

  useEffect(() => {
    setContextualItems(getItems())
    return () => setContextualItems(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
