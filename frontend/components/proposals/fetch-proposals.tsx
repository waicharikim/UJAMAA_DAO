"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
  Activity,
  ShieldCheck,
} from "lucide-react"

interface FetchProposalsProps {
  onCreateProposal?: () => void
}

type TabStatus = "ALL" | "VOTING" | "APPROVED" | "REJECTED"

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:               { label: "Draft",          color: "#7A6E60", bg: "rgba(122,110,96,0.10)" },
  PENDING_REVIEW:      { label: "Under Review",   color: "#C9922A", bg: "rgba(201,146,42,0.10)" },
  APPROVED_FOR_VOTING: { label: "Ready to Vote",  color: "#2A6B7C", bg: "rgba(42,107,124,0.10)" },
  VOTING:              { label: "Voting Open",    color: "#1D4731", bg: "rgba(29,71,49,0.10)"  },
  APPROVED:            { label: "Approved",       color: "#1A6B3C", bg: "rgba(26,107,60,0.10)" },
  REJECTED:            { label: "Rejected",       color: "#B03A1E", bg: "rgba(176,58,30,0.10)" },
  EXECUTING:           { label: "Executing",      color: "#2A6B7C", bg: "rgba(42,107,124,0.10)" },
  COMPLETED:           { label: "Completed",      color: "#1D4731", bg: "rgba(29,71,49,0.10)"  },
  CANCELLED:           { label: "Cancelled",      color: "#7A6E60", bg: "rgba(122,110,96,0.10)" },
}

