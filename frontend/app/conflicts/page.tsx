"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { conflictApi, type ConflictCaseDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Flag,
  Plus,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react"

// ── Status config ──────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  OPEN:         { label: "Open",         color: "#C9922A", bg: "rgba(201,146,42,0.12)", Icon: Clock },
  INVESTIGATING:{ label: "Investigating",color: "#2A6B7C", bg: "rgba(42,107,124,0.10)", Icon: AlertCircle },
  MEDIATION:    { label: "Mediation",    color: "#6B4F9E", bg: "rgba(107,79,158,0.10)", Icon: AlertCircle },
  CLOSED:       { label: "Closed",       color: "#1D4731", bg: "rgba(29,71,49,0.10)",   Icon: CheckCircle },
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  return `${days}d ago`
}

// ── Case card ─────────────────────────────────────────────

function CaseCard({ c, currentUserId }: { c: ConflictCaseDto; currentUserId: string }) {
  const cfg = STATUS_CFG[c.status] ?? STATUS_CFG.OPEN
  const { Icon, color, bg, label } = cfg
  const isComplainant = c.complainant.id === currentUserId
  const other = isComplainant ? c.respondent : c.complainant
  const role  = isComplainant ? "Filed by you" : "Filed against you"

  return (
    <Link href={`/conflicts/${c.id}`} className="block">
      <div
        className="bg-white rounded-2xl shadow-card border-l-[3px] p-4 hover:shadow-md transition-shadow"
        style={{ borderLeftColor: color }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0E0B08]">vs {other.name}</p>
              <p className="text-[10px] text-[#0E0B08]/40 mt-0.5">{role} · {relativeTime(c.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: bg, color }}
            >
              {label}
            </span>
            <ChevronRight className="h-4 w-4 text-[#0E0B08]/30" />
          </div>
        </div>
        <p className="text-xs text-[#0E0B08]/60 mt-3 line-clamp-2">{c.description}</p>
      </div>
    </Link>
  )
}

// ── File conflict form ─────────────────────────────────────

function FileConflictForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ respondentId: "", description: "" })

  const { mutate, isPending } = useMutation({
    mutationFn: () => conflictApi.fileConflict({
      respondentId: form.respondentId.trim(),
      description:  form.description.trim(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-conflicts"] })
      toast({ title: "Case filed", description: "The other party will be notified." })
      onClose()
    },
    onError: (err: any) => toast({
      title: "Failed to file conflict",
      description: err?.message ?? "Please try again.",
      variant: "destructive",
    }),
  })

  const valid = form.respondentId.trim().length > 10 && form.description.trim().length >= 20

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Flag className="h-4 w-4" style={{ color: "#B03A1E" }} />
            File a Conflict Report
          </CardTitle>
          <button onClick={onClose} className="text-[#0E0B08]/40 hover:text-[#0E0B08]">
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-[#0E0B08]/60 uppercase tracking-wider mb-1.5 block">
            Other party's User ID
          </label>
          <Input
            placeholder="Paste their user ID (e.g. from their profile)"
            value={form.respondentId}
            onChange={(e) => setForm((f) => ({ ...f, respondentId: e.target.value }))}
          />
          <p className="text-[10px] text-[#0E0B08]/40 mt-1">Find the ID on their public profile page (/profile/[id])</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-[#0E0B08]/60 uppercase tracking-wider mb-1.5 block">
            Description <span className="font-normal">(min 20 chars)</span>
          </label>
          <Textarea
            placeholder="Describe the conflict clearly. Include relevant dates, actions, and impact on the ward community."
            rows={4}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <p className="text-[10px] text-[#0E0B08]/40 mt-1">{form.description.length} / 2000 chars</p>
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            onClick={() => mutate()}
            disabled={!valid || isPending}
            className="flex-1 font-semibold rounded-xl"
            style={{ background: "#1D4731", color: "#fff" }}
          >
            {isPending ? "Filing…" : "Submit Report"}
          </Button>
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function ConflictsPage() {
  const { user } = useAuth()
  const [showForm, setShowForm] = useState(false)

  const { data: cases, isLoading } = useQuery({
    queryKey: ["my-conflicts"],
    queryFn:  conflictApi.getMyCases,
    staleTime: 30_000,
    enabled: !!user,
  })

  const open   = cases?.filter((c) => c.status !== "CLOSED") ?? []
  const closed = cases?.filter((c) => c.status === "CLOSED") ?? []

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-3xl text-[#0E0B08]">Conflicts</h2>
          <p className="text-sm text-[#0E0B08]/50 mt-1">
            Structured dispute resolution for ward members.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all hover:opacity-80 flex-shrink-0"
            style={{ background: "rgba(176,58,30,0.10)", color: "#B03A1E" }}
          >
            <Plus className="h-3.5 w-3.5" />
            File Report
          </button>
        )}
      </div>

      {/* File form */}
      {showForm && <FileConflictForm onClose={() => setShowForm(false)} />}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !cases?.length && !showForm && (
        <Card className="border-0 shadow-card text-center py-12">
          <CardContent>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: "rgba(176,58,30,0.08)" }}>
              <Flag className="h-5 w-5" style={{ color: "#B03A1E" }} />
            </div>
            <p className="text-sm font-semibold text-[#0E0B08] mb-1">No conflicts on record</p>
            <p className="text-xs text-[#0E0B08]/50 max-w-xs mx-auto">
              Conflicts between ward members are handled here through structured mediation.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Open cases */}
      {!isLoading && open.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-[#0E0B08]/40">
            Open · {open.length}
          </p>
          {open.map((c) => (
            <CaseCard key={c.id} c={c} currentUserId={user?.id ?? ""} />
          ))}
        </section>
      )}

      {/* Closed cases */}
      {!isLoading && closed.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-[#0E0B08]/40">
            Resolved · {closed.length}
          </p>
          {closed.map((c) => (
            <CaseCard key={c.id} c={c} currentUserId={user?.id ?? ""} />
          ))}
        </section>
      )}
    </div>
  )
}
