"use client"

/**
 * OnboardingWizard
 * A first-time slide-through walkthrough shown to new users.
 *
 * Two modes:
 *  1. Auto-show: mounts globally in AppShell, fires once per user (localStorage).
 *  2. Controlled: pass forceOpen + onClose to re-open from any trigger (e.g. GettingStartedCard).
 *
 * Completing the final slide calls completeTutorial('platform_intro') so the PR is awarded
 * whether the user finished it on first load or re-opened it later.
 */

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ChevronRight, X, Users, Vote, Coins, ShieldCheck, Smartphone, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { onboardingApi } from "@/lib/api"

const STORAGE_KEY = "ujamaa_wizard_seen"

interface Slide {
  icon: React.ElementType
  iconColor: string
  iconBg: string
  title: string
  body: string
}

const SLIDES: Slide[] = [
  {
    icon: Zap,
    iconColor: "#C9922A",
    iconBg: "rgba(201,146,42,0.12)",
    title: "Welcome to UjamaaDAO 🌿",
    body: "UjamaaDAO is a citizen-led platform built ward by ward across Kenya. Here you collaborate, make decisions together, and grow as a community. Every contribution you make earns you Participation Rights (PR).",
  },
  {
    icon: Coins,
    iconColor: "#1E3D2F",
    iconBg: "rgba(30,61,47,0.10)",
    title: "Participation Rights (PR)",
    body: "PR is your civic currency — it cannot be bought or sold. You earn it by attending barazas, voting on proposals, completing your profile, and contributing to your community. More PR means more voice in decisions.",
  },
  {
    icon: Smartphone,
    iconColor: "#2A6B7C",
    iconBg: "rgba(42,107,124,0.10)",
    title: "Verify your phone number",
    body: "Your first step is verifying your phone number via SMS, WhatsApp, or Telegram. This confirms you are a real person — not a bot — and unlocks your community membership.",
  },
  {
    icon: Users,
    iconColor: "#1D4731",
    iconBg: "rgba(29,71,49,0.10)",
    title: "Community Verification",
    body: "After phone verification, get 3 vouches from people in your ward. This is community verification — person to person, the way it has always been done. It unlocks governance participation and the cooperative economy.",
  },
  {
    icon: Vote,
    iconColor: "#B03A1E",
    iconBg: "rgba(176,58,30,0.10)",
    title: "Real governance, real power",
    body: "Any verified member can submit a proposal for their ward, constituency, or county. Every vote is weighted by your PR — not your wealth. No money buys influence here, only participation.",
  },
  {
    icon: ShieldCheck,
    iconColor: "#C9922A",
    iconBg: "rgba(201,146,42,0.12)",
    title: "You are ready — let's begin!",
    body: "Start by verifying your phone and completing your profile. Once you reach Community Verified status you become a full member of your ward community. Finishing this walkthrough earns you +10 PR 🎉. Heshima na Ujamaa! 🌿",
  },
]

interface OnboardingWizardProps {
  /** Controlled mode: force the wizard open (e.g. from a replay button). */
  forceOpen?: boolean
  /** Called when the wizard closes in controlled mode. */
  onClose?: () => void
}

export function OnboardingWizard({ forceOpen, onClose }: OnboardingWizardProps) {
  const { isAuthenticated, user, refreshUser } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [visible, setVisible] = useState(false)
  const [slide, setSlide] = useState(0)

  const completeMutation = useMutation({
    mutationFn: () => onboardingApi.completeTutorial("platform_intro"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] })
      refreshUser()
    },
  })

  // Auto-show on first visit (uncontrolled mode)
  useEffect(() => {
    if (forceOpen !== undefined) return // controlled mode — skip auto-show logic
    if (!isAuthenticated || !user?.id) return
    const seen = localStorage.getItem(`${STORAGE_KEY}_${user.id}`)
    if (!seen) setVisible(true)
  }, [isAuthenticated, user?.id, forceOpen])

  // Controlled mode: respond to forceOpen changes
  useEffect(() => {
    if (forceOpen === undefined) return
    if (forceOpen) {
      setSlide(0)
      setVisible(true)
    } else {
      setVisible(false)
    }
  }, [forceOpen])

  function close() {
    // Mark seen so auto-show won't fire again
    if (user?.id) localStorage.setItem(`${STORAGE_KEY}_${user.id}`, "1")
    setVisible(false)
    onClose?.()
  }

  function next() {
    if (slide < SLIDES.length - 1) {
      setSlide((s) => s + 1)
    } else {
      // Final slide — award PR + navigate to profile
      completeMutation.mutate()
      close()
      router.push("/profile")
    }
  }

  if (!visible) return null

  const current = SLIDES[slide]
  const Icon = current.icon
  const isLast = slide === SLIDES.length - 1

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(10,31,20,0.7)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full sm:max-w-md mx-auto sm:rounded-3xl overflow-hidden"
        style={{ background: "#F7F2E8" }}
      >
        {/* Progress bar */}
        <div className="h-1 w-full" style={{ background: "rgba(14,11,8,0.08)" }}>
          <div
            className="h-1 transition-all duration-500"
            style={{
              width: `${((slide + 1) / SLIDES.length) * 100}%`,
              background: "#C9922A",
            }}
          />
        </div>

        {/* Dismiss — available from slide 1 onwards */}
        {slide > 0 && (
          <button
            onClick={close}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-black/5 transition-colors"
            aria-label="Skip"
          >
            <X className="h-4 w-4" style={{ color: "rgba(14,11,8,0.4)" }} />
          </button>
        )}

        <div className="p-5 pt-7 sm:p-8 sm:pt-10">
          {/* Icon */}
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-6"
            style={{ background: current.iconBg }}
          >
            <Icon className="h-7 w-7 sm:h-8 sm:w-8" style={{ color: current.iconColor }} />
          </div>

          {/* Content */}
          <h2 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3" style={{ color: "#0E0B08" }}>
            {current.title}
          </h2>
          <p className="text-sm leading-relaxed mb-5 sm:mb-8" style={{ color: "rgba(14,11,8,0.65)" }}>
            {current.body}
          </p>

          {/* Slide dots */}
          <div className="flex gap-1.5 mb-4 sm:mb-6">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === slide ? "20px" : "6px",
                  background: i === slide ? "#C9922A" : "rgba(14,11,8,0.15)",
                }}
              />
            ))}
          </div>

          {/* Actions */}
          <Button
            onClick={next}
            disabled={completeMutation.isPending}
            className="w-full font-semibold rounded-xl py-5"
            style={{ background: "#1E3D2F", color: "#fff" }}
          >
            {isLast
              ? completeMutation.isPending
                ? "Recording your PR…"
                : "Let's get started → (+10 PR)"
              : (
                <span className="flex items-center justify-center gap-1">
                  Continue <ChevronRight className="h-4 w-4" />
                </span>
              )}
          </Button>
        </div>
      </div>
    </div>
  )
}
