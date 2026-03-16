"use client"

import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { StatsGrid } from "@/components/layout/stats-grid"
import { ProjectDashboard } from "@/components/projects/project-dashboard"
import { useAuth } from "@/contexts/auth-context"
import { useQuery } from "@tanstack/react-query"
import { projectApi, ProjectListItemDto } from "@/lib/api"
import { FolderOpen, Target, Users, TrendingUp, ArrowRight } from "lucide-react"
import type { Project } from "@/lib/types/projects"

/** Maps the lean API DTO to the richer legacy Project shape expected by ProjectDashboard. */
function toProject(p: ProjectListItemDto): Project {
  const completionPct =
    p.milestonesCount > 0
      ? Math.round((p.completedMilestonesCount / p.milestonesCount) * 100)
      : 0

  return {
    id: p.id,
    proposalId: p.proposalId ?? "",
    title: p.title,
    description: p.description ?? "",
    locationScope: "LOCAL",
    status: p.status as Project["status"],
    budget: { total: 0, allocated: 0, disbursed: 0, remaining: 0 },
    timeline: {
      startDate: p.createdAt,
      endDate: p.updatedAt,
      estimatedDuration: 0,
    },
    participants: [],
    milestones: [],
    createdBy: { id: p.ownerUserId ?? "", name: "", type: "USER" },
    managedBy: { id: p.ownerUserId ?? "", name: "", role: "PROJECT_MANAGER" },
    groupId: p.ownerGroupId ?? undefined,
    progress: {
      overall: completionPct,
      milestonesCompleted: p.completedMilestonesCount,
      totalMilestones: p.milestonesCount,
      daysElapsed: 0,
      daysRemaining: 0,
    },
    impactMetrics: {
      participantsCount: 0,
      beneficiariesCount: 0,
      impactPointsGenerated: 0,
      tokensDistributed: 0,
    },
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

export default function ProjectsPage() {
  const { user } = useAuth()

  const { data: result, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectApi.getProjects({ limit: 50 }),
    staleTime: 60_000,
    enabled: !!user,
  })

  const projects = (result?.projects ?? []).map(toProject)

  const handleViewProject = (projectId: string) => {
    window.location.href = `/projects/${projectId}`
  }

  const stats = [
    {
      title: "Active Projects",
      value: projects.filter((p) => p.status === "ACTIVE").length,
      change: "",
      changeType: "positive" as const,
      icon: FolderOpen,
      color: "bg-[#1E3D2F]",
      description: "Currently running",
    },
    {
      title: "Completed Milestones",
      value: projects.reduce((sum, p) => sum + p.progress.milestonesCompleted, 0),
      change: "",
      changeType: "positive" as const,
      icon: Target,
      color: "bg-[#C9922A]",
      description: "Achievements unlocked",
    },
    {
      title: "Total Milestones",
      value: projects.reduce((sum, p) => sum + p.progress.totalMilestones, 0),
      change: "",
      changeType: "positive" as const,
      icon: Users,
      color: "bg-[#2A5240]",
      description: "Across all projects",
    },
    {
      title: "Avg. Progress",
      value: `${Math.round(projects.reduce((sum, p) => sum + p.progress.overall, 0) / (projects.length || 1))}%`,
      change: "",
      changeType: "positive" as const,
      icon: TrendingUp,
      color: "bg-[#B03A1E]",
      description: "Project completion",
    },
  ]

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#C9922A] border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageHeader
        title="Project Management"
        description="Projects are launched from approved governance proposals."
        actions={
          <Link
            href="/proposals"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "#D4911E", color: "#0A1F14" }}
          >
            View Proposals
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <StatsGrid stats={stats} />

      <ProjectDashboard projects={projects} onCreateProject={() => window.location.href = "/proposals"} onViewProject={handleViewProject} />
    </div>
  )
}
