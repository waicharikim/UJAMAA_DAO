"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/auth-context"
import { projectApi, SKILL_CATEGORIES, type TaskDto, type SkillCategory, type ProjectMilestoneDto } from "@/lib/api"
import { CheckCircle2, Circle, Clock, AlertCircle, Plus, X, ChevronDown } from "lucide-react"

// ── helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<TaskDto["status"], string> = {
  TODO: "Open",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  BLOCKED: "Blocked",
}

const STATUS_COLOR: Record<TaskDto["status"], string> = {
  TODO: "#1D4731",
  IN_PROGRESS: "#C9922A",
  DONE: "#5B7F5B",
  BLOCKED: "#B03A1E",
}

const STATUS_ICON: Record<TaskDto["status"], React.ReactNode> = {
  TODO: <Circle className="h-4 w-4" />,
  IN_PROGRESS: <Clock className="h-4 w-4" />,
  DONE: <CheckCircle2 className="h-4 w-4" />,
  BLOCKED: <AlertCircle className="h-4 w-4" />,
}

// ── sub-components ────────────────────────────────────────────────────────────

function TaskCard({
  task,
  userId,
  isLeader,
  projectId,
}: {
  task: TaskDto
  userId: string | undefined
  isLeader: boolean
  projectId: string
}) {
  const queryClient = useQueryClient()

  const claimMutation = useMutation({
    mutationFn: () => projectApi.claimTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] })
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
    },
  })

  const completeMutation = useMutation({
    mutationFn: () => projectApi.completeTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] })
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
    },
  })

  const isAssignedToMe = task.assignedTo?.id === userId
  const canClaim = task.status === "TODO" && !!userId && !task.assignedTo
  const canComplete = task.status === "IN_PROGRESS" && isAssignedToMe

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-semibold text-[#0E0B08] leading-snug">{task.title}</p>
          {task.description && (
            <p className="text-xs text-[#0E0B08]/50 line-clamp-2">{task.description}</p>
          )}
        </div>
        <span
          className="shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: `${STATUS_COLOR[task.status]}15`, color: STATUS_COLOR[task.status] }}
        >
          {STATUS_ICON[task.status]}
          {STATUS_LABEL[task.status]}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {task.skillCategory && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: "rgba(29,71,49,0.08)", color: "#1D4731" }}
          >
            {task.skillCategory}
          </span>
        )}
        {task.dueDate && (
          <span className="text-[10px] text-[#0E0B08]/40">
            Due {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>

      {task.assignedTo && (
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
            style={{ background: "#1D4731" }}
          >
            {(task.assignedTo.name ?? "?")[0].toUpperCase()}
          </div>
          <span className="text-xs text-[#0E0B08]/60">{task.assignedTo.name ?? "Unknown"}</span>
          {isAssignedToMe && (
            <span className="text-[10px] font-semibold text-[#C9922A]">(you)</span>
          )}
        </div>
      )}

      {(canClaim || canComplete) && (
        <button
          onClick={() => (canClaim ? claimMutation.mutate() : completeMutation.mutate())}
          disabled={claimMutation.isPending || completeMutation.isPending}
          className="w-full rounded-lg py-2 text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: canComplete ? "#1D4731" : "rgba(29,71,49,0.1)", color: canComplete ? "#fff" : "#1D4731" }}
        >
          {claimMutation.isPending || completeMutation.isPending
            ? "…"
            : canComplete
              ? "Mark as Done (+10 IP)"
              : "Claim Task"}
        </button>
      )}
    </div>
  )
}

// ── Create task form ──────────────────────────────────────────────────────────

function CreateTaskForm({
  milestones,
  projectId,
  onClose,
}: {
  milestones: ProjectMilestoneDto[]
  projectId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    milestoneId: milestones[0]?.id ?? "",
    title: "",
    description: "",
    skillCategory: "" as SkillCategory | "",
    maxAssignees: 1,
    dueDate: "",
  })

  const createMutation = useMutation({
    mutationFn: () =>
      projectApi.createTask({
        milestoneId: form.milestoneId,
        title: form.title,
        description: form.description || undefined,
        skillCategory: (form.skillCategory as SkillCategory) || undefined,
        maxAssignees: form.maxAssignees,
        dueDate: form.dueDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] })
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      onClose()
    },
  })

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#0E0B08]">New Task</p>
        <button onClick={onClose}>
          <X className="h-4 w-4 text-[#0E0B08]/40 hover:text-[#0E0B08]" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#0E0B08]/60">Milestone</label>
          <select
            className="w-full rounded-lg border border-[#0E0B08]/10 px-3 py-2 text-sm bg-white text-[#0E0B08]"
            value={form.milestoneId}
            onChange={(e) => setForm((f) => ({ ...f, milestoneId: e.target.value }))}
          >
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#0E0B08]/60">Title *</label>
          <input
            className="w-full rounded-lg border border-[#0E0B08]/10 px-3 py-2 text-sm text-[#0E0B08] placeholder:text-[#0E0B08]/30"
            placeholder="e.g. Mix concrete for foundation"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#0E0B08]/60">Description</label>
          <textarea
            className="w-full rounded-lg border border-[#0E0B08]/10 px-3 py-2 text-sm text-[#0E0B08] placeholder:text-[#0E0B08]/30 resize-none"
            placeholder="What needs to be done?"
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#0E0B08]/60">Skill</label>
            <select
              className="w-full rounded-lg border border-[#0E0B08]/10 px-3 py-2 text-sm bg-white text-[#0E0B08]"
              value={form.skillCategory}
              onChange={(e) => setForm((f) => ({ ...f, skillCategory: e.target.value as SkillCategory | "" }))}
            >
              <option value="">Any skill</option>
              {SKILL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#0E0B08]/60">Due date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-[#0E0B08]/10 px-3 py-2 text-sm text-[#0E0B08]"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => createMutation.mutate()}
        disabled={!form.title.trim() || !form.milestoneId || createMutation.isPending}
        className="w-full rounded-xl py-2.5 text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
        style={{ background: "#1D4731", color: "#fff" }}
      >
        {createMutation.isPending ? "Creating…" : "Create Task"}
      </button>
      {createMutation.isError && (
        <p className="text-xs text-[#B03A1E]">
          {(createMutation.error as Error).message}
        </p>
      )}
    </div>
  )
}

