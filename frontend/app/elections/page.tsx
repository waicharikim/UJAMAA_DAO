"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { ScrollText, Clock, Vote, CheckCircle, Users, ChevronRight, CalendarDays } from "lucide-react"
import { electionsApi, ElectionSummaryDto, ElectionStatus } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"

const STATUS_TABS: { label: string; value: ElectionStatus | "ALL" }[] = [
  { label: "All",             value: "ALL" },
  { label: "Nominations",     value: "NOMINATIONS_OPEN" },
  { label: "Voting Open",     value: "VOTING_OPEN" },
  { label: "Pending",         value: "PENDING" },
  { label: "Closed",          value: "CLOSED" },
]

function statusBadge(status: ElectionStatus) {
  const map: Record<ElectionStatus, { label: string; color: string }> = {
    PENDING:          { label: "Pending",     color: "#888" },
    NOMINATIONS_OPEN: { label: "Nominations", color: "#2A7A4B" },
    VOTING_OPEN:      { label: "Voting Open", color: "#C9922A" },
    CLOSED:           { label: "Closed",      color: "#555" },
  }
  const { label, color } = map[status] ?? { label: status, color: "#888" }
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  )
}

function roleLabel(roleKey: string) {
  return roleKey
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function ElectionCard({ election }: { election: ElectionSummaryDto }) {
  return (
    <Link href={`/elections/${election.id}`}>
      <div
        className="group rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition-all duration-200 hover:shadow-md"
        style={{
          background: "white",
          border: "1px solid rgba(29,71,49,0.10)",
        }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {statusBadge(election.status)}
              <span className="text-[11px] text-gray-400">{election.scope}</span>
            </div>
            <h3 className="mt-1.5 text-[15px] font-semibold text-gray-800 leading-snug">
              {roleLabel(election.roleKey)}
              {election.groupName && (
                <span className="text-gray-400 font-normal"> — {election.groupName}</span>
              )}
            </h3>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-1 group-hover:text-amber-500 transition-colors" />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-[12px] text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {election.candidateCount} candidate{election.candidateCount !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Vote className="h-3.5 w-3.5" />
            {election.totalVoteWeight} weight
          </span>
          {election.myNominationId && (
            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 py-0">
              You&apos;re nominated
            </Badge>
          )}
          {election.myVotedCandidateId && (
            <Badge variant="outline" className="text-[10px] border-green-500 text-green-600 py-0">
              Voted
            </Badge>
          )}
        </div>

        {/* Timeline */}
        <div
          className="rounded-lg px-3 py-2 text-[11px] text-gray-500 flex items-center gap-1.5"
          style={{ background: "rgba(29,71,49,0.04)" }}
        >
          <CalendarDays className="h-3 w-3 flex-shrink-0" />
          {election.status === "NOMINATIONS_OPEN" && (
            <>Nominations close {formatDate(election.nominationsCloseAt)}</>
          )}
          {election.status === "VOTING_OPEN" && (
            <>Voting closes {formatDate(election.votingCloseAt)}</>
          )}
          {election.status === "PENDING" && (
            <>Nominations open {formatDate(election.nominationsOpenAt)}</>
          )}
          {election.status === "CLOSED" && (
            <>
              {election.winnerId
                ? `Winner: ${election.winnerName ?? "Declared"}`
                : "No quorum reached"}
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl p-4 border border-gray-100 flex flex-col gap-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3 w-40" />
    </div>
  )
}

export default function ElectionsPage() {
  const { isAuthenticated } = useAuth()
  const [tab, setTab] = useState<ElectionStatus | "ALL">("ALL")

  const { data, isLoading } = useQuery({
    queryKey: ["elections", tab],
    queryFn: () =>
      electionsApi.listElections({
        status: tab === "ALL" ? undefined : tab,
        limit: 50,
      }),
  })

  const { data: myData } = useQuery({
    queryKey: ["elections-mine"],
    queryFn: () => electionsApi.getMyElections(),
    enabled: isAuthenticated,
  })

  const myPending = myData?.elections.filter(
    (e) => e.status === "NOMINATIONS_OPEN" || e.status === "VOTING_OPEN"
  ) ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(29,71,49,0.10)" }}
        >
          <ScrollText className="h-5 w-5" style={{ color: "#1D4731" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Elections</h1>
          <p className="text-sm text-gray-500">Community leadership elections</p>
        </div>
      </div>

      {/* Action banner — items needing attention */}
      {myPending.length > 0 && (
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: "rgba(201,146,42,0.08)", border: "1px solid rgba(201,146,42,0.20)" }}
        >
          <Clock className="h-5 w-5 flex-shrink-0" style={{ color: "#C9922A" }} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {myPending.length} election{myPending.length !== 1 ? "s" : ""} need your attention
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              You have active nominations or open votes
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-amber-700 border-amber-400 hover:bg-amber-50 text-xs"
            onClick={() => setTab("VOTING_OPEN")}
          >
            View
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150"
            style={
              tab === t.value
                ? { background: "#1D4731", color: "white" }
                : { background: "rgba(29,71,49,0.06)", color: "#555" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : !data?.elections.length ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No elections in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.elections.map((e) => <ElectionCard key={e.id} election={e} />)}
        </div>
      )}
    </div>
  )
}
