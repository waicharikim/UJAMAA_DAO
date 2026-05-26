"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle, XCircle, Plus, BookOpen, Clock, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { adminEducationApi, type EducationModuleDto, type CreateModuleDto } from "@/lib/api"

function ModuleReviewCard({ module }: { module: EducationModuleDto }) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [showRejectForm, setShowRejectForm] = useState(false)

  const approveMutation = useMutation({
    mutationFn: () => adminEducationApi.approve(module.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "education-pending"] }),
  })

  const rejectMutation = useMutation({
    mutationFn: () => adminEducationApi.reject(module.id, rejectReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "education-pending"] })
      setShowRejectForm(false)
      setRejectReason("")
    },
  })

  return (
    <div className="rounded-xl border" style={{ borderColor: "rgba(14,11,8,0.1)", background: "#fff" }}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: "rgba(201,146,42,0.1)", color: "#C9922A" }}
              >
                {module.difficulty.toLowerCase()}
              </span>
              <span className="text-[10px] text-[#0E0B08]/40 uppercase tracking-wide">{module.category}</span>
            </div>
            <p className="font-semibold text-[#0E0B08] leading-snug">{module.title}</p>
            <p className="text-xs text-[#0E0B08]/55 mt-1 leading-relaxed line-clamp-2">{module.description}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-[#0E0B08]/40">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{module.duration}m</span>
              <span>by {module.creator.name ?? "Unknown"}</span>
              {module.completionIP > 0 && <span>+{module.completionIP} IP</span>}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-black/5 transition-colors text-xs text-[#0E0B08]/50"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setShowRejectForm((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <XCircle className="h-5 w-5 text-red-400" />
            </button>
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="p-1.5 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="h-5 w-5 text-green-600" />
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-black/6">
            <p className="text-xs font-semibold text-[#0E0B08]/50 mb-2 uppercase tracking-wide">Content preview</p>
            <pre className="text-xs text-[#0E0B08]/65 whitespace-pre-wrap font-mono rounded-lg p-3 max-h-64 overflow-y-auto"
              style={{ background: "rgba(26,18,11,0.04)", border: "1px solid rgba(26,18,11,0.06)" }}>
              {module.content.slice(0, 1200)}{module.content.length > 1200 ? "\n\n[truncated…]" : ""}
            </pre>
          </div>
        )}

        {showRejectForm && (
          <div className="mt-3 space-y-2">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (min 10 chars, visible to the author)"
              rows={2}
              className="text-sm resize-none border-red-200 focus:border-red-400"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowRejectForm(false); setRejectReason("") }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={rejectReason.trim().length < 10 || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate()}
              >
                Confirm Reject
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const CATEGORIES = ["governance", "health", "agriculture", "civic", "economy", "environment", "technology", "other"]
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const

function AdminCreateForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<CreateModuleDto>({
    title: "",
    description: "",
    content: "",
    difficulty: "BEGINNER",
    category: "governance",
    duration: 15,
    completionIP: 20,
  })

  const createMutation = useMutation({
    mutationFn: (dto: CreateModuleDto) => adminEducationApi.createModule(dto),
    onSuccess: onCreated,
  })

  const isValid = form.title.trim().length >= 5 && form.description.trim().length >= 20 && form.content.trim().length >= 100

  function set(k: keyof CreateModuleDto, v: any) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <Input
          placeholder="Title (5–120 chars)"
          value={form.title}
          maxLength={120}
          onChange={(e) => set("title", e.target.value)}
        />
        <Textarea
          placeholder="Short description (20–500 chars)"
          value={form.description}
          maxLength={500}
          rows={2}
          className="resize-none"
          onChange={(e) => set("description", e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "rgba(14,11,8,0.1)" }}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
          <select
            value={form.difficulty}
            onChange={(e) => set("difficulty", e.target.value as any)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "rgba(14,11,8,0.1)" }}
          >
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}
          </select>
          <Input
            type="number" min={1} max={300} placeholder="Duration (min)"
            value={form.duration} onChange={(e) => set("duration", parseInt(e.target.value) || 15)}
          />
          <Input
            type="number" min={0} max={200} placeholder="IP reward"
            value={form.completionIP} onChange={(e) => set("completionIP", parseInt(e.target.value) || 0)}
          />
        </div>
        <Textarea
          placeholder="Module content (markdown supported, min 100 chars)"
          value={form.content}
          rows={10}
          className="resize-y font-mono text-xs"
          onChange={(e) => set("content", e.target.value)}
        />
      </div>
      <Button
        onClick={() => createMutation.mutate(form)}
        disabled={!isValid || createMutation.isPending}
        className="w-full text-white"
        style={{ background: "#1D4731" }}
      >
        {createMutation.isPending ? "Publishing…" : "Publish Module (auto-approved)"}
      </Button>
    </div>
  )
}

export function EducationReview() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "education-pending"],
    queryFn: () => adminEducationApi.getPending({ limit: 50 }),
    staleTime: 30_000,
  })

  const pending = data?.modules ?? []

  return (
    <div className="space-y-6">
      {/* Create panel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" style={{ color: "#C9922A" }} />
              Publish a New Module
            </CardTitle>
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: "#1D4731" }}
            >
              <Plus className="h-3.5 w-3.5" />
              {showCreate ? "Cancel" : "Create"}
            </button>
          </div>
        </CardHeader>
        {showCreate && (
          <CardContent>
            <AdminCreateForm onCreated={() => {
              setShowCreate(false)
              queryClient.invalidateQueries({ queryKey: ["education-modules"] })
            }} />
          </CardContent>
        )}
      </Card>

      {/* Review queue */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            Community Submissions
            {pending.length > 0 && (
              <Badge className="bg-amber-100 text-amber-800 ml-1">{pending.length} pending</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-[#0E0B08]/40 text-center py-8">Loading…</p>
          ) : pending.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle className="h-8 w-8 mx-auto mb-2" style={{ color: "rgba(42,82,64,0.3)" }} />
              <p className="text-sm text-[#0E0B08]/40">No modules awaiting review</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((m) => (
                <ModuleReviewCard key={m.id} module={m} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
