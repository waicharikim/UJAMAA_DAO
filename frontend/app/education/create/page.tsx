"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { ArrowLeft, BookOpen, Send, Save, CheckCircle, XCircle, Award, Clock } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { educationApi, type CreateModuleDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

const CATEGORIES = ["governance", "health", "agriculture", "civic", "economy", "environment", "technology", "other"]
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const

function EligibilityWall({ verified }: { verified: boolean }) {
  const { user } = useAuth()

  const { data: eligibility, isLoading } = useQuery({
    queryKey: ["education-authorship-eligibility"],
    queryFn: educationApi.getAuthorshipEligibility,
    enabled: verified,
    staleTime: 120_000,
  })

  const criteria = [
    {
      icon: CheckCircle,
      label: "Community verified",
      met: verified,
      detail: verified ? "Verified member" : "Complete community verification",
      action: !verified ? { href: "/profile#verification", label: "Get verified" } : null,
    },
    {
      icon: BookOpen,
      label: "Completed 3 modules",
      met: verified && (eligibility?.completedModules ?? 0) >= (eligibility?.requiredModules ?? 3),
      detail: isLoading
        ? "Checking…"
        : verified
        ? `${eligibility?.completedModules ?? 0} / ${eligibility?.requiredModules ?? 3} completed`
        : "Complete your verification first",
      action: { href: "/education", label: "Browse modules" },
    },
    {
      icon: Award,
      label: `${eligibility?.requiredIP ?? "—"} Impact Points`,
      met: verified && (eligibility?.currentIP ?? 0) >= (eligibility?.requiredIP ?? 999),
      detail: isLoading
        ? "Checking…"
        : verified
        ? `${eligibility?.currentIP ?? 0} / ${eligibility?.requiredIP ?? "—"} IP · based on ${eligibility?.daysOnPlatform ?? 0} days on platform`
        : "Complete your verification first",
      action: null,
    },
  ]

  return (
    <div className="min-h-screen" style={{ background: "#F7F2E8" }}>
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b"
        style={{ background: "rgba(247,242,232,0.95)", backdropFilter: "blur(8px)", borderColor: "rgba(14,11,8,0.08)" }}>
        <Link href="/education" className="p-1.5 rounded-lg hover:bg-black/5 transition-colors">
          <ArrowLeft className="h-5 w-5" style={{ color: "#0E0B08" }} />
        </Link>
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" style={{ color: "#C9922A" }} />
          <span className="font-semibold text-sm" style={{ color: "#0E0B08" }}>Contribute a Module</span>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(201,146,42,0.1)" }}>
            <BookOpen className="h-6 w-6" style={{ color: "#C9922A" }} />
          </div>
          <h2 className="font-semibold text-xl text-[#0E0B08] mb-2">Contributor criteria</h2>
          <p className="text-sm" style={{ color: "rgba(14,11,8,0.5)" }}>
            UjamaaDAO holds its educators to a high standard. Meet all three criteria to contribute.
          </p>
        </div>

        <div className="space-y-3">
          {criteria.map(({ icon: Icon, label, met, detail, action }) => (
            <div
              key={label}
              className="flex items-start gap-3 rounded-xl px-4 py-3.5"
              style={{
                background: met ? "rgba(42,82,64,0.06)" : "rgba(14,11,8,0.04)",
                border: `1px solid ${met ? "rgba(42,82,64,0.2)" : "rgba(14,11,8,0.08)"}`,
              }}
            >
              {met
                ? <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: "#2A5240" }} />
                : <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: "rgba(14,11,8,0.25)" }} />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: met ? "#2A5240" : "#0E0B08" }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(14,11,8,0.45)" }}>{detail}</p>
              </div>
              {!met && action && (
                <Link
                  href={action.href}
                  className="text-xs font-semibold flex-shrink-0 self-center"
                  style={{ color: "#C9922A" }}
                >
                  {action.label}
                </Link>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-xl px-4 py-3"
          style={{ background: "rgba(201,146,42,0.06)", border: "1px solid rgba(201,146,42,0.15)" }}>
          <Clock className="h-4 w-4 flex-shrink-0" style={{ color: "#C9922A" }} />
          <p className="text-xs" style={{ color: "rgba(14,11,8,0.55)" }}>
            The IP threshold rises with your account age — the longer you've been part of the community, the more we expect.
          </p>
        </div>

        <Link href="/education"
          className="mt-6 w-full flex items-center justify-center rounded-xl py-3 text-sm font-semibold transition-all hover:bg-black/5"
          style={{ color: "rgba(14,11,8,0.45)" }}>
          Back to Learn
        </Link>
      </div>
    </div>
  )
}

export default function CreateModulePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isAuthenticated, user } = useAuth()

  const verified =
    user?.verificationLevel === "COMMUNITY_VERIFIED" ||
    user?.verificationLevel === "FULL_VERIFIED"

  const { data: eligibility } = useQuery({
    queryKey: ["education-authorship-eligibility"],
    queryFn: educationApi.getAuthorshipEligibility,
    enabled: verified,
    staleTime: 120_000,
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

  const [submitAfterSave, setSubmitAfterSave] = useState(false)

  const createMutation = useMutation({
    mutationFn: (dto: CreateModuleDto) => educationApi.createModule(dto),
    onSuccess: async (module) => {
      queryClient.invalidateQueries({ queryKey: ["education-my-modules"] })
      if (submitAfterSave) {
        await educationApi.submitModule(module.id)
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

  function handleSave() {
    setSubmitAfterSave(false)
    createMutation.mutate(form)
  }

  function handleSubmit() {
    setSubmitAfterSave(true)
    createMutation.mutate(form)
  }

  const isValid =
    form.title.trim().length >= 5 &&
    form.description.trim().length >= 20 &&
    form.content.trim().length >= 100

  // Show eligibility wall if not verified, or if eligibility data says they're not eligible
  if (isAuthenticated && (!verified || (eligibility && !eligibility.eligible))) {
    return <EligibilityWall verified={verified} />
  }

  return (
    <div className="min-h-screen" style={{ background: "#F7F2E8" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b"
        style={{ background: "rgba(247,242,232,0.95)", backdropFilter: "blur(8px)", borderColor: "rgba(14,11,8,0.08)" }}>
        <Link href="/education" className="p-1.5 rounded-lg hover:bg-black/5 transition-colors">
          <ArrowLeft className="h-5 w-5" style={{ color: "#0E0B08" }} />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <BookOpen className="h-4 w-4" style={{ color: "#C9922A" }} />
          <span className="font-semibold text-sm" style={{ color: "#0E0B08" }}>Contribute a Module</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Info banner */}
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(201,146,42,0.08)", border: "1px solid rgba(201,146,42,0.2)", color: "rgba(14,11,8,0.6)" }}>
          Your module will be reviewed by the UjamaaDAO team before it goes live. You can save a draft and submit when ready.
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(14,11,8,0.4)" }}>Title *</label>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Understanding Ward Development Funds"
            maxLength={120}
            className="bg-white border-[rgba(14,11,8,0.1)] focus:border-[#C9922A]"
          />
          <p className="text-[10px]" style={{ color: "rgba(14,11,8,0.35)" }}>{form.title.length}/120</p>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(14,11,8,0.4)" }}>Short description *</label>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What will learners know after completing this? (20–500 chars)"
            maxLength={500}
            rows={3}
            className="bg-white border-[rgba(14,11,8,0.1)] focus:border-[#C9922A] resize-none"
          />
          <p className="text-[10px]" style={{ color: "rgba(14,11,8,0.35)" }}>{form.description.length}/500</p>
        </div>

        {/* Meta row */}
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
              type="number"
              min={1}
              max={300}
              value={form.duration}
              onChange={(e) => set("duration", parseInt(e.target.value) || 15)}
              className="bg-white border-[rgba(14,11,8,0.1)] focus:border-[#C9922A]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(14,11,8,0.4)" }}>Impact Points reward</label>
            <Input
              type="number"
              min={0}
              max={200}
              value={form.completionIP}
              onChange={(e) => set("completionIP", parseInt(e.target.value) || 0)}
              className="bg-white border-[rgba(14,11,8,0.1)] focus:border-[#C9922A]"
            />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(14,11,8,0.4)" }}>Module content *</label>
          <p className="text-[11px]" style={{ color: "rgba(14,11,8,0.4)" }}>
            Write the full learning content. Markdown is supported (## headings, **bold**, bullet lists).
          </p>
          <Textarea
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder="## Introduction&#10;&#10;Start with the key question this module answers...&#10;&#10;## Section 1&#10;..."
            rows={16}
            className="bg-white border-[rgba(14,11,8,0.1)] focus:border-[#C9922A] resize-y font-mono text-sm"
          />
          <p className="text-[10px]" style={{ color: form.content.length < 100 ? "#C9922A" : "rgba(14,11,8,0.35)" }}>
            {form.content.length} chars {form.content.length < 100 ? `(need ${100 - form.content.length} more)` : "✓"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 pb-8">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={!isValid || createMutation.isPending}
            className="flex-1 gap-2"
          >
            <Save className="h-4 w-4" />
            Save draft
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createMutation.isPending}
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
