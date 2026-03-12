"use client"

import { use } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { governanceApi } from "@/lib/api"
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  MinusCircle,
  Clock,
  Users,
  TrendingUp,
} from "lucide-react"

const STATUS_META: Record<string, { label: string; className: string }> = {
  DRAFT:    { label: "Draft",    className: "bg-warm-gray/20 text-warm-gray" },
  VOTING:   { label: "Voting",   className: "bg-amber/20 text-amber" },
  APPROVED: { label: "Approved", className: "bg-tea-green/20 text-tea-green" },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700" },
}

const TYPE_LABEL: Record<string, string> = {
  STANDARD:  "Standard",
  EMERGENCY: "Emergency",
  BUDGET:    "Budget",
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
}

function relativeTime(iso: string | null) {
  if (!iso) return "—"
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const days  = Math.floor(abs / 86_400_000)
  const hours = Math.floor(abs / 3_600_000)
  const mins  = Math.floor(abs / 60_000)
  if (days > 0)  return diff > 0 ? `${days}d remaining` : `ended ${days}d ago`
  if (hours > 0) return diff > 0 ? `${hours}h remaining` : `ended ${hours}h ago`
  return diff > 0 ? `${mins}m remaining` : `ended ${mins}m ago`
}

// Vote bar — visual breakdown of yes/no weights
function VoteBar({ yes, no, total }: { yes: number; no: number; total: number }) {
  if (total === 0) return <div className="h-2 rounded-full bg-cream w-full" />
  const yesPct = Math.round((yes / total) * 100)
  const noPct  = Math.round((no  / total) * 100)
  const absPct = Math.max(0, 100 - yesPct - noPct)
  return (
    <div className="h-2 rounded-full overflow-hidden flex w-full bg-cream">
      <div className="bg-tea-green transition-all" style={{ width: `${yesPct}%` }} />
      <div className="bg-red-400 transition-all"  style={{ width: `${noPct}%`  }} />
      <div className="bg-warm-gray/30 transition-all" style={{ width: `${absPct}%` }} />
    </div>
  )
}

