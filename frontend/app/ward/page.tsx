"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { userApi, leaderboardApi, governanceApi, type LeaderboardEntryDto, type ProposalDto } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MapPin, Users, Trophy, Vote, Award, ShieldCheck, ChevronRight } from "lucide-react"

// ─── Verification level badge colours ──────────────────────
const LEVEL_COLOR: Record<string, string> = {
  FULL_VERIFIED:      "#1A6B3C",
  COMMUNITY_VERIFIED: "#7A4F1E",
  PHONE_VERIFIED:     "#1E3D2F",
  EMAIL_VERIFIED:     "#555",
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  VOTING_OPEN:    { label: "Voting",   color: "#1A6B3C" },
  PENDING_REVIEW: { label: "Review",   color: "#7A4F1E" },
  DRAFT:          { label: "Draft",    color: "#999"    },
  PASSED:         { label: "Passed",   color: "#1E3D2F" },
  FAILED:         { label: "Failed",   color: "#B03A1E" },
  CANCELLED:      { label: "Cancelled",color: "#999"    },
}

function MemberRow({ m, rank }: { m: { id: string; name: string; verificationLevel: string }; rank: number }) {
  const color = LEVEL_COLOR[m.verificationLevel] ?? "#555"
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "rgba(26,18,11,0.06)" }}>
      <span className="w-5 text-xs font-bold text-center" style={{ color: "rgba(14,11,8,0.3)" }}>{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0E0B08] truncate">{m.name}</p>
        <p className="text-[10px]" style={{ color }}>{m.verificationLevel.replace(/_/g, " ")}</p>
      </div>
    </div>
  )
}

function LeaderRow({ entry }: { entry: LeaderboardEntryDto }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "rgba(26,18,11,0.06)" }}>
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{
          background: entry.rank <= 3 ? "rgba(201,146,42,0.12)" : "rgba(14,11,8,0.05)",
          color:      entry.rank <= 3 ? "#C9922A" : "rgba(14,11,8,0.4)",
        }}
      >
        {entry.rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0E0B08] truncate">{entry.name}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Award className="h-3.5 w-3.5" style={{ color: "#C9922A" }} />
        <span className="text-sm font-bold" style={{ color: "#C9922A" }}>
          {entry.globalImpactPoints.toLocaleString()}
        </span>
        <span className="text-[10px] opacity-50" style={{ color: "#C9922A" }}>IP</span>
      </div>
    </div>
  )
}

function ProposalRow({ proposal }: { proposal: ProposalDto }) {
  const badge = STATUS_BADGE[proposal.status] ?? { label: proposal.status, color: "#999" }
  return (
    <Link
      href={`/proposals/${proposal.id}`}
      className="flex items-start gap-3 py-3 border-b last:border-0 hover:bg-black/[0.02] rounded-lg px-1 -mx-1 transition-colors"
      style={{ borderColor: "rgba(26,18,11,0.06)" }}
    >
      <Vote className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#1E3D2F" }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0E0B08] leading-snug line-clamp-2">{proposal.title}</p>
        {proposal.group && (
          <p className="text-[11px] mt-0.5" style={{ color: "rgba(14,11,8,0.4)" }}>{proposal.group.name}</p>
        )}
      </div>
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
        style={{ background: `${badge.color}18`, color: badge.color }}
      >
        {badge.label}
      </span>
    </Link>
  )
}

