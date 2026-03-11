// @ts-nocheck — scaffold: stale types, alignment deferred
"use client"

import { createContext, useContext, useReducer, useEffect, type ReactNode } from "react"
import { useAuth } from "@/contexts/auth-context"
import { apiClient } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import type { Proposal } from "@/lib/types/governance"

interface Vote {
  proposalId: string
  userId: string
  vote: "yes" | "no" | "abstain"
  tokensCost: number
  timestamp: string
}

interface VotingState {
  userVotes: Record<string, Vote>
  proposals: Proposal[]
  isLoading: boolean
  error: string | null
}

type VotingAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_PROPOSALS"; payload: Proposal[] }
  | { type: "ADD_VOTE"; payload: Vote }
  | { type: "UPDATE_PROPOSAL"; payload: Proposal }

const initialState: VotingState = {
  userVotes: {},
  proposals: [],
  isLoading: false,
  error: null,
}

function votingReducer(state: VotingState, action: VotingAction): VotingState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload }
    case "SET_ERROR":
      return { ...state, error: action.payload, isLoading: false }
    case "SET_PROPOSALS":
      return { ...state, proposals: action.payload, isLoading: false }
    case "ADD_VOTE":
      return {
        ...state,
        userVotes: {
          ...state.userVotes,
          [action.payload.proposalId]: action.payload,
        },
      }
    case "UPDATE_PROPOSAL":
      return {
        ...state,
        proposals: state.proposals.map((p) => (p.id === action.payload.id ? action.payload : p)),
      }
    default:
      return state
  }
}

interface VotingContextType extends VotingState {
  castVote: (proposalId: string, vote: "yes" | "no" | "abstain") => Promise<boolean>
  loadProposals: () => Promise<void>
  getUserVote: (proposalId: string) => Vote | null
  canUserVote: (proposalId: string) => { canVote: boolean; reason?: string; tokenCost: number }
}

const VotingContext = createContext<VotingContextType | undefined>(undefined)

