"use client"

import { useEffect, useRef, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { onboardingApi } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import type { TourStep } from "@/lib/tours/types"
import "driver.js/dist/driver.css"
import "@/styles/driver-theme.css"

// Prevents a tour re-firing within the same page session (e.g. on remount) before
// the server completion round-trips. Cleared on full reload, which is fine.
const shownThisSession = new Set<string>()

/**
 * Drives a contextual tour for a section.
 *
 * - Auto-starts once on a user's first visit (gated by backend completion, so it
 *   never replays across rebuilds/devices), then marks it complete.
 * - Returns `replay()` to start it on demand (the "?" affordance), which does NOT
 *   re-mark completion.
 */
export function useSectionTour(tourKey: string, steps: TourStep[]) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const startedRef = useRef(false)

  const { data: progress } = useQuery({
    queryKey: ["onboarding-progress"],
    queryFn: onboardingApi.getProgress,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const loaded = progress !== undefined
  const completed = !!progress?.completions?.some(
    (c) => c.tutorial.key === tourKey && c.completed,
  )

  const completeMutation = useMutation({
    mutationFn: () => onboardingApi.completeTutorial(tourKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] }),
  })

  const start = useCallback(
    async (markComplete: boolean) => {
      if (typeof window === "undefined" || steps.length === 0) return
      // Only include steps whose anchor actually exists in the DOM right now.
      const present = steps.filter((s) => document.querySelector(s.element))
      if (present.length === 0) {
        if (markComplete) completeMutation.mutate()
        return
      }
      const { driver } = await import("driver.js")
      const d = driver({
        showProgress: true,
        allowClose: true,
        popoverClass: "ujamaa-tour",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Got it",
        steps: present.map((s) => ({
          element: s.element,
          popover: {
            title: s.title,
            // driver.js renders description as HTML — append an optional
            // "Learn more →" link into the Education library for depth.
            description: s.learnMore
              ? `${s.description}<a class="ujamaa-tour-link" href="${s.learnMore.href}">${s.learnMore.label ?? "Learn more"} →</a>`
              : s.description,
            side: s.side ?? "bottom",
            align: s.align ?? "start",
          },
        })),
        onDestroyed: () => {
          if (markComplete) completeMutation.mutate()
        },
      })
      d.drive()
    },
    [steps, completeMutation],
  )

  // Auto-start on first visit.
  useEffect(() => {
    if (!isAuthenticated || !loaded) return
    if (completed || shownThisSession.has(tourKey) || startedRef.current) return
    startedRef.current = true
    shownThisSession.add(tourKey)
    // Small delay so the section (and its data-tour anchors) have rendered.
    const t = setTimeout(() => start(true), 700)
    return () => clearTimeout(t)
  }, [isAuthenticated, loaded, completed, tourKey, start])

  // On-demand replay (does not re-mark completion).
  const replay = useCallback(() => start(false), [start])

  return { replay, completed }
}