export default function WardPage() {
  const { user } = useAuth()
  const wardId   = user?.primaryWardId
  const wardName = user?.primaryWardName ?? "My Ward"

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["ward-members", wardId],
    queryFn:  () => userApi.getWardMembers(wardId!),
    enabled:  !!wardId,
    staleTime: 120_000,
  })

  const { data: leaderboard, isLoading: lbLoading } = useQuery({
    queryKey: ["ward-leaderboard", wardId],
    queryFn:  () => leaderboardApi.getLeaderboard({ scope: "ward", scopeId: wardId!, limit: 10 }),
    enabled:  !!wardId,
    staleTime: 120_000,
  })

  const { data: proposals, isLoading: propLoading } = useQuery({
    queryKey: ["ward-proposals"],
    queryFn:  () => governanceApi.getProposals({ limit: 8 }),
    enabled:  !!wardId,
    staleTime: 60_000,
  })

  if (!wardId) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto">
        <Card className="border-0 shadow-card">
          <CardContent className="py-12 text-center space-y-3">
            <MapPin className="h-10 w-10 mx-auto opacity-30" />
            <p className="font-medium text-[#0E0B08]">No ward set</p>
            <p className="text-sm" style={{ color: "rgba(14,11,8,0.45)" }}>
              Add your home ward in your profile to see local stats.
            </p>
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 text-sm font-semibold mt-2"
              style={{ color: "#1A6B3C" }}
            >
              Go to Profile <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Verification breakdown from members list
  const verificationCounts = (members ?? []).reduce<Record<string, number>>((acc, m) => {
    acc[m.verificationLevel] = (acc[m.verificationLevel] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(30,61,47,0.1)" }}
        >
          <MapPin className="h-5 w-5" style={{ color: "#1E3D2F" }} />
        </div>
        <div>
          <h2 className="font-serif font-bold text-2xl text-[#0E0B08] leading-tight">{wardName}</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(14,11,8,0.4)" }}>Ward · Local stats and activity</p>
        </div>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-3 gap-2">
        {membersLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)
        ) : (
          <>
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(30,61,47,0.07)" }}>
              <p className="text-2xl font-bold" style={{ color: "#1E3D2F" }}>{(members?.length ?? 0).toLocaleString()}</p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color: "rgba(14,11,8,0.45)" }}>Members</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(201,146,42,0.08)" }}>
              <p className="text-2xl font-bold" style={{ color: "#C9922A" }}>
                {(verificationCounts["COMMUNITY_VERIFIED"] ?? 0) + (verificationCounts["FULL_VERIFIED"] ?? 0)}
              </p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color: "rgba(14,11,8,0.45)" }}>Verified</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(26,107,60,0.06)" }}>
              <p className="text-2xl font-bold" style={{ color: "#1A6B3C" }}>
                {leaderboard?.entries?.[0]?.globalImpactPoints
                  ? leaderboard.entries.reduce((s, e) => s + e.globalImpactPoints, 0).toLocaleString()
                  : "—"}
              </p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color: "rgba(14,11,8,0.45)" }}>Total IP</p>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members">
        <TabsList className="w-full grid grid-cols-3 h-10 rounded-xl" style={{ background: "rgba(14,11,8,0.05)" }}>
          <TabsTrigger value="members" className="rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Members
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Leaderboard
          </TabsTrigger>
          <TabsTrigger value="proposals" className="rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <Vote className="h-3.5 w-3.5" /> Proposals
          </TabsTrigger>
        </TabsList>

        {/* Members */}
        <TabsContent value="members" className="mt-4">
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" style={{ color: "#1E3D2F" }} />
                  Ward Members
                </span>
                {!membersLoading && (
                  <span className="text-xs font-normal" style={{ color: "rgba(14,11,8,0.4)" }}>
                    {members?.length ?? 0} total
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="space-y-3">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
              ) : !members?.length ? (
                <p className="text-sm text-center py-6" style={{ color: "rgba(14,11,8,0.35)" }}>No members found.</p>
              ) : (
                <>
                  {/* Verification breakdown pills */}
                  <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b" style={{ borderColor: "rgba(26,18,11,0.06)" }}>
                    {Object.entries(verificationCounts).map(([level, count]) => (
                      <span
                        key={level}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: `${LEVEL_COLOR[level] ?? "#555"}18`, color: LEVEL_COLOR[level] ?? "#555" }}
                      >
                        {count} {level.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                  {members.map((m, i) => <MemberRow key={m.id} m={m} rank={i + 1} />)}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leaderboard */}
        <TabsContent value="leaderboard" className="mt-4">
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4" style={{ color: "#C9922A" }} />
                IP Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lbLoading ? (
                <div className="space-y-3">{[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
              ) : !leaderboard?.entries?.length ? (
                <p className="text-sm text-center py-6" style={{ color: "rgba(14,11,8,0.35)" }}>
                  No activity recorded yet.
                </p>
              ) : (
                leaderboard.entries.map((e) => <LeaderRow key={e.userId} entry={e} />)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Proposals */}
        <TabsContent value="proposals" className="mt-4">
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Vote className="h-4 w-4" style={{ color: "#1E3D2F" }} />
                  Recent Proposals
                </span>
                <Link
                  href="/proposals"
                  className="text-xs font-semibold flex items-center gap-0.5"
                  style={{ color: "#1A6B3C" }}
                >
                  All <ChevronRight className="h-3 w-3" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {propLoading ? (
                <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
              ) : !proposals?.proposals?.length ? (
                <p className="text-sm text-center py-6" style={{ color: "rgba(14,11,8,0.35)" }}>
                  No proposals yet.
                </p>
              ) : (
                proposals.proposals.map((p) => <ProposalRow key={p.id} proposal={p} />)
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
