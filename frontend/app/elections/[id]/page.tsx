"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ChevronLeft,
  Users,
  Vote,
  CheckCircle,
  CalendarDays,
  Trophy,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { electionsApi, ElectionCandidateDto } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function roleLabel(roleKey: string) {
  return roleKey
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function CandidateCard({
  candidate,
  myVotedId,
  canVote,
  onVote,
  isVoting,
  winnerId,
}: {
  candidate: ElectionCandidateDto
  myVotedId?: string
  canVote: boolean
  onVote: (id: string) => void
  isVoting: boolean
  winnerId?: string
}) {
  const isWithdrawn = !!candidate.withdrawnAt
  const isWinner = winnerId === candidate.userId
  const isVotedFor = myVotedId === candidate.id

  return (
    <div
      className="rounded-xl p-4 flex gap-3 items-start"
      style={{
        background: isWinner
          ? "rgba(201,146,42,0.06)"
          : isWithdrawn
          ? "rgba(0,0,0,0.02)"
          : "white",
        border: `1px solid ${
          isWinner
            ? "rgba(201,146,42,0.30)"
            : isWithdrawn
            ? "rgba(0,0,0,0.05)"
            : "rgba(29,71,49,0.10)"
        }`,
        opacity: isWithdrawn ? 0.5 : 1,
      }}
    >
      <Avatar className="h-10 w-10 rounded-xl flex-shrink-0">
        <AvatarImage src={candidate.avatarUrl} />
        <AvatarFallback className="rounded-xl bg-[#1D4731] text-white text-sm">
          {candidate.userName[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[14px] text-gray-800">{candidate.userName}</span>
          {isWinner && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
              <Trophy className="h-3 w-3" /> Winner
            </span>
          )}
          {isWithdrawn && (
            <span className="text-[11px] text-gray-400">Withdrawn</span>
          )}
          {isVotedFor && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600">
              <CheckCircle className="h-3 w-3" /> Your vote
            </span>
          )}
        </div>

        {candidate.statement && (
          <p className="mt-1 text-[12px] text-gray-500 leading-relaxed line-clamp-3">
            {candidate.statement}
          </p>
        )}

        <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-400">
          <span>{candidate.voteCount} vote{candidate.voteCount !== 1 ? "s" : ""}</span>
          <span>{candidate.totalWeight} weight</span>
        </div>
      </div>

      {canVote && !isWithdrawn && !myVotedId && (
        <Button
          size="sm"
          className="text-xs flex-shrink-0"
          style={{ background: "#1D4731", color: "white" }}
          onClick={() => onVote(candidate.id)}
          disabled={isVoting}
        >
          {isVoting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Vote"}
        </Button>
      )}
    </div>
  )
}

export default function ElectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const qc = useQueryClient()
  const { toast } = useToast()

  const [statement, setStatement] = useState("")
  const [showNominateForm, setShowNominateForm] = useState(false)

  const { data: election, isLoading } = useQuery({
    queryKey: ["election", id],
    queryFn: () => electionsApi.getElection(id),
  })

  const nominateMutation = useMutation({
    mutationFn: () => electionsApi.nominate(id, statement.trim() || undefined),
    onSuccess: () => {
      toast({ title: "Nomination submitted" })
      setShowNominateForm(false)
      qc.invalidateQueries({ queryKey: ["election", id] })
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  })

  const withdrawMutation = useMutation({
    mutationFn: () => electionsApi.withdrawNomination(id),
    onSuccess: () => {
      toast({ title: "Nomination withdrawn" })
      qc.invalidateQueries({ queryKey: ["election", id] })
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  })

  const [votingFor, setVotingFor] = useState<string | null>(null)
  const voteMutation = useMutation({
    mutationFn: (candidateId: string) => electionsApi.castVote(id, candidateId),
    onSuccess: () => {
      toast({ title: "Vote cast successfully" })
      setVotingFor(null)
      qc.invalidateQueries({ queryKey: ["election", id] })
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" })
      setVotingFor(null)
    },
  })

  const handleVote = (candidateId: string) => {
    setVotingFor(candidateId)
    voteMutation.mutate(candidateId)
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  if (!election) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center text-gray-500">
        Election not found.
      </div>
    )
  }

  const canNominate = election.status === "NOMINATIONS_OPEN" && isAuthenticated
  const canVote = election.status === "VOTING_OPEN" && isAuthenticated && !election.myVotedCandidateId
  const activeCandidates = election.candidates.filter((c) => !c.withdrawnAt)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Elections
      </button>

      {/* Header card */}
      <div
        className="rounded-2xl p-5 space-y-3"
        style={{ background: "white", border: "1px solid rgba(29,71,49,0.10)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-gray-900">
            {roleLabel(election.roleKey)}
          </h1>
          <span
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
            style={
              election.status === "VOTING_OPEN"
                ? { background: "rgba(201,146,42,0.12)", color: "#C9922A" }
                : election.status === "NOMINATIONS_OPEN"
                ? { background: "rgba(42,122,75,0.10)", color: "#2A7A4B" }
                : { background: "rgba(0,0,0,0.05)", color: "#666" }
            }
          >
            {election.status.replace(/_/g, " ")}
          </span>
        </div>

        {election.groupName && (
          <p className="text-sm text-gray-500">{election.groupName}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          {[
            { icon: Users, label: "Candidates", value: activeCandidates.length },
            { icon: Vote, label: "Total weight", value: election.totalVoteWeight },
            {
              icon: CheckCircle,
              label: "Quorum",
              value: election.quorumReached ? "Reached" : "Pending",
            },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-xl p-3 text-center"
              style={{ background: "rgba(29,71,49,0.04)" }}
            >
              <Icon className="h-4 w-4 mx-auto mb-1 text-gray-400" />
              <p className="text-[13px] font-bold text-gray-800">{value}</p>
              <p className="text-[10px] text-gray-400">{label}</p>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="space-y-1 pt-1 text-[12px] text-gray-500">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Nominations: {formatDate(election.nominationsOpenAt)} — {formatDate(election.nominationsCloseAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Voting: {formatDate(election.votingOpenAt)} — {formatDate(election.votingCloseAt)}
            </span>
          </div>
        </div>

        {/* Winner */}
        {election.winnerId && (
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-3"
            style={{ background: "rgba(201,146,42,0.08)", border: "1px solid rgba(201,146,42,0.20)" }}
          >
            <Trophy className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-amber-800">
              Winner: {election.winnerName}
            </span>
          </div>
        )}
      </div>

      {/* Nominate section */}
      {canNominate && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "rgba(42,122,75,0.05)", border: "1px solid rgba(42,122,75,0.15)" }}
        >
          {election.myNominationId ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-700">You are nominated</p>
                <p className="text-xs text-green-600 mt-0.5">
                  You can withdraw your nomination until voting opens
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50 text-xs"
                onClick={() => withdrawMutation.mutate()}
                disabled={withdrawMutation.isPending}
              >
                {withdrawMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Withdraw"
                )}
              </Button>
            </div>
          ) : showNominateForm ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-green-800">Nominate yourself</p>
              <Textarea
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                placeholder="Optional: share your vision and qualifications (max 1000 chars)"
                maxLength={1000}
                rows={4}
                className="text-sm resize-none"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  style={{ background: "#1D4731", color: "white" }}
                  onClick={() => nominateMutation.mutate()}
                  disabled={nominateMutation.isPending}
                >
                  {nominateMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  Submit nomination
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowNominateForm(false)}
                  className="text-gray-500"
                >
                  Cancel
                </Button>
              </div>
              <p className="text-[11px] text-gray-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                A nomination fee (PR) will be deducted from your balance
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-800">Nominations open</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Stand for election — a PR fee applies
                </p>
              </div>
              <Button
                size="sm"
                style={{ background: "#1D4731", color: "white" }}
                onClick={() => setShowNominateForm(true)}
                className="text-xs"
              >
                Nominate yourself
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Voting banner */}
      {election.status === "VOTING_OPEN" && election.myVotedCandidateId && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-2"
          style={{ background: "rgba(42,122,75,0.06)", border: "1px solid rgba(42,122,75,0.15)" }}
        >
          <CheckCircle className="h-4 w-4 text-green-600" />
          <p className="text-sm text-green-700 font-medium">You have cast your vote</p>
        </div>
      )}

      {/* Candidates */}
      <div className="space-y-2">
        <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-wide">
          Candidates ({activeCandidates.length})
        </h2>
        {election.candidates.length === 0 ? (
          <div
            className="rounded-xl px-4 py-8 text-center text-gray-400 text-sm"
            style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            No candidates yet
          </div>
        ) : (
          <div className="space-y-2">
            {election.candidates.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                myVotedId={election.myVotedCandidateId}
                canVote={canVote}
                onVote={handleVote}
                isVoting={votingFor === c.id && voteMutation.isPending}
                winnerId={election.winnerId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
