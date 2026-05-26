"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Trophy, Star, Zap, BarChart3, Medal } from "lucide-react"
import { leaderboardApi, LeaderboardEntryDto } from "@/lib/api"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"

const METRIC_TABS = [
  { value: "combined", label: "Combined",  icon: BarChart3 },
  { value: "ip",       label: "Impact",    icon: Star },
  { value: "pr",       label: "Reputation",icon: Zap },
] as const
type Metric = (typeof METRIC_TABS)[number]["value"]

const SCOPE_TABS = [
  { value: "global", label: "Global" },
  { value: "county", label: "County" },
  { value: "ward",   label: "Ward" },
] as const
type Scope = (typeof SCOPE_TABS)[number]["value"]

function rankMedal(rank: number) {
  if (rank === 1) return <span className="text-[16px]">🥇</span>
  if (rank === 2) return <span className="text-[16px]">🥈</span>
  if (rank === 3) return <span className="text-[16px]">🥉</span>
  return (
    <span className="w-7 text-center text-[13px] font-bold" style={{ color: "#999" }}>
      {rank}
    </span>
  )
}

function scoreValue(entry: LeaderboardEntryDto, metric: Metric): number {
  if (metric === "ip") return entry.globalImpactPoints
  if (metric === "pr") return entry.participationRights
  return entry.combinedScore
}

function scoreLabel(metric: Metric) {
  if (metric === "ip") return "IP"
  if (metric === "pr") return "PR"
  return "Score"
}

function EntryRow({
  entry,
  metric,
  isMe,
}: {
  entry: LeaderboardEntryDto
  metric: Metric
  isMe: boolean
}) {
  const inner = (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:shadow-sm"
      style={{
        background: isMe
          ? "rgba(201,146,42,0.07)"
          : entry.rank <= 3
          ? "rgba(29,71,49,0.04)"
          : "white",
        border: isMe
          ? "1px solid rgba(201,146,42,0.25)"
          : "1px solid rgba(29,71,49,0.07)",
      }}
    >
      <div className="w-7 flex items-center justify-center flex-shrink-0">
        {rankMedal(entry.rank)}
      </div>
      <Avatar className="h-9 w-9 rounded-xl flex-shrink-0">
        <AvatarImage src={entry.avatarUrl} />
        <AvatarFallback className="rounded-xl bg-[#1D4731] text-white text-sm font-semibold">
          {(entry.name || "U")[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold text-gray-800 truncate">
          {entry.name}
          {isMe && (
            <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
              You
            </span>
          )}
        </p>
        {entry.ward && (
          <p className="text-[11px] text-gray-400 truncate">
            {entry.ward.name}{entry.county ? `, ${entry.county.name}` : ""}
          </p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[14px] font-bold text-gray-800">{scoreValue(entry, metric).toLocaleString()}</p>
        <p className="text-[10px] text-gray-400">{scoreLabel(metric)}</p>
      </div>
    </div>
  )

  return isMe ? inner : <Link href={`/profile/${entry.userId}`}>{inner}</Link>
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100">
      <Skeleton className="h-5 w-5 rounded" />
      <Skeleton className="h-9 w-9 rounded-xl" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-5 w-12" />
    </div>
  )
}

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [metric, setMetric] = useState<Metric>("combined")
  const [scope, setScope] = useState<Scope>("global")

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", metric, scope],
    queryFn: () => leaderboardApi.getLeaderboard({ metric, scope, limit: 50 }),
  })

  const myEntry = data?.entries.find((e) => e.userId === user?.id)
  const myEntryInList = myEntry !== undefined

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(201,146,42,0.12)" }}
        >
          <Trophy className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leaderboard</h1>
          <p className="text-sm text-gray-500">Top contributors in the community</p>
        </div>
      </div>

      {/* Top 3 podium */}
      {!isLoading && data?.entries && data.entries.length >= 3 && (
        <div
          className="rounded-2xl p-4"
          style={{ background: "linear-gradient(135deg, #1D4731 0%, #142F22 100%)" }}
        >
          <div className="flex items-end justify-center gap-4">
            {/* 2nd */}
            <PodiumItem entry={data.entries[1]} metric={metric} position={2} />
            {/* 1st */}
            <PodiumItem entry={data.entries[0]} metric={metric} position={1} />
            {/* 3rd */}
            <PodiumItem entry={data.entries[2]} metric={metric} position={3} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-2">
        {/* Metric */}
        <div className="flex gap-1.5">
          {METRIC_TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setMetric(value)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all"
              style={
                metric === value
                  ? { background: "#C9922A", color: "white" }
                  : { background: "rgba(201,146,42,0.08)", color: "#C9922A" }
              }
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Scope */}
        <div className="flex gap-1.5">
          {SCOPE_TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setScope(value)}
              className="px-3 py-1 rounded-full text-[12px] font-medium transition-all"
              style={
                scope === value
                  ? { background: "#1D4731", color: "white" }
                  : { background: "rgba(29,71,49,0.06)", color: "#555" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Header row */}
      <div className="px-4 flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">
        <div className="w-7" />
        <div className="w-9 flex-shrink-0" />
        <div className="flex-1">Member</div>
        <div>{scoreLabel(metric)}</div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : !data?.entries.length ? (
        <div className="text-center py-16 text-gray-400">
          <Medal className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No data yet for this scope</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.entries.map((entry) => (
            <EntryRow
              key={entry.userId}
              entry={entry}
              metric={metric}
              isMe={user?.id === entry.userId}
            />
          ))}
        </div>
      )}

      {/* Your position — pinned if you're outside the visible list */}
      {!isLoading && user && !myEntryInList && data && data.total > 0 && (
        <div className="pt-1 border-t border-dashed border-gray-200">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold mb-2 px-1">
            Your Position
          </p>
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{
              background: "rgba(201,146,42,0.07)",
              border: "1px solid rgba(201,146,42,0.25)",
            }}
          >
            <div className="w-7 flex items-center justify-center flex-shrink-0">
              <span className="text-[13px] font-bold" style={{ color: "#999" }}>—</span>
            </div>
            <Avatar className="h-9 w-9 rounded-xl flex-shrink-0">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="rounded-xl bg-[#1D4731] text-white text-sm font-semibold">
                {(user.username || "U")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-semibold text-gray-800 truncate">
                {user.username}
                <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                  You
                </span>
              </p>
              <p className="text-[11px] text-gray-400">Not in top {data.entries.length}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[13px] text-gray-500">—</p>
              <p className="text-[10px] text-gray-400">{scoreLabel(metric)}</p>
            </div>
          </div>
        </div>
      )}

      {data && (
        <p className="text-center text-[11px] text-gray-400">
          Showing {data.entries.length} of {data.total} members
        </p>
      )}
    </div>
  )
}

