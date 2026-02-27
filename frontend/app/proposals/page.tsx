"use client"

import { PageHeader } from "@/components/layout/page-header"
import { StatsGrid } from "@/components/layout/stats-grid"
import { FetchProposals } from "@/components/proposals/fetch-proposals"
import { VotingProvider } from "@/contexts/voting-context"
import { useAuth } from "@/contexts/auth-context"
import { useRole } from "@/contexts/role-context"
import { Plus, Vote, TrendingUp, Users, Clock } from "lucide-react"

export default function ProposalsPage() {
  const { user } = useAuth()
  const { hasScope } = useRole()

  const handleCreateProposal = () => {
    window.location.href = "/proposals/create"
  }

  const stats = [
    {
      title: "Active Proposals",
      value: 3,
      change: "+2 this week",
      changeType: "positive" as const,
      icon: Vote,
      color: "bg-[#C9922A]",
      description: "Currently voting",
    },
    {
      title: "Total Votes Cast",
      value: 111,
      change: "+45 today",
      changeType: "positive" as const,
      icon: TrendingUp,
      color: "bg-[#1E3D2F]",
      description: "Community participation",
    },
    {
      title: "Participants",
      value: 156,
      change: "+12 this month",
      changeType: "positive" as const,
      icon: Users,
      color: "bg-[#B03A1E]",
      description: "Active voters",
    },
    {
      title: "Avg. Voting Time",
      value: "2.3 days",
      change: "Faster than usual",
      changeType: "positive" as const,
      icon: Clock,
      color: "bg-[#2A5240]",
      description: "Decision speed",
    },
  ]

  return (
    <VotingProvider>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <PageHeader
          title="Governance Proposals"
          description="Participate in community governance by voting on proposals and creating new initiatives."
          actions={
            hasScope("proposals:create") && (
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
