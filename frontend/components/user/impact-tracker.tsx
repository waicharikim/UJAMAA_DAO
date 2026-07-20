"use client"

import { useQuery } from "@tanstack/react-query"
import { TrendingUp, MapPin, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { reputationApi, type WardReputationBreakdownDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  NONE:     { label: "—",        color: "#9E9587", bg: "rgba(158,149,135,0.10)" },
  BRONZE:   { label: "Bronze",   color: "#7A4F1E", bg: "rgba(122,79,30,0.10)" },
  SILVER:   { label: "Silver",   color: "#5A7A8A", bg: "rgba(90,122,138,0.10)" },
  GOLD:     { label: "Gold",     color: "#C9922A", bg: "rgba(201,146,42,0.12)" },
  PLATINUM: { label: "Platinum", color: "#1D4731", bg: "rgba(29,71,49,0.10)" },
}

function TierBadge({ tier }: { tier: string }) {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.NONE
  if (tier === "NONE") return null
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  )
}

function WardRow({ entry }: { entry: WardReputationBreakdownDto }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-black/[0.04] last:border-0">
      <MapPin className="h-3 w-3 flex-shrink-0" style={{ color: "#9E9587" }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#0E0B08] truncate">{entry.ward}</p>
        <p className="text-[10px] text-[#0E0B08]/45 truncate">{entry.constituency}, {entry.county}</p>
      </div>
      <TierBadge tier={entry.tier} />
      <span className="text-xs font-bold text-[#C9922A] flex-shrink-0 ml-1">
        {entry.points.toLocaleString()} IP
      </span>
    </div>
  )
}

function RecentLog({ reason, amount, createdAt }: { reason: string; amount: number; createdAt: string }) {
  const diff = Date.now() - new Date(createdAt).getTime()
  const days = Math.floor(diff / 86_400_000)
  const timeLabel = days === 0 ? "today" : days === 1 ? "yesterday" : `${days}d ago`
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04] last:border-0">
      <p className="text-xs text-[#0E0B08]/65 truncate mr-2">{reason.replace(/_/g, " ").toLowerCase()}</p>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-xs font-semibold" style={{ color: amount >= 0 ? "#1A6B3C" : "#B03A1E" }}>
          {amount >= 0 ? "+" : ""}{amount}
        </span>
        <span className="text-[10px] text-[#0E0B08]/35">{timeLabel}</span>
      </div>
    </div>
  )
}

export function ImpactTracker() {
  const { user, isAuthenticated } = useAuth()

  const { data: rep, isLoading: repLoading } = useQuery({
    queryKey: ["reputation-me"],
    queryFn: () => reputationApi.getMyReputation(),
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ["reputation-history"],
    queryFn: () => reputationApi.getMyHistory({ limit: 5 }),
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  if (!isAuthenticated) return null

  const isLoading = repLoading || histLoading

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-sm font-bold text-chai flex items-center gap-2">
          <TrendingUp className="h-4 w-4" style={{ color: "#C9922A" }} />
          Impact Points
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-1 space-y-4">
        {/* Global total */}
        {isLoading ? (
          <Skeleton className="h-12 w-full rounded-xl" />
        ) : (
          <div
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: "rgba(201,146,42,0.07)", border: "1px solid rgba(201,146,42,0.14)" }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#0E0B08]/40">
                Global total
              </p>
              <p className="text-2xl font-bold text-[#0E0B08] leading-none mt-0.5">
                {(rep?.globalImpactPoints ?? 0).toLocaleString()}
              </p>
            </div>
            <Star className="h-8 w-8 opacity-20" style={{ color: "#C9922A" }} />
          </div>
        )}

        {/* Per-ward breakdown */}
        {!isLoading && (rep?.breakdown ?? []).length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#0E0B08]/40 mb-1">
              By ward
            </p>
            {rep!.breakdown.map((entry) => (
              <WardRow key={entry.wardId} entry={entry} />
            ))}
          </div>
        )}

        {/* Recent history */}
        {!isLoading && (history?.logs ?? []).length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#0E0B08]/40 mb-1">
              Recent activity
            </p>
            {history!.logs.map((log) => (
              <RecentLog key={log.id} reason={log.reason} amount={log.amount} createdAt={log.createdAt} />
            ))}
          </div>
        )}

        {!isLoading && (rep?.globalImpactPoints ?? 0) === 0 && (
          <p className="text-xs text-[#0E0B08]/40 py-1">
            Participate in governance, complete your profile, and attend barazas to earn Impact Points.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
