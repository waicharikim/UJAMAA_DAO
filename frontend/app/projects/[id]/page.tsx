"use client"

import { useState } from "react"
import Link from "next/link"
import { use } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { projectApi, type ProjectDetailDto, type ProjectMilestoneDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft,
  Briefcase,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Circle,
  PlayCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
} from "lucide-react"
import { formatDate } from "@/lib/utils"

// ── Status config ─────────────────────────────────────────

const PROJECT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PLANNING:  { label: "Planning",   color: "#C9922A", bg: "rgba(201,146,42,0.10)" },
  ACTIVE:    { label: "Active",     color: "#1D4731", bg: "rgba(29,71,49,0.10)"   },
  ON_HOLD:   { label: "On Hold",    color: "#7A6E60", bg: "rgba(122,110,96,0.10)" },
  CANCELLED: { label: "Cancelled",  color: "#B03A1E", bg: "rgba(176,58,30,0.10)" },
  COMPLETED: { label: "Completed",  color: "#2A7A4B", bg: "rgba(42,122,75,0.10)" },
}

const MILESTONE_STATUS: Record<
  string,
  { label: string; color: string; bg: string; Icon: React.ElementType }
> = {
  PENDING:                { label: "Pending",             color: "#7A6E60", bg: "rgba(122,110,96,0.10)", Icon: Circle        },
  IN_PROGRESS:            { label: "In Progress",         color: "#C9922A", bg: "rgba(201,146,42,0.10)", Icon: PlayCircle    },
  AWAITING_VERIFICATION:  { label: "Awaiting Review",     color: "#2A6B7C", bg: "rgba(42,107,124,0.10)", Icon: Clock         },
  VERIFIED:               { label: "Verified",            color: "#1D4731", bg: "rgba(29,71,49,0.10)",   Icon: CheckCircle2  },
  REJECTED:               { label: "Rejected",            color: "#B03A1E", bg: "rgba(176,58,30,0.10)",  Icon: XCircle       },
}

// ── Helpers ───────────────────────────────────────────────

function StatusBadge({ status, config }: { status: string; config: Record<string, { label: string; color: string; bg: string; Icon?: React.ElementType }> }) {
  const cfg = config[status] ?? { label: status, color: "#7A6E60", bg: "rgba(122,110,96,0.10)", Icon: Circle }
  const Icon = "Icon" in cfg ? cfg.Icon! : undefined
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {cfg.label}
    </span>
  )
}

// ── Skeleton ──────────────────────────────────────────────

function ProjectSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-28 rounded-2xl" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    </div>
  )
}

// ── Milestone card ────────────────────────────────────────

