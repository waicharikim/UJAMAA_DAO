// @ts-nocheck — scaffold: stale types, alignment deferred
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Vote, Users, MapPin, DollarSign, TrendingUp, Shield, Eye, EyeOff, Search, Coins } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { GovernanceService } from "@/lib/services/governance-service"
import { TokenService } from "@/lib/services/token-service"
import type { Proposal } from "@/lib/types/governance"

interface EnhancedProposalsProps {
  proposals?: Proposal[]
  onVote?: (proposalId: string, vote: boolean) => void
  onCreateProposal?: () => void
}

export function EnhancedProposals({ proposals = [], onVote, onCreateProposal }: EnhancedProposalsProps) {
  const { user } = useAuth()
  const [filteredProposals, setFilteredProposals] = useState<Proposal[]>(proposals)
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    type: "all",
    scope: "all",
    dateRange: "all",
  })
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)
  const [votingCosts, setVotingCosts] = useState<Record<string, number>>({})

  useEffect(() => {
    // Calculate voting costs for all proposals
    const costs: Record<string, number> = {}
    proposals.forEach((proposal) => {
      costs[proposal.id] = TokenService.calculateVotingCost(proposal)
    })
    setVotingCosts(costs)
  }, [proposals])

  useEffect(() => {
    let filtered = proposals

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(filters.search.toLowerCase()) ||
          p.description.toLowerCase().includes(filters.search.toLowerCase()),
      )
    }

    // Status filter
    if (filters.status !== "all") {
      filtered = filtered.filter((p) => p.status === filters.status)
    }

    // Type filter
    if (filters.type !== "all") {
      filtered = filtered.filter((p) => p.proposalType === filters.type)
    }

    // Scope filter
    if (filters.scope !== "all") {
      filtered = filtered.filter((p) => p.locationScope === filters.scope)
    }

    setFilteredProposals(filtered)
  }, [proposals, filters])

  const getStatusColor = (status: string) => {
    const colors = {
      DRAFT: "bg-gray-500",
      VOTING: "bg-blue-500",
      APPROVED: "bg-green-500",
      REJECTED: "bg-red-500",
      EXECUTING: "bg-yellow-500",
      COMPLETED: "bg-purple-500",
    }
    return colors[status as keyof typeof colors] || "bg-gray-500"
  }

  const getTypeIcon = (type: string) => {
    const icons = {
      BUSINESS: DollarSign,
      NON_PROFIT: Users,
      BILL: Shield,
    }
    const Icon = icons[type as keyof typeof icons] || Users
    return <Icon className="h-4 w-4" />
  }

  const checkVotingEligibility = (proposal: Proposal) => {
    if (!user) return { canVote: false, reason: "Not authenticated" }

    return GovernanceService.checkVotingEligibility(user, proposal)
  }

  const checkProposalEligibility = (locationScope: string) => {
    if (!user) return { canPropose: false, reason: "Not authenticated" }

    return GovernanceService.checkProposalEligibility(user, locationScope)
  }

  const handleVote = (proposalId: string, vote: boolean) => {
    const proposal = proposals.find((p) => p.id === proposalId)
    if (!proposal || !user) return

    const eligibility = checkVotingEligibility(proposal)
    if (!eligibility.canVote) {
      alert(eligibility.reason)
      return
    }

    const tokenCost = votingCosts[proposalId] || 0
    if (user.tokenBalance < tokenCost) {
      alert(`Insufficient tokens. You need ${tokenCost} tokens to vote.`)
      return
    }

    onVote?.(proposalId, vote)
  }

  const renderProposalCard = (proposal: Proposal) => {
    const eligibility = checkVotingEligibility(proposal)
    const tokenCost = votingCosts[proposal.id] || 0
    const quorumProgress = (proposal.votes.quorum.achieved / proposal.votes.quorum.required) * 100
    const consensusProgress = (proposal.votes.consensus.achieved / proposal.votes.consensus.required) * 100

    return (
      <Card key={proposal.id} className="mb-4 hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                {getTypeIcon(proposal.proposalType)}
                {proposal.title}
                {proposal.isPrivate && <EyeOff className="h-4 w-4 text-gray-500" />}
                {!proposal.isPrivate && <Eye className="h-4 w-4 text-gray-500" />}
              </CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge className={getStatusColor(proposal.status)}>{proposal.status}</Badge>
                <Badge variant="outline">
                  <MapPin className="h-3 w-3 mr-1" />
                  {proposal.locationScope}
                </Badge>
                <Badge variant="outline">{proposal.proposalType}</Badge>
                {proposal.funded && proposal.budget && (
                  <Badge variant="outline">
                    <DollarSign className="h-3 w-3 mr-1" />${proposal.budget.toLocaleString()}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <p className="text-gray-600 mb-4">{proposal.description}</p>

          {proposal.status === "VOTING" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Quorum Progress</span>
                    <span>
                      {proposal.votes.quorum.achieved}/{proposal.votes.quorum.required}
                    </span>
                  </div>
                  <Progress value={quorumProgress} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Consensus Progress</span>
                    <span>
                      {proposal.votes.consensus.achieved}/{proposal.votes.consensus.required}
                    </span>
                  </div>
                  <Progress value={consensusProgress} className="h-2" />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  <span className="text-sm">Voting Cost: {tokenCost} tokens</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Your Balance: {user?.tokenBalance || 0} tokens</span>
                </div>
              </div>

              {!eligibility.canVote && (
                <Alert>
                  <AlertDescription>{eligibility.reason}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => handleVote(proposal.id, true)}
                  disabled={!eligibility.canVote}
                  className="flex-1"
                  variant="default"
                >
                  <Vote className="h-4 w-4 mr-2" />
                  Vote Yes
                </Button>
                <Button
                  onClick={() => handleVote(proposal.id, false)}
                  disabled={!eligibility.canVote}
                  className="flex-1"
                  variant="outline"
                >
                  <Vote className="h-4 w-4 mr-2" />
                  Vote No
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>Individual Votes: {proposal.votes.individual.length}</div>
              <div>Group Votes: {proposal.votes.group.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderUserStats = () => {
    if (!user) return null

    const constituencyEligibility = checkProposalEligibility("CONSTITUENCY")
    const countyEligibility = checkProposalEligibility("COUNTY")
    const nationalEligibility = checkProposalEligibility("NATIONAL")

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Your Governance Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{user.impactPoints?.global || 0}</div>
              <div className="text-sm text-gray-600">Global Impact Points</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{user.tokenBalance || 0}</div>
              <div className="text-sm text-gray-600">Token Balance</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {(user.participationHistory?.constituency || 0) +
                  (user.participationHistory?.county || 0) +
                  (user.participationHistory?.national || 0)}
              </div>
              <div className="text-sm text-gray-600">Projects Participated</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{user.roles?.length || 0}</div>
              <div className="text-sm text-gray-600">Active Roles</div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <h4 className="font-semibold mb-2">Proposal Creation Eligibility</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Constituency Level:</span>
                <Badge variant={constituencyEligibility.canPropose ? "default" : "secondary"}>
                  {constituencyEligibility.canPropose ? "Eligible" : "Not Eligible"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>County Level:</span>
                <Badge variant={countyEligibility.canPropose ? "default" : "secondary"}>
                  {countyEligibility.canPropose ? "Eligible" : "Not Eligible"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>National Level:</span>
                <Badge variant={nationalEligibility.canPropose ? "default" : "secondary"}>
                  {nationalEligibility.canPropose ? "Eligible" : "Not Eligible"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {renderUserStats()}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Governance Proposals</CardTitle>
            <Button onClick={onCreateProposal}>Create Proposal</Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search proposals..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>

            <Select
              value={filters.status}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="VOTING">Voting</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="EXECUTING">Executing</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.type} onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="BUSINESS">Business</SelectItem>
                <SelectItem value="NON_PROFIT">Non-Profit</SelectItem>
                <SelectItem value="BILL">Bill</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.scope} onValueChange={(value) => setFilters((prev) => ({ ...prev, scope: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scopes</SelectItem>
                <SelectItem value="LOCAL">Local</SelectItem>
                <SelectItem value="CONSTITUENCY">Constituency</SelectItem>
                <SelectItem value="COUNTY">County</SelectItem>
                <SelectItem value="NATIONAL">National</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.dateRange}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, dateRange: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Proposals List */}
          <div className="space-y-4">
            {filteredProposals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No proposals found matching your criteria.</div>
            ) : (
              filteredProposals.map(renderProposalCard)
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