// ── Main TaskBoard ────────────────────────────────────────────────────────────

interface TaskBoardProps {
  projectId: string
  milestones: ProjectMilestoneDto[]
  isLeader: boolean
}

export default function TaskBoard({ projectId, milestones, isLeader }: TaskBoardProps) {
  const { user } = useAuth()
  const [skillFilter, setSkillFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["project-tasks", projectId, statusFilter, skillFilter],
    queryFn: () =>
      projectApi.listProjectTasks(projectId, {
        status: statusFilter || undefined,
        skillCategory: skillFilter || undefined,
      }),
    staleTime: 30_000,
  })

  const tasks = data?.tasks ?? []

  const grouped = {
    TODO: tasks.filter((t) => t.status === "TODO"),
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS"),
    DONE: tasks.filter((t) => t.status === "DONE"),
    BLOCKED: tasks.filter((t) => t.status === "BLOCKED"),
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          {/* Skill filter pills */}
          <button
            onClick={() => setSkillFilter("")}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
            style={{
              background: skillFilter === "" ? "#1D4731" : "rgba(29,71,49,0.08)",
              color: skillFilter === "" ? "#fff" : "#1D4731",
            }}
          >
            All skills
          </button>
          {SKILL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSkillFilter(skillFilter === cat ? "" : cat)}
              className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
              style={{
                background: skillFilter === cat ? "#1D4731" : "rgba(29,71,49,0.08)",
                color: skillFilter === cat ? "#fff" : "#1D4731",
              }}
            >
              {cat.charAt(0) + cat.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Status quick filter */}
        <div className="relative">
          <select
            className="appearance-none rounded-lg border border-[#0E0B08]/10 pl-3 pr-7 py-1.5 text-xs font-semibold bg-white text-[#0E0B08] cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="TODO">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
            <option value="BLOCKED">Blocked</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#0E0B08]/40 pointer-events-none" />
        </div>

        {isLeader && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all hover:opacity-90"
            style={{ background: "#1D4731", color: "#fff" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Task
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateTaskForm
          milestones={milestones}
          projectId={projectId}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Task columns */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-[#0E0B08]/05 animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-10 space-y-2">
          <p className="text-sm font-semibold text-[#0E0B08]/40">No tasks yet</p>
          {isLeader && (
            <p className="text-xs text-[#0E0B08]/30">
              Add tasks to break this project into claimable work items.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const).map((status) => {
            const group = grouped[status]
            if (group.length === 0) return null
            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span style={{ color: STATUS_COLOR[status] }}>{STATUS_ICON[status]}</span>
                  <span className="text-xs font-bold text-[#0E0B08]/60 uppercase tracking-wide">
                    {STATUS_LABEL[status]}
                  </span>
                  <span className="text-xs text-[#0E0B08]/30">({group.length})</span>
                </div>
                <div className="space-y-2">
                  {group.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      userId={user?.id}
                      isLeader={isLeader}
                      projectId={projectId}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
