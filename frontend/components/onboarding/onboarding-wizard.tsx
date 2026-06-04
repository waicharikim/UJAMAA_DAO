"use client"

/**
 * OnboardingWizard — unified "Karibu" flow (4 slides).
 *
 * Merges the former OnboardingWizard (6 slides) and CommunityAuditGate into
 * one sequential experience:
 *   1. Karibu — Vision & Values
 *   2. Your Communities & Data  (transparency disclosure, was CommunityAuditGate)
 *   3. Verify & Join
 *   4. You're Ready!
 *
 * Sets both `ujamaa_wizard_seen_<id>` and `ca_seen_<id>` on close/complete
 * so the old standalone CommunityAuditGate never fires.
 *
 * Two modes:
 *   1. Auto-show: mounts in AppShell, fires once per user (localStorage).
 *   2. Controlled: pass forceOpen + onClose to re-open from GettingStartedCard.
 */

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRight, X, Users, Vote, Coins, ShieldCheck, Smartphone, Zap, Home, Landmark, MapPin, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"
import { onboardingApi, communityApi } from "@/lib/api"

const STORAGE_KEY = "ujamaa_wizard_seen"
const AUDIT_KEY   = "ca_seen"

// ─── Slide 2 — Groups list (Audit Gate content) ─────────────
const GROUP_TIERS = [
  { scope: "WARD",         label: "Ward",         icon: Home,     color: "#1A6B3C" },
  { scope: "CONSTITUENCY", label: "Constituency",  icon: Landmark, color: "#7A4F1E" },
  { scope: "COUNTY",       label: "County",        icon: MapPin,   color: "#B03A1E" },
  { scope: "NATIONAL",     label: "National",      icon: Globe,    color: "#1D4731" },
]

function CommunitiesSlide({ userId }: { userId: string }) {
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["wizard-system-groups", userId],
    queryFn: communityApi.getMyGroups,
    staleTime: 60_000,
  })

  const systemGroups = (groups as Array<{ name: string; locationScope?: string; isSystemGroup?: boolean }>)
    .filter((g) => g.isSystemGroup)

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {GROUP_TIERS.map(({ scope, label, icon: Icon, color }) => {
            const match = systemGroups.find(
              (g) => (g.locationScope ?? "").toUpperCase() === scope
            )
            return (
              <div
                key={scope}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: `${color}0D`, border: `1px solid ${color}20` }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}15` }}
                >
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold truncate" style={{ color: "#0E0B08" }}>
                    {match?.name ?? label}
                  </p>
                  <p className="text-[10px]" style={{ color: "rgba(14,11,8,0.45)" }}>{label} group</p>
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${color}15`, color }}
                >
                  ✓
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div
        className="px-3 py-2.5 rounded-xl text-[11px] leading-relaxed"
        style={{ background: "rgba(14,11,8,0.04)", color: "rgba(14,11,8,0.55)" }}
      >
        Every connection shown here is permanent in the audit log. Nothing about your participation is hidden from you — ever.
      </div>
    </div>
  )
}

// ─── Slide definitions ────────────────────────────────────

type Slide = {
  icon: React.ElementType
  iconColor: string
  iconBg: string
  title: string
  body: string
  customContent?: boolean
}

function buildSlides(ward?: string, constituency?: string, county?: string): Slide[] {
  const w = ward ?? "your ward"
  const hasLocation = !!ward

  return [
    {
      icon: Zap,
      iconColor: "#C9922A",
      iconBg: "rgba(201,146,42,0.12)",
      title: hasLocation ? `Karibu ${w} 🌿` : "Karibu UjamaaDAO 🌿",
      body: `UjamaaDAO is built community by community across Kenya${hasLocation ? ` — starting with ${w}` : ""}. You collaborate on local issues, make decisions together, and earn Participation Rights (PR) for every contribution. PR is non-transferable — it cannot be bought, only earned.`,
    },
    {
      icon: ShieldCheck,
      iconColor: "#1D4731",
      iconBg: "rgba(29,71,49,0.10)",
      title: "Your Communities & Data",
      body: "Based on your registered ward, you were automatically enrolled in these governance groups. You cannot leave them — they are your constitutional participation units.",
      customContent: true,
    },
    {
      icon: Smartphone,
      iconColor: "#2A6B7C",
      iconBg: "rgba(42,107,124,0.10)",
      title: "Verify & Join",
      body: `Start by verifying your phone (SMS, WhatsApp, or Telegram) to confirm you are a real person. Then get 3 vouches from verified ${hasLocation ? w : "ward"} members to unlock full governance participation — proposals, voting, and the cooperative economy.`,
    },
    {
      icon: Vote,
      iconColor: "#C9922A",
      iconBg: "rgba(201,146,42,0.12)",
      title: "You are ready — let's begin!",
      body: `Any verified member can submit proposals for ${hasLocation ? `${w}, ${constituency ?? "your constituency"}, or ${county ?? "your county"}` : "their local community"}. Every vote is weighted by PR — not wealth. Finishing this walkthrough earns you +10 PR 🎉. Heshima na Ujamaa! 🌿`,
    },
  ]
}

