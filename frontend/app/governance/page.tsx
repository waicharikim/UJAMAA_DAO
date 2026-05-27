"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  governanceApi,
  platformConfigApi,
  electionsApi,
  type ProposalDto,
  type ProposalStatus,
  type ElectionSummaryDto,
  type ElectionStatus,
} from "@/lib/api"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import { FetchProposals } from "@/components/proposals/fetch-proposals"
import { VotingProvider } from "@/contexts/voting-context"
import {
  Scale,
  Vote,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  ShieldCheck,
  Coins,
  Server,
  MessageSquare,
  Banknote,
  TrendingUp,
  Users,
  ScrollText,
  ChevronRight,
  CalendarDays,
  Plus,
} from "lucide-react"

// ── Shared helpers ─────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
}

// ── Proposal cover photos ──────────────────────────────────────────────────

// Verified Kenyan community photos — real CDN base URLs confirmed from Unsplash
const PROPOSAL_PHOTOS = [
  "https://images.unsplash.com/photo-1515657241610-a6b33f0f6c5a", // community gathering, Kargi, Kenya
  "https://images.unsplash.com/photo-1515657834497-26509e295154", // woman dancing, Kargi, Kenya
  "https://images.unsplash.com/photo-1547496727-11c450fe4e7f", // traditional Kenyan attire group
  "https://images.unsplash.com/photo-1515658323406-25d61c141a6e", // people gathered, Kargi, Kenya
  "https://images.unsplash.com/photo-1603703182693-51a19941fa59", // Samburu women, Kenya
  "https://images.unsplash.com/photo-1601071733462-d0bbb6ee7a02", // Masai family, Masai Village, Kenya
  "https://images.unsplash.com/photo-1704495669300-216e12543f9f", // Masai Mara, Kenya
  "https://images.unsplash.com/photo-1610982330184-b26f7ea46541", // Masai in traditional clothing, Masai Mara
  "https://images.unsplash.com/photo-1741706538015-ddc358873090", // outdoor market, Karen, Nairobi
  "https://images.unsplash.com/photo-1709427327748-a6ebaf65a691", // Maasai village, Naboisho, Narok
  "https://images.unsplash.com/photo-1623519364070-effe59a1c4d7", // rural Kenya, Massi village
  "https://images.unsplash.com/photo-1709427249173-85111186e52a", // Maasai dwelling, Kenya
]

function proposalCoverUrl(id: string): string {
  const seed = id.split("").slice(0, 4).reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return `${PROPOSAL_PHOTOS[seed % PROPOSAL_PHOTOS.length]}?w=800&q=75`
}

// ── Platform Governance section ────────────────────────────────────────────

const PROPOSAL_STATUS_META: Record<string, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  DRAFT:               { label: "Draft",          Icon: Clock,        color: "#7A6E60", bg: "rgba(122,110,96,0.10)"  },
  PENDING_REVIEW:      { label: "Under Review",   Icon: ShieldCheck,  color: "#C9922A", bg: "rgba(201,146,42,0.10)" },
  APPROVED_FOR_VOTING: { label: "Ready for Vote", Icon: Vote,         color: "#2A6B7C", bg: "rgba(42,107,124,0.10)" },
  VOTING:              { label: "Voting Open",     Icon: Activity,     color: "#1D4731", bg: "rgba(29,71,49,0.10)"  },
  APPROVED:            { label: "Approved",        Icon: CheckCircle,  color: "#1A6B3C", bg: "rgba(26,107,60,0.10)" },
  REJECTED:            { label: "Rejected",        Icon: XCircle,      color: "#B03A1E", bg: "rgba(176,58,30,0.10)" },
  EXECUTING:           { label: "Executing",       Icon: Activity,     color: "#2A6B7C", bg: "rgba(42,107,124,0.10)" },
  COMPLETED:           { label: "Completed",       Icon: CheckCircle,  color: "#1D4731", bg: "rgba(29,71,49,0.10)"  },
  CANCELLED:           { label: "Cancelled",       Icon: XCircle,      color: "#7A6E60", bg: "rgba(122,110,96,0.10)" },
}

