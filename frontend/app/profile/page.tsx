"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/contexts/auth-context"
import { UserProfile } from "@/components/user/user-profile"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import { Award, Coins, MapPin, History, ShieldCheck, LayoutGrid, Settings } from "lucide-react"
import { reputationApi, type WardReputationBreakdownDto, type ImpactPointLogDto, type ReputationHierarchyDto } from "@/lib/api"
import { VerificationCard } from "@/components/profile/verification-card"
import { DuesPaymentCard } from "@/components/payments/dues-payment-card"
import { UtWithdrawalCard } from "@/components/payments/ut-withdrawal-card"
import { GettingStartedCard } from "@/components/onboarding/getting-started-card"
import { useSectionTour } from "@/hooks/use-section-tour"
import { profileTour } from "@/lib/tours"
import { PasskeyManager } from "@/components/auth/passkey-manager"
import { TelegramLinkCard } from "@/components/integration/telegram-link-card"
import { ResidenceChangeCard } from "@/components/user/residence-change-card"
import { SessionManager } from "@/components/auth/session-manager"
import { TwoFactorCard } from "@/components/auth/two-factor-card"

// ── Tier config for ward breakdown ────────────────────────
const TIER_CONFIG: Record<string, { bg: string; color: string }> = {
  PLATINUM: { bg: "rgba(107,122,143,0.15)", color: "#607080" },
  GOLD:     { bg: "rgba(201,146,42,0.15)",  color: "#C9922A" },
  SILVER:   { bg: "rgba(107,107,107,0.12)", color: "#777"    },
  BRONZE:   { bg: "rgba(176,100,58,0.12)",  color: "#B0643A" },
  NONE:     { bg: "rgba(26,18,11,0.06)",    color: "rgba(14,11,8,0.4)" },
}

const REASON_LABELS: Record<string, string> = {
  EMAIL_VERIFIED:             "Email verified",
  PHONE_VERIFIED:             "Phone verified",
  COMMUNITY_VERIFIED:         "Community verified",
  PHYSICAL_WORK_VERIFIED:     "Work verified",
  EDUCATION_MODULE_COMPLETED: "Module completed",
  MILESTONE_ACHIEVED:         "Milestone achieved",
  MANUAL_ADJUSTMENT:          "Manual adjustment",
  TEMPORARY_CHECKIN:          "Location check-in",
}

function HierarchyBar({ label, points, max, color }: { label: string; points: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((points / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[#0E0B08]/60">{label}</span>
        <span className="font-bold" style={{ color }}>{points.toLocaleString()} IP</span>
      </div>
      <div className="h-1.5 rounded-full w-full" style={{ background: "rgba(14,11,8,0.07)" }}>
        <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function HierarchyCard({ hierarchy, global: globalPts }: { hierarchy: ReputationHierarchyDto; global: number }) {
  const max = globalPts || 1
  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="h-4 w-4" style={{ color: "#C9922A" }} />
          Impact by Level
        </CardTitle>
        <p className="text-xs text-[#0E0B08]/45 leading-relaxed">
          <strong className="text-[#C9922A]">Global</strong> is your cumulative total across everything.
          The ward / constituency / county bars show where that impact was earned.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <HierarchyBar label={`${hierarchy.ward.name} (Ward)`} points={hierarchy.ward.points} max={max} color="#1A6B3C" />
        <HierarchyBar label={`${hierarchy.constituency.name} (Constituency)`} points={hierarchy.constituency.points} max={max} color="#7A4F1E" />
        <HierarchyBar label={`${hierarchy.county.name} (County)`} points={hierarchy.county.points} max={max} color="#B03A1E" />
        <div className="border-t border-cream pt-3">
          <HierarchyBar label="Global (cumulative)" points={globalPts} max={max} color="#C9922A" />
        </div>
      </CardContent>
    </Card>
  )
}

function WardBreakdownRow({ item }: { item: WardReputationBreakdownDto }) {
  const tier = TIER_CONFIG[item.tier] ?? TIER_CONFIG.NONE
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "rgba(26,18,11,0.06)" }}>
      <div className="flex items-center gap-2 min-w-0">
        <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#1E3D2F" }} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#0E0B08] truncate">{item.ward}</p>
          <p className="text-[10px] text-[#0E0B08]/50 truncate">{item.constituency}, {item.county}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: tier.bg, color: tier.color }}>
          {item.tier}
        </span>
        <span className="text-sm font-bold text-[#0E0B08]">{item.points.toLocaleString()}</span>
      </div>
    </div>
  )
}

