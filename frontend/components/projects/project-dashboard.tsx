"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Calendar,
  Users,
  Coins,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  BarChart3,
  Target,
  Award,
  ChevronRight,
  MapPin,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { ProjectService } from "@/lib/services/project-service"
import type { Project, ProjectFilters } from "@/lib/types/projects"

// ── Design-system status config ─────────────────────────────
const STATUS_META: Record<string, { color: string; bg: string; label: string; Icon: React.ElementType }> = {
  PLANNING:  { color: "#2A6B7C", bg: "rgba(42,107,124,0.12)",  label: "Planning",  Icon: Clock        },
  ACTIVE:    { color: "#1D4731", bg: "rgba(29,71,49,0.12)",    label: "Active",    Icon: TrendingUp   },
  COMPLETED: { color: "#1A6B3C", bg: "rgba(26,107,60,0.12)",   label: "Completed", Icon: CheckCircle  },
  ON_HOLD:   { color: "#C9922A", bg: "rgba(201,146,42,0.12)",  label: "On Hold",   Icon: AlertCircle  },
  CANCELLED: { color: "#B03A1E", bg: "rgba(176,58,30,0.12)",   label: "Cancelled", Icon: AlertCircle  },
}

const STATUS_PHOTOS: Record<string, string> = {
  PLANNING:  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=70",
  ACTIVE:    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=70",
  COMPLETED: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=600&q=70",
  ON_HOLD:   "https://images.unsplash.com/photo-1486175060817-5663ccc2ab84?auto=format&fit=crop&w=600&q=70",
  CANCELLED: "https://images.unsplash.com/photo-1486175060817-5663ccc2ab84?auto=format&fit=crop&w=600&q=70",
}

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
  const [activeTab, setActiveTab] = useState<"all" | "managing" | "participating" | "verifying">("all")
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    setFilteredProjects(ProjectService.filterProjects(projects, filters))
  }, [projects, filters])

  const getUserProjects = (role?: string) => {
    if (!user) return []
    return filteredProjects.filter((p) =>
      role
        ? p.participants.some((x) => x.userId === user.id && x.role === role)
        : p.participants.some((x) => x.userId === user.id)
    )
  }

  const getProjectsByTab = () => {
    switch (activeTab) {
      case "managing":      return getUserProjects("MANAGER")
      case "participating": return getUserProjects("PARTICIPANT")
      case "verifying":     return getUserProjects("VERIFIER")
      default:              return filteredProjects
    }
  }

  const myStats = (() => {
    const mine = getUserProjects()
    return {
      total:       mine.length,
      active:      mine.filter((p) => p.status === "ACTIVE").length,
      completed:   mine.filter((p) => p.status === "COMPLETED").length,
      impactPts:   mine.reduce((s, p) => s + p.impactMetrics.impactPointsGenerated, 0),
      tokens:      mine.reduce((s, p) => s + p.impactMetrics.tokensDistributed, 0),
    }
  })()

  // ── Project card ─────────────────────────────────────────
  function ProjectCard({ project }: { project: Project }) {
    const meta        = STATUS_META[project.status] ?? STATUS_META.PLANNING
    const photo       = STATUS_PHOTOS[project.status] ?? STATUS_PHOTOS.PLANNING
    const { Icon }    = meta
    const participant = project.participants.find((p) => p.userId === user?.id)
    const isManager   = participant?.role === "MANAGER"
    const isVerifier  = participant?.role === "VERIFIER"

    return (
      <div
        className="group rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl cursor-pointer"
        style={{ background: "#fff", border: "1px solid rgba(29,71,49,0.08)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
        onClick={() => onViewProject?.(project.id)}
      >
        {/* Photo cover */}
        <div className="relative h-32 overflow-hidden">
          <Image
            src={photo}
            alt={project.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(160deg, rgba(14,11,8,0.55) 0%, transparent 70%)" }}
          />
          {/* Status badge on photo */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-sm"
            style={{ background: `${meta.bg}`, border: `1px solid ${meta.color}44` }}>
            <Icon className="h-3 w-3" style={{ color: meta.color }} />
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
              {meta.label}
            </span>
          </div>
          {/* Progress pct */}
          <div className="absolute top-3 right-3 text-white text-sm font-bold"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
            {project.progress.overall}%
          </div>
        </div>

        {/* Card body */}
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-[15px] leading-snug text-[#1A120B] line-clamp-2 mb-1">
              {project.title}
            </h3>
            <p className="text-xs text-[#7A6E60] line-clamp-2 leading-relaxed">{project.description}</p>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-[11px] text-[#7A6E60] mb-1.5">
              <span>{project.progress.milestonesCompleted}/{project.progress.totalMilestones} milestones</span>
              <span style={{ color: meta.color }}>{project.progress.overall}% done</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(29,71,49,0.08)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${project.progress.overall}%`, background: meta.color }}
              />
            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#7A6E60" }}>
              <Users className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#1D4731" }} />
              {project.participants.length} participants
            </div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#7A6E60" }}>
              <Award className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#C9922A" }} />
              {project.impactMetrics.impactPointsGenerated} IP
            </div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#7A6E60" }}>
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#7A4F1E" }} />
              {project.progress.daysRemaining}d left
            </div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#7A6E60" }}>
              <Coins className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#C9922A" }} />
              {project.impactMetrics.tokensDistributed} UT
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "rgba(29,71,49,0.08)" }}>
            {participant && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(29,71,49,0.08)", color: "#1D4731" }}>
                {participant.role}
              </span>
            )}
            <div className="flex items-center gap-1.5 text-[11px] ml-auto" style={{ color: "#7A6E60" }}>
              <MapPin className="h-3 w-3" />
              {project.locationScope}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Compact stats row (user's own projects) ─────────────
  function MyStatsRow() {
    if (myStats.total === 0) return null
    return (
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: "My Projects",   value: myStats.total,     icon: Target,       color: "#1D4731"  },
          { label: "Active",        value: myStats.active,    icon: TrendingUp,   color: "#2A6B7C"  },
          { label: "Completed",     value: myStats.completed, icon: CheckCircle,  color: "#1A6B3C"  },
          { label: "Impact Pts",    value: myStats.impactPts, icon: Award,        color: "#C9922A"  },
          { label: "Tokens Earned", value: myStats.tokens,    icon: Coins,        color: "#7A4F1E"  },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl p-3 text-center"
            style={{ background: `${color}0D`, border: `1px solid ${color}22` }}>
            <Icon className="h-4 w-4 mx-auto mb-1" style={{ color }} />
            <p className="text-xl font-bold" style={{ color: "#1A120B" }}>{value}</p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: "#7A6E60" }}>{label}</p>
          </div>
        ))}
      </div>
    )
  }

  const TABS = [
    { key: "all" as const,          label: "All" },
    { key: "managing" as const,     label: "Managing" },
    { key: "participating" as const, label: "Participating" },
    { key: "verifying" as const,    label: "Verifying" },
  ]

  const displayed = getProjectsByTab()

  return (
    <div className="space-y-5">
      <MyStatsRow />

      {/* Search + filter bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#7A6E60" }} />
          <Input
            placeholder="Search projects…"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="pl-9 h-9 text-sm rounded-full border-0"
            style={{ background: "rgba(29,71,49,0.05)", color: "#1A120B" }}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="h-9 px-3 rounded-full gap-1.5 text-xs font-semibold"
          style={{ background: showFilters ? "rgba(29,71,49,0.10)" : "rgba(29,71,49,0.05)", color: "#1D4731" }}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
        </Button>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl"
          style={{ background: "rgba(29,71,49,0.04)", border: "1px solid rgba(29,71,49,0.08)" }}>
          <Select
            value={filters.status[0] || "all"}
            onValueChange={(v) => setFilters((p) => ({ ...p, status: v === "all" ? [] : [v] }))}
          >
            <SelectTrigger className="h-8 text-xs rounded-lg border-0" style={{ background: "#fff" }}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {["all", "PLANNING", "ACTIVE", "COMPLETED", "ON_HOLD", "CANCELLED"].map((v) => (
                <SelectItem key={v} value={v} className="text-xs">
                  {v === "all" ? "All Status" : v.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.locationScope[0] || "all"}
            onValueChange={(v) => setFilters((p) => ({ ...p, locationScope: v === "all" ? [] : [v] }))}
          >
            <SelectTrigger className="h-8 text-xs rounded-lg border-0" style={{ background: "#fff" }}>
              <SelectValue placeholder="Scope" />
            </SelectTrigger>
            <SelectContent>
              {["all", "LOCAL", "CONSTITUENCY", "COUNTY", "NATIONAL"].map((v) => (
                <SelectItem key={v} value={v} className="text-xs">
                  {v === "all" ? "All Scopes" : v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.participantRole[0] || "all"}
            onValueChange={(v) => setFilters((p) => ({ ...p, participantRole: v === "all" ? [] : [v] }))}
          >
            <SelectTrigger className="h-8 text-xs rounded-lg border-0" style={{ background: "#fff" }}>
              <SelectValue placeholder="Your Role" />
            </SelectTrigger>
            <SelectContent>
              {["all", "MANAGER", "PARTICIPANT", "VERIFIER", "TREASURER"].map((v) => (
                <SelectItem key={v} value={v} className="text-xs">
                  {v === "all" ? "All Roles" : v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ search: "", status: [], locationScope: [], participantRole: [] })}
            className="h-8 text-xs rounded-lg"
            style={{ color: "#B03A1E" }}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Tab strip */}
      <div className="flex gap-1 border-b" style={{ borderColor: "rgba(29,71,49,0.08)" }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap"
            style={activeTab === key
              ? { color: "#1D4731", borderBottom: "2px solid #1D4731" }
              : { color: "#7A6E60" }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(29,71,49,0.08)" }}>
            <BarChart3 className="h-6 w-6" style={{ color: "#1D4731" }} />
          </div>
          <p className="font-semibold text-sm" style={{ color: "#1A120B" }}>No projects found</p>
          <p className="text-xs" style={{ color: "#7A6E60" }}>
            {activeTab === "all"
              ? "No projects match your current filters."
              : `You don't have any projects in the ${activeTab} category.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  )
}
