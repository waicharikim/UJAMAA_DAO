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

function PlatformProposalCard({ proposal }: { proposal: ProposalDto }) {
  const meta = PROPOSAL_STATUS_META[proposal.status] ?? PROPOSAL_STATUS_META.DRAFT
  const { Icon, color, bg, label } = meta
  const yesWeight = proposal.votesSummary?.yesWeight ?? 0
  const noWeight  = proposal.votesSummary?.noWeight  ?? 0
  const totalWeight = yesWeight + noWeight
  const yesPct = totalWeight > 0 ? Math.round((yesWeight / totalWeight) * 100) : 0

  return (
    <Link href={`/proposals/${proposal.id}`}>
      <Card className="border-0 shadow-card transition-shadow hover:shadow-md cursor-pointer">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-bold text-[#0A1F14] leading-snug flex-1">{proposal.title}</h3>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: bg }}>
              <Icon className="h-3 w-3" style={{ color }} />
              <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
            </div>
          </div>
          <p className="text-xs text-[#7A6E60] line-clamp-2 leading-relaxed">{proposal.description}</p>
          {totalWeight > 0 && (
            <div className="space-y-1">
              <div className="h-1.5 rounded-full overflow-hidden flex bg-cream">
                <div className="bg-tea-green transition-all" style={{ width: `${yesPct}%` }} />
                <div className="bg-red-400 transition-all" style={{ width: `${100 - yesPct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-[#7A6E60]">
                <span>For: {yesPct}%</span>
                <span>{proposal.votesSummary?.total ?? 0} votes</span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between text-[11px] text-[#7A6E60]">
            <span>by <span className="font-medium text-[#0A1F14]">{proposal.creator?.name ?? "Member"}</span></span>
            <span>{formatDate(proposal.createdAt)}</span>
          </div>
        </CardContent>
      </Card>
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
        <div className="space-y-4">
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
              <span className="text-[11px] text-gray-400">{election.scope}</span>
            </div>
            <h3 className="mt-1.5 text-[15px] font-semibold text-gray-800 leading-snug">
              {election.roleKey.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
              {election.groupName && <span className="text-gray-400 font-normal"> — {election.groupName}</span>}
            </h3>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-1 group-hover:text-amber-500 transition-colors" />
        </div>
        <div className="flex items-center gap-4 text-[12px] text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />{election.candidateCount} candidate{election.candidateCount !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Vote className="h-3.5 w-3.5" />{election.totalVoteWeight} weight
          </span>
          {election.myNominationId && (
            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 py-0">You&apos;re nominated</Badge>
          )}
          {election.myVotedCandidateId && (
            <Badge variant="outline" className="text-[10px] border-green-500 text-green-600 py-0">Voted</Badge>
          )}
        </div>
        <div className="rounded-lg px-3 py-2 text-[11px] text-gray-500 flex items-center gap-1.5"
          style={{ background: "rgba(29,71,49,0.04)" }}>
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
            <p className="text-sm font-semibold text-amber-800">
              {myPending.length} election{myPending.length !== 1 ? "s" : ""} need your attention
            </p>
            <p className="text-xs text-amber-700 mt-0.5">You have active nominations or open votes</p>
          </div>
          <Button size="sm" variant="outline" className="text-amber-700 border-amber-400 hover:bg-amber-50 text-xs"
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
            <div key={i} className="rounded-xl p-4 border border-gray-100 flex flex-col gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(29,71,49,0.10)" }}>
          <Scale className="h-5 w-5" style={{ color: "#1D4731" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0A1F14]" style={{ fontFamily: "var(--font-cormorant, serif)" }}>
            Govern
          </h1>
          <p className="text-sm text-[#7A6E60]">Proposals, elections, and platform governance</p>
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
