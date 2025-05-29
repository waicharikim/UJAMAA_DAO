"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/contexts/auth-context"
import { useRole } from "@/contexts/role-context"
import { apiClient } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import {
  Search,
  Plus,
  Vote,
  EyeOff,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Filter,
} from "lucide-react"

// Types
interface Proposal {
  id: string
  title: string
  description: string
  purpose: "business" | "nonprofit" | "bill"
  locationScope: "local" | "constituency" | "county" | "national"
  isPrivate: boolean
  status: "draft" | "active" | "passed" | "rejected" | "expired"
  createdBy: {
    id: string
    name: string
    avatar?: string
  }
  groupId?: string
  groupName?: string
  votingDeadline: string
  tokenCost: number
  impactPointsRequired: number
  votingStats: {
    totalVotes: number
    yesVotes: number
    noVotes: number
    abstainVotes: number
    quorumRequired: number
    consensusRequired: number
    currentQuorum: number
    currentConsensus: number
  }
  userVote?: "yes" | "no" | "abstain"
  canVote: boolean
  canEdit: boolean
  createdAt: string
  updatedAt: string
}

interface ProposalFilters {
  search: string
  locationScope: string
  purpose: string
  status: string
}

interface FetchProposalsProps {
  onCreateProposal?: () => void
}

