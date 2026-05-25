"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { use } from "react"
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query"
import { projectApi, projectUpdatesApi, type ProjectDetailDto, type ProjectMilestoneDto, type WorkLogResponseDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { WorkSessionPanel } from "@/components/projects/work-session-panel"
import TaskBoard from "@/components/projects/task-board"
import MemberContributions from "@/components/projects/member-contributions"
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
  ClipboardList,
  UserPlus,
  Coins,
  ListTodo,
  MessageSquare,
  Send,
  Check,
  X as XIcon,
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

const WORK_TYPE_LABELS: Record<string, string> = {
  MANUAL_LABOR: "Manual Labour",
  SKILLED_WORK:  "Skilled Work",
  SUPERVISION:   "Supervision",
}

const LOG_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  PENDING:  { color: "#C9922A", bg: "rgba(201,146,42,0.10)" },
  APPROVED: { color: "#1D4731", bg: "rgba(29,71,49,0.10)"   },
  REJECTED: { color: "#B03A1E", bg: "rgba(176,58,30,0.10)"  },
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

// ── Milestone action sub-panels ───────────────────────────

function MilestoneStartButton({ milestoneId, projectId }: { milestoneId: string; projectId: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const mut = useMutation({
    mutationFn: () => projectApi.startMilestone(milestoneId),
    onSuccess: () => {
      toast({ title: "Milestone started" })
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  })
  return (
    <button
      onClick={() => mut.mutate()}
      disabled={mut.isPending}
      className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
      style={{ background: "#C9922A", color: "#fff" }}
    >
      {mut.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
      Start Milestone
    </button>
  )
}

function MilestoneSubmitForm({
  milestoneId, projectId, onClose,
}: { milestoneId: string; projectId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [proofUrl, setProofUrl] = useState("")
  const [desc, setDesc] = useState("")
  const mut = useMutation({
    mutationFn: () => projectApi.submitMilestone({ milestoneId, proofUrl, description: desc }),
    onSuccess: () => {
      toast({ title: "Milestone submitted for review" })
      onClose()
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  })
  return (
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
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"
      />
      <button
        onClick={() => mut.mutate()}
        disabled={mut.isPending || !desc.trim()}
        className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
        style={{ background: "#1D4731", color: "#fff" }}
      >
        {mut.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        Submit for Review
      </button>
    </div>
  )
}

function MilestoneVerifyForm({
  milestoneId, projectId, onClose,
}: { milestoneId: string; projectId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [feedback, setFeedback] = useState("")
  const mut = useMutation({
    mutationFn: (approved: boolean) =>
      projectApi.verifyMilestone({ milestoneId, approved, feedback: feedback || undefined }),
    onSuccess: (_, approved) => {
      toast({ title: approved ? "Milestone verified ✓" : "Milestone rejected" })
      onClose()
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  })
  return (
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
          onClick={() => mut.mutate(false)}
          disabled={mut.isPending}
          className="flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: "rgba(176,58,30,0.10)", color: "#B03A1E" }}
        >
          {mut.isPending && <Loader2 className="h-3 w-3 animate-spin inline mr-1" />}
          Reject
        </button>
        <button
          onClick={() => mut.mutate(true)}
          disabled={mut.isPending}
          className="flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: "#1D4731", color: "#fff" }}
        >
          {mut.isPending && <Loader2 className="h-3 w-3 animate-spin inline mr-1" />}
          Approve
        </button>
      </div>
    </div>
  )
}

function MilestoneLogHoursPanel({ milestoneId }: { milestoneId: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [workType, setWorkType] = useState<"MANUAL_LABOR" | "SKILLED_WORK" | "SUPERVISION">("MANUAL_LABOR")
  const [desc, setDesc] = useState("")
  const [hours, setHours] = useState(1)
  const mut = useMutation({
    mutationFn: () => projectApi.logWork({ milestoneId, workType, description: desc, hours }),
    onSuccess: () => {
      toast({ title: "Hours logged" })
      setDesc("")
      setHours(1)
      queryClient.invalidateQueries({ queryKey: ["work-logs", milestoneId] })
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  })
  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#2A6B7C] hover:opacity-80 transition-opacity"
      >
        <ClipboardList className="h-3.5 w-3.5" />
        Log hours
        {open ? <ChevronUp className="h-3 w-3 opacity-60" /> : <ChevronDown className="h-3 w-3 opacity-60" />}
      </button>
      {open && (
        <div className="space-y-2.5 pt-1">
          <div className="flex gap-2">
            <select
              value={workType}
              onChange={(e) => setWorkType(e.target.value as typeof workType)}
              className="h-9 rounded-lg border border-black/10 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber/40"
            >
              <option value="MANUAL_LABOR">Manual Labour</option>
              <option value="SKILLED_WORK">Skilled Work</option>
              <option value="SUPERVISION">Supervision</option>
            </select>
            <input
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-20 h-9 rounded-lg border border-black/10 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber/40"
              placeholder="hrs"
            />
          </div>
          <textarea
            placeholder="What did you do? (min 10 chars)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"
          />
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || desc.trim().length < 10 || hours <= 0}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "#2A6B7C", color: "#fff" }}
          >
            {mut.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Submit Hours
          </button>
        </div>
      )}
    </div>
  )
}

function MilestoneWorkLogs({
  milestoneId, milestoneStatus, expanded, isLeader,
}: { milestoneId: string; milestoneStatus: string; expanded: boolean; isLeader: boolean }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const showLogs = ["IN_PROGRESS", "AWAITING_VERIFICATION", "VERIFIED"].includes(milestoneStatus)
  const { data } = useQuery<{ workLogs: WorkLogResponseDto[]; total: number }>({
    queryKey: ["work-logs", milestoneId],
    queryFn:  () => projectApi.getWorkLogs(milestoneId),
    enabled:  showLogs && expanded,
    staleTime: 30_000,
  })
  const verifyMut = useMutation({
    mutationFn: ({ workLogId, approved, feedback }: { workLogId: string; approved: boolean; feedback?: string }) =>
      projectApi.verifyWork({ workLogId, approved, feedback }),
    onSuccess: (_, vars) => {
      toast({ title: vars.approved ? "Work log approved ✓" : "Work log rejected" })
      queryClient.invalidateQueries({ queryKey: ["work-logs", milestoneId] })
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  })
  if (!data || data.workLogs.length === 0) return null
  return (
    <div className="space-y-1.5 pt-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#0E0B08]/40">
        Logged work ({data.total})
      </p>
      {data.workLogs.map((log) => {
        const sc = LOG_STATUS_COLORS[log.status] ?? LOG_STATUS_COLORS.PENDING
        const canVerify = isLeader && log.status === "PENDING"
        return (
          <div
            key={log.id}
            className="rounded-lg p-2.5 space-y-2"
            style={{ background: "rgba(0,0,0,0.025)" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#0E0B08]">
                  {WORK_TYPE_LABELS[log.workType]} · {log.hours}h
                </p>
                <p className="text-[10px] text-[#0E0B08]/50 line-clamp-2 mt-0.5">{log.description}</p>
                <p className="text-[10px] text-[#0E0B08]/35 mt-0.5">{log.worker.name ?? "Member"}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                  style={{ color: sc.color, background: sc.bg }}
                >
                  {log.status.toLowerCase()}
                </span>
                {log.totalIPEarned > 0 && (
                  <span className="text-[10px] font-bold" style={{ color: "#C9922A" }}>
                    +{log.totalIPEarned} IP
                  </span>
                )}
              </div>
            </div>
            {canVerify && (
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  onClick={() => verifyMut.mutate({ workLogId: log.id, approved: true })}
                  disabled={verifyMut.isPending}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: "rgba(29,71,49,0.12)", color: "#1D4731" }}
                >
                  <Check className="h-3 w-3" /> Approve
                </button>
                <button
                  onClick={() => verifyMut.mutate({ workLogId: log.id, approved: false })}
                  disabled={verifyMut.isPending}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: "rgba(176,58,30,0.10)", color: "#B03A1E" }}
                >
                  <XIcon className="h-3 w-3" /> Reject
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Milestone card ────────────────────────────────────────

function MilestoneCard({
  milestone,
  isMember,
  isLeader,
  projectId,
  projectMembers,
}: {
  milestone: ProjectMilestoneDto
  isMember: boolean
  isLeader: boolean
  projectId: string
  projectMembers: ProjectDetailDto["members"]
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = MILESTONE_STATUS[milestone.status] ?? MILESTONE_STATUS.PENDING
  const canStart    = isMember && milestone.status === "PENDING"
  const canSubmit   = isMember && milestone.status === "IN_PROGRESS"
  const canVerify   = isMember && milestone.status === "AWAITING_VERIFICATION"
  const canLogWork  = isMember && milestone.status === "IN_PROGRESS"
  const hasWorkLogs = ["IN_PROGRESS", "AWAITING_VERIFICATION", "VERIFIED"].includes(milestone.status)

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
              {milestone.tasks.length > 0 && (
                <p className="text-[10px] text-[#0E0B08]/35 mt-1">
                  {milestone.tasks.filter((t) => t.status === "DONE").length}/{milestone.tasks.length} tasks done
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={milestone.status} config={MILESTONE_STATUS} />
            {(canStart || canSubmit || canVerify || canLogWork || hasWorkLogs) && (
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

      {expanded && (
        <div
          className="border-t px-4 py-4 space-y-3"
          style={{ borderColor: "rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.015)" }}
        >
          {canStart   && <MilestoneStartButton milestoneId={milestone.id} projectId={projectId} />}
          {canSubmit  && <MilestoneSubmitForm  milestoneId={milestone.id} projectId={projectId} onClose={() => setExpanded(false)} />}
          {canVerify  && <MilestoneVerifyForm  milestoneId={milestone.id} projectId={projectId} onClose={() => setExpanded(false)} />}
          {canLogWork && <MilestoneLogHoursPanel milestoneId={milestone.id} />}
          {canLogWork && (
            <WorkSessionPanel
              milestoneId={milestone.id}
              projectId={projectId}
              projectMembers={projectMembers}
              isLeader={isLeader}
            />
          )}
          <MilestoneWorkLogs milestoneId={milestone.id} milestoneStatus={milestone.status} expanded={expanded} isLeader={isLeader} />
        </div>
      )}
    </div>
  )
}

// ── Relative time ─────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return days === 1 ? "1d" : `${days}d`
}

// ── Tabs ──────────────────────────────────────────────────

type Tab = "milestones" | "tasks" | "team" | "updates"

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "milestones", label: "Milestones", icon: <PlayCircle className="h-3.5 w-3.5" /> },
    { id: "tasks",      label: "Tasks",      icon: <ListTodo className="h-3.5 w-3.5" /> },
    { id: "team",       label: "Team",       icon: <Users className="h-3.5 w-3.5" /> },
    { id: "updates",    label: "Updates",    icon: <MessageSquare className="h-3.5 w-3.5" /> },
  ]
  return (
    <div
      className="flex gap-1 rounded-xl p-1"
      style={{ background: "rgba(14,11,8,0.05)" }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all"
          style={
            active === t.id
              ? { background: "#fff", color: "#1D4731", boxShadow: "0 1px 3px rgba(0,0,0,0.10)" }
              : { color: "rgba(14,11,8,0.45)" }
          }
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Project header card ───────────────────────────────────

function ProjectHeaderCard({
  project,
  projectId,
  user,
  isMember,
}: {
  project: ProjectDetailDto
  projectId: string
  user: { id: string } | null
  isMember: boolean
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [contributeAmount, setContributeAmount] = useState("")
  const [showContributeForm, setShowContributeForm] = useState(false)

  const projectCfg = PROJECT_STATUS[project.status] ?? PROJECT_STATUS.PLANNING
  const progress = project.milestonesCount > 0
    ? Math.round((project.completedMilestonesCount / project.milestonesCount) * 100)
    : 0

  const joinMutation = useMutation({
    mutationFn: () => projectApi.joinProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      toast({ title: "Joined project ✓" })
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  })

  const contributeMutation = useMutation({
    mutationFn: () => projectApi.contribute(projectId, parseInt(contributeAmount, 10)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      setShowContributeForm(false)
      setContributeAmount("")
      toast({ title: `Contributed ${contributeAmount} UT ✓`, description: `New balance: ${data.newBalance} UT` })
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  })

  return (
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

        {user && (
          <div className="mt-4 flex flex-wrap gap-2">
            {!isMember && (
              <button
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "#1D4731", color: "#fff" }}
              >
                {joinMutation.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <UserPlus className="h-3.5 w-3.5" />}
                Join Project
              </button>
            )}
            {isMember && !showContributeForm && (
              <button
                onClick={() => setShowContributeForm(true)}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all hover:opacity-90"
                style={{ background: "rgba(201,146,42,0.12)", color: "#C9922A" }}
              >
                <Coins className="h-3.5 w-3.5" />
                Contribute UT
              </button>
            )}
          </div>
        )}

        {showContributeForm && (
          <div className="mt-4 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={100000}
              placeholder="Amount (UT)"
              value={contributeAmount}
              onChange={(e) => setContributeAmount(e.target.value)}
              className="w-32 h-9 rounded-lg border border-black/10 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber/40"
            />
            <button
              onClick={() => contributeMutation.mutate()}
              disabled={contributeMutation.isPending || !contributeAmount || parseInt(contributeAmount, 10) < 1}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "#C9922A", color: "#fff" }}
            >
              {contributeMutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : "Confirm"}
            </button>
            <button
              onClick={() => { setShowContributeForm(false); setContributeAmount("") }}
              className="text-xs text-[#0E0B08]/40 hover:text-[#0E0B08]/70 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        <p className="text-[10px] text-[#0E0B08]/35 mt-3">
          Created {formatDate(project.createdAt)}
        </p>
      </CardContent>
    </Card>
  )
}

// ── Tab panels ────────────────────────────────────────────

function MilestonesTab({
  milestones, isMember, isLeader, projectId, members,
}: {
  milestones: ProjectMilestoneDto[]
  isMember: boolean
  isLeader: boolean
  projectId: string
  members: ProjectDetailDto["members"]
}) {
  if (milestones.length === 0) {
    return (
      <Card className="border-0 shadow-card">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-[#0E0B08]/40">No milestones defined yet.</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="space-y-3">
      {milestones
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((m) => (
          <MilestoneCard
            key={m.id}
            milestone={m}
            isMember={isMember}
            isLeader={isLeader}
            projectId={projectId}
            projectMembers={members}
          />
        ))}
    </div>
  )
}

function TeamTab({ projectId, members }: { projectId: string; members: ProjectDetailDto["members"] }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#0E0B08]/40 mb-3">
          Contributions
        </h2>
        <MemberContributions projectId={projectId} />
      </div>
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" style={{ color: "#C9922A" }} />
            Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {members.map((m) => (
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
    </div>
  )
}

// ── Updates tab ───────────────────────────────────────────

function UpdatesTab({ projectId, isMember }: { projectId: string; isMember: boolean }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [content, setContent] = useState("")
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mutation = useMutation({
    mutationFn: () => projectUpdatesApi.create(projectId, content.trim()),
    onSuccess: () => {
      setContent("")
      setFocused(false)
      queryClient.invalidateQueries({ queryKey: ["project-updates", projectId] })
    },
  })

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [content])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["project-updates", projectId],
    queryFn: ({ pageParam }) =>
      projectUpdatesApi.list(projectId, { cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  })

  const updates = data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="space-y-4">
      {/* Compose — only for project members */}
      {isMember && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#fff",
            boxShadow: focused
              ? "0 0 0 2px rgba(201,146,42,0.35), 0 1px 6px rgba(14,11,8,0.07)"
              : "0 1px 6px rgba(14,11,8,0.07), 0 0 0 1px rgba(14,11,8,0.04)",
            transition: "box-shadow 0.15s",
          }}
        >
          <div className="flex gap-3 px-4 pt-4 pb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold"
              style={{ background: "rgba(29,71,49,0.10)", color: "#1D4731" }}
            >
              {user?.username?.slice(0, 2).toUpperCase() ?? user?.email?.slice(0, 2).toUpperCase() ?? "Me"}
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setFocused(true)}
              placeholder="What's the latest on this project?"
              rows={1}
              maxLength={1000}
              className="flex-1 resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-[rgba(14,11,8,0.35)]"
              style={{ color: "#0E0B08", minHeight: "24px" }}
            />
          </div>
          {(focused || content.length > 0) && (
            <div
              className="flex items-center justify-end px-4 pb-3 pt-1 border-t gap-3"
              style={{ borderColor: "rgba(14,11,8,0.06)" }}
            >
              <span
                className="text-[11px] font-medium"
                style={{ color: content.length > 900 ? "#B03A1E" : "rgba(14,11,8,0.30)" }}
              >
                {1000 - content.length}
              </span>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !content.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-bold disabled:opacity-40"
                style={{ background: "#1D4731", color: "#fff" }}
              >
                {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Post Update
              </button>
            </div>
          )}
        </div>
      )}

      {/* Updates list */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "#fff", boxShadow: "0 1px 6px rgba(14,11,8,0.07), 0 0 0 1px rgba(14,11,8,0.04)" }}
      >
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : updates.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium" style={{ color: "#7A6E60" }}>No updates yet.</p>
            {isMember && (
              <p className="text-xs mt-1" style={{ color: "rgba(14,11,8,0.35)" }}>
                Be the first to post a project update above.
              </p>
            )}
          </div>
        ) : (
          <div>
            {updates.map((u) => (
              <div
                key={u.id}
                className="flex gap-3 px-4 py-4 border-b last:border-0"
                style={{ borderColor: "rgba(14,11,8,0.05)" }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold"
                  style={{ background: "rgba(29,71,49,0.10)", color: "#1D4731" }}
                >
                  {u.authorInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-[13px] font-semibold" style={{ color: "#0E0B08" }}>{u.authorName}</span>
                    <span style={{ color: "rgba(14,11,8,0.25)" }}>·</span>
                    <span className="text-[11px]" style={{ color: "rgba(14,11,8,0.38)" }}>
                      {relativeTime(u.createdAt)}
                    </span>
                  </div>
                  <p className="text-[14px] leading-relaxed" style={{ color: "#0E0B08" }}>{u.content}</p>
                </div>
              </div>
            ))}
            {hasNextPage && (
              <div className="px-4 py-3 border-t" style={{ borderColor: "rgba(14,11,8,0.05)" }}>
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="w-full text-xs font-semibold py-2 rounded-xl hover:bg-black/[0.03] flex items-center justify-center gap-1.5"
                  style={{ color: "#1D4731" }}
                >
                  {isFetchingNextPage ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Load more
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>("milestones")

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

  const isMember = project.members.some((m) => m.userId === user?.id)
  const isLeader = project.members.some((m) => m.userId === user?.id && m.role === "LEADER")

  return (
    <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E0B08]/50 hover:text-[#0E0B08] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Projects
      </Link>

      <ProjectHeaderCard project={project} projectId={id} user={user} isMember={isMember} />

      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === "milestones" && (
        <MilestonesTab
          milestones={project.milestones}
          isMember={isMember}
          isLeader={isLeader}
          projectId={id}
          members={project.members}
        />
      )}
      {activeTab === "tasks" && (
        <TaskBoard projectId={id} milestones={project.milestones} isLeader={isLeader} />
      )}
      {activeTab === "team" && (
        <TeamTab projectId={id} members={project.members} />
      )}
      {activeTab === "updates" && (
        <UpdatesTab projectId={id} isMember={isMember} />
      )}
    </div>
  )
}
