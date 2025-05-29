"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MilestoneTracker } from "@/components/projects/milestone-tracker"
import { useAuth } from "@/contexts/auth-context"
import { Calendar, Users, DollarSign, MapPin, TrendingUp, Clock, Target, ArrowLeft } from "lucide-react"
import type { Project, ProjectMilestone } from "@/lib/types/projects"

export default function ProjectDetailPage() {
  const params = useParams()
  const { user } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProject()
  }, [params.id])

  const loadProject = async () => {
    try {
      setLoading(true)
      // Mock project data - in real app, fetch from API
      const mockProject: Project = {
        id: params.id as string,
        proposalId: "prop-1",
        title: "Community Solar Energy Initiative",
        description:
          "Install solar panels in community centers across Westlands constituency to reduce energy costs and promote renewable energy adoption. This project aims to create sustainable energy solutions while building community capacity for green technology maintenance and operation.",
        locationScope: "CONSTITUENCY",
        constituency: "Westlands",
        status: "ACTIVE",
        budget: {
          total: 50000,
          allocated: 30000,
          disbursed: 15000,
          remaining: 35000,
        },
        timeline: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          estimatedDuration: 90,
        },
        participants: [
          {
            id: "p1",
            userId: user?.id || "user1",
            user: {
              id: user?.id || "user1",
              name: user?.name || "John Doe",
              email: user?.email || "john@example.com",
              avatarUrl: user?.avatarUrl,
              impactPoints: 150,
            },
            role: "MANAGER",
            permissions: ["view_project", "edit_project", "create_milestone"],
            contribution: {
              description: "Project management and coordination",
              hoursCommitted: 40,
              skillsOffered: ["Project Management", "Solar Energy"],
              availability: "PART_TIME",
            },
            performance: {
              milestonesCompleted: 2,
              impactPointsEarned: 75,
              tokensEarned: 150,
              rating: 4.5,
              feedback: ["Great leadership", "Excellent communication"],
            },
            joinedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
            status: "ACTIVE",
          },
          {
            id: "p2",
            userId: "user2",
            user: {
              id: "user2",
              name: "Sarah Wilson",
              email: "sarah@example.com",
              impactPoints: 120,
            },
            role: "VERIFIER",
            permissions: ["view_project", "verify_milestones"],
            contribution: {
              description: "Technical verification and quality assurance",
              hoursCommitted: 20,
              skillsOffered: ["Solar Installation", "Quality Control"],
              availability: "PART_TIME",
            },
            performance: {
              milestonesCompleted: 1,
              impactPointsEarned: 45,
              tokensEarned: 90,
              rating: 4.8,
              feedback: ["Thorough verification process"],
            },
            joinedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
            status: "ACTIVE",
          },
        ],
        milestones: [],
        createdBy: {
          id: "group1",
          name: "Green Energy Collective",
          type: "GROUP",
        },
        managedBy: {
          id: user?.id || "user1",
          name: user?.name || "John Doe",
          role: "PROJECT_MANAGER",
        },
        groupId: "group1",
        groupName: "Green Energy Collective",
        progress: {
          overall: 65,
          milestonesCompleted: 2,
          totalMilestones: 4,
          daysElapsed: 30,
          daysRemaining: 60,
        },
        impactMetrics: {
          participantsCount: 8,
          beneficiariesCount: 500,
          impactPointsGenerated: 320,
          tokensDistributed: 640,
        },
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const mockMilestones: ProjectMilestone[] = [
        {
          id: "m1",
          projectId: params.id as string,
          title: "Site Assessment and Planning",
          description: "Conduct comprehensive site assessment for solar panel installation locations",
          requirements: [
            "Survey all potential installation sites",
            "Assess structural integrity of buildings",
            "Calculate energy requirements",
            "Obtain necessary permits",
          ],
          deliverables: [
            "Site assessment report",
            "Installation plan document",
            "Permit applications",
            "Energy calculation spreadsheet",
          ],
          dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          status: "COMPLETED",
          priority: "HIGH",
          funding: {
            allocated: 5000,
            disbursed: 5000,
            pending: 0,
          },
          assignedTo: [user?.id || "user1"],
          verifiedBy: {
            id: "user2",
            name: "Sarah Wilson",
            verifiedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            comments: "Excellent work on site assessment. All requirements met.",
          },
          submissions: [
            {
              id: "s1",
              milestoneId: "m1",
              submittedBy: {
                id: user?.id || "user1",
                name: user?.name || "John Doe",
              },
              evidence: {
                description:
                  "Completed comprehensive site assessment with detailed measurements and structural analysis.",
                files: [],
                links: ["https://docs.google.com/spreadsheets/site-assessment"],
                metrics: { sitesAssessed: 5, permitsObtained: 3 },
              },
              submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              status: "APPROVED",
              reviewComments: "Thorough assessment with excellent documentation.",
              reviewedBy: {
                id: "user2",
                name: "Sarah Wilson",
                reviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              },
            },
          ],
          dependencies: [],
          progress: 100,
          impactPoints: {
            individual: 50,
            group: 25,
          },
          tokenRewards: {
            individual: 100,
            group: 50,
          },
          createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "m2",
          projectId: params.id as string,
          title: "Equipment Procurement",
          description: "Source and purchase solar panels, inverters, and installation equipment",
          requirements: [
            "Research certified solar equipment suppliers",
            "Obtain quotes from multiple vendors",
            "Ensure equipment meets local standards",
            "Negotiate bulk purchase discounts",
          ],
          deliverables: [
            "Vendor comparison report",
            "Purchase orders",
            "Equipment delivery schedule",
            "Quality certificates",
          ],
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          status: "IN_PROGRESS",
          priority: "CRITICAL",
          funding: {
            allocated: 25000,
            disbursed: 0,
            pending: 25000,
          },
          assignedTo: [user?.id || "user1", "user3"],
          submissions: [],
          dependencies: ["m1"],
          progress: 40,
          impactPoints: {
            individual: 75,
            group: 40,
          },
          tokenRewards: {
            individual: 150,
            group: 75,
          },
          createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "m3",
          projectId: params.id as string,
          title: "Installation and Setup",
          description: "Install solar panels and configure energy systems",
          requirements: [
            "Install solar panels on approved sites",
            "Set up inverters and electrical connections",
            "Configure monitoring systems",
            "Conduct safety testing",
          ],
          deliverables: [
            "Installation completion report",
            "System configuration documentation",
            "Safety test results",
            "User operation manual",
          ],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: "PENDING",
          priority: "HIGH",
          funding: {
            allocated: 15000,
            disbursed: 0,
            pending: 15000,
          },
          assignedTo: ["user2", "user4"],
          submissions: [],
          dependencies: ["m2"],
          progress: 0,
          impactPoints: {
            individual: 100,
            group: 50,
          },
          tokenRewards: {
            individual: 200,
            group: 100,
          },
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "m4",
          projectId: params.id as string,
          title: "Community Training and Handover",
          description: "Train community members on system operation and maintenance",
          requirements: [
            "Develop training materials",
            "Conduct training sessions",
            "Establish maintenance schedule",
            "Create support documentation",
          ],
          deliverables: [
            "Training curriculum",
            "Training completion certificates",
            "Maintenance schedule",
            "Support contact list",
          ],
          dueDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(),
          status: "PENDING",
          priority: "MEDIUM",
          funding: {
            allocated: 5000,
            disbursed: 0,
            pending: 5000,
          },
          assignedTo: [user?.id || "user1", "user5"],
          submissions: [],
          dependencies: ["m3"],
          progress: 0,
          impactPoints: {
            individual: 60,
            group: 30,
          },
          tokenRewards: {
            individual: 120,
            group: 60,
          },
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      setProject(mockProject)
      setMilestones(mockMilestones)
    } catch (error) {
      console.error("Failed to load project:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitMilestone = async (milestoneId: string, submission: any) => {
    try {
      // In real app, submit to API
      console.log("Submitting milestone:", milestoneId, submission)
      // Refresh milestones
      await loadProject()
    } catch (error) {
      console.error("Failed to submit milestone:", error)
    }
  }

  const handleVerifyMilestone = async (milestoneId: string, approved: boolean, comments: string) => {
    try {
      // In real app, submit verification to API
      console.log("Verifying milestone:", milestoneId, approved, comments)
      // Refresh milestones
      await loadProject()
    } catch (error) {
      console.error("Failed to verify milestone:", error)
    }
  }

  const handleCreateMilestone = () => {
    // Navigate to milestone creation page
    window.location.href = `/projects/${params.id}/milestones/create`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-600">Project not found</h1>
          <Button className="mt-4" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const userParticipant = project.participants.find((p) => p.userId === user?.id)
  const getStatusColor = (status: string) => {
    const colors = {
      PLANNING: "bg-blue-500",
      ACTIVE: "bg-green-500",
      COMPLETED: "bg-purple-500",
      ON_HOLD: "bg-yellow-500",
      CANCELLED: "bg-red-500",
    }
    return colors[status as keyof typeof colors] || "bg-gray-500"
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{project.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
            <Badge variant="outline">
              <MapPin className="h-3 w-3 mr-1" />
              {project.locationScope}
            </Badge>
            {userParticipant && <Badge variant="secondary">{userParticipant.role}</Badge>}
          </div>
        </div>
      </div>

      {/* Project Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Project Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-6">{project.description}</p>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Overall Progress</span>
                    <span>{project.progress.overall}%</span>
                  </div>
                  <Progress value={project.progress.overall} className="h-3" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">
                      {project.progress.milestonesCompleted}/{project.progress.totalMilestones} milestones
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">{project.progress.daysRemaining} days remaining</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Budget Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Budget
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Budget</span>
                  <span className="font-semibold">${project.budget.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Allocated</span>
                  <span>${project.budget.allocated.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Disbursed</span>
                  <span className="text-green-600">${project.budget.disbursed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Remaining</span>
                  <span className="text-blue-600">${project.budget.remaining.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Impact Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Impact Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Participants</span>
                  <span className="font-semibold">{project.impactMetrics.participantsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Beneficiaries</span>
                  <span className="font-semibold">{project.impactMetrics.beneficiariesCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Impact Points</span>
                  <span className="text-orange-600">{project.impactMetrics.impactPointsGenerated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Tokens Distributed</span>
                  <span className="text-yellow-600">{project.impactMetrics.tokensDistributed}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Project Tabs */}
      <Tabs defaultValue="milestones">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="budget">Budget & Funding</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="milestones" className="mt-6">
          <MilestoneTracker
            project={project}
            milestones={milestones}
            onSubmitMilestone={handleSubmitMilestone}
            onVerifyMilestone={handleVerifyMilestone}
            onCreateMilestone={handleCreateMilestone}
          />
        </TabsContent>

        <TabsContent value="participants" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Project Participants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {project.participants.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {participant.user.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-semibold">{participant.user.name}</h4>
                        <p className="text-sm text-gray-600">{participant.contribution.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">{participant.role}</Badge>
                      <div className="text-sm text-gray-600 mt-1">
                        {participant.performance.impactPointsEarned} impact points
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Budget Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {milestones.map((milestone) => (
                    <div key={milestone.id} className="flex justify-between items-center p-3 border rounded">
                      <div>
                        <h4 className="font-medium">{milestone.title}</h4>
                        <p className="text-sm text-gray-600">
                          Status: {milestone.status} | Priority: {milestone.priority}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${milestone.funding.allocated.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">
                          ${milestone.funding.disbursed.toLocaleString()} disbursed
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Funding Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center text-gray-600">
                    <Calendar className="h-12 w-12 mx-auto mb-2" />
                    <p>Funding timeline visualization will be displayed here</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-600 py-12">
                <TrendingUp className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Reports Coming Soon</h3>
                <p>Detailed project analytics and reports will be available here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
