"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { projectApi, type ProjectSetupMilestone } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp, Briefcase } from "lucide-react"

type VerificationMethod = ProjectSetupMilestone["verificationMethod"]

const VERIFICATION_METHODS: { value: VerificationMethod; label: string }[] = [
  { value: "PEER", label: "Peer review" },
  { value: "SUPERVISOR", label: "Supervisor sign-off" },
  { value: "COMMUNITY_WITNESS", label: "Community witness" },
  { value: "PHOTO_EVIDENCE", label: "Photo evidence" },
]

// Editor row mirrors ProjectSetupMilestone but keeps free-text inputs the UI
// parses into the structured arrays on submit.
interface DraftMilestone {
  title: string
  description: string
  budgetAmount: string
  startOffset: string
  duration: string
  verificationMethod: VerificationMethod
  verifiersNeeded: string
  deliverables: string // one per line
  laborHours: string
  materials: string // one per line
  criteria: string // one per line
  advancedOpen: boolean
}

function blankMilestone(): DraftMilestone {
  return {
    title: "",
    description: "",
    budgetAmount: "",
    startOffset: "0",
    duration: "7",
    verificationMethod: "PEER",
    verifiersNeeded: "1",
    deliverables: "",
    laborHours: "",
    materials: "",
    criteria: "",
    advancedOpen: false,
  }
}

const inputCls =
  "w-full h-9 rounded-lg border border-cream bg-white px-3 text-sm text-[#0A1F14] placeholder:text-warm-gray/60 focus:outline-none focus:ring-2 focus:ring-amber/40"
const taCls =
  "w-full rounded-lg border border-cream bg-white px-3 py-2 text-sm text-[#0A1F14] placeholder:text-warm-gray/60 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"

function lines(s: string): string[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
}