function VotingBar({ yesWeight, noWeight }: { yesWeight: number; noWeight: number }) {
  const total = yesWeight + noWeight
  if (total === 0) return null
  const yesPct = Math.round((yesWeight / total) * 100)
  const noPct  = 100 - yesPct
  return (
    <div className="space-y-2">
      {/* Segmented bar */}
      <div className="h-2.5 rounded-full overflow-hidden flex gap-px" style={{ background: "rgba(14,11,8,0.06)" }}>
        <div
          className="h-full rounded-l-full transition-all duration-500"
          style={{ width: `${yesPct}%`, background: "linear-gradient(90deg, #1D4731, #2E6B4F)" }}
        />
        <div
          className="h-full rounded-r-full transition-all duration-500"
          style={{ width: `${noPct}%`, background: "linear-gradient(90deg, #C0452A, #A03020)" }}
        />
      </div>
      {/* Chips */}
      <div className="flex items-center gap-2">
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: "rgba(29,71,49,0.10)", color: "#1D4731" }}
        >
          ✓ {yesPct}% For
        </span>
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: "rgba(176,58,30,0.10)", color: "#B03A1E" }}
        >
          ✕ {noPct}% Against
        </span>
        <span className="ml-auto text-[10px] text-[#7A6E60]">{total} vote{total !== 1 ? "s" : ""}</span>
      </div>
    </div>
  )
}

