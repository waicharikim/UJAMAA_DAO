"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/contexts/auth-context"
import { UserProfile } from "@/components/user/user-profile"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Award, Coins, Users, MapPin, History } from "lucide-react"
import { reputationApi, type WardReputationBreakdownDto, type ImpactPointLogDto } from "@/lib/api"
import { VerificationCard } from "@/components/profile/verification-card"
import { DuesPaymentCard } from "@/components/payments/dues-payment-card"

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
}) {
  return (
    <Card className="border-0 shadow-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0E0B08]/40 mb-1">{label}</p>
            <p className="text-[28px] font-bold text-[#0E0B08] leading-none">{value}</p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color }}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

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

function WardBreakdownRow({ item }: { item: WardReputationBreakdownDto }) {
  const tier = TIER_CONFIG[item.tier] ?? TIER_CONFIG.NONE
  return (
    <div
      className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0"
      style={{ borderColor: "rgba(26,18,11,0.06)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#1E3D2F" }} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#0E0B08] truncate">{item.ward}</p>
          <p className="text-[10px] text-[#0E0B08]/50 truncate">{item.constituency}, {item.county}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: tier.bg, color: tier.color }}
        >
          {item.tier}
        </span>
        <span className="text-sm font-bold text-[#0E0B08]">{item.points.toLocaleString()}</span>
      </div>
    </div>
  )
}

function HistoryRow({ log }: { log: ImpactPointLogDto }) {
  return (
    <div
      className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0"
      style={{ borderColor: "rgba(26,18,11,0.06)" }}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#0E0B08]">
          {REASON_LABELS[log.reason] ?? log.reason}
        </p>
        <p className="text-[10px] text-[#0E0B08]/40 mt-0.5">
          {log.scope} · {new Date(log.createdAt).toLocaleDateString()}
        </p>
      </div>
      <span className="text-sm font-bold flex-shrink-0" style={{ color: "#1E3D2F" }}>
        +{log.amount} IP
      </span>
    </div>
  )
}

export default function ProfilePage() {
  const { user, isLoading } = useAuth()

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

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="font-display font-bold text-3xl text-[#0E0B08]">My Profile</h2>
        <p className="text-sm text-[#0E0B08]/50 mt-1">
          Manage your account, track your impact, and update your preferences.
        </p>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="Impact Points"
            value={reputation?.globalImpactPoints ?? user?.impactPoints?.global ?? 0}
            icon={Award}
            color="#C9922A"
          />
          <StatCard
            label="PR Balance"
            value={user?.tokenBalance ?? 0}
            icon={Coins}
            color="#1E3D2F"
          />
          <StatCard
            label="Roles"
            value={user?.roles?.length ?? 0}
            icon={Users}
            color="#B03A1E"
          />
        </div>
      )}

      {/* Verification progress */}
      <VerificationCard />

      {/* Monthly dues */}
      {user?.verificationLevel === "COMMUNITY_VERIFIED" || user?.verificationLevel === "FULL_VERIFIED"
        ? <DuesPaymentCard />
        : null
      }

      {/* Ward reputation breakdown */}
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" style={{ color: "#1E3D2F" }} />
            Ward Reputation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {repLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : !reputation?.breakdown?.length ? (
            <p className="text-sm text-center py-6" style={{ color: "rgba(14,11,8,0.35)" }}>
              No ward activity yet. Participate in your ward to build local reputation.
            </p>
          ) : (
            <div>
              {reputation.breakdown.map((item) => (
                <WardBreakdownRow key={item.wardId} item={item} />
              ))}
              <p className="text-xs text-[#0E0B08]/40 mt-3 pt-3 border-t" style={{ borderColor: "rgba(26,18,11,0.06)" }}>
                Total across {reputation.totals.locations} ward{reputation.totals.locations !== 1 ? "s" : ""} ·{" "}
                <strong>{reputation.totals.totalPoints.toLocaleString()} IP</strong>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* IP history */}
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" style={{ color: "#C9922A" }} />
            Impact Points History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {histLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
          ) : !history?.logs?.length ? (
            <p className="text-sm text-center py-6" style={{ color: "rgba(14,11,8,0.35)" }}>
              No impact points earned yet.
            </p>
          ) : (
            <div>
              {history.logs.map((log) => (
                <HistoryRow key={log.id} log={log} />
              ))}
              {(history.pagination.total ?? 0) > 10 && (
                <p className="text-xs text-center mt-3 pt-3 border-t" style={{ color: "rgba(14,11,8,0.4)", borderColor: "rgba(26,18,11,0.06)" }}>
                  Showing 10 of {history.pagination.total} entries
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <UserProfile />
    </div>
  )
}
