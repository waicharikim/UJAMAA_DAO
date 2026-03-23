"use client"

/**
 * /governance — Platform Transparency Hub
 *
 * Surfaces all community-wide (public) proposals so every member can see
 * what decisions are being made at the platform level. This page is the
 * answer to "Who governs UjamaaDAO?" — the community does, and here is the
 * permanent record of how.
 */

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { governanceApi, type ProposalDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import {
  Scale,
  ArrowRight,
  Users,
  Vote,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  ShieldCheck,
} from "lucide-react"

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  DRAFT:               { label: "Draft",            Icon: Clock,        color: "#7A6E60", bg: "rgba(122,110,96,0.10)"  },
  PENDING_REVIEW:      { label: "Under Review",     Icon: ShieldCheck,  color: "#C9922A", bg: "rgba(201,146,42,0.10)" },
  APPROVED_FOR_VOTING: { label: "Ready for Vote",   Icon: Vote,         color: "#2A6B7C", bg: "rgba(42,107,124,0.10)" },
  VOTING:              { label: "Voting Open",       Icon: Activity,     color: "#1D4731", bg: "rgba(29,71,49,0.10)"  },
  APPROVED:            { label: "Approved",          Icon: CheckCircle,  color: "#1A6B3C", bg: "rgba(26,107,60,0.10)" },
  REJECTED:            { label: "Rejected",          Icon: XCircle,      color: "#B03A1E", bg: "rgba(176,58,30,0.10)" },
  EXECUTING:           { label: "Executing",         Icon: Activity,     color: "#2A6B7C", bg: "rgba(42,107,124,0.10)" },
  COMPLETED:           { label: "Completed",         Icon: CheckCircle,  color: "#1D4731", bg: "rgba(29,71,49,0.10)"  },
  CANCELLED:           { label: "Cancelled",         Icon: XCircle,      color: "#7A6E60", bg: "rgba(122,110,96,0.10)" },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
}

// ── Proposal card ──────────────────────────────────────────────────────────

function ProposalCard({ proposal }: { proposal: ProposalDto }) {
  const meta = STATUS_META[proposal.status] ?? STATUS_META.DRAFT
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
            <h3 className="text-sm font-bold text-[#0A1F14] leading-snug flex-1">
              {proposal.title}
            </h3>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0"
              style={{ background: bg }}
            >
              <Icon className="h-3 w-3" style={{ color }} />
              <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
            </div>
          </div>

          <p className="text-xs text-[#7A6E60] line-clamp-2 leading-relaxed">
            {proposal.description}
          </p>

          {/* Vote bar — only if voting has happened */}
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
            <span>
              by <span className="font-medium text-[#0A1F14]">{proposal.creator?.name ?? "Member"}</span>
            </span>
            <span>{formatDate(proposal.createdAt)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function ProposalSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="border-0 shadow-card">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-4 w-48 flex-1" />
              <Skeleton className="h-6 w-24 rounded-full flex-shrink-0" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

const STATUS_TABS = ["ALL", "VOTING", "APPROVED", "REJECTED", "COMPLETED"] as const
type StatusTab = typeof STATUS_TABS[number]

export default function GovernancePage() {
  const { isAuthenticated } = useAuth()
  const [tab, setTab] = useState<StatusTab>("ALL")

  const { data, isLoading } = useQuery({
    queryKey: ["governance-public", tab],
    queryFn: () =>
      governanceApi.getProposals({
        scope: "COMMUNITY" as any,
        status: tab === "ALL" ? undefined : (tab as any),
        limit: 30,
      }),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  const proposals = (data as any)?.proposals ?? []

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(29,71,49,0.10)" }}
          >
            <Scale className="h-5 w-5" style={{ color: "#1D4731" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold text-[#0A1F14]"
              style={{ fontFamily: "var(--font-cormorant, serif)" }}
            >
              Platform Governance
            </h1>
            <p className="text-sm text-[#7A6E60]">How UjamaaDAO governs itself</p>
          </div>
        </div>

        {/* Transparency statement */}
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{ background: "rgba(29,71,49,0.06)", border: "1px solid rgba(29,71,49,0.10)" }}
        >
          <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "#1D4731" }} />
          <p className="text-xs text-[#0A1F14]/70 leading-relaxed">
            Every community-wide decision is made here, in public, by members.
            No platform rule, fee change, or structural decision can be made without
            this record. These proposals belong to the community.
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-black/[0.06] overflow-x-auto">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap capitalize transition-colors flex-shrink-0"
            style={tab === t
              ? { color: "#1D4731", borderBottom: "2px solid #1D4731" }
              : { color: "#7A6E60" }}
          >
            {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Proposals list */}
      {!isAuthenticated ? (
        <Card className="border-0 shadow-card">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-sm text-[#7A6E60]">Sign in to view platform governance proposals.</p>
            <Link href="/auth/callback" className="text-sm font-semibold" style={{ color: "#C9922A" }}>
              Sign in →
            </Link>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <ProposalSkeleton />
      ) : proposals.length === 0 ? (
        <Card className="border-0 shadow-card">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-sm text-[#7A6E60]">No platform proposals yet.</p>
            <p className="text-xs text-[#7A6E60]/70">
              When community-wide decisions are brought to a vote, they appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {proposals.map((p: ProposalDto) => (
            <ProposalCard key={p.id} proposal={p} />
          ))}
        </div>
      )}

      {/* How this works */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-sm font-bold text-[#0A1F14]">How platform governance works</h2>
          <div className="space-y-3">
            {[
              {
                Icon: Users,
                title: "Community scope",
                desc: "Any proposal marked 'Community' scope is visible to all members and affects everyone on the platform.",
              },
              {
                Icon: Vote,
                title: "Weighted voting",
                desc: "Votes are weighted by Participation Rights — earned through consistent community contribution, not wealth.",
              },
              {
                Icon: CheckCircle,
                title: "Permanent record",
                desc: "Every vote, rationale, and outcome is stored permanently. Nothing can be deleted or hidden.",
              },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(29,71,49,0.08)" }}
                >
                  <Icon className="h-4 w-4" style={{ color: "#1D4731" }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#0A1F14]">{title}</p>
                  <p className="text-xs text-[#7A6E60] mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/proposals"
            className="flex items-center gap-1 text-xs font-semibold pt-1"
            style={{ color: "#C9922A" }}
          >
            View all proposals <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