export function ProjectSetupEditor({
  proposalId,
  onDone,
}: {
  proposalId: string
  onDone?: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [milestones, setMilestones] = useState<DraftMilestone[]>([blankMilestone()])

  function update(i: number, patch: Partial<DraftMilestone>) {
    setMilestones((ms) => ms.map((m, idx) => (idx === i ? { ...m, ...patch } : m)))
  }

  const valid =
    milestones.length > 0 &&
    milestones.every(
      (m) =>
        m.title.trim().length >= 3 &&
        m.description.trim().length >= 1 &&
        Number(m.duration) >= 1 &&
        Number(m.budgetAmount) >= 0 &&
        m.budgetAmount !== "",
    )

  const totalBudget = milestones.reduce((s, m) => s + (Number(m.budgetAmount) || 0), 0)

  const { mutate: setup, isPending } = useMutation({
    mutationFn: () => {
      const payload: ProjectSetupMilestone[] = milestones.map((m, i) => ({
        title: m.title.trim(),
        description: m.description.trim(),
        budgetAmount: Number(m.budgetAmount) || 0,
        startOffset: Number(m.startOffset) || 0,
        duration: Number(m.duration) || 1,
        verificationMethod: m.verificationMethod,
        verifiersNeeded: Number(m.verifiersNeeded) || 1,
        orderIndex: i,
        deliverables: lines(m.deliverables).map((d) => ({ description: d })),
        ...(m.laborHours ? { laborHours: Number(m.laborHours) } : {}),
        ...(lines(m.materials).length ? { materials: lines(m.materials).map((item) => ({ item })) } : {}),
        ...(lines(m.criteria).length
          ? { verificationCriteria: lines(m.criteria).map((criterion) => ({ criterion, required: true })) }
          : {}),
      }))
      return projectApi.createFromProposal(proposalId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] })
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      toast({ title: "Project set up", description: "Milestones saved. You can now start execution." })
      onDone?.()
    },
    onError: (err: any) =>
      toast({ title: "Setup failed", description: err?.message ?? "Please try again.", variant: "destructive" }),
  })

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {milestones.map((m, i) => (
          <div key={i} className="rounded-xl border border-cream bg-cream/30 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-tea-green">Milestone {i + 1}</span>
              {milestones.length > 1 && (
                <button
                  type="button"
                  onClick={() => setMilestones((ms) => ms.filter((_, idx) => idx !== i))}
                  className="text-warm-gray hover:text-red-500 transition-colors"
                  aria-label="Remove milestone"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <input
              className={inputCls}
              placeholder="Title (e.g. Drill the borehole)"
              value={m.title}
              onChange={(e) => update(i, { title: e.target.value })}
            />
            <textarea
              className={taCls}
              rows={2}
              placeholder="What will be done in this milestone?"
              value={m.description}
              onChange={(e) => update(i, { description: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[11px] text-warm-gray">Budget (KES)</span>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  placeholder="0"
                  value={m.budgetAmount}
                  onChange={(e) => update(i, { budgetAmount: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-warm-gray">Duration (days)</span>
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={m.duration}
                  onChange={(e) => update(i, { duration: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-warm-gray">Starts after (days)</span>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={m.startOffset}
                  onChange={(e) => update(i, { startOffset: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-warm-gray">Verifiers needed</span>
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={m.verifiersNeeded}
                  onChange={(e) => update(i, { verifiersNeeded: e.target.value })}
                />
              </label>
            </div>

            <label className="space-y-1 block">
              <span className="text-[11px] text-warm-gray">How is completion verified?</span>
              <select
                className={inputCls}
                value={m.verificationMethod}
                onChange={(e) => update(i, { verificationMethod: e.target.value as VerificationMethod })}
              >
                {VERIFICATION_METHODS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 block">
              <span className="text-[11px] text-warm-gray">Deliverables (one per line)</span>
              <textarea
                className={taCls}
                rows={2}
                placeholder={"Borehole drilled to 80m\nHand pump installed"}
                value={m.deliverables}
                onChange={(e) => update(i, { deliverables: e.target.value })}
              />
            </label>

            <button
              type="button"
              onClick={() => update(i, { advancedOpen: !m.advancedOpen })}
              className="flex items-center gap-1 text-[11px] font-medium text-tea-green"
            >
              {m.advancedOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Advanced (labour, materials, acceptance criteria)
            </button>

            {m.advancedOpen && (
              <div className="space-y-2.5 pt-1">
                <label className="space-y-1 block">
                  <span className="text-[11px] text-warm-gray">Estimated labour hours</span>
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    placeholder="0"
                    value={m.laborHours}
                    onChange={(e) => update(i, { laborHours: e.target.value })}
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="text-[11px] text-warm-gray">Materials (one per line)</span>
                  <textarea
                    className={taCls}
                    rows={2}
                    placeholder={"Cement x 20 bags\nPVC piping 100m"}
                    value={m.materials}
                    onChange={(e) => update(i, { materials: e.target.value })}
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="text-[11px] text-warm-gray">Acceptance criteria (one per line)</span>
                  <textarea
                    className={taCls}
                    rows={2}
                    placeholder={"Water flows at the tap\nNo leaks at the joints"}
                    value={m.criteria}
                    onChange={(e) => update(i, { criteria: e.target.value })}
                  />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setMilestones((ms) => [...ms, blankMilestone()])}
        className="flex items-center gap-1.5 text-sm font-medium text-tea-green hover:text-amber transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add milestone
      </button>

      <div className="flex items-center justify-between border-t border-cream pt-3">
        <span className="text-xs text-warm-gray">
          {milestones.length} milestone{milestones.length === 1 ? "" : "s"} · total budget{" "}
          <strong className="text-[#0A1F14]">KES {totalBudget.toLocaleString()}</strong>
        </span>
        <button
          type="button"
          onClick={() => setup()}
          disabled={!valid || isPending}
          className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{ background: "#1D4731", color: "#fff" }}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
          {isPending ? "Setting up…" : "Set up project"}
        </button>
      </div>
    </div>
  )
}