export function FetchProposals({ onCreateProposal }: FetchProposalsProps) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("all")
  const [filters, setFilters] = useState<ProposalFilters>({
    search: "",
    locationScope: "all",
    purpose: "all",
    status: "all",
  })

  const { user, isAuthenticated } = useAuth()
  const { hasScope } = useRole()
  const { toast } = useToast()

  useEffect(() => {
    if (isAuthenticated) {
      loadProposals()
    }
  }, [isAuthenticated])

  const loadProposals = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.getProposals()

      // Handle different response structures
      let proposalsData: Proposal[] = []
      if (Array.isArray(response)) {
        proposalsData = response
      } else if (response && Array.isArray(response.proposals)) {
        proposalsData = response.proposals
      } else if (response && response.data && Array.isArray(response.data)) {
        proposalsData = response.data
      } else {
        console.warn("Unexpected API response structure:", response)
        proposalsData = []
      }

      setProposals(proposalsData)
    } catch (err: any) {
      console.error("Failed to load proposals:", err)
      setError(err.message || "Failed to load proposals")
      setProposals([]) // Ensure proposals is always an array
    } finally {
      setLoading(false)
    }
  }

  const handleVote = async (proposalId: string, vote: "yes" | "no" | "abstain") => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please connect your wallet to vote.",
        variant: "destructive",
      })
      return
    }

    try {
      await apiClient.voteOnProposal(proposalId, vote)
      toast({
        title: "Vote Cast Successfully",
        description: `Your ${vote} vote has been recorded.`,
      })
      // Reload proposals to get updated vote counts
      await loadProposals()
    } catch (error: any) {
      toast({
        title: "Voting Failed",
        description: error.message || "Failed to cast vote. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Filter proposals based on current filters and active tab
  const filteredProposals = (proposals || []).filter((proposal) => {
    // Tab filtering
    if (activeTab === "active" && proposal.status !== "active") return false
    if (activeTab === "my-votes" && !proposal.userVote) return false
    if (activeTab === "my-proposals" && proposal.createdBy.id !== user?.id) return false

    // Search filter
    if (
      filters.search &&
      !proposal.title.toLowerCase().includes(filters.search.toLowerCase()) &&
      !proposal.description.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false
    }

    // Location scope filter
    if (filters.locationScope !== "all" && proposal.locationScope !== filters.locationScope) {
      return false
    }

    // Purpose filter
    if (filters.purpose !== "all" && proposal.purpose !== filters.purpose) {
      return false
    }

    // Status filter
    if (filters.status !== "all" && proposal.status !== filters.status) {
      return false
    }

    return true
  })

  const handleFilterChange = (key: keyof ProposalFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({
      search: "",
      locationScope: "all",
      purpose: "all",
      status: "all",
    })
  }

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Vote className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Governance Participation</h3>
          <p className="text-slate-600 mb-4">Connect your wallet to view and participate in proposals.</p>
          <Button>Connect Wallet</Button>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-96 mt-2 animate-pulse"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="flex gap-2">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-red-500 mb-4">Error: {error}</div>
          <Button onClick={loadProposals}>Retry</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Governance Proposals</h1>
          <p className="text-slate-600">Participate in community governance and shape the future</p>
        </div>
        {hasScope("proposals:create") && (
          <Button onClick={onCreateProposal} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Create Proposal
          </Button>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Vote className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{proposals.filter((p) => p.status === "active").length}</div>
                <div className="text-sm text-slate-600">Active Proposals</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold">
                  {proposals.reduce((sum, p) => sum + p.votingStats.totalVotes, 0)}
                </div>
                <div className="text-sm text-slate-600">Total Votes</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Vote className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">
                  {Object.keys(proposals.reduce((acc, p) => ({ ...acc, [p.createdBy.id]: true }), {})).length}
                </div>
                <div className="text-sm text-slate-600">Participants</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Vote className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-2xl font-bold">{proposals.filter((p) => p.userVote).length}</div>
                <div className="text-sm text-slate-600">Your Votes</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search proposals..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={filters.locationScope} onValueChange={(value) => handleFilterChange("locationScope", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Location Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="constituency">Constituency</SelectItem>
                <SelectItem value="county">County</SelectItem>
                <SelectItem value="national">National</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.purpose} onValueChange={(value) => handleFilterChange("purpose", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Purpose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Purposes</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="nonprofit">Nonprofit</SelectItem>
                <SelectItem value="bill">Bill</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Proposals</TabsTrigger>
          <TabsTrigger value="active">Active Voting</TabsTrigger>
          <TabsTrigger value="my-votes">My Votes</TabsTrigger>
          <TabsTrigger value="my-proposals">My Proposals</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredProposals.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Vote className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Proposals Found</h3>
                <p className="text-slate-600">No proposals match your current filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {filteredProposals.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} onVote={handleVote} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Individual Proposal Card Component
interface ProposalCardProps {
  proposal: Proposal
  onVote: (proposalId: string, vote: "yes" | "no" | "abstain") => void
}

function ProposalCard({ proposal, onVote }: ProposalCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-100 text-blue-800"
      case "passed":
        return "bg-green-100 text-green-800"
      case "rejected":
        return "bg-red-100 text-red-800"
      case "expired":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-slate-100 text-slate-800"
    }
  }

  const getPurposeColor = (purpose: string) => {
    switch (purpose) {
      case "business":
        return "bg-purple-100 text-purple-800"
      case "nonprofit":
        return "bg-green-100 text-green-800"
      case "bill":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-slate-100 text-slate-800"
    }
  }

  const quorumProgress = (proposal.votingStats.currentQuorum / proposal.votingStats.quorumRequired) * 100
  const consensusProgress = proposal.votingStats.currentConsensus

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-semibold">{proposal.title}</h3>
              {proposal.isPrivate && <EyeOff className="h-4 w-4 text-slate-500" />}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={getStatusColor(proposal.status)}>{proposal.status}</Badge>
              <Badge className={getPurposeColor(proposal.purpose)}>{proposal.purpose}</Badge>
              <Badge variant="outline">
                <MapPin className="h-3 w-3 mr-1" />
                {proposal.locationScope}
              </Badge>
            </div>
            <p className="text-slate-600 mb-4">{proposal.description}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-500">
          <div className="flex items-center gap-4">
            <span>By {proposal.createdBy.name}</span>
            {proposal.groupName && <span>• {proposal.groupName}</span>}
            <span>• {formatRelativeTime(proposal.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Ends {formatDate(proposal.votingDeadline)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Voting Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Quorum Progress</span>
            <span>
              {proposal.votingStats.currentQuorum}% / {proposal.votingStats.quorumRequired}%
            </span>
          </div>
          <Progress value={quorumProgress} className="h-2" />

          <div className="flex items-center justify-between text-sm">
            <span>Consensus</span>
            <span>
              {consensusProgress}% (need {proposal.votingStats.consensusRequired}%)
            </span>
          </div>
          <Progress value={consensusProgress} className="h-2" />
        </div>

        {/* Vote Breakdown */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">{proposal.votingStats.yesVotes}</div>
            <div className="text-sm text-slate-600">Yes</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{proposal.votingStats.noVotes}</div>
            <div className="text-sm text-slate-600">No</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-600">{proposal.votingStats.abstainVotes}</div>
            <div className="text-sm text-slate-600">Abstain</div>
          </div>
        </div>

        {/* Voting Actions */}
        {proposal.canVote && proposal.status === "active" && (
          <div className="flex gap-2 pt-4 border-t">
            <Button
              size="sm"
              variant={proposal.userVote === "yes" ? "default" : "outline"}
              onClick={() => onVote(proposal.id, "yes")}
              className="flex-1"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Yes
            </Button>
            <Button
              size="sm"
              variant={proposal.userVote === "no" ? "destructive" : "outline"}
              onClick={() => onVote(proposal.id, "no")}
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              No
            </Button>
            <Button
              size="sm"
              variant={proposal.userVote === "abstain" ? "secondary" : "outline"}
              onClick={() => onVote(proposal.id, "abstain")}
              className="flex-1"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Abstain
            </Button>
          </div>
        )}

        {/* Vote History */}
        {proposal.userVote && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">Your vote:</span>
              <Badge
                variant={
                  proposal.userVote === "yes" ? "default" : proposal.userVote === "no" ? "destructive" : "secondary"
                }
              >
                {proposal.userVote}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