const TYPE_LABEL: Record<string, string> = {
  STANDARD:  "Standard",
  EMERGENCY: "Emergency",
  BUDGET:    "Budget",
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

function VotingBar({ yesWeight, noWeight }: { yesWeight: number; noWeight: number }) {
  const total = yesWeight + noWeight
  if (total === 0) return null
  const yesPct = Math.round((yesWeight / total) * 100)
  return (
    <div className="space-y-1.5">
      <div className="h-2 rounded-full overflow-hidden flex gap-px" style={{ background: "rgba(14,11,8,0.06)" }}>
        <div className="h-full rounded-l-full transition-all duration-500"
          style={{ width: `${yesPct}%`, background: "linear-gradient(90deg, #1D4731, #2E6B4F)" }} />
        <div className="h-full rounded-r-full transition-all duration-500"
          style={{ width: `${100 - yesPct}%`, background: "linear-gradient(90deg, #C0452A, #A03020)" }} />
      </div>
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(29,71,49,0.10)", color: "#1D4731" }}>
          ✓ {yesPct}% For
        </span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(176,58,30,0.10)", color: "#B03A1E" }}>
          ✕ {100 - yesPct}% Against
        </span>
        <span className="ml-auto text-[10px]" style={{ color: "#7A6E60" }}>{total} vote{total !== 1 ? "s" : ""}</span>
      </div>
    </div>
  )
}

function ProposalCard({
  proposal,
  onVote,
  voting,
}: {
  proposal: ProposalDto
  onVote: (id: string, option: "YES" | "NO" | "ABSTAIN") => void
  voting: boolean
}) {
  const meta = STATUS_META[proposal.status] ?? STATUS_META.DRAFT
  const total = proposal._count?.votes ?? proposal.votesSummary?.total ?? 0
  const isVoting = proposal.status === "VOTING" || proposal.status === "APPROVED_FOR_VOTING"

  return (
    <div
      className="rounded-xl overflow-hidden transition-all hover:shadow-md"
      style={{
        background: "white",
        border: "1px solid rgba(29,71,49,0.08)",
        borderLeft: isVoting ? `3px solid ${meta.color}` : undefined,
      }}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: meta.bg, color: meta.color }}
              >
                {meta.label}
              </span>
              {proposal.proposalType && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ background: "rgba(14,11,8,0.05)", color: "#7A6E60" }}
                >
                  {TYPE_LABEL[proposal.proposalType] ?? proposal.proposalType}
                </span>
              )}
              {proposal.group && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ background: "rgba(29,71,49,0.07)", color: "#1D4731" }}
                >
                  {proposal.group.name}
                </span>
              )}
            </div>
            <Link
              href={`/proposals/${proposal.id}`}
              className="text-sm font-bold leading-snug line-clamp-2 hover:underline"
              style={{ color: "#0A1F14" }}
            >
              {proposal.title}
            </Link>
            {proposal.description && (
              <p className="mt-1 text-xs leading-relaxed line-clamp-2" style={{ color: "#7A6E60" }}>
                {proposal.description}
              </p>
            )}
          </div>
          <Link href={`/proposals/${proposal.id}`} className="shrink-0 mt-0.5">
            <ChevronRight className="h-4 w-4" style={{ color: "rgba(201,146,42,0.5)" }} />
          </Link>
        </div>

        {/* Voting bar */}
        <VotingBar
          yesWeight={proposal.votesSummary?.yesWeight ?? 0}
          noWeight={proposal.votesSummary?.noWeight ?? 0}
        />

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: "#7A6E60" }}>
          {proposal.creator && (
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                style={{ background: "#1D4731" }}
              >
                {(proposal.creator.name ?? "M")[0].toUpperCase()}
              </div>
              <span className="font-medium" style={{ color: "#1A120B" }}>{proposal.creator.name}</span>
            </div>
          )}
          <span>{total} vote{total !== 1 ? "s" : ""}</span>
          {proposal.votingEndsAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {relativeTime(proposal.votingEndsAt)}
            </span>
          )}
        </div>

        {/* Vote buttons */}
        {proposal.status === "VOTING" && (
          <div className="flex gap-2 pt-3" style={{ borderTop: "1px solid rgba(14,11,8,0.06)" }}>
            <button
              onClick={() => onVote(proposal.id, "YES")}
              disabled={voting}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold transition-all disabled:opacity-50"
              style={{ background: "rgba(29,71,49,0.08)", color: "#1D4731" }}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Yes
            </button>
            <button
              onClick={() => onVote(proposal.id, "NO")}
              disabled={voting}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold transition-all disabled:opacity-50"
              style={{ background: "rgba(176,58,30,0.08)", color: "#B03A1E" }}
            >
              <XCircle className="h-3.5 w-3.5" />
              No
            </button>
            <button
              onClick={() => onVote(proposal.id, "ABSTAIN")}
              disabled={voting}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold transition-all disabled:opacity-50"
              style={{ background: "rgba(122,110,96,0.08)", color: "#7A6E60" }}
            >
              <MinusCircle className="h-3.5 w-3.5" />
              Abstain
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function FetchProposals({ onCreateProposal: _onCreateProposal }: FetchProposalsProps) {
  const [tab, setTab] = useState<TabStatus>("ALL")
  const { isAuthenticated } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ["proposals", tab],
    queryFn: () => governanceApi.getProposals(tab === "ALL" ? {} : { status: tab }),
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
      toast({ title: "Vote failed", description: err?.message ?? "Please try again.", variant: "destructive" })
    },
  })

  const proposals = data?.proposals ?? []

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl py-12 text-center" style={{ border: "1px solid rgba(29,71,49,0.08)" }}>
        <Vote className="h-10 w-10 mx-auto mb-3 opacity-20" style={{ color: "#1D4731" }} />
        <p className="text-sm" style={{ color: "#7A6E60" }}>Sign in to view governance proposals.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tab strip */}
      <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: "rgba(14,11,8,0.06)" }}>
        {(["ALL", "VOTING", "APPROVED", "REJECTED"] as TabStatus[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors"
            style={tab === t
              ? { color: "#1D4731", borderBottom: "2px solid #1D4731" }
              : { color: "#7A6E60" }}
          >
            {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl p-4 space-y-3" style={{ border: "1px solid rgba(29,71,49,0.08)" }}>
              <div className="flex justify-between gap-3">
                <Skeleton className="h-4 w-48 flex-1" />
                <Skeleton className="h-5 w-20 rounded-full flex-shrink-0" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl p-8 text-center text-sm" style={{ color: "#B03A1E", border: "1px solid rgba(176,58,30,0.15)" }}>
          Failed to load proposals.
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-xl py-12 text-center" style={{ border: "1px solid rgba(29,71,49,0.08)" }}>
          <Vote className="h-10 w-10 mx-auto mb-3 opacity-20" style={{ color: "#1D4731" }} />
          <p className="text-sm" style={{ color: "#7A6E60" }}>No proposals yet.</p>
        </div>
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
