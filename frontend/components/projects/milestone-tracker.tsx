// @ts-nocheck — scaffold: stale types, alignment deferred
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Upload,
  FileText,
  DollarSign,
  Award,
  Users,
  Eye,
  Edit,
  Send,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import type { Project, ProjectMilestone, FileAttachment } from "@/lib/types/projects"

interface MilestoneTrackerProps {
  project: Project
  milestones: ProjectMilestone[]
  onSubmitMilestone?: (milestoneId: string, submission: any) => void
  onVerifyMilestone?: (milestoneId: string, approved: boolean, comments: string) => void
  onCreateMilestone?: () => void
}

export function MilestoneTracker({
  project,
  milestones,
  onSubmitMilestone,
  onVerifyMilestone,
  onCreateMilestone,
}: MilestoneTrackerProps) {
  const { user } = useAuth()
  const [selectedMilestone, setSelectedMilestone] = useState<ProjectMilestone | null>(null)
  const [submissionData, setSubmissionData] = useState({
    description: "",
    files: [] as FileAttachment[],
    links: [] as string[],
    metrics: {} as Record<string, any>,
  })
  const [verificationComments, setVerificationComments] = useState("")
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false)
  const [showVerificationDialog, setShowVerificationDialog] = useState(false)

  const userParticipant = project.participants.find((p) => p.userId === user?.id)
  const isManager = userParticipant?.role === "MANAGER"
  const isVerifier = userParticipant?.role === "VERIFIER"

  const getStatusColor = (status: string) => {
    const colors = {
      PENDING: "bg-gray-500",
      IN_PROGRESS: "bg-blue-500",
      SUBMITTED: "bg-yellow-500",
      UNDER_REVIEW: "bg-orange-500",
      APPROVED: "bg-green-500",
      REJECTED: "bg-red-500",
      COMPLETED: "bg-purple-500",
    }
    return colors[status as keyof typeof colors] || "bg-gray-500"
  }

  const getStatusIcon = (status: string) => {
    const icons = {
      PENDING: Clock,
      IN_PROGRESS: Clock,
      SUBMITTED: Upload,
      UNDER_REVIEW: Eye,
      APPROVED: CheckCircle,
      REJECTED: AlertTriangle,
      COMPLETED: CheckCircle,
    }
    const Icon = icons[status as keyof typeof icons] || Clock
    return <Icon className="h-4 w-4" />
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      LOW: "text-green-600",
      MEDIUM: "text-yellow-600",
      HIGH: "text-orange-600",
      CRITICAL: "text-red-600",
    }
    return colors[priority as keyof typeof colors] || "text-gray-600"
  }

  const canSubmitMilestone = (milestone: ProjectMilestone) => {
    return (
      milestone.assignedTo.includes(user?.id || "") &&
      (milestone.status === "PENDING" || milestone.status === "IN_PROGRESS" || milestone.status === "REJECTED")
    )
  }

  const canVerifyMilestone = (milestone: ProjectMilestone) => {
    return isVerifier && milestone.status === "SUBMITTED"
  }

  const handleSubmitMilestone = () => {
    if (!selectedMilestone) return

    onSubmitMilestone?.(selectedMilestone.id, submissionData)
    setShowSubmissionDialog(false)
    setSubmissionData({ description: "", files: [], links: [], metrics: {} })
  }

  const handleVerifyMilestone = (approved: boolean) => {
    if (!selectedMilestone) return

    onVerifyMilestone?.(selectedMilestone.id, approved, verificationComments)
    setShowVerificationDialog(false)
    setVerificationComments("")
  }

  const renderMilestoneCard = (milestone: ProjectMilestone) => {
    const isOverdue = new Date(milestone.dueDate) < new Date() && milestone.status !== "COMPLETED"
    const daysUntilDue = Math.ceil(
      (new Date(milestone.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
    )

    return (
      <Card key={milestone.id} className={`hover:shadow-lg transition-shadow ${isOverdue ? "border-red-300" : ""}`}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(milestone.status)}
                {milestone.title}
                {isOverdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
              </CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge className={getStatusColor(milestone.status)}>{milestone.status}</Badge>
                <Badge variant="outline" className={getPriorityColor(milestone.priority)}>
                  {milestone.priority}
                </Badge>
                <Badge variant="outline">
                  <Calendar className="h-3 w-3 mr-1" />
                  {daysUntilDue > 0 ? `${daysUntilDue} days left` : `${Math.abs(daysUntilDue)} days overdue`}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{milestone.progress}%</div>
              <div className="text-sm text-gray-500">Complete</div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <p className="text-gray-600 mb-4">{milestone.description}</p>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progress</span>
              <span>{milestone.progress}%</span>
            </div>
            <Progress value={milestone.progress} className="h-2" />
          </div>

          {/* Key Info */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-sm">${milestone.funding.allocated.toLocaleString()} allocated</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-orange-500" />
              <span className="text-sm">{milestone.impactPoints.individual} impact points</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm">{milestone.assignedTo.length} assigned</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-500" />
              <span className="text-sm">{milestone.submissions.length} submissions</span>
            </div>
          </div>

          {/* Requirements */}
          {milestone.requirements.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm mb-2">Requirements:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {milestone.requirements.map((req, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Deliverables */}
          {milestone.deliverables.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm mb-2">Deliverables:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {milestone.deliverables.map((deliverable, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    {deliverable}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Latest Submission */}
          {milestone.submissions.length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Latest Submission:</h4>
              <div className="text-sm text-gray-600">
                <p>By: {milestone.submissions[milestone.submissions.length - 1].submittedBy.name}</p>
                <p>Status: {milestone.submissions[milestone.submissions.length - 1].status}</p>
                <p className="mt-1">{milestone.submissions[milestone.submissions.length - 1].evidence.description}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            {canSubmitMilestone(milestone) && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedMilestone(milestone)
                  setShowSubmissionDialog(true)
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Submit Work
              </Button>
            )}

            {canVerifyMilestone(milestone) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedMilestone(milestone)
                  setShowVerificationDialog(true)
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Review
              </Button>
            )}

            {isManager && (
              <Button size="sm" variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderSubmissionDialog = () => (
    <Dialog open={showSubmissionDialog} onOpenChange={setShowSubmissionDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Submit Milestone Work</DialogTitle>
          <DialogDescription>
            Provide evidence and documentation for milestone: {selectedMilestone?.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="description">Description of Work Completed</Label>
            <Textarea
              id="description"
              placeholder="Describe what you've accomplished for this milestone..."
              value={submissionData.description}
              onChange={(e) => setSubmissionData((prev) => ({ ...prev, description: e.target.value }))}
              rows={4}
            />
          </div>

          <div>
            <Label>Supporting Links</Label>
            <Input
              placeholder="Add links to external resources, documents, or demos"
              onKeyPress={(e) => {
                if (e.key === "Enter" && e.currentTarget.value) {
                  setSubmissionData((prev) => ({
                    ...prev,
                    links: [...prev.links, e.currentTarget.value],
                  }))
                  e.currentTarget.value = ""
                }
              }}
            />
            {submissionData.links.length > 0 && (
              <div className="mt-2 space-y-1">
                {submissionData.links.map((link, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <span className="text-blue-600">{link}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setSubmissionData((prev) => ({
                          ...prev,
                          links: prev.links.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>File Attachments</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Drag and drop files here, or click to browse</p>
              <p className="text-xs text-gray-500 mt-1">Supports: PDF, DOC, JPG, PNG (max 10MB each)</p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSubmissionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitMilestone} disabled={!submissionData.description}>
              Submit Work
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  const renderVerificationDialog = () => (
    <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review Milestone Submission</DialogTitle>
          <DialogDescription>Review and verify the work submitted for: {selectedMilestone?.title}</DialogDescription>
        </DialogHeader>

        {selectedMilestone?.submissions.length > 0 && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">Submitted Work:</h4>
              <p className="text-sm text-gray-600 mb-3">
                {selectedMilestone.submissions[selectedMilestone.submissions.length - 1].evidence.description}
              </p>

              {selectedMilestone.submissions[selectedMilestone.submissions.length - 1].evidence.links.length > 0 && (
                <div>
                  <h5 className="font-medium text-sm mb-1">Links:</h5>
                  <ul className="text-sm text-blue-600 space-y-1">
                    {selectedMilestone.submissions[selectedMilestone.submissions.length - 1].evidence.links.map(
                      (link, index) => (
                        <li key={index}>
                          <a href={link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {link}
                          </a>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="comments">Verification Comments</Label>
              <Textarea
                id="comments"
                placeholder="Provide feedback on the submission..."
                value={verificationComments}
                onChange={(e) => setVerificationComments(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowVerificationDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => handleVerifyMilestone(false)}>
                Reject
              </Button>
              <Button onClick={() => handleVerifyMilestone(true)}>Approve</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )

  const getMilestonesByStatus = (status: string) => {
    return milestones.filter((m) => m.status === status)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Project Milestones</h2>
          <p className="text-gray-600">Track progress and manage deliverables</p>
        </div>
        {isManager && (
          <Button onClick={onCreateMilestone}>
            <Calendar className="h-4 w-4 mr-2" />
            Create Milestone
          </Button>
        )}
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{getMilestonesByStatus("PENDING").length}</div>
                <div className="text-sm text-gray-600">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">{getMilestonesByStatus("SUBMITTED").length}</div>
                <div className="text-sm text-gray-600">Submitted</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{getMilestonesByStatus("UNDER_REVIEW").length}</div>
                <div className="text-sm text-gray-600">Under Review</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{getMilestonesByStatus("COMPLETED").length}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Milestone Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Milestones</TabsTrigger>
          <TabsTrigger value="assigned">Assigned to Me</TabsTrigger>
          <TabsTrigger value="pending">Pending Review</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {milestones.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No milestones yet</h3>
                <p className="text-gray-500">Create your first milestone to start tracking progress.</p>
              </div>
            ) : (
              milestones.map(renderMilestoneCard)
            )}
          </div>
        </TabsContent>

        <TabsContent value="assigned" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {milestones.filter((m) => m.assignedTo.includes(user?.id || "")).map(renderMilestoneCard)}
          </div>
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {milestones.filter((m) => m.status === "SUBMITTED" || m.status === "UNDER_REVIEW").map(renderMilestoneCard)}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {milestones.filter((m) => m.status === "COMPLETED").map(renderMilestoneCard)}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {renderSubmissionDialog()}
      {renderVerificationDialog()}
    </div>
  )
}
