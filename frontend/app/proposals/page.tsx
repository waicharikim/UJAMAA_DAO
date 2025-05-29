"use client"

import { PageHeader } from "@/components/layout/page-header"
import { StatsGrid } from "@/components/layout/stats-grid"
import { FetchProposals } from "@/components/proposals/fetch-proposals"
import { VotingProvider } from "@/contexts/voting-context"
import { useAuth } from "@/contexts/auth-context"
import { useRole } from "@/contexts/role-context"
import { Button } from "@/components/ui/button"
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
      color: "bg-gradient-to-br from-blue-500 to-blue-600",
      description: "Currently voting",
    },
    {
      title: "Total Votes Cast",
      value: 111,
      change: "+45 today",
      changeType: "positive" as const,
      icon: TrendingUp,
      color: "bg-gradient-to-br from-green-500 to-green-600",
      description: "Community participation",
    },
    {
      title: "Participants",
      value: 156,
      change: "+12 this month",
      changeType: "positive" as const,
      icon: Users,
      color: "bg-gradient-to-br from-purple-500 to-purple-600",
      description: "Active voters",
    },
    {
      title: "Avg. Voting Time",
      value: "2.3 days",
      change: "Faster than usual",
      changeType: "positive" as const,
      icon: Clock,
      color: "bg-gradient-to-br from-orange-500 to-orange-600",
      description: "Decision speed",
    },
  ]

  return (
    <VotingProvider>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <PageHeader
          title="Governance Proposals"
          description="Participate in community governance by voting on proposals and creating new initiatives."
          gradient
          actions={
            hasScope("proposals:create") && (
              <Button
                onClick={handleCreateProposal}
                size="lg"
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Proposal
              </Button>
            )
          }
        />

        <StatsGrid stats={stats} />

        <FetchProposals onCreateProposal={handleCreateProposal} />
      </div>
    </VotingProvider>
  )
}
