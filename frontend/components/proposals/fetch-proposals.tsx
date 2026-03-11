"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { governanceApi, type ProposalDto } from "@/lib/api"
import {
  Vote,
  Clock,
  CheckCircle,
  XCircle,
  MinusCircle,
  ChevronRight,
  Loader2,
} from "lucide-react"

interface FetchProposalsProps {
  onCreateProposal?: () => void
}

type TabStatus = "ALL" | "VOTING" | "APPROVED" | "REJECTED"

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
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

function statusBadge(status: string) {
  const s = STATUS_LABEL[status] ?? { label: status, className: "bg-gray-100 text-gray-600" }
  return <Badge className={`text-xs font-semibold ${s.className}`}>{s.label}</Badge>
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—"
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const mins  = Math.floor(abs / 60_000)
  const hours = Math.floor(abs / 3_600_000)
  const days  = Math.floor(abs / 86_400_000)
  if (days > 0)  return diff > 0 ? `${days}d left`  : `${days}d ago`
  if (hours > 0) return diff > 0 ? `${hours}h left` : `${hours}h ago`
  return diff > 0 ? `${mins}m left` : `${mins}m ago`
}

// ── Proposal card ────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  onVote,
  voting,
}: {
  proposal: ProposalDto
  onVote: (id: string, option: "YES" | "NO" | "ABSTAIN") => void
  voting: boolean
}) {
  const total = proposal._count?.votes ?? proposal.votesSummary?.total ?? 0

  return (
    <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* badges */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {statusBadge(proposal.status)}
              {proposal.proposalType && (
                <Badge variant="outline" className="text-xs">
                  {TYPE_LABEL[proposal.proposalType] ?? proposal.proposalType}
                </Badge>
              )}
              {proposal.group && (
                <Badge variant="outline" className="text-xs">
                  {proposal.group.name}
                </Badge>
              )}
            </div>

            {/* title */}
            <Link
              href={`/proposals/${proposal.id}`}
              className="text-base font-semibold text-[#0A1F14] hover:text-amber transition-colors line-clamp-2"
            >
              {proposal.title}
            </Link>

            {/* description */}
            {proposal.description && (
              <p className="mt-1 text-sm text-warm-gray line-clamp-2">
                {proposal.description}
              </p>
            )}

            {/* meta row */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-warm-gray">
              {proposal.creator && <span>By {proposal.creator.name}</span>}
              <span>{total} vote{total !== 1 ? "s" : ""}</span>
              {proposal.votingEndsAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {relativeTime(proposal.votingEndsAt)}
                </span>
              )}
            </div>
          </div>

          {/* detail arrow */}
          <Link href={`/proposals/${proposal.id}`} className="mt-1 shrink-0">
            <ChevronRight className="h-5 w-5 text-warm-gray hover:text-amber transition-colors" />
          </Link>
        </div>

        {/* vote buttons — only for VOTING proposals */}
        {proposal.status === "VOTING" && (
          <div className="mt-4 flex gap-2 pt-4 border-t border-cream">
            <button
              onClick={() => onVote(proposal.id, "YES")}
              disabled={voting}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold bg-tea-green/10 text-tea-green hover:bg-tea-green/20 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              Yes
            </button>
            <button
              onClick={() => onVote(proposal.id, "NO")}
              disabled={voting}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              No
            </button>
            <button
              onClick={() => onVote(proposal.id, "ABSTAIN")}
              disabled={voting}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold bg-warm-gray/10 text-warm-gray hover:bg-warm-gray/20 transition-colors disabled:opacity-50"
            >
              <MinusCircle className="h-4 w-4" />
              Abstain
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function FetchProposals({ onCreateProposal: _onCreateProposal }: FetchProposalsProps) {
  const [tab, setTab] = useState<TabStatus>("ALL")
  const { isAuthenticated } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const queryKey = ["proposals", tab]

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () =>
      governanceApi.getProposals(tab === "ALL" ? {} : { status: tab }),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  const { mutate: castVote, isPending: voting } = useMutation({
    mutationFn: ({ proposalId, option }: { proposalId: string; option: "YES" | "NO" | "ABSTAIN" }) =>
      governanceApi.castVote({ proposalId, option }),
    onSuccess: () => {
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

  const proposals = data?.proposals ?? []

  if (!isAuthenticated) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-10 text-center">
          <Vote className="h-12 w-12 text-warm-gray mx-auto mb-3" />
          <p className="text-sm text-warm-gray">Sign in to view governance proposals.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabStatus)}>
        <TabsList className="bg-cream border border-cream rounded-full h-9 p-1">
          {(["ALL", "VOTING", "APPROVED", "REJECTED"] as TabStatus[]).map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-full text-xs font-semibold px-4 data-[state=active]:bg-[#1D4731] data-[state=active]:text-cream"
            >
              {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-warm-gray" />
        </div>
      ) : isError ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-sm text-red-600">
            Failed to load proposals.
          </CardContent>
        </Card>
      ) : proposals.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 text-center">
            <Vote className="h-12 w-12 text-warm-gray mx-auto mb-3" />
            <p className="text-sm text-warm-gray">No proposals yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onVote={(id, option) => castVote({ proposalId: id, option })}
              voting={voting}
            />
          ))}
        </div>
      )}
    </div>
  )
}
