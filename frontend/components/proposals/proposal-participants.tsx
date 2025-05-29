"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Users,
  UserPlus,
  Crown,
  Star,
  Briefcase,
  Shield,
  Target,
  Vote,
  Clock,
  CheckCircle,
  XCircle,
  Search,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import type { Proposal, ProposalParticipant } from "@/lib/types/governance"

interface ProposalParticipantsProps {
  proposal: Proposal
  onAddParticipant?: (participant: Omit<ProposalParticipant, "id" | "joinedAt">) => void
  onUpdateParticipant?: (participantId: string, updates: Partial<ProposalParticipant>) => void
  canManageParticipants?: boolean
}

export function ProposalParticipants({
  proposal,
  onAddParticipant,
  onUpdateParticipant,
  canManageParticipants = false,
}: ProposalParticipantsProps) {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRole, setFilterRole] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newParticipant, setNewParticipant] = useState({
    userId: "",
    role: "EXPERT" as ProposalParticipant["role"],
    contribution: {
      type: "EXPERTISE" as const,
      description: "",
      commitment: "",
    },
  })

  const getRoleIcon = (role: ProposalParticipant["role"]) => {
    const icons = {
      CREATOR: Crown,
      CO_SPONSOR: Star,
      EXPERT: Briefcase,
      IMPLEMENTER: Target,
      VERIFIER: Shield,
      BENEFICIARY: Users,
      VOTER: Vote,
    }
    const Icon = icons[role] || Users
    return <Icon className="h-4 w-4" />
  }

  const getRoleColor = (role: ProposalParticipant["role"]) => {
    const colors = {
      CREATOR: "bg-purple-500",
      CO_SPONSOR: "bg-blue-500",
      EXPERT: "bg-green-500",
      IMPLEMENTER: "bg-orange-500",
      VERIFIER: "bg-red-500",
      BENEFICIARY: "bg-gray-500",
      VOTER: "bg-indigo-500",
    }
    return colors[role] || "bg-gray-500"
  }

  const getStatusIcon = (status: ProposalParticipant["status"]) => {
    const icons = {
      ACTIVE: CheckCircle,
      PENDING: Clock,
      DECLINED: XCircle,
    }
    const Icon = icons[status] || Clock
    return <Icon className="h-4 w-4" />
  }

  const getStatusColor = (status: ProposalParticipant["status"]) => {
    const colors = {
      ACTIVE: "text-green-600",
      PENDING: "text-yellow-600",
      DECLINED: "text-red-600",
    }
    return colors[status] || "text-gray-600"
  }

  const filteredParticipants = proposal.participants.filter((participant) => {
    const matchesSearch =
      participant.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participant.user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = filterRole === "all" || participant.role === filterRole
    return matchesSearch && matchesRole
  })

  const participantsByRole = proposal.participants.reduce(
    (acc, participant) => {
      if (!acc[participant.role]) {
        acc[participant.role] = []
      }
      acc[participant.role].push(participant)
      return acc
    },
    {} as Record<string, ProposalParticipant[]>,
  )

  const handleAddParticipant = () => {
    if (!newParticipant.userId || !newParticipant.contribution.description) {
      return
    }

    onAddParticipant?.({
      userId: newParticipant.userId,
      user: {
        id: newParticipant.userId,
        name: "New Participant", // This would come from user lookup
        email: "participant@example.com",
        impactPoints: 0,
        roles: [],
      },
      role: newParticipant.role,
      contribution: newParticipant.contribution,
      status: "PENDING",
      permissions: [],
    })

    setNewParticipant({
      userId: "",
      role: "EXPERT",
      contribution: {
        type: "EXPERTISE",
        description: "",
        commitment: "",
      },
    })
    setShowAddDialog(false)
  }

  const canUserJoin = () => {
    if (!user) return false
    const isAlreadyParticipant = proposal.participants.some((p) => p.userId === user.id)
    return !isAlreadyParticipant && proposal.status === "DRAFT"
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Proposal Participants ({proposal.participants.length})
            </CardTitle>
            {(canManageParticipants || canUserJoin()) && (
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    {canUserJoin() ? "Join Proposal" : "Add Participant"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Participant</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">User ID</label>
                      <Input
                        value={newParticipant.userId}
                        onChange={(e) => setNewParticipant((prev) => ({ ...prev, userId: e.target.value }))}
                        placeholder="Enter user ID or search..."
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Role</label>
                      <Select
                        value={newParticipant.role}
                        onValueChange={(value) =>
                          setNewParticipant((prev) => ({
                            ...prev,
                            role: value as ProposalParticipant["role"],
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CO_SPONSOR">Co-Sponsor</SelectItem>
                          <SelectItem value="EXPERT">Subject Matter Expert</SelectItem>
                          <SelectItem value="IMPLEMENTER">Implementation Team</SelectItem>
                          <SelectItem value="VERIFIER">Milestone Verifier</SelectItem>
                          <SelectItem value="BENEFICIARY">Beneficiary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Contribution Type</label>
                      <Select
                        value={newParticipant.contribution.type}
                        onValueChange={(value) =>
                          setNewParticipant((prev) => ({
                            ...prev,
                            contribution: { ...prev.contribution, type: value as any },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EXPERTISE">Expertise & Advice</SelectItem>
                          <SelectItem value="FUNDING">Funding Support</SelectItem>
                          <SelectItem value="IMPLEMENTATION">Implementation Work</SelectItem>
                          <SelectItem value="VERIFICATION">Milestone Verification</SelectItem>
                          <SelectItem value="ENDORSEMENT">Endorsement & Support</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Contribution Description</label>
                      <Textarea
                        value={newParticipant.contribution.description}
                        onChange={(e) =>
                          setNewParticipant((prev) => ({
                            ...prev,
                            contribution: { ...prev.contribution, description: e.target.value },
                          }))
                        }
                        placeholder="Describe how you will contribute to this proposal..."
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Time Commitment (Optional)</label>
                      <Input
                        value={newParticipant.contribution.commitment || ""}
                        onChange={(e) =>
                          setNewParticipant((prev) => ({
                            ...prev,
                            contribution: { ...prev.contribution, commitment: e.target.value },
                          }))
                        }
                        placeholder="e.g., 10 hours/week, Full-time, As needed..."
                      />
                    </div>
                    <Button onClick={handleAddParticipant} className="w-full">
                      Add Participant
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Role Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.entries(participantsByRole).map(([role, participants]) => (
              <div key={role} className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-1">
                  {getRoleIcon(role as ProposalParticipant["role"])}
                  <span className="text-sm font-medium">{role.replace("_", " ")}</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">{participants.length}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search participants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="CREATOR">Creator</SelectItem>
                <SelectItem value="CO_SPONSOR">Co-Sponsor</SelectItem>
                <SelectItem value="EXPERT">Expert</SelectItem>
                <SelectItem value="IMPLEMENTER">Implementer</SelectItem>
                <SelectItem value="VERIFIER">Verifier</SelectItem>
                <SelectItem value="BENEFICIARY">Beneficiary</SelectItem>
                <SelectItem value="VOTER">Voter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Participants List */}
          <div className="space-y-4">
            {filteredParticipants.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm || filterRole !== "all"
                  ? "No participants found matching your criteria."
                  : "No participants yet. Be the first to join this proposal!"}
              </div>
            ) : (
              filteredParticipants.map((participant) => (
                <Card key={participant.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <Avatar>
                        <AvatarImage src={participant.user.avatarUrl || "/placeholder.svg"} />
                        <AvatarFallback>
                          {participant.user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{participant.user.name}</h4>
                          <Badge className={getRoleColor(participant.role)}>
                            {getRoleIcon(participant.role)}
                            <span className="ml-1">{participant.role.replace("_", " ")}</span>
                          </Badge>
                          <div className={`flex items-center gap-1 ${getStatusColor(participant.status)}`}>
                            {getStatusIcon(participant.status)}
                            <span className="text-sm">{participant.status}</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{participant.user.email}</p>
                        {participant.contribution && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{participant.contribution.type}</Badge>
                              {participant.contribution.commitment && (
                                <span className="text-sm text-gray-500">{participant.contribution.commitment}</span>
                              )}
                            </div>
                            <p className="text-sm">{participant.contribution.description}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>Impact Points: {participant.user.impactPoints}</span>
                          <span>Joined: {new Date(participant.joinedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    {canManageParticipants && participant.status === "PENDING" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => onUpdateParticipant?.(participant.id, { status: "ACTIVE" })}>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onUpdateParticipant?.(participant.id, { status: "DECLINED" })}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Participation Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Participation Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                <strong>Who can participate:</strong> Any verified user can join as a participant. Different roles have
                different responsibilities and requirements.
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Participant Roles:</h4>
                <ul className="space-y-1 text-sm">
                  <li>
                    <strong>Co-Sponsor:</strong> Endorses and supports the proposal
                  </li>
                  <li>
                    <strong>Expert:</strong> Provides subject matter expertise
                  </li>
                  <li>
                    <strong>Implementer:</strong> Will help execute if approved
                  </li>
                  <li>
                    <strong>Verifier:</strong> Will verify milestone completion
                  </li>
                  <li>
                    <strong>Beneficiary:</strong> Will benefit from the proposal
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Benefits of Participation:</h4>
                <ul className="space-y-1 text-sm">
                  <li>• Earn impact points for contributions</li>
                  <li>• Influence proposal development</li>
                  <li>• Priority access to implementation roles</li>
                  <li>• Build reputation in the community</li>
                  <li>• Network with like-minded individuals</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
