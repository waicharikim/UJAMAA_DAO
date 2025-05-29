"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { StatsGrid } from "@/components/layout/stats-grid"
import { ProjectDashboard } from "@/components/projects/project-dashboard"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Plus, FolderOpen, Target, Users, TrendingUp } from "lucide-react"
import type { Project } from "@/lib/types/projects"

export default function ProjectsPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setLoading(true)
      // Mock data for demonstration
      const mockProjects: Project[] = [
        {
          id: "1",
          proposalId: "prop-1",
          title: "Community Solar Energy Initiative",
          description:
            "Install solar panels in community centers to reduce energy costs and promote renewable energy adoption.",
          locationScope: "CONSTITUENCY",
          constituency: "Westlands",
          status: "ACTIVE",
          budget: { total: 50000, allocated: 30000, disbursed: 15000, remaining: 35000 },
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
          ],
          milestones: [],
          createdBy: { id: "group1", name: "Green Energy Collective", type: "GROUP" },
          managedBy: { id: user?.id || "user1", name: user?.name || "John Doe", role: "PROJECT_MANAGER" },
          groupId: "group1",
          groupName: "Green Energy Collective",
          progress: { overall: 65, milestonesCompleted: 2, totalMilestones: 4, daysElapsed: 30, daysRemaining: 60 },
          impactMetrics: {
            participantsCount: 8,
            beneficiariesCount: 500,
            impactPointsGenerated: 320,
            tokensDistributed: 640,
          },
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "2",
          proposalId: "prop-2",
          title: "Digital Literacy Training Program",
          description: "Comprehensive digital literacy training for rural communities to bridge the digital divide.",
          locationScope: "COUNTY",
          county: "Nairobi",
          status: "PLANNING",
          budget: { total: 25000, allocated: 0, disbursed: 0, remaining: 25000 },
          timeline: {
            startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 67 * 24 * 60 * 60 * 1000).toISOString(),
            estimatedDuration: 60,
          },
          participants: [
            {
              id: "p2",
              userId: user?.id || "user1",
              user: {
                id: user?.id || "user1",
                name: user?.name || "John Doe",
                email: user?.email || "john@example.com",
                avatarUrl: user?.avatarUrl,
                impactPoints: 95,
              },
              role: "PARTICIPANT",
              permissions: ["view_project", "submit_milestone"],
              contribution: {
                description: "Training curriculum development and delivery",
                hoursCommitted: 20,
                skillsOffered: ["Digital Training", "Curriculum Design"],
                availability: "VOLUNTEER",
              },
              performance: { milestonesCompleted: 0, impactPointsEarned: 0, tokensEarned: 0, rating: 0, feedback: [] },
              joinedAt: new Date().toISOString(),
              status: "ACTIVE",
            },
          ],
          milestones: [],
          createdBy: { id: user?.id || "user1", name: user?.name || "John Doe", type: "USER" },
          managedBy: { id: user?.id || "user1", name: user?.name || "John Doe", role: "PROJECT_MANAGER" },
          progress: { overall: 0, milestonesCompleted: 0, totalMilestones: 0, daysElapsed: 0, daysRemaining: 67 },
          impactMetrics: {
            participantsCount: 1,
            beneficiariesCount: 200,
            impactPointsGenerated: 0,
            tokensDistributed: 0,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]
      setProjects(mockProjects)
    } catch (error) {
      console.error("Failed to load projects:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = () => {
    window.location.href = "/projects/create"
  }

  const handleViewProject = (projectId: string) => {
    window.location.href = `/projects/${projectId}`
  }

  const stats = [
    {
      title: "Active Projects",
      value: projects.filter((p) => p.status === "ACTIVE").length,
      change: "+1 this month",
      changeType: "positive" as const,
      icon: FolderOpen,
      color: "bg-gradient-to-br from-green-500 to-green-600",
      description: "Currently running",
    },
    {
      title: "Completed Milestones",
      value: projects.reduce((sum, p) => sum + p.progress.milestonesCompleted, 0),
      change: "+5 this week",
      changeType: "positive" as const,
      icon: Target,
      color: "bg-gradient-to-br from-blue-500 to-blue-600",
      description: "Achievements unlocked",
    },
    {
      title: "Total Participants",
      value: projects.reduce((sum, p) => sum + p.participants.length, 0),
      change: "+3 new members",
      changeType: "positive" as const,
      icon: Users,
      color: "bg-gradient-to-br from-purple-500 to-purple-600",
      description: "Community involvement",
    },
    {
      title: "Avg. Progress",
      value: `${Math.round(projects.reduce((sum, p) => sum + p.progress.overall, 0) / projects.length || 0)}%`,
      change: "On track",
      changeType: "positive" as const,
      icon: TrendingUp,
      color: "bg-gradient-to-br from-orange-500 to-orange-600",
      description: "Project completion",
    },
  ]

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageHeader
        title="Project Management"
        description="Track your project participation, manage milestones, and collaborate with team members."
        gradient
        actions={
          <Button
            onClick={handleCreateProject}
            size="lg"
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        }
      />

      <StatsGrid stats={stats} />

      <ProjectDashboard projects={projects} onCreateProject={handleCreateProject} onViewProject={handleViewProject} />
    </div>
  )
}