function MilestoneCard({
  milestone,
  isMember,
  projectId,
}: {
  milestone: ProjectMilestoneDto
  isMember: boolean
  projectId: string
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)

  // Submit form state
  const [proofUrl, setProofUrl] = useState("")
  const [submitDesc, setSubmitDesc] = useState("")

  // Verify form state
  const [feedback, setFeedback] = useState("")

  const cfg = MILESTONE_STATUS[milestone.status] ?? MILESTONE_STATUS.PENDING

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["project", projectId] })

  const startMutation = useMutation({
    mutationFn: () => projectApi.startMilestone(milestone.id),
    onSuccess: () => { toast({ title: "Milestone started" }); invalidate() },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  })

  const submitMutation = useMutation({
    mutationFn: () => projectApi.submitMilestone({ milestoneId: milestone.id, proofUrl, description: submitDesc }),
    onSuccess: () => { toast({ title: "Milestone submitted for review" }); setExpanded(false); invalidate() },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  })

  const verifyMutation = useMutation({
    mutationFn: (approved: boolean) => projectApi.verifyMilestone({ milestoneId: milestone.id, approved, feedback: feedback || undefined }),
    onSuccess: (_, approved) => { toast({ title: approved ? "Milestone verified ✓" : "Milestone rejected" }); setExpanded(false); invalidate() },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  })

  const canStart  = isMember && milestone.status === "PENDING"
  const canSubmit = isMember && milestone.status === "IN_PROGRESS"
  const canVerify = isMember && milestone.status === "AWAITING_VERIFICATION"

  return (
    <div
      className="bg-white rounded-2xl border transition-shadow hover:shadow-sm"
      style={{ borderColor: "rgba(0,0,0,0.07)" }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: cfg.bg }}
            >
              <cfg.Icon className="h-4 w-4" style={{ color: cfg.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0E0B08] leading-snug">{milestone.title}</p>
              {milestone.description && (
                <p className="text-xs text-[#0E0B08]/50 mt-0.5 line-clamp-1">{milestone.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={milestone.status} config={MILESTONE_STATUS} />
            {(canStart || canSubmit || canVerify) && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1 rounded-lg hover:bg-black/5 transition-colors"
              >
                {expanded
                  ? <ChevronUp className="h-3.5 w-3.5 text-[#0E0B08]/40" />
                  : <ChevronDown className="h-3.5 w-3.5 text-[#0E0B08]/40" />
                }
              </button>
            )}
          </div>
        </div>

        {milestone.dueDate && (
          <p className="text-[10px] text-[#0E0B08]/40 mt-2 ml-11">
            Due {formatDate(milestone.dueDate)}
          </p>
        )}
      </div>

      {/* Action panel */}
      {expanded && (
        <div
          className="border-t px-4 py-4 space-y-3"
          style={{ borderColor: "rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.015)" }}
        >
          {/* Start */}
          {canStart && (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "#C9922A", color: "#fff" }}
            >
              {startMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Start Milestone
            </button>
          )}

          {/* Submit */}
          {canSubmit && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-[#0E0B08]">Submit for review</p>
              <input
                type="url"
                placeholder="Proof URL (photo, doc, drive link…)"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                className="w-full h-9 rounded-lg border border-black/10 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber/40"
              />
              <textarea
                placeholder="Describe what was completed…"
                value={submitDesc}
                onChange={(e) => setSubmitDesc(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"
              />
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !submitDesc.trim()}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "#1D4731", color: "#fff" }}
              >
                {submitMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Submit for Review
              </button>
            </div>
          )}

          {/* Verify */}
          {canVerify && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-[#0E0B08]">Review submission</p>
              <textarea
                placeholder="Optional feedback…"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => verifyMutation.mutate(false)}
                  disabled={verifyMutation.isPending}
                  className="flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: "rgba(176,58,30,0.10)", color: "#B03A1E" }}
                >
                  {verifyMutation.isPending && <Loader2 className="h-3 w-3 animate-spin inline mr-1" />}
                  Reject
                </button>
                <button
                  onClick={() => verifyMutation.mutate(true)}
                  disabled={verifyMutation.isPending}
                  className="flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#1D4731", color: "#fff" }}
                >
                  {verifyMutation.isPending && <Loader2 className="h-3 w-3 animate-spin inline mr-1" />}
                  Approve
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()

  const { data: project, isLoading, error } = useQuery<ProjectDetailDto>({
    queryKey: ["project", id],
    queryFn:  () => projectApi.getProject(id),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto">
        <ProjectSkeleton />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto text-center py-20">
        <p className="text-sm font-medium" style={{ color: "#B03A1E" }}>Project not found.</p>
        <Link href="/projects" className="text-xs text-[#0E0B08]/50 mt-2 inline-block hover:underline">
          ← Back to projects
        </Link>
      </div>
    )
  }

  const projectCfg = PROJECT_STATUS[project.status] ?? PROJECT_STATUS.PLANNING
  const isMember   = project.members.some((m) => m.userId === user?.id)
  const progress   = project.milestonesCount > 0
    ? Math.round((project.completedMilestonesCount / project.milestonesCount) * 100)
    : 0

  return (
    <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto space-y-6">

      {/* Back link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E0B08]/50 hover:text-[#0E0B08] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Projects
      </Link>

      {/* Header card */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: projectCfg.bg }}
            >
              <Briefcase className="h-5 w-5" style={{ color: projectCfg.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-bold text-2xl text-[#0E0B08] leading-tight">
                {project.title}
              </h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <StatusBadge status={project.status} config={PROJECT_STATUS} />
                {project.ownerGroup && (
                  <Link
                    href={`/groups/${project.ownerGroup.id}`}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1D4731] hover:underline"
                  >
                    {project.ownerGroup.name}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                )}
                {project.proposal && (
                  <Link
                    href={`/proposals/${project.proposal.id}`}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#2A6B7C] hover:underline"
                  >
                    View proposal
                    <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {project.description && (
            <p className="text-sm text-[#0E0B08]/60 leading-relaxed mt-4">
              {project.description}
            </p>
          )}

          {/* Progress */}
          {project.milestonesCount > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-[#0E0B08]/50">Progress</span>
                <span className="font-bold text-[#0E0B08]">
                  {project.completedMilestonesCount}/{project.milestonesCount} milestones · {progress}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, background: "#1D4731" }}
                />
              </div>
            </div>
          )}

          <p className="text-[10px] text-[#0E0B08]/35 mt-3">
            Created {formatDate(project.createdAt)}
          </p>
        </CardContent>
      </Card>

      {/* Milestones */}
      {project.milestones.length > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#0E0B08]/40 mb-3">Milestones</h2>
          <div className="space-y-3">
            {project.milestones
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((m) => (
                <MilestoneCard
                  key={m.id}
                  milestone={m}
                  isMember={isMember}
                  projectId={id}
                />
              ))}
          </div>
        </div>
      )}

      {project.milestones.length === 0 && (
        <Card className="border-0 shadow-card">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-[#0E0B08]/40">No milestones defined yet.</p>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      {project.members.length > 0 && (
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" style={{ color: "#C9922A" }} />
              Team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {project.members.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
                  style={{ borderColor: "rgba(0,0,0,0.05)" }}
                >
                  <div className="flex items-center gap-2.5">
                    {m.user.avatarUrl ? (
                      <img src={m.user.avatarUrl} alt="" className="w-8 h-8 rounded-xl object-cover" />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: "#1D4731" }}
                      >
                        {(m.user.name ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                    <p className="text-sm font-semibold text-[#0E0B08]">{m.user.name ?? "Member"}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#7A6E60" }}>
                    {m.role.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