function PodiumItem({
  entry,
  metric,
  position,
}: {
  entry: LeaderboardEntryDto
  metric: Metric
  position: 1 | 2 | 3
}) {
  const heights = { 1: "h-20", 2: "h-14", 3: "h-10" }
  const colors = {
    1: "#D4911E",
    2: "rgba(247,242,232,0.6)",
    3: "rgba(247,242,232,0.4)",
  }

  return (
    <div className="flex flex-col items-center gap-2 flex-1 max-w-[90px]">
      <Avatar className="h-10 w-10 rounded-xl border-2" style={{ borderColor: colors[position] }}>
        <AvatarImage src={entry.avatarUrl} />
        <AvatarFallback className="rounded-xl bg-[#2A5C40] text-white text-sm font-bold">
          {(entry.name || "U")[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <p className="text-[11px] font-semibold text-cream truncate w-full text-center">
        {entry.name.split(" ")[0]}
      </p>
      <p className="text-[10px]" style={{ color: colors[position] }}>
        {scoreValue(entry, metric).toLocaleString()} {scoreLabel(metric)}
      </p>
      <div
        className={`w-full ${heights[position]} rounded-t-lg flex items-end justify-center pb-2`}
        style={{ background: `${colors[position]}22`, border: `1px solid ${colors[position]}44` }}
      >
        <span className="text-[18px]">{position === 1 ? "🥇" : position === 2 ? "🥈" : "🥉"}</span>
      </div>
    </div>
  )
}
