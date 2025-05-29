"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useVoting } from "@/contexts/voting-context"
import { useAuth } from "@/contexts/auth-context"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { Vote, CheckCircle, XCircle, AlertCircle, Clock, Coins, Eye, EyeOff, MapPin } from "lucide-react"
import type { Proposal } from "@/lib/types/governance"

interface VotingInterfaceProps {
  proposal: Proposal
}

export function VotingInterface({ proposal }: VotingInterfaceProps) {
  const [showVoteDialog, setShowVoteDialog] = useState(false)
  const [selectedVote, setSelectedVote] = useState<"yes" | "no" | "abstain" | null>(null)
  const [isVoting, setIsVoting] = useState(false)

  const { castVote, getUserVote, canUserVote, isLoading } = useVoting()
  const { user } = useAuth()

  const userVote = getUserVote(proposal.id)
  const eligibility = canUserVote(proposal.id)

  const handleVoteClick = (vote: "yes" | "no" | "abstain") => {
    setSelectedVote(vote)
    setShowVoteDialog(true)
  }

  const confirmVote = async () => {
    if (!selectedVote) return

    setIsVoting(true)
    const success = await castVote(proposal.id, selectedVote)
    if (success) {
      setShowVoteDialog(false)
      setSelectedVote(null)
    }
    setIsVoting(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "passed":
        return "bg-green-100 text-green-800 border-green-200"
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200"
      case "expired":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-slate-100 text-slate-800 border-slate-200"
    }
  }

  const getPurposeColor = (purpose: string) => {
    switch (purpose) {
      case "business":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "nonprofit":
        return "bg-green-100 text-green-800 border-green-200"
      case "bill":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-slate-100 text-slate-800 border-slate-200"
    }
  }

  const quorumProgress = Math.min((proposal.votingStats.currentQuorum / proposal.votingStats.quorumRequired) * 100, 100)
  const consensusProgress = proposal.votingStats.currentConsensus

  const timeRemaining = new Date(proposal.votingDeadline).getTime() - new Date().getTime()
  const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24))

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-xl">{proposal.title}</CardTitle>
              {proposal.isPrivate ? (
                <EyeOff className="h-4 w-4 text-slate-500" />
              ) : (
                <Eye className="h-4 w-4 text-slate-500" />
              )}
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Badge className={getStatusColor(proposal.status)}>{proposal.status.toUpperCase()}</Badge>
              <Badge className={getPurposeColor(proposal.purpose)}>{proposal.purpose.toUpperCase()}</Badge>
              <Badge variant="outline">
                <MapPin className="h-3 w-3 mr-1" />
                {proposal.locationScope.toUpperCase()}
              </Badge>
              {proposal.groupName && <Badge variant="outline">{proposal.groupName}</Badge>}
            </div>

            <p className="text-slate-600 mb-4">{proposal.description}</p>

            <div className="flex items-center justify-between text-sm text-slate-500">
              <div className="flex items-center gap-4">
                <span>By {proposal.createdBy.name}</span>
                <span>• {formatRelativeTime(proposal.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{daysRemaining > 0 ? `${daysRemaining} days left` : "Voting ended"}</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Voting Progress */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">Quorum Progress</span>
              <span>
                {proposal.votingStats.currentQuorum.toFixed(1)}% / {proposal.votingStats.quorumRequired}%
              </span>
            </div>
            <Progress value={quorumProgress} className="h-3" />
            <p className="text-xs text-slate-500 mt-1">{proposal.votingStats.totalVotes} votes cast</p>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">Consensus</span>
              <span>
                {consensusProgress.toFixed(1)}% (need {proposal.votingStats.consensusRequired}%)
              </span>
            </div>
            <Progress value={consensusProgress} className="h-3" />
            <p className="text-xs text-slate-500 mt-1">Percentage of yes votes</p>
          </div>
        </div>

        {/* Vote Breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-600">{proposal.votingStats.yesVotes}</div>
            <div className="text-sm text-green-700">Yes</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="text-2xl font-bold text-red-600">{proposal.votingStats.noVotes}</div>
            <div className="text-sm text-red-700">No</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-2xl font-bold text-slate-600">{proposal.votingStats.abstainVotes}</div>
            <div className="text-sm text-slate-700">Abstain</div>
          </div>
        </div>

        {/* Voting Cost */}
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">Voting Cost: {proposal.tokenCost} tokens</span>
          </div>
          <div className="text-sm text-slate-600">Your Balance: {user?.tokenBalance || 0} tokens</div>
        </div>

        {/* User Vote Status */}
        {userVote && (
          <Alert>
            <Vote className="h-4 w-4" />
            <AlertDescription>
              You voted <strong>{userVote.vote.toUpperCase()}</strong> on {formatDate(userVote.timestamp)} • Cost:{" "}
              {userVote.tokensCost} tokens
            </AlertDescription>
          </Alert>
        )}

        {/* Eligibility Check */}
        {!eligibility.canVote && !userVote && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{eligibility.reason}</AlertDescription>
          </Alert>
        )}

        {/* Voting Buttons */}
        {eligibility.canVote && !userVote && proposal.status === "active" && (
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={() => handleVoteClick("yes")}
              disabled={isLoading || isVoting}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Vote Yes
            </Button>
            <Button
              onClick={() => handleVoteClick("no")}
              disabled={isLoading || isVoting}
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Vote No
            </Button>
            <Button
              onClick={() => handleVoteClick("abstain")}
              disabled={isLoading || isVoting}
              variant="outline"
              className="flex-1"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Abstain
            </Button>
          </div>
        )}

        {/* Vote Confirmation Dialog */}
        <Dialog open={showVoteDialog} onOpenChange={setShowVoteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Your Vote</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium mb-2">{proposal.title}</h4>
                <p className="text-sm text-slate-600">{proposal.description}</p>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="font-medium">Your Vote:</span>
                <Badge
                  variant={selectedVote === "yes" ? "default" : selectedVote === "no" ? "destructive" : "secondary"}
                >
                  {selectedVote?.toUpperCase()}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <span className="font-medium">Token Cost:</span>
                <span>{proposal.tokenCost} tokens</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span className="font-medium">Remaining Balance:</span>
                <span>{(user?.tokenBalance || 0) - proposal.tokenCost} tokens</span>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This action cannot be undone. Your vote will be recorded permanently.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button onClick={confirmVote} disabled={isVoting} className="flex-1">
                  {isVoting ? "Casting Vote..." : "Confirm Vote"}
                </Button>
                <Button
                  onClick={() => setShowVoteDialog(false)}
                  variant="outline"
                  disabled={isVoting}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
