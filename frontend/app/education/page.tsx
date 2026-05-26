"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  BookOpen,
  Star,
  Clock,
  Users,
  ChevronRight,
  Award,
  CheckCircle,
  Play,
  X,
  BarChart2,
  ArrowRight,
  Plus,
  FileText,
  AlertCircle,
  Send,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { educationApi, onboardingApi, type EducationModuleDto, type EducationModuleDetailDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

// ─── Difficulty badge ──────────────────────────────────────
const DIFFICULTY_STYLES: Record<string, { bg: string; text: string }> = {
  BEGINNER: { bg: "rgba(42,82,64,0.12)", text: "#2A5240" },
  INTERMEDIATE: { bg: "rgba(201,146,42,0.12)", text: "#C9922A" },
  ADVANCED: { bg: "rgba(176,58,30,0.12)", text: "#B03A1E" },
  EXPERT: { bg: "rgba(80,40,120,0.12)", text: "#4a2878" },
}

function DifficultyBadge({ level }: { level: string }) {
  const s = DIFFICULTY_STYLES[level] ?? { bg: "rgba(0,0,0,0.06)", text: "#555" }
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: s.bg, color: s.text }}
    >
      {level.toLowerCase()}
    </span>
  )
}

// ─── Star rating display ───────────────────────────────────
function StarRating({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className="h-3 w-3"
          style={{ color: i <= Math.round(value) ? "#C9922A" : "rgba(0,0,0,0.15)" }}
          fill={i <= Math.round(value) ? "#C9922A" : "none"}
        />
      ))}
      <span className="text-xs text-[#0E0B08]/50 ml-1">{value > 0 ? value.toFixed(1) : "–"}</span>
    </span>
  )
}