function PlatformProposalCard({ proposal }: { proposal: ProposalDto }) {
  const meta = PROPOSAL_STATUS_META[proposal.status] ?? PROPOSAL_STATUS_META.DRAFT
  const { Icon, color, bg, label } = meta
  const isVoting = proposal.status === "VOTING" || proposal.status === "APPROVED_FOR_VOTING"

  return (
    <Link href={`/proposals/${proposal.id}`}>
      <div
        className="rounded-xl overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer group flex flex-col h-full"
        style={{ background: "white", border: "1px solid rgba(29,71,49,0.08)" }}
      >
        {/* Photo */}
        <div className="relative h-44 overflow-hidden flex-shrink-0">
          <Image
            src={proposalCoverUrl(proposal.id)}
            alt=""
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, 340px"
          />
          {/* Thin scrim at bottom only */}
          <div
            className="absolute inset-x-0 bottom-0 h-14"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 100%)" }}
          />
          <div className="absolute bottom-2.5 left-3">
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm"
              style={{ background: `${color}dd`, color: "white" }}
            >
              {label}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-3 flex flex-col flex-1">
          <h3 className="text-sm font-bold text-[#0A1F14] leading-snug line-clamp-2">{proposal.title}</h3>
          <p className="text-xs text-[#7A6E60] line-clamp-2 leading-relaxed flex-1">{proposal.description}</p>

          <VotingBar
            yesWeight={proposal.votesSummary?.yesWeight ?? 0}
            noWeight={proposal.votesSummary?.noWeight ?? 0}
          />

          <div className="flex items-center justify-between text-[11px] text-[#7A6E60] pt-0.5">
            <div className="flex items-center gap-1.5">
              {proposal.creator?.avatarUrl ? (
                <div className="relative w-4 h-4 rounded-full overflow-hidden flex-shrink-0">
                  <Image src={proposal.creator.avatarUrl} alt="" fill sizes="16px" className="object-cover" />
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white" style={{ background: "#1D4731" }}>
                  {(proposal.creator?.name ?? "M")[0].toUpperCase()}
                </div>
              )}
              <span className="font-medium text-[#0A1F14]">{proposal.creator?.name ?? "Member"}</span>
            </div>
            <span>{formatDate(proposal.createdAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

const PLATFORM_STATUS_TABS = ["ALL", "VOTING", "APPROVED", "REJECTED", "COMPLETED"] as const
type PlatformStatusTab = typeof PLATFORM_STATUS_TABS[number]

function PlatformGovernSection() {
  const { isAuthenticated } = useAuth()
  const [statusTab, setStatusTab] = useState<PlatformStatusTab>("ALL")

  const { data, isLoading } = useQuery({
    queryKey: ["governance-public", statusTab],
    queryFn: () => governanceApi.getProposals({
      scope: "COMMUNITY",
      status: statusTab === "ALL" ? undefined : (statusTab as ProposalStatus),
      limit: 30,
    }),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  const { data: configEntries } = useQuery({
    queryKey: ["platform-config"],
    queryFn: platformConfigApi.getAll,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  })

  const proposals = data?.proposals ?? []
  const cfg = (key: string, fallback: number) => {
    const entry = configEntries?.find((c) => c.key === key)
    return entry ? parseInt(entry.value, 10) : fallback
  }

  const costs = [
    { key: "cost_infrastructure", label: configEntries?.find(c => c.key === "cost_infrastructure")?.label ?? "Infrastructure (servers, DB, storage)", Icon: Server },
    { key: "cost_sms",            label: configEntries?.find(c => c.key === "cost_sms")?.label ?? "SMS verification (Africa's Talking)",      Icon: MessageSquare },
    { key: "cost_mpesa_fees",     label: configEntries?.find(c => c.key === "cost_mpesa_fees")?.label ?? "M-Pesa API fees (~1.5% on contributions)",  Icon: Banknote },
    { key: "cost_blockchain_gas", label: configEntries?.find(c => c.key === "cost_blockchain_gas")?.label ?? "Blockchain gas (Base Sepolia → Base)",   Icon: TrendingUp },
  ]
  const tiers = [
    { tier: "Ordinary",  kesKey: "tier_ordinary_kes",  defaultKes: 60 },
    { tier: "Supporter", kesKey: "tier_supporter_kes", defaultKes: 200 },
    { tier: "Sponsor",   kesKey: "tier_sponsor_kes",   defaultKes: 1_000 },
  ]

  return (
    <div className="space-y-5">
      {/* Transparency statement */}
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: "rgba(29,71,49,0.06)", border: "1px solid rgba(29,71,49,0.10)" }}
      >
        <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "#1D4731" }} />
        <p className="text-xs text-[#0A1F14]/70 leading-relaxed">
          Every community-wide decision is made here, in public, by members.
          No platform rule, fee change, or structural decision can be made without this record.
        </p>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 border-b border-black/[0.06] overflow-x-auto">
        {PLATFORM_STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setStatusTab(t)}
            className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap capitalize transition-colors flex-shrink-0"
            style={statusTab === t ? { color: "#1D4731", borderBottom: "2px solid #1D4731" } : { color: "#7A6E60" }}
          >
            {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {!isAuthenticated ? (
        <Card className="border-0 shadow-card">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-sm text-[#7A6E60]">Sign in to view platform governance proposals.</p>
            <Link href="/auth/callback" className="text-sm font-semibold" style={{ color: "#C9922A" }}>Sign in →</Link>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="border-0 shadow-card">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <Skeleton className="h-4 w-48 flex-1" />
                  <Skeleton className="h-6 w-24 rounded-full flex-shrink-0" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <Card className="border-0 shadow-card">
          <CardContent className="py-12 text-center space-y-2">
            <p className="text-sm text-[#7A6E60]">No platform proposals yet.</p>
            <p className="text-xs text-[#7A6E60]/70">When community-wide decisions come to a vote, they appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {proposals.map((p: ProposalDto) => <PlatformProposalCard key={p.id} proposal={p} />)}
        </div>
      )}

      {/* Platform Finances */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-4 md:p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4" style={{ color: "#C9922A" }} />
            <h2 className="text-sm font-bold text-[#0A1F14]">What it costs to run UjamaaDAO</h2>
          </div>
          <div className="space-y-2">
            {costs.map(({ key, label, Icon }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 flex-shrink-0 text-[#7A6E60]" />
                  <span className="text-xs text-[#0A1F14]/70">{label}</span>
                </div>
                <span className="text-xs font-semibold text-[#0A1F14] tabular-nums">
                  KES {cfg(key, 0).toLocaleString()}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 pt-2" style={{ borderTop: "1px solid rgba(14,11,8,0.08)" }}>
              <span className="text-xs font-bold text-[#0A1F14]">Total / month</span>
              <span className="text-xs font-bold text-[#C9922A] tabular-nums">
                KES {costs.reduce((sum, { key }) => sum + cfg(key, 0), 0).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {tiers.map(({ tier, kesKey, defaultKes }) => {
              const kes = cfg(kesKey, defaultKes)
              const total = costs.reduce((sum, { key }) => sum + cfg(key, 0), 0)
              const needed = kes > 0 ? Math.ceil(total / kes) : 0
              return (
                <div key={tier} className="rounded-xl p-3 space-y-1.5 text-center"
                  style={{ background: "rgba(201,146,42,0.06)", border: "1px solid rgba(201,146,42,0.12)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#C9922A" }}>{tier}</p>
                  <p className="text-base font-bold text-[#0A1F14]">KES {kes}</p>
                  <p className="text-[10px] text-[#7A6E60]">+{kes} UT/month</p>
                  <p className="text-[10px] text-[#0A1F14]/40">{needed} members<br/>to break even</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Proposals section ──────────────────────────────────────────────────────

function ProposalsSection() {
  const router = useRouter()
  const { user } = useAuth()
  const canCreate = user?.verificationLevel === "COMMUNITY_VERIFIED" || user?.verificationLevel === "FULL_VERIFIED"

  return (
    <VotingProvider>
      <div className="space-y-5">
        {canCreate && (
          <div className="flex justify-end">
            <button
              onClick={() => router.push("/proposals/create")}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold"
              style={{ background: "#D4911E", color: "#0A1F14" }}
            >
              <Plus className="h-4 w-4" />
              Create Proposal
            </button>
          </div>
        )}
        <FetchProposals onCreateProposal={() => router.push("/proposals/create")} />
      </div>
    </VotingProvider>
  )
}

// ── Elections section ──────────────────────────────────────────────────────

const ELECTION_STATUS_TABS: { label: string; value: ElectionStatus | "ALL" }[] = [
  { label: "All",         value: "ALL" },
  { label: "Nominations", value: "NOMINATIONS_OPEN" },
  { label: "Voting",      value: "VOTING_OPEN" },
  { label: "Pending",     value: "PENDING" },
  { label: "Closed",      value: "CLOSED" },
]

function electionStatusBadge(status: ElectionStatus) {
  const map: Record<ElectionStatus, { label: string; color: string }> = {
    PENDING:          { label: "Pending",     color: "#888" },
    NOMINATIONS_OPEN: { label: "Nominations", color: "#2A7A4B" },
    VOTING_OPEN:      { label: "Voting Open", color: "#C9922A" },
    CLOSED:           { label: "Closed",      color: "#555" },
  }
  const { label, color } = map[status] ?? { label: status, color: "#888" }
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  )
}

function ElectionCard({ election }: { election: ElectionSummaryDto }) {
  return (
    <Link href={`/elections/${election.id}`}>
      <div className="group rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition-all hover:shadow-md"
        style={{ background: "white", border: "1px solid rgba(29,71,49,0.10)" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {electionStatusBadge(election.status)}
              <span className="text-[11px]" style={{ color: "#7A6E60" }}>{election.scope}</span>
            </div>
            <h3 className="mt-1.5 text-[15px] font-semibold leading-snug" style={{ color: "#1A120B" }}>
              {election.roleKey.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
              {election.groupName && <span className="font-normal" style={{ color: "#7A6E60" }}> — {election.groupName}</span>}
            </h3>
          </div>
          <ChevronRight className="h-4 w-4 flex-shrink-0 mt-1 transition-colors" style={{ color: "rgba(201,146,42,0.4)" }} />
        </div>
        <div className="flex items-center gap-4 text-[12px]" style={{ color: "#7A6E60" }}>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />{election.candidateCount} candidate{election.candidateCount !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Vote className="h-3.5 w-3.5" />{election.totalVoteWeight} weight
          </span>
          {election.myNominationId && (
            <Badge variant="outline" className="text-[10px] py-0" style={{ borderColor: "rgba(201,146,42,0.5)", color: "#C9922A" }}>You&apos;re nominated</Badge>
          )}
          {election.myVotedCandidateId && (
            <Badge variant="outline" className="text-[10px] py-0" style={{ borderColor: "rgba(29,71,49,0.4)", color: "#1D4731" }}>Voted</Badge>
          )}
        </div>
        <div className="rounded-lg px-3 py-2 text-[11px] flex items-center gap-1.5" style={{ color: "#7A6E60", background: "rgba(29,71,49,0.04)" }}>
          <CalendarDays className="h-3 w-3 flex-shrink-0" />
          {election.status === "NOMINATIONS_OPEN" && <>Nominations close {formatDate(election.nominationsCloseAt)}</>}
          {election.status === "VOTING_OPEN" && <>Voting closes {formatDate(election.votingCloseAt)}</>}
          {election.status === "PENDING" && <>Nominations open {formatDate(election.nominationsOpenAt)}</>}
          {election.status === "CLOSED" && <>{election.winnerId ? `Winner: ${election.winnerName ?? "Declared"}` : "No quorum reached"}</>}
        </div>
      </div>
    </Link>
  )
}

function ElectionsSection() {
  const { isAuthenticated } = useAuth()
  const [electionTab, setElectionTab] = useState<ElectionStatus | "ALL">("ALL")

  const { data, isLoading } = useQuery({
    queryKey: ["elections", electionTab],
    queryFn: () => electionsApi.listElections({ status: electionTab === "ALL" ? undefined : electionTab, limit: 50 }),
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
    <div className="space-y-5">
      {myPending.length > 0 && (
        <div className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: "rgba(201,146,42,0.08)", border: "1px solid rgba(201,146,42,0.20)" }}>
          <Clock className="h-5 w-5 flex-shrink-0" style={{ color: "#C9922A" }} />
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: "#7A4F0A" }}>
              {myPending.length} election{myPending.length !== 1 ? "s" : ""} need your attention
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#A06A1A" }}>You have active nominations or open votes</p>
          </div>
          <Button size="sm" variant="outline" className="text-xs"
            style={{ color: "#C9922A", borderColor: "rgba(201,146,42,0.5)" }}
            onClick={() => setElectionTab("VOTING_OPEN")}>
            View
          </Button>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {ELECTION_STATUS_TABS.map((t) => (
          <button key={t.value} onClick={() => setElectionTab(t.value)}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all"
            style={electionTab === t.value
              ? { background: "#1D4731", color: "white" }
              : { background: "rgba(29,71,49,0.06)", color: "#555" }}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl p-4 flex flex-col gap-3" style={{ border: "1px solid rgba(29,71,49,0.08)" }}>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      ) : !data?.elections.length ? (
        <div className="text-center py-16" style={{ color: "#7A6E60" }}>
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

// ── Main page ──────────────────────────────────────────────────────────────

type Section = "govern" | "proposals" | "elections"

const SECTIONS: { key: Section; label: string; Icon: React.ElementType }[] = [
  { key: "govern",    label: "Platform",  Icon: Scale },
  { key: "proposals", label: "Proposals", Icon: Vote },
  { key: "elections", label: "Elections", Icon: ScrollText },
]

export default function GovernancePage() {
  const [section, setSection] = useState<Section>("govern")

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-3xl space-y-5">
      {/* Hero banner */}
      <div className="relative h-36 rounded-2xl overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=900&q=75"
          alt="Community governance"
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover object-center"
          priority
        />
        {/* Overlay */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(120deg, rgba(29,71,49,0.88) 0%, rgba(29,71,49,0.50) 60%, transparent 100%)" }}
        />
        <div className="absolute inset-0 flex items-center px-6 gap-3">
          <div>
            <h1 className="font-serif font-bold text-2xl md:text-3xl text-white leading-tight">Govern</h1>
            <p className="text-sm text-white/65 mt-0.5">Proposals, elections, and platform governance</p>
          </div>
        </div>
      </div>

      {/* Section switcher */}
      <div className="flex gap-1 border-b border-black/[0.06]">
        {SECTIONS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors"
            style={section === key
              ? { color: "#1D4731", borderBottom: "2px solid #1D4731" }
              : { color: "#7A6E60" }}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Section content */}
      {section === "govern"    && <PlatformGovernSection />}
      {section === "proposals" && <ProposalsSection />}
      {section === "elections" && <ElectionsSection />}
    </div>
  )
}
