"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
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
  COMMUNITY_INITIATIVE: "Community Initiative",
  MAJOR_PROJECT:        "Major Project",
  STRATEGIC_DECISION:   "Strategic Decision",
  EMERGENCY:            "Emergency",
}

// Kenyan photos per proposal type — CDN base URLs verified from Unsplash
const PROPOSAL_PHOTOS: Record<string, string[]> = {
  COMMUNITY_INITIATIVE: [
    "https://images.unsplash.com/photo-1515657241610-a6b33f0f6c5a", // community gathering, Kargi
    "https://images.unsplash.com/photo-1515657834497-26509e295154", // woman dancing, Kargi
    "https://images.unsplash.com/photo-1515658323406-25d61c141a6e", // people gathered, Kargi
    "https://images.unsplash.com/photo-1520254553641-2eed4cf2ef26", // children, northern Kenya
    "https://images.unsplash.com/photo-1576830886922-02b61aee42ad", // learning/sewing, Korogocho Nairobi
    "https://images.unsplash.com/photo-1547496614-54ff387d650a", // children playing, Kenya
    "https://images.unsplash.com/photo-1656068218535-85db26125e13", // Nairobi street scene
    "https://images.unsplash.com/photo-1741706538015-ddc358873090", // outdoor market, Karen, Nairobi
  ],
  MAJOR_PROJECT: [
    "https://images.unsplash.com/photo-1741706527174-ebd2768ffc49", // stadium construction, Nairobi
    "https://images.unsplash.com/photo-1747854828989-5c8408a8f0bc", // Konza Technopolis, Kenya
    "https://images.unsplash.com/photo-1758875168808-72bc8dd1c5bf", // construction crane, Nairobi
    "https://images.unsplash.com/photo-1673902205653-98d0c3cd3ae0", // building, Kenya coast
  ],
  STRATEGIC_DECISION: [
    "https://images.unsplash.com/photo-1655028183177-f941088a84aa", // community meeting, Karen Nairobi
    "https://images.unsplash.com/photo-1776039325163-f45315a484f3", // panel discussion, Nairobi
    "https://images.unsplash.com/photo-1548522904-e5ab6cf5e09b", // group at Masai Mara
    "https://images.unsplash.com/photo-1709427327748-a6ebaf65a691", // Maasai village, Narok
    "https://images.unsplash.com/photo-1547496727-11c450fe4e7f", // traditional Kenyan attire group
  ],
  EMERGENCY: [
    "https://images.unsplash.com/photo-1638628982284-77a437c37089", // mother and baby, Kenya
    "https://images.unsplash.com/photo-1664990594725-552201db8079", // kids in Nairobi
    "https://images.unsplash.com/photo-1603703182693-51a19941fa59", // Samburu women, Kenya
    "https://images.unsplash.com/photo-1601071733462-d0bbb6ee7a02", // Masai family, Kenya
  ],
}

function proposalCoverUrl(id: string, type?: string | null): string {
  const pool = PROPOSAL_PHOTOS[type ?? ""] ?? PROPOSAL_PHOTOS.COMMUNITY_INITIATIVE
  const seed = id.split("").slice(0, 4).reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return `${pool[seed % pool.length]}?w=800&q=75`
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

  return (
    <Link
      href={`/proposals/${proposal.id}`}
      className="rounded-xl overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 group flex flex-col h-full"
      style={{
        background: "white",
        border: "1px solid rgba(29,71,49,0.08)",
      }}
    >
      {/* Photo */}
      <div className="relative h-44 overflow-hidden flex-shrink-0">
        <Image
          src={proposalCoverUrl(proposal.id, proposal.proposalType)}
          alt=""
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, 340px"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-14"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 100%)" }}
        />
        <div className="absolute bottom-2.5 left-3 flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm"
            style={{ background: `${meta.color}dd`, color: "white" }}
          >
            {meta.label}
          </span>
          {proposal.proposalType && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm"
              style={{ background: "rgba(0,0,0,0.40)", color: "rgba(255,255,255,0.90)" }}
            >
              {TYPE_LABEL[proposal.proposalType] ?? proposal.proposalType}
            </span>
          )}
        </div>
        {proposal.group && (
          <div className="absolute top-2.5 right-3">
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm"
              style={{ background: "rgba(29,71,49,0.75)", color: "white" }}
            >
              {proposal.group.name}
            </span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3 flex flex-col flex-1">
        {/* Title + arrow */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-snug line-clamp-2" style={{ color: "#0A1F14" }}>
              {proposal.title}
            </p>
            {proposal.description && (
              <p className="mt-1 text-xs leading-relaxed line-clamp-2 flex-1" style={{ color: "#7A6E60" }}>
                {proposal.description}
              </p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "rgba(201,146,42,0.5)" }} />
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

        {/* Vote buttons — stopPropagation so clicks don't navigate */}
        {proposal.status === "VOTING" && (
          <div
            className="flex gap-2 pt-3"
            style={{ borderTop: "1px solid rgba(14,11,8,0.06)" }}
            onClick={(e) => e.stopPropagation()}
          >
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
    </Link>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(29,71,49,0.08)" }}>
              <Skeleton className="h-44 w-full rounded-none" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