function HistoryRow({ log }: { log: ImpactPointLogDto }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "rgba(26,18,11,0.06)" }}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#0E0B08]">{REASON_LABELS[log.reason] ?? log.reason}</p>
        <p className="text-[10px] text-[#0E0B08]/40 mt-0.5">{log.scope} · {new Date(log.createdAt).toLocaleDateString()}</p>
      </div>
      <span className="text-sm font-bold flex-shrink-0" style={{ color: "#1E3D2F" }}>+{log.amount} IP</span>
    </div>
  )
}

export default function ProfilePage() {
  const { user, isLoading } = useAuth()
  useSectionTour(profileTour.key, profileTour.steps)

  const { data: reputation, isLoading: repLoading } = useQuery({
    queryKey: ["reputation-me"],
    queryFn: reputationApi.getMyReputation,
    staleTime: 60_000,
    enabled: !!user,
    retry: false,
  })

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ["reputation-history"],
    queryFn: () => reputationApi.getMyHistory({ limit: 10 }),
    staleTime: 60_000,
    enabled: !!user,
    retry: false,
  })

  const isVerified = user?.verificationLevel === "COMMUNITY_VERIFIED" || user?.verificationLevel === "FULL_VERIFIED"

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-5">

      {/* ── Photo hero with avatar + stats overlay ─────────── */}
      <div className="relative h-40 rounded-2xl overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80"
          alt="Profile"
          fill
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(29,71,49,0.55) 0%, rgba(29,71,49,0.88) 100%)" }}
        />
        <div className="absolute inset-0 flex items-end p-5 gap-4">
          {/* Avatar */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0 ring-2 ring-white/30"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            {(user?.username ?? user?.email ?? "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-serif font-bold text-xl text-white leading-tight truncate">
              {user?.username ?? user?.email ?? "My Profile"}
            </h2>
            <p className="text-white/60 text-xs mt-0.5 truncate">
              {user?.verificationLevel?.replace(/_/g, " ") ?? ""}
            </p>
          </div>
          {/* Inline stats */}
          {!isLoading && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: "rgba(201,146,42,0.25)" }}>
                <Award className="h-3 w-3 text-amber-300" />
                <span className="text-sm font-bold text-amber-200">
                  {(reputation?.globalImpactPoints ?? user?.impactPoints?.global ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-amber-300/70">IP</span>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.15)" }}>
                <Coins className="h-3 w-3 text-white/70" />
                <span className="text-sm font-bold text-white">
                  {(user?.tokenBalance ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-white/50">PR</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full grid grid-cols-3 h-10 rounded-xl" style={{ background: "rgba(14,11,8,0.05)" }}>
          <TabsTrigger value="overview" className="rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verification
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* ── Overview: onboarding + verification ─────────── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div data-tour="getting-started">
            <GettingStartedCard />
          </div>
          <div id="verification" data-tour="verification">
            <VerificationCard />
          </div>
        </TabsContent>

        {/* ── Activity: rep + history ──────────────────────── */}
        <TabsContent value="activity" className="mt-4 space-y-4">
          {reputation?.hierarchy && (
            <HierarchyCard hierarchy={reputation.hierarchy} global={reputation.globalImpactPoints} />
          )}
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" style={{ color: "#1E3D2F" }} />
                Ward Reputation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {repLoading ? (
                <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
              ) : !reputation?.breakdown?.length ? (
                <p className="text-sm text-center py-6" style={{ color: "rgba(14,11,8,0.35)" }}>
                  No ward activity yet. Participate to build local reputation.
                </p>
              ) : (
                <div>
                  {reputation.breakdown.map((item) => <WardBreakdownRow key={item.wardId} item={item} />)}
                  <p className="text-xs text-[#0E0B08]/40 mt-3 pt-3 border-t" style={{ borderColor: "rgba(26,18,11,0.06)" }}>
                    {reputation.totals.locations} ward{reputation.totals.locations !== 1 ? "s" : ""} · <strong>{reputation.totals.totalPoints.toLocaleString()} IP</strong>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" style={{ color: "#C9922A" }} />
                Impact Points History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {histLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
              ) : !history?.logs?.length ? (
                <p className="text-sm text-center py-6" style={{ color: "rgba(14,11,8,0.35)" }}>No impact points earned yet.</p>
              ) : (
                <div>
                  {history.logs.map((log) => <HistoryRow key={log.id} log={log} />)}
                  {(history.pagination.total ?? 0) > 10 && (
                    <p className="text-xs text-center mt-3 pt-3 border-t" style={{ color: "rgba(14,11,8,0.4)", borderColor: "rgba(26,18,11,0.06)" }}>
                      Showing 10 of {history.pagination.total} entries
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Settings: profile edit + passkeys + payments ─── */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <UserProfile />
          <PasskeyManager />
          <TelegramLinkCard />
          {isVerified && <DuesPaymentCard />}
          <UtWithdrawalCard />
          {isVerified && <ResidenceChangeCard />}
          <TwoFactorCard />
          <SessionManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
