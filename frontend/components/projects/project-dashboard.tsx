"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Search,
  Filter,
  BarChart3,
  Target,
  Award,
  Coins,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { ProjectService } from "@/lib/services/project-service"
import type { Project, ProjectFilters } from "@/lib/types/projects"

interface ProjectDashboardProps {
  projects?: Project[]
  onCreateProject?: () => void
  onViewProject?: (projectId: string) => void
}

export function ProjectDashboard({ projects = [], onCreateProject, onViewProject }: ProjectDashboardProps) {
  const { user } = useAuth()
  const [filteredProjects, setFilteredProjects] = useState<Project[]>(projects)
  const [filters, setFilters] = useState<ProjectFilters>({
    search: "",
    status: [],
    locationScope: [],
    participantRole: [],
  })
  const [activeTab, setActiveTab] = useState("all")
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const filtered = ProjectService.filterProjects(projects, filters)
    setFilteredProjects(filtered)
  }, [projects, filters])

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

  const getStatusIcon = (status: string) => {
    const icons = {
      PLANNING: Clock,
      ACTIVE: TrendingUp,
      COMPLETED: CheckCircle,
      ON_HOLD: AlertCircle,
      CANCELLED: AlertCircle,
    }
    const Icon = icons[status as keyof typeof icons] || Clock
    return <Icon className="h-4 w-4" />
  }

  const getUserProjects = (role?: string) => {
    if (!user) return []
    return filteredProjects.filter((project) => {
      const isParticipant = project.participants.some((p) => p.userId === user.id)
      if (role) {
        return project.participants.some((p) => p.userId === user.id && p.role === role)
      }
      return isParticipant
    })
  }

  const getProjectsByTab = () => {
    switch (activeTab) {
      case "managing":
        return getUserProjects("MANAGER")
      case "participating":
        return getUserProjects("PARTICIPANT")
      case "verifying":
        return getUserProjects("VERIFIER")
      default:
        return filteredProjects
    }
  }

  const calculateOverallStats = () => {
    const userProjects = getUserProjects()
    return {
      totalProjects: userProjects.length,
      activeProjects: userProjects.filter((p) => p.status === "ACTIVE").length,
      completedProjects: userProjects.filter((p) => p.status === "COMPLETED").length,
      totalImpactPoints: userProjects.reduce((sum, p) => sum + p.impactMetrics.impactPointsGenerated, 0),
      totalTokensEarned: userProjects.reduce((sum, p) => sum + p.impactMetrics.tokensDistributed, 0),
    }
  }

  const renderProjectCard = (project: Project) => {
    const userParticipant = project.participants.find((p) => p.userId === user?.id)
    const isManager = userParticipant?.role === "MANAGER"
    const isVerifier = userParticipant?.role === "VERIFIER"

    return (
      <Card key={project.id} className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardHeader onClick={() => onViewProject?.(project.id)}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(project.status)}
                {project.title}
              </CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                <Badge variant="outline">{project.locationScope}</Badge>
                {userParticipant && <Badge variant="secondary">{userParticipant.role}</Badge>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">{project.progress.overall}%</div>
              <div className="text-sm text-gray-500">Complete</div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <p className="text-gray-600 mb-4 line-clamp-2">{project.description}</p>

          <div className="space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Overall Progress</span>
                <span>
                  {project.progress.milestonesCompleted}/{project.progress.totalMilestones} milestones
                </span>
              </div>
              <Progress value={project.progress.overall} className="h-2" />
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-sm">{project.participants.length} participants</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-sm">${project.budget.disbursed.toLocaleString()} disbursed</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-500" />
                <span className="text-sm">{project.progress.daysRemaining} days left</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-orange-500" />
                <span className="text-sm">{project.impactMetrics.impactPointsGenerated} impact pts</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => onViewProject?.(project.id)}>
                View Details
              </Button>
              {isManager && (
                <Button variant="outline" size="sm">
                  Manage
                </Button>
              )}
              {isVerifier && (
                <Button variant="outline" size="sm">
                  Review
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderStatsCards = () => {
    const stats = calculateOverallStats()

    return (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{stats.totalProjects}</div>
                <div className="text-sm text-gray-600">Total Projects</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{stats.activeProjects}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{stats.completedProjects}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{stats.totalImpactPoints}</div>
                <div className="text-sm text-gray-600">Impact Points</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">{stats.totalTokensEarned}</div>
                <div className="text-sm text-gray-600">Tokens Earned</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderFilters = () => {
    if (!showFilters) return null

    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              value={filters.status[0] || "all"}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value === "all" ? [] : [value] }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PLANNING">Planning</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.locationScope[0] || "all"}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, locationScope: value === "all" ? [] : [value] }))
              }
            >
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
              value={filters.participantRole[0] || "all"}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, participantRole: value === "all" ? [] : [value] }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Your Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="PARTICIPANT">Participant</SelectItem>
                <SelectItem value="VERIFIER">Verifier</SelectItem>
                <SelectItem value="TREASURER">Treasurer</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => setFilters({ search: "", status: [], locationScope: [], participantRole: [] })}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Project Dashboard</h1>
          <p className="text-gray-600">Manage and track your project participation</p>
        </div>
        <Button onClick={onCreateProject}>
          <Plus className="h-4 w-4 mr-2" />
          Create Project
        </Button>
      </div>

      {/* Stats Cards */}
      {renderStatsCards()}

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search projects..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {renderFilters()}

      {/* Project Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Projects</TabsTrigger>
          <TabsTrigger value="managing">Managing</TabsTrigger>
          <TabsTrigger value="participating">Participating</TabsTrigger>
          <TabsTrigger value="verifying">Verifying</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getProjectsByTab().length === 0 ? (
              <div className="col-span-full text-center py-12">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No projects found</h3>
                <p className="text-gray-500">
                  {activeTab === "all"
                    ? "No projects match your current filters."
                    : `You don't have any projects in the ${activeTab} category.`}
                </p>
              </div>
            ) : (
              getProjectsByTab().map(renderProjectCard)
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