export default function ProposalDetailPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = use(params)
  const { isAuthenticated, user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: proposal, isLoading, isError } = useQuery({
    queryKey: ["proposal", proposalId],
    queryFn: () => governanceApi.getProposal(proposalId),
    enabled: isAuthenticated,
    staleTime: 15_000,
  })

  const { mutate: castVote, isPending: voting } = useMutation({
    mutationFn: (option: "YES" | "NO" | "ABSTAIN") =>
      governanceApi.castVote({ proposalId, option }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] })
      queryClient.invalidateQueries({ queryKey: ["proposals"] })
      toast({ title: "Vote recorded" })
    },
    onError: (err: any) => {
      toast({
        title: "Vote failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      })
    },
  })

  const { mutate: startVoting, isPending: startingVote } = useMutation({
    mutationFn: () => governanceApi.startVoting(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] })
      queryClient.invalidateQueries({ queryKey: ["proposals"] })
      toast({ title: "Voting opened", description: "Members can now cast their votes." })
    },
    onError: (err: any) => {
      toast({ title: "Failed to start voting", description: err?.message ?? "Please try again.", variant: "destructive" })
    },
  })

  const { mutate: tallyVotes, isPending: tallying } = useMutation({
    mutationFn: () => governanceApi.tallyVotes(proposalId),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] })
      queryClient.invalidateQueries({ queryKey: ["proposals"] })
      toast({ title: `Proposal ${data?.newStatus === "APPROVED" ? "approved" : "rejected"}` })
    },
    onError: (err: any) => {
      toast({ title: "Tally failed", description: err?.message ?? "Please try again.", variant: "destructive" })
    },
  })

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-sm text-warm-gray">
        Sign in to view this proposal.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-warm-gray" />
      </div>
    )
  }

  if (isError || !proposal) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-sm text-red-600 mb-4">Proposal not found.</p>
        <Link href="/proposals" className="text-sm text-amber hover:underline">
          ← Back to proposals
        </Link>
      </div>
    )
  }

  const statusMeta = STATUS_META[proposal.status] ?? { label: proposal.status, className: "bg-gray-100 text-gray-600" }
  const summary = proposal.votesSummary
  const yesWeight = summary?.yesWeight ?? 0
  const noWeight  = summary?.noWeight  ?? 0
  const total     = summary?.total ?? proposal._count?.votes ?? 0
  const absWeight = Math.max(0, total - yesWeight - noWeight)

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      {/* Back */}
      <Link href="/proposals" className="inline-flex items-center gap-1.5 text-sm text-warm-gray hover:text-amber transition-colors">
        <ArrowLeft className="h-4 w-4" />
        All proposals
      </Link>

      {/* Header card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 space-y-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className={`text-xs font-semibold ${statusMeta.className}`}>{statusMeta.label}</Badge>
            {proposal.proposalType && (
              <Badge variant="outline" className="text-xs">{TYPE_LABEL[proposal.proposalType] ?? proposal.proposalType}</Badge>
            )}
            {proposal.group && (
              <Badge variant="outline" className="text-xs">{proposal.group.name}</Badge>
            )}
          </div>

          {/* Title */}
          <h1 className="text-xl font-bold text-[#0A1F14] leading-snug" style={{ fontFamily: "var(--font-cormorant, serif)" }}>
            {proposal.title}
          </h1>

          {/* Description */}
          {proposal.description && (
            <p className="text-sm text-warm-gray leading-relaxed whitespace-pre-line">
              {proposal.description}
            </p>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-cream text-xs text-warm-gray">
            {proposal.creator && (
              <div>
                <p className="font-semibold text-[#0A1F14] mb-0.5">Proposed by</p>
                <p>{proposal.creator.name}</p>
              </div>
            )}
            <div>
              <p className="font-semibold text-[#0A1F14] mb-0.5">Created</p>
              <p>{formatDate(proposal.createdAt)}</p>
            </div>
            {proposal.votingStartsAt && (
              <div>
                <p className="font-semibold text-[#0A1F14] mb-0.5">Voting started</p>
                <p>{formatDate(proposal.votingStartsAt)}</p>
              </div>
            )}
            {proposal.votingEndsAt && (
              <div>
                <p className="font-semibold text-[#0A1F14] mb-0.5">Voting deadline</p>
                <p className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {relativeTime(proposal.votingEndsAt)}
                </p>
              </div>
            )}
            {proposal.budget && (
              <div>
                <p className="font-semibold text-[#0A1F14] mb-0.5">Budget</p>
                <p>KES {Number(proposal.budget).toLocaleString()}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vote tally card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber" />
            <h2 className="text-sm font-bold text-[#0A1F14]">Vote Tally</h2>
            <span className="ml-auto flex items-center gap-1 text-xs text-warm-gray">
              <Users className="h-3 w-3" />
              {total} vote{total !== 1 ? "s" : ""}
            </span>
          </div>

          <VoteBar yes={yesWeight} no={noWeight} total={total} />

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-tea-green/10 py-3">
              <p className="text-xl font-bold text-tea-green">{yesWeight}</p>
              <p className="text-xs text-warm-gray mt-0.5">Yes</p>
            </div>
            <div className="rounded-xl bg-red-50 py-3">
              <p className="text-xl font-bold text-red-500">{noWeight}</p>
              <p className="text-xs text-warm-gray mt-0.5">No</p>
            </div>
            <div className="rounded-xl bg-cream py-3">
              <p className="text-xl font-bold text-warm-gray">{absWeight}</p>
              <p className="text-xs text-warm-gray mt-0.5">Abstain</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Start Voting — only for creator when proposal is DRAFT */}
      {proposal.status === "DRAFT" && user?.id === proposal.creatorId && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 space-y-3">
            <h2 className="text-sm font-bold text-[#0A1F14]">Open for Voting</h2>
            <p className="text-xs text-warm-gray">
              Once you start voting, members of the group can cast their votes. This action cannot be undone.
            </p>
            <button
              onClick={() => startVoting()}
              disabled={startingVote}
              className="w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "#D4911E", color: "#0A1F14" }}
            >
              {startingVote ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              {startingVote ? "Opening…" : "Start Voting"}
            </button>
          </CardContent>
        </Card>
      )}

      {/* Tally Votes — for VOTING proposals (any authenticated user can trigger) */}
      {proposal.status === "VOTING" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#0A1F14]">Close & Tally</p>
              <p className="text-xs text-warm-gray">Finalise the result once the voting deadline has passed.</p>
            </div>
            <button
              onClick={() => tallyVotes()}
              disabled={tallying}
              className="flex-shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold border border-warm-gray/30 text-warm-gray hover:border-amber hover:text-amber transition-colors disabled:opacity-50"
            >
              {tallying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
              {tallying ? "Tallying…" : "Tally Votes"}
            </button>
          </CardContent>
        </Card>
      )}

      {/* Vote actions — only for VOTING proposals */}
      {proposal.status === "VOTING" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 space-y-3">
            <h2 className="text-sm font-bold text-[#0A1F14]">Cast your vote</h2>
            <p className="text-xs text-warm-gray">Your vote is weighted by your Participation Rights balance.</p>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => castVote("YES")}
                disabled={voting}
                className="flex flex-col items-center gap-1.5 rounded-xl py-4 text-sm font-semibold bg-tea-green/10 text-tea-green hover:bg-tea-green/20 transition-colors disabled:opacity-50"
              >
                {voting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                Yes
              </button>
              <button
                onClick={() => castVote("NO")}
                disabled={voting}
                className="flex flex-col items-center gap-1.5 rounded-xl py-4 text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {voting ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
                No
              </button>
              <button
                onClick={() => castVote("ABSTAIN")}
                disabled={voting}
                className="flex flex-col items-center gap-1.5 rounded-xl py-4 text-sm font-semibold bg-cream text-warm-gray hover:bg-cream/80 transition-colors disabled:opacity-50"
              >
                {voting ? <Loader2 className="h-5 w-5 animate-spin" /> : <MinusCircle className="h-5 w-5" />}
                Abstain
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