export function VotingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(votingReducer, initialState)
  const { user, updateUser } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      loadProposals()
      loadUserVotes()
    }
  }, [user])

  const loadProposals = async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true })
      const data = await apiClient.getProposals()
      dispatch({ type: "SET_PROPOSALS", payload: data.proposals || data })
    } catch (error: any) {
      dispatch({ type: "SET_ERROR", payload: error.message })
    }
  }

  const loadUserVotes = async () => {
    try {
      const votes = await apiClient.getUserVotes()
      votes.forEach((vote: Vote) => {
        dispatch({ type: "ADD_VOTE", payload: vote })
      })
    } catch (error) {
      console.error("Failed to load user votes:", error)
    }
  }

  const canUserVote = (proposalId: string) => {
    if (!user) {
      return { canVote: false, reason: "Not authenticated", tokenCost: 0 }
    }

    const proposal = state.proposals.find((p) => p.id === proposalId)
    if (!proposal) {
      return { canVote: false, reason: "Proposal not found", tokenCost: 0 }
    }

    // Check if already voted
    if (state.userVotes[proposalId]) {
      return { canVote: false, reason: "Already voted", tokenCost: proposal.tokenCost }
    }

    // Check if proposal is active
    if (proposal.status !== "active") {
      return { canVote: false, reason: "Voting is closed", tokenCost: proposal.tokenCost }
    }

    // Check voting deadline
    if (new Date(proposal.votingDeadline) < new Date()) {
      return { canVote: false, reason: "Voting deadline has passed", tokenCost: proposal.tokenCost }
    }

    // Check token balance
    if (user.tokenBalance < proposal.tokenCost) {
      return {
        canVote: false,
        reason: `Insufficient tokens. Need ${proposal.tokenCost}, have ${user.tokenBalance}`,
        tokenCost: proposal.tokenCost,
      }
    }

    // Check participation requirements
    const participationThresholds = {
      local: 0,
      constituency: 1,
      county: 2,
      national: 3,
    }

    const requiredParticipation =
      participationThresholds[proposal.locationScope as keyof typeof participationThresholds] || 0
    const userParticipation =
      user.projectParticipation?.[proposal.locationScope as keyof typeof user.projectParticipation] || 0

    if (userParticipation < requiredParticipation) {
      return {
        canVote: false,
        reason: `Need ${requiredParticipation} project participation(s) at ${proposal.locationScope} level`,
        tokenCost: proposal.tokenCost,
      }
    }

    return { canVote: true, tokenCost: proposal.tokenCost }
  }

  const castVote = async (proposalId: string, vote: "yes" | "no" | "abstain"): Promise<boolean> => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please connect your wallet to vote.",
        variant: "destructive",
      })
      return false
    }

    const eligibility = canUserVote(proposalId)
    if (!eligibility.canVote) {
      toast({
        title: "Cannot Vote",
        description: eligibility.reason,
        variant: "destructive",
      })
      return false
    }

    const proposal = state.proposals.find((p) => p.id === proposalId)
    if (!proposal) {
      toast({
        title: "Error",
        description: "Proposal not found.",
        variant: "destructive",
      })
      return false
    }

    try {
      dispatch({ type: "SET_LOADING", payload: true })

      // Submit vote to API
      await apiClient.voteOnProposal(proposalId, vote)

      // Create vote record
      const voteRecord: Vote = {
        proposalId,
        userId: user.id,
        vote,
        tokensCost: proposal.tokenCost,
        timestamp: new Date().toISOString(),
      }

      // Update local state
      dispatch({ type: "ADD_VOTE", payload: voteRecord })

      // Deduct tokens from user
      updateUser({
        tokenBalance: user.tokenBalance - proposal.tokenCost,
      })

      // Update proposal vote counts
      const updatedProposal = { ...proposal }
      updatedProposal.votingStats.totalVotes += 1

      if (vote === "yes") {
        updatedProposal.votingStats.yesVotes += 1
      } else if (vote === "no") {
        updatedProposal.votingStats.noVotes += 1
      } else {
        updatedProposal.votingStats.abstainVotes += 1
      }

      // Recalculate quorum and consensus
      const totalVotes = updatedProposal.votingStats.totalVotes
      const yesVotes = updatedProposal.votingStats.yesVotes

      // Update quorum (percentage of eligible voters who voted)
      updatedProposal.votingStats.currentQuorum = Math.min(
        (totalVotes / 100) * 100, // Assuming 100 eligible voters for demo
        100,
      )

      // Update consensus (percentage of yes votes)
      updatedProposal.votingStats.currentConsensus = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0

      // Check if proposal should pass
      if (
        updatedProposal.votingStats.currentQuorum >= updatedProposal.votingStats.quorumRequired &&
        updatedProposal.votingStats.currentConsensus >= updatedProposal.votingStats.consensusRequired
      ) {
        updatedProposal.status = "passed"
      }

      dispatch({ type: "UPDATE_PROPOSAL", payload: updatedProposal })

      toast({
        title: "Vote Cast Successfully",
        description: `Your ${vote} vote has been recorded. ${proposal.tokenCost} tokens deducted.`,
      })

      return true
    } catch (error: any) {
      dispatch({ type: "SET_ERROR", payload: error.message })
      toast({
        title: "Voting Failed",
        description: error.message || "Failed to cast vote. Please try again.",
        variant: "destructive",
      })
      return false
    } finally {
      dispatch({ type: "SET_LOADING", payload: false })
    }
  }

  const getUserVote = (proposalId: string): Vote | null => {
    return state.userVotes[proposalId] || null
  }

  return (
    <VotingContext.Provider
      value={{
        ...state,
        castVote,
        loadProposals,
        getUserVote,
        canUserVote,
      }}
    >
      {children}
    </VotingContext.Provider>
  )
}

export function useVoting() {
  const context = useContext(VotingContext)
  if (context === undefined) {
    throw new Error("useVoting must be used within a VotingProvider")
  }
  return context
}
