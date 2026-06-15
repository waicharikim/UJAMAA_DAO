"use client"

import { useState, useEffect, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle, Circle, ArrowRight, Sparkles, PlayCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { onboardingApi } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { OnboardingWizard } from "./onboarding-wizard"

// Maps tutorial key → where the user goes to complete the action
// Hash suffix scrolls to the relevant section on the target page
const TUTORIAL_LINK: Record<string, string> = {
  platform_intro:         "/dashboard",
  verify_phone:           "/profile#verification",
  connect_wallet:         "/profile#verification",
  community_verification: "/profile#verification",
  governance_basics:      "/governance",
  learn_basics:           "/education",
  attend_baraza:          "/dashboard",
  explore_marketplace:    "/marketplace",
}

// Keys that open the wizard instead of navigating
const WIZARD_KEYS = new Set(["platform_intro"])

// Maps tutorial key → auto-complete condition (returns true when real-world state is met)
type AutoCondition = (user: any, data: any) => boolean

const AUTO_CONDITIONS: Record<string, AutoCondition> = {
  verify_phone: (user) => !!user?.phoneVerified,
  connect_wallet: (user) => !!user?.walletAddress,
  community_verification: (user) =>
    user?.verificationLevel === "COMMUNITY_VERIFIED" ||
    user?.verificationLevel === "FULL_VERIFIED",
  governance_basics: (user) =>
    user?.verificationLevel === "COMMUNITY_VERIFIED" ||
    user?.verificationLevel === "FULL_VERIFIED",
}

export function GettingStartedCard() {
  const { isAuthenticated, user, refreshUser } = useAuth()
  const queryClient = useQueryClient()
  const router = useRouter()
  const firedRef = useRef<Set<string>>(new Set())
  const [wizardOpen, setWizardOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-progress"],
    queryFn: onboardingApi.getProgress,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const completeMutation = useMutation({
    mutationFn: (key: string) => onboardingApi.completeTutorial(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] })
      refreshUser()
    },
  })

  // Auto-complete tutorials whose real-world conditions are already met
  useEffect(() => {
    if (!data || !user) return

    const completedKeys = new Set(
      (data.completions ?? []).filter((c) => c.completed).map((c) => c.tutorial?.key)
    )

    for (const tutorial of data.tutorials ?? []) {
      const key = tutorial.key
      if (completedKeys.has(key)) continue
      if (firedRef.current.has(key)) continue
      const condition = AUTO_CONDITIONS[key]
      if (!condition || !condition(user, data)) continue

      firedRef.current.add(key)
      completeMutation.mutate(key)
    }
  }, [data, user]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAuthenticated || isLoading || !data) return null

  const completedKeys = new Set(
    (data.completions ?? []).filter((c) => c.completed).map((c) => c.tutorial?.key)
  )
  const tutorials = (data.tutorials ?? [])
    // Contextual section tours (category TOUR, keys end in _tour) are ambient — they
    // run in-place on first visit and don't belong in the first-steps checklist.
    .filter((t) => !t.key.endsWith("_tour"))
    .map((t) => ({
      ...t,
      // Reflect live real-world state immediately (e.g. already FULL_VERIFIED),
      // not just server-persisted completions — the auto-complete mutation
      // round-trip otherwise lags and shows an already-satisfied step.
      completed:
        completedKeys.has(t.key) ||
        (!!user && AUTO_CONDITIONS[t.key]?.(user, data) === true),
      link: TUTORIAL_LINK[t.key] ?? "/dashboard",
      opensWizard: WIZARD_KEYS.has(t.key),
    }))

  const incomplete = tutorials.filter((t) => !t.completed)

  if (tutorials.length === 0 || incomplete.length === 0) return null

  const totalPR = incomplete.reduce((sum, t) => sum + (t.prReward ?? 0), 0)

  function handleRowClick(t: typeof tutorials[number]) {
    if (t.completed) return
    if (t.opensWizard) {
      setWizardOpen(true)
    } else {
      router.push(t.link)
    }
  }

  return (
    <>
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" style={{ color: "#C9922A" }} />
            Getting started
            {totalPR > 0 && (
              <span
                className="ml-auto text-xs font-semibold rounded-full px-2 py-0.5"
                style={{ background: "rgba(201,146,42,0.12)", color: "#C9922A" }}
              >
                +{totalPR} PR available
              </span>
            )}
          </CardTitle>

          {/* Replay intro button */}
          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-1.5 text-xs mt-1 hover:opacity-70 transition-opacity"
            style={{ color: "rgba(14,11,8,0.4)" }}
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Replay intro
          </button>
        </CardHeader>

        <CardContent className="space-y-2">
          {tutorials.map((t) => {
            const rowContent = (
              <>
                {t.completed ? (
                  <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: "#2A5240" }} />
                ) : (
                  <Circle className="h-4 w-4 flex-shrink-0" style={{ color: "rgba(14,11,8,0.2)" }} />
                )}

                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium leading-snug"
                    style={{ color: t.completed ? "#2A5240" : "#0E0B08" }}
                  >
                    {t.title}
                  </p>
                  {t.prReward > 0 && !t.completed && (
                    <p className="text-[10px] mt-0.5" style={{ color: "#C9922A" }}>
                      +{t.prReward} PR on completion
                    </p>
                  )}
                </div>

                {!t.completed && (
                  <ArrowRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "rgba(14,11,8,0.25)" }} />
                )}
              </>
            )

            const rowStyle = {
              background: t.completed ? "rgba(42,82,64,0.06)" : "rgba(26,18,11,0.03)",
              border: t.completed
                ? "1px solid rgba(42,82,64,0.15)"
                : "1px solid rgba(26,18,11,0.06)",
            }

            const rowClass = `flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-150 ${
              t.completed ? "opacity-70" : "cursor-pointer hover:border-[rgba(14,11,8,0.15)] hover:bg-[rgba(26,18,11,0.06)]"
            }`

            if (t.completed) {
              return (
                <div key={t.key} className={rowClass} style={rowStyle}>
                  {rowContent}
                </div>
              )
            }

            if (t.opensWizard) {
              return (
                <button
                  key={t.key}
                  className={`w-full text-left ${rowClass}`}
                  style={rowStyle}
                  onClick={() => setWizardOpen(true)}
                >
                  {rowContent}
                </button>
              )
            }

            return (
              <Link key={t.key} href={t.link} className={rowClass} style={rowStyle}>
                {rowContent}
              </Link>
            )
          })}
        </CardContent>
      </Card>

      {/* Wizard — controlled by replay button or platform_intro row */}
      <OnboardingWizard
        forceOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />
    </>
  )
}
