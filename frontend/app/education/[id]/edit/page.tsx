"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, BookOpen, Send, Save } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { educationApi, type CreateModuleDto } from "@/lib/api"

const CATEGORIES = ["governance", "health", "agriculture", "civic", "economy", "environment", "technology", "other"]
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const

export default function EditModulePage() {
  const router = useRouter()
  const params = useParams()
  const moduleId = params.id as string
  const queryClient = useQueryClient()

  const { data: mod, isLoading } = useQuery({
    queryKey: ["education-module-edit", moduleId],
    queryFn: () => educationApi.getModule(moduleId),
    staleTime: 0,
  })

  const [form, setForm] = useState<CreateModuleDto>({
    title: "",
    description: "",
    content: "",
    difficulty: "BEGINNER",
    category: "governance",
    duration: 15,
    completionIP: 20,
  })
  const [ready, setReady] = useState(false)
  const [submitAfterSave, setSubmitAfterSave] = useState(false)

  useEffect(() => {
    if (mod && !ready) {
      setForm({
        title: mod.title,
        description: mod.description,
        content: mod.content,
        difficulty: mod.difficulty,
        category: mod.category,
        duration: mod.duration,
        completionIP: mod.completionIP,
      })
      setReady(true)
    }
  }, [mod, ready])

  const updateMutation = useMutation({
    mutationFn: (dto: Partial<CreateModuleDto>) => educationApi.updateModule(moduleId, dto),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["education-my-modules"] })
      if (submitAfterSave) {
        await educationApi.submitModule(moduleId)
        queryClient.invalidateQueries({ queryKey: ["education-my-modules"] })
        router.push("/education?submitted=1")
      } else {
        router.push("/education?saved=1")
      }
    },
  })

  function set(field: keyof CreateModuleDto, value: any) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const isValid =
    form.title.trim().length >= 5 &&
    form.description.trim().length >= 20 &&
    form.content.trim().length >= 100

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 space-y-4" style={{ background: "#F7F2E8" }}>
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: "#F7F2E8" }}>
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b"
        style={{ background: "rgba(247,242,232,0.95)", backdropFilter: "blur(8px)", borderColor: "rgba(14,11,8,0.08)" }}>
        <Link href="/education" className="p-1.5 rounded-lg hover:bg-black/5 transition-colors">
          <ArrowLeft className="h-5 w-5" style={{ color: "#0E0B08" }} />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <BookOpen className="h-4 w-4" style={{ color: "#C9922A" }} />
          <span className="font-semibold text-sm" style={{ color: "#0E0B08" }}>Edit Module</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(14,11,8,0.4)" }}>Title *</label>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={120}
            className="bg-white border-[rgba(14,11,8,0.1)] focus:border-[#C9922A]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(14,11,8,0.4)" }}>Short description *</label>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={500}
            rows={3}
            className="bg-white border-[rgba(14,11,8,0.1)] focus:border-[#C9922A] resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(14,11,8,0.4)" }}>Category</label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
              style={{ borderColor: "rgba(14,11,8,0.1)", color: "#0E0B08" }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(14,11,8,0.4)" }}>Difficulty</label>
            <select
              value={form.difficulty}
              onChange={(e) => set("difficulty", e.target.value as any)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
              style={{ borderColor: "rgba(14,11,8,0.1)", color: "#0E0B08" }}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(14,11,8,0.4)" }}>Duration (minutes)</label>
            <Input
              type="number" min={1} max={300}
              value={form.duration}
              onChange={(e) => set("duration", parseInt(e.target.value) || 15)}
              className="bg-white border-[rgba(14,11,8,0.1)] focus:border-[#C9922A]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(14,11,8,0.4)" }}>Impact Points reward</label>
            <Input
              type="number" min={0} max={200}
              value={form.completionIP}
              onChange={(e) => set("completionIP", parseInt(e.target.value) || 0)}
              className="bg-white border-[rgba(14,11,8,0.1)] focus:border-[#C9922A]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(14,11,8,0.4)" }}>Module content *</label>
          <Textarea
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            rows={16}
            className="bg-white border-[rgba(14,11,8,0.1)] focus:border-[#C9922A] resize-y font-mono text-sm"
          />
          <p className="text-[10px]" style={{ color: form.content.length < 100 ? "#C9922A" : "rgba(14,11,8,0.35)" }}>
            {form.content.length} chars {form.content.length < 100 ? `(need ${100 - form.content.length} more)` : "✓"}
          </p>
        </div>

        <div className="flex gap-3 pt-2 pb-8">
          <Button
            variant="outline"
            onClick={() => { setSubmitAfterSave(false); updateMutation.mutate(form) }}
            disabled={!isValid || updateMutation.isPending}
            className="flex-1 gap-2"
          >
            <Save className="h-4 w-4" />
            Save draft
          </Button>
          <Button
            onClick={() => { setSubmitAfterSave(true); updateMutation.mutate(form) }}
            disabled={!isValid || updateMutation.isPending}
            className="flex-1 gap-2 text-white"
            style={{ background: "#1D4731" }}
          >
            <Send className="h-4 w-4" />
            Submit for review
          </Button>
        </div>
      </div>
    </div>
  )
}
