"use client"

import { useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { onboardingApi } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import type { TourStep } from "@/lib/tours/types"
import "driver.js/dist/driver.css"
import "@/styles/driver-theme.css"

/**
 * Drives a contextual tour for a section.
 *
 * Tours are **on-demand only** — triggered by the section's "?" tour button via
 * the returned `replay()`. They do NOT auto-fire: a first-timer already sees the
 * welcome wizard, and an auto-tour on every section stacked overlays that
 * intercepted clicks (and felt intrusive). The library is still here so the
 * affordance remains one tap away.
 */
export function useSectionTour(tourKey: string, steps: TourStep[]) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const { data: progress } = useQuery({
    queryKey: ["onboarding-progress"],
    queryFn: onboardingApi.getProgress,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

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

  // On-demand replay (does not re-mark completion). No auto-start.
  const replay = useCallback(() => start(false), [start])

  return { replay, completed }
}