// ─── Module card ───────────────────────────────────────────
function ModuleCard({
  module,
  onClick,
}: {
  module: EducationModuleDto
  onClick: (m: EducationModuleDto) => void
}) {
  return (
    <Card
      className="border-0 shadow-card overflow-hidden cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
      onClick={() => onClick(module)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <DifficultyBadge level={module.difficulty} />
              <span className="text-[10px] text-[#0E0B08]/40 uppercase tracking-wide font-medium">
                {module.category}
              </span>
            </div>
            <h3 className="font-semibold text-[#0E0B08] text-base leading-snug line-clamp-2">{module.title}</h3>
          </div>
          <ChevronRight className="h-4 w-4 text-[#0E0B08]/30 flex-shrink-0 mt-1" />
        </div>

        <p className="text-xs text-[#0E0B08]/55 leading-relaxed line-clamp-2 mb-4">{module.description}</p>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-[#0E0B08]/45">
              <Clock className="h-3 w-3" />
              {module.duration}m
            </span>
            <span className="flex items-center gap-1 text-xs text-[#0E0B08]/45">
              <Users className="h-3 w-3" />
              {module._count?.progress ?? 0}
            </span>
            <StarRating value={module.averageRating} />
          </div>
          {module.completionIP > 0 && (
            <span
              className="flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5"
              style={{ background: "rgba(201,146,42,0.12)", color: "#C9922A" }}
            >
              <Award className="h-3 w-3" />
              +{module.completionIP} IP
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Module detail drawer ──────────────────────────────────
function ModuleDrawer({
  moduleId,
  onClose,
}: {
  moduleId: string
  onClose: () => void
}) {
  const { isAuthenticated, refreshUser } = useAuth()
  const queryClient = useQueryClient()
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: "" })
  const [showReview, setShowReview] = useState(false)

  const { data: mod, isLoading } = useQuery<EducationModuleDetailDto>({
    queryKey: ["education-module", moduleId],
    queryFn: () => educationApi.getModule(moduleId),
    staleTime: 60_000,
  })

  const startMutation = useMutation({
    mutationFn: () => educationApi.startModule(moduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["education-module", moduleId] })
      queryClient.invalidateQueries({ queryKey: ["education-modules"] })
    },
  })

  const completeMutation = useMutation({
    mutationFn: () => educationApi.completeModule(moduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["education-module", moduleId] })
      queryClient.invalidateQueries({ queryKey: ["education-modules"] })
      queryClient.invalidateQueries({ queryKey: ["education-my-progress"] })
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] })
      refreshUser()
      // Mark learn_basics tutorial complete (fire-and-forget)
      onboardingApi.completeTutorial("learn_basics").catch(() => {})
    },
  })

  const reviewMutation = useMutation({
    mutationFn: () =>
      educationApi.submitReview(moduleId, {
        rating: reviewForm.rating,
        comment: reviewForm.comment || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["education-module", moduleId] })
      setShowReview(false)
    },
  })

  const progress = mod?.userProgress
  const isStarted = !!progress
  const isCompleted = progress?.status === "COMPLETED"

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div
        className="w-full md:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl"
        style={{ background: "#F7F2E8" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-black/8" style={{ background: "#F7F2E8" }}>
          <span className="font-semibold text-[#0E0B08]">Module Details</span>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-black/8 transition-colors"
          >
            <X className="h-4 w-4 text-[#0E0B08]/60" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-7 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-5/6 rounded-lg" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : mod ? (
          <div className="p-6 space-y-6">
            {/* Title + meta */}
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <DifficultyBadge level={mod.difficulty} />
                <span className="text-xs text-[#0E0B08]/40 uppercase tracking-wide font-medium">{mod.category}</span>
              </div>
              <h2 className="font-display font-bold text-2xl text-[#0E0B08] leading-snug mb-2">{mod.title}</h2>
              <p className="text-sm text-[#0E0B08]/60 leading-relaxed">{mod.description}</p>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 flex-wrap text-sm text-[#0E0B08]/50">
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{mod.duration} min</span>
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{mod._count?.progress ?? 0} learners</span>
              <StarRating value={mod.averageRating} />
              {mod.completionIP > 0 && (
                <span className="flex items-center gap-1.5 font-semibold" style={{ color: "#C9922A" }}>
                  <Award className="h-4 w-4" />+{mod.completionIP} IP on completion
                </span>
              )}
            </div>

            {/* Progress indicator */}
            {isStarted && (
              <div
                className="flex items-center gap-3 rounded-xl p-4"
                style={{
                  background: isCompleted ? "rgba(42,82,64,0.08)" : "rgba(201,146,42,0.08)",
                  border: `1px solid ${isCompleted ? "rgba(42,82,64,0.2)" : "rgba(201,146,42,0.2)"}`,
                }}
              >
                {isCompleted ? (
                  <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: "#2A5240" }} />
                ) : (
                  <BarChart2 className="h-5 w-5 flex-shrink-0" style={{ color: "#C9922A" }} />
                )}
                <div>
                  <p className="text-sm font-semibold" style={{ color: isCompleted ? "#2A5240" : "#C9922A" }}>
                    {isCompleted ? "Module completed" : "In progress"}
                  </p>
                  {progress?.score != null && (
                    <p className="text-xs text-[#0E0B08]/50 mt-0.5">Score: {progress.score}%</p>
                  )}
                </div>
              </div>
            )}

            {/* Content */}
            <div>
              <h3 className="font-semibold text-sm text-[#0E0B08] mb-3">Content</h3>
              <div
                className="rounded-xl p-5"
                style={{ background: "rgba(26,18,11,0.03)", border: "1px solid rgba(26,18,11,0.06)" }}
              >
                <div className="prose prose-sm max-w-none
                  prose-headings:font-semibold prose-headings:text-[#0E0B08]
                  prose-h1:text-xl prose-h1:mb-4 prose-h1:mt-0
                  prose-h2:text-base prose-h2:mt-6 prose-h2:mb-2
                  prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-1
                  prose-p:text-[#0E0B08]/70 prose-p:leading-relaxed prose-p:my-2
                  prose-strong:text-[#0E0B08] prose-strong:font-semibold
                  prose-li:text-[#0E0B08]/70 prose-li:my-0.5
                  prose-ul:my-2 prose-ol:my-2
                  prose-table:text-sm prose-table:w-full
                  prose-th:text-left prose-th:font-semibold prose-th:text-[#0E0B08] prose-th:pb-2 prose-th:border-b prose-th:border-black/10
                  prose-td:py-1.5 prose-td:text-[#0E0B08]/65 prose-td:border-b prose-td:border-black/5
                  prose-code:text-xs prose-code:bg-black/6 prose-code:rounded prose-code:px-1 prose-code:text-[#0E0B08]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {mod.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            {/* Actions */}
            {isAuthenticated && (
              <div className="space-y-3">
                {!isStarted && (
                  <button
                    onClick={() => startMutation.mutate()}
                    disabled={startMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all hover:opacity-90 active:scale-[0.99]"
                    style={{ background: "#1E3D2F", color: "#fff" }}
                  >
                    <Play className="h-4 w-4" />
                    {startMutation.isPending ? "Starting…" : "Start Module"}
                  </button>
                )}

                {isStarted && !isCompleted && (
                  <button
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all hover:opacity-90 active:scale-[0.99]"
                    style={{ background: "#C9922A", color: "#fff" }}
                  >
                    <CheckCircle className="h-4 w-4" />
                    {completeMutation.isPending ? "Marking complete…" : "Mark as Complete"}
                  </button>
                )}

                {isCompleted && !showReview && (
                  <button
                    onClick={() => setShowReview(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all hover:opacity-90"
                    style={{ background: "rgba(201,146,42,0.12)", color: "#C9922A" }}
                  >
                    <Star className="h-4 w-4" />
                    Leave a Review
                  </button>
                )}

                {showReview && (
                  <div
                    className="rounded-xl p-4 space-y-3"
                    style={{ background: "rgba(26,18,11,0.04)", border: "1px solid rgba(26,18,11,0.06)" }}
                  >
                    <p className="text-sm font-semibold text-[#0E0B08]">Rate this module</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((r) => (
                        <button
                          key={r}
                          onClick={() => setReviewForm((f) => ({ ...f, rating: r }))}
                          className="transition-transform hover:scale-110"
                        >
                          <Star
                            className="h-7 w-7"
                            style={{
                              color: r <= reviewForm.rating ? "#C9922A" : "rgba(0,0,0,0.15)",
                            }}
                            fill={r <= reviewForm.rating ? "#C9922A" : "none"}
                          />
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C9922A]/30"
                      placeholder="Optional comment…"
                      rows={3}
                      value={reviewForm.comment}
                      onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowReview(false)}
                        className="flex-1 rounded-lg py-2 text-sm text-[#0E0B08]/50 hover:bg-black/5"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => reviewMutation.mutate()}
                        disabled={reviewMutation.isPending || reviewForm.rating === 0}
                        className="flex-1 rounded-lg py-2 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                        style={{ background: "#C9922A", color: "#fff" }}
                      >
                        {reviewMutation.isPending ? "Submitting…" : "Submit Review"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─── Filter pill ───────────────────────────────────────────
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const
const CATEGORIES = ["governance", "economy", "health", "agriculture", "technology", "civic", "environment"]

// ─── Continue learning strip ────────────────────────────────
function ContinueLearningStrip({ onOpen }: { onOpen: (id: string) => void }) {
  const { isAuthenticated } = useAuth()
  const { data } = useQuery({
    queryKey: ["education-my-progress"],
    queryFn: educationApi.getMyProgress,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const inProgress = data?.inProgress ?? []
  if (inProgress.length === 0) return null

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(14,11,8,0.40)" }}>
        Continue Learning
      </p>
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
        {inProgress.map((m) => (
          <button
            key={m.id}
            onClick={() => onOpen(m.id)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl flex-shrink-0 text-left transition-all hover:shadow-sm"
            style={{ background: "rgba(201,146,42,0.08)", border: "1px solid rgba(201,146,42,0.2)", minWidth: 240, maxWidth: 300 }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(201,146,42,0.15)" }}
            >
              <BarChart2 className="h-4 w-4" style={{ color: "#C9922A" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#0E0B08] truncate">{m.title}</p>
              <p className="text-[11px]" style={{ color: "#C9922A" }}>In progress · {m.duration}m</p>
            </div>
            <ArrowRight className="h-4 w-4 flex-shrink-0" style={{ color: "rgba(201,146,42,0.5)" }} />
          </button>
        ))}
      </div>
    </div>
  )
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  DRAFT:     { label: "Draft",     color: "rgba(14,11,8,0.45)", bg: "rgba(14,11,8,0.05)", icon: FileText },
  SUBMITTED: { label: "In review", color: "#C9922A",            bg: "rgba(201,146,42,0.08)", icon: Send },
  REJECTED:  { label: "Rejected",  color: "#B03A1E",            bg: "rgba(176,58,30,0.07)", icon: AlertCircle },
  APPROVED:  { label: "Live",      color: "#2A5240",            bg: "rgba(42,82,64,0.07)", icon: CheckCircle },
}

function MyModulesSection() {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const { data: myModules, isLoading } = useQuery<EducationModuleDto[]>({
    queryKey: ["education-my-modules"],
    queryFn: educationApi.getMyModules,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => educationApi.submitModule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["education-my-modules"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => educationApi.deleteModule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["education-my-modules"] }),
  })

  if (!isAuthenticated || isLoading) return null
  if (!myModules || myModules.length === 0) return null

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(14,11,8,0.40)" }}>
        My Contributions
      </p>
      <div className="space-y-2">
        {myModules.map((m) => {
          const meta = STATUS_META[m.status] ?? STATUS_META.DRAFT
          const Icon = meta.icon
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: meta.bg, border: `1px solid ${meta.color}22` }}
            >
              <Icon className="h-4 w-4 flex-shrink-0" style={{ color: meta.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0E0B08] truncate">{m.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                  {m.status === "REJECTED" && m.rejectionReason && (
                    <span className="text-[10px]" style={{ color: "rgba(176,58,30,0.7)" }}>
                      · {m.rejectionReason}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {(m.status === "DRAFT" || m.status === "REJECTED") && (
                  <>
                    <Link
                      href={`/education/${m.id}/edit`}
                      className="p-1.5 rounded-lg hover:bg-black/8 transition-colors text-xs font-medium"
                      style={{ color: "rgba(14,11,8,0.5)" }}
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => submitMutation.mutate(m.id)}
                      disabled={submitMutation.isPending}
                      className="p-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
                      style={{ color: "#C9922A" }}
                    >
                      Submit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete this draft?")) deleteMutation.mutate(m.id)
                      }}
                      className="p-1.5 rounded-lg hover:bg-black/8 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" style={{ color: "rgba(176,58,30,0.6)" }} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function isVerified(level?: string) {
  return level === "COMMUNITY_VERIFIED" || level === "FULL_VERIFIED"
}

// ─── Main page ─────────────────────────────────────────────
export default function EducationPage() {
  const [difficulty, setDifficulty] = useState<string | undefined>()
  const [category, setCategory] = useState<string | undefined>()
  const [activeModule, setActiveModule] = useState<string | null>(null)

  const { isAuthenticated, user } = useAuth()
  const canContribute = isAuthenticated && isVerified(user?.verificationLevel)

  const { data, isLoading } = useQuery({
    queryKey: ["education-modules", difficulty, category],
    queryFn: () => educationApi.getModules({ difficulty, category, limit: 50 }),
    staleTime: 60_000,
  })

  const modules = data?.modules ?? []

  return (
    <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-3xl text-[#0E0B08]">Learn</h2>
          <p className="text-sm text-[#0E0B08]/50 mt-1">
            Earn Impact Points by completing governance and civic education modules.
          </p>
        </div>
        {canContribute ? (
          <Link
            href="/education/create"
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all hover:opacity-90 flex-shrink-0 mt-1"
            style={{ background: "#1D4731", color: "#fff" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Contribute
          </Link>
        ) : isAuthenticated ? (
          <div
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs flex-shrink-0 mt-1"
            style={{ background: "rgba(14,11,8,0.05)", color: "rgba(14,11,8,0.35)" }}
            title="Community verification required to contribute modules"
          >
            <Plus className="h-3.5 w-3.5" />
            Contribute
          </div>
        ) : null}
      </div>

      {/* In-progress modules */}
      <ContinueLearningStrip onOpen={setActiveModule} />

      {/* My contributed modules */}
      <MyModulesSection />

      {/* Difficulty filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setDifficulty(undefined)}
          className="rounded-full px-4 py-1.5 text-xs font-semibold transition-all"
          style={
            !difficulty
              ? { background: "#1E3D2F", color: "#fff" }
              : { background: "rgba(26,18,11,0.06)", color: "rgba(14,11,8,0.6)" }
          }
        >
          All levels
        </button>
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(difficulty === d ? undefined : d)}
            className="rounded-full px-4 py-1.5 text-xs font-semibold transition-all capitalize"
            style={
              difficulty === d
                ? { background: DIFFICULTY_STYLES[d]?.bg ?? "#1E3D2F", color: DIFFICULTY_STYLES[d]?.text ?? "#fff", border: `1.5px solid ${DIFFICULTY_STYLES[d]?.text}` }
                : { background: "rgba(26,18,11,0.06)", color: "rgba(14,11,8,0.6)" }
            }
          >
            {d.toLowerCase()}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCategory(undefined)}
          className="rounded-full px-3 py-1 text-[11px] font-semibold transition-all"
          style={
            !category
              ? { background: "#C9922A", color: "#fff" }
              : { background: "rgba(201,146,42,0.1)", color: "#C9922A" }
          }
        >
          All topics
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(category === c ? undefined : c)}
            className="rounded-full px-3 py-1 text-[11px] font-semibold transition-all capitalize"
            style={
              category === c
                ? { background: "#C9922A", color: "#fff" }
                : { background: "rgba(201,146,42,0.1)", color: "#C9922A" }
            }
          >
            {c}
          </button>
        ))}
      </div>

      {/* Module grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : modules.length === 0 ? (
        <Card className="border-0 shadow-card text-center py-16">
          <CardContent>
            <BookOpen className="h-10 w-10 mx-auto mb-3" style={{ color: "rgba(14,11,8,0.15)" }} />
            <p className="font-semibold text-[#0E0B08]/50">No modules found</p>
            <p className="text-xs text-[#0E0B08]/35 mt-1">
              {difficulty || category ? "Try a different filter." : "Modules will appear here once published."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-[#0E0B08]/40">{data?.total ?? modules.length} module{modules.length !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {modules.map((m) => (
              <ModuleCard key={m.id} module={m} onClick={(mod) => setActiveModule(mod.id)} />
            ))}
          </div>
        </>
      )}

      {/* Detail drawer */}
      {activeModule && (
        <ModuleDrawer moduleId={activeModule} onClose={() => setActiveModule(null)} />
      )}
    </div>
  )
}