// ─── Main component ───────────────────────────────────────

interface OnboardingWizardProps {
  forceOpen?: boolean
  onClose?: () => void
}

export function OnboardingWizard({ forceOpen, onClose }: OnboardingWizardProps) {
  const { isAuthenticated, user, refreshUser } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [visible, setVisible] = useState(false)
  const [slide, setSlide] = useState(0)

  const SLIDES = buildSlides(
    user?.primaryWardName,
    user?.residenceConstituency,
    user?.residenceCounty,
  )

  const completeMutation = useMutation({
    mutationFn: () => onboardingApi.completeTutorial("platform_intro"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] })
      refreshUser()
    },
  })

  // Backend is the source of truth for whether the welcome was seen — survives
  // container rebuilds (new user UUID), new devices, and cleared caches, where
  // localStorage alone would wrongly replay the wizard.
  const { data: progress, isLoading: progressLoading } = useQuery({
    queryKey: ["onboarding-progress"],
    queryFn: onboardingApi.getProgress,
    enabled: isAuthenticated && forceOpen === undefined,
    staleTime: 60_000,
  })

  const introCompletedOnServer = !!progress?.completions?.some(
    (c) => c.tutorial.key === "platform_intro" && c.completed,
  )

  useEffect(() => {
    if (forceOpen !== undefined) return
    if (!isAuthenticated || !user?.id) return
    if (progressLoading) return
    // localStorage is an optimistic fast-path; the server record is authoritative.
    const seenLocally = !!localStorage.getItem(`${STORAGE_KEY}_${user.id}`)
    if (!introCompletedOnServer && !seenLocally) setVisible(true)
    // If the server says it's done, keep localStorage in sync to avoid a flash next time.
    if (introCompletedOnServer && !seenLocally) markSeen()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, forceOpen, progressLoading, introCompletedOnServer])

  useEffect(() => {
    if (forceOpen === undefined) return
    if (forceOpen) { setSlide(0); setVisible(true) }
    else setVisible(false)
  }, [forceOpen])

  function markSeen() {
    if (!user?.id) return
    localStorage.setItem(`${STORAGE_KEY}_${user.id}`, "1")
    localStorage.setItem(`${AUDIT_KEY}_${user.id}`, "1")
  }

  function close() {
    markSeen()
    setVisible(false)
    onClose?.()
  }

  function next() {
    if (slide < SLIDES.length - 1) {
      setSlide((s) => s + 1)
    } else {
      completeMutation.mutate()
      markSeen()
      setVisible(false)
      onClose?.()
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
            style={{ width: `${((slide + 1) / SLIDES.length) * 100}%`, background: "#C9922A" }}
          />
        </div>

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
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-6"
            style={{ background: current.iconBg }}
          >
            <Icon className="h-7 w-7 sm:h-8 sm:w-8" style={{ color: current.iconColor }} />
          </div>

          <h2 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3" style={{ color: "#0E0B08" }}>
            {current.title}
          </h2>
          <p className="text-sm leading-relaxed mb-4 sm:mb-5" style={{ color: "rgba(14,11,8,0.65)" }}>
            {current.body}
          </p>

          {/* Slide 2 custom content — communities list */}
          {current.customContent && user?.id && (
            <div className="mb-5 sm:mb-6">
              <CommunitiesSlide userId={user.id} />
            </div>
          )}

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
