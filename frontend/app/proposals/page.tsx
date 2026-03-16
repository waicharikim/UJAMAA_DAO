"use client"

import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { StatsGrid } from "@/components/layout/stats-grid"
import { FetchProposals } from "@/components/proposals/fetch-proposals"
import { VotingProvider } from "@/contexts/voting-context"
import { governanceApi } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { Plus, Vote, TrendingUp, AlertCircle } from "lucide-react"

export default function ProposalsPage() {
  const { isAuthenticated, user } = useAuth()
  const canCreateProposal =
    user?.verificationLevel === "COMMUNITY_VERIFIED" ||
    user?.verificationLevel === "FULL_VERIFIED"

  const { data: allMeta } = useQuery({
    queryKey: ["proposals-total"],
    queryFn: () => governanceApi.getProposals({ limit: 1 }),
    staleTime: 60_000,
  })
  const { data: activeMeta } = useQuery({
    queryKey: ["proposals-voting"],
    queryFn: () => governanceApi.getProposals({ status: "VOTING", limit: 1 }),
    staleTime: 60_000,
  })
  const { data: needsAction } = useQuery({
    queryKey: ["proposals-needs-action"],
    queryFn: () => governanceApi.getNeedsAction(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  const handleCreateProposal = () => {
    window.location.href = "/proposals/create"
  }

  const stats = [
    {
      title: "Active Proposals",
      value: activeMeta?.total ?? "—",
      change: "Open for voting",
      changeType: "positive" as const,
      icon: Vote,
      color: "bg-[#C9922A]",
      description: "Currently voting",
    },
    {
      title: "Total Proposals",
      value: allMeta?.total ?? "—",
      change: "All time",
      changeType: "neutral" as const,
      icon: TrendingUp,
      color: "bg-[#1E3D2F]",
      description: "Proposals submitted",
    },
    ...(needsAction && needsAction.total > 0
      ? [{
          title: "Need Your Action",
          value: needsAction.total,
          change: "Awaiting you",
          changeType: "negative" as const,
          icon: AlertCircle,
          color: "bg-amber",
          description: "Proposals requiring action",
        }]
      : []),
  ]

  return (
    <VotingProvider>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <PageHeader
          title="Governance Proposals"
          description="Participate in community governance by voting on proposals and creating new initiatives."
          actions={
            canCreateProposal && (
              <button
                onClick={handleCreateProposal}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "#D4911E", color: "#0A1F14" }}
              >
                <Plus className="h-4 w-4" />
                Create Proposal
              </button>
            )
          }
        />

        <StatsGrid stats={stats} />

        <FetchProposals onCreateProposal={handleCreateProposal} />
      </div>
    </VotingProvider>
  )
}
