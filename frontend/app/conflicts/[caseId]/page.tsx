"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { conflictApi } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Flag,
  ChevronLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  FileText,
  Gavel,
  Link2,
  Plus,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react"

// ── Status config ──────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  OPEN:          { label: "Open",          color: "#C9922A", bg: "rgba(201,146,42,0.12)", Icon: Clock },
  INVESTIGATING: { label: "Investigating", color: "#2A6B7C", bg: "rgba(42,107,124,0.10)", Icon: AlertCircle },
  MEDIATION:     { label: "Mediation",     color: "#6B4F9E", bg: "rgba(107,79,158,0.10)", Icon: AlertCircle },
  CLOSED:        { label: "Closed",        color: "#1D4731", bg: "rgba(29,71,49,0.10)",   Icon: CheckCircle },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric", month: "long", year: "numeric",
  })
}

// ── Main page ─────────────────────────────────────────────

export default function ConflictCasePage() {
  const { caseId } = useParams<{ caseId: string }>()
  const router     = useRouter()
  const { user }   = useAuth()
  const { toast }  = useToast()
  const queryClient = useQueryClient()
  const [resolution, setResolution] = useState("")
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [showEvidenceForm, setShowEvidenceForm] = useState(false)
  const [evidenceUrls, setEvidenceUrls] = useState([""])

  const { data: conflict, isLoading } = useQuery({
    queryKey: ["conflict", caseId],
    queryFn:  () => conflictApi.getCase(caseId),
    staleTime: 30_000,
    enabled:  !!caseId,
  })

  const evidenceMutation = useMutation({
    mutationFn: () => {
      const valid = evidenceUrls.map((u) => u.trim()).filter(Boolean)
      return conflictApi.addEvidence(caseId, valid)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["conflict", caseId], updated)
      toast({ title: "Evidence added" })
      setShowEvidenceForm(false)
      setEvidenceUrls([""])
    },
    onError: (err: any) => toast({
      title: "Failed to add evidence",
      description: err?.message ?? "Please try again.",
      variant: "destructive",
    }),
  })

  const resolveMutation = useMutation({
    mutationFn: () => conflictApi.resolveCase(caseId, resolution.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conflict", caseId] })
      queryClient.invalidateQueries({ queryKey: ["my-conflicts"] })
      toast({ title: "Case closed", description: "The resolution has been recorded." })
      setShowResolveForm(false)
      setResolution("")
    },
    onError: (err: any) => toast({
      title: "Failed to resolve",
      description: err?.message ?? "Please try again.",
      variant: "destructive",
    }),
  })

  if (isLoading) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  }

  if (!conflict) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto text-center py-20">
        <p className="text-sm text-[#0E0B08]/50">Case not found or you don't have access.</p>
        <Link href="/conflicts" className="text-xs font-semibold mt-3 block" style={{ color: "#C9922A" }}>
          ← Back to conflicts
        </Link>
      </div>
    )
  }

  const cfg = STATUS_CFG[conflict.status] ?? STATUS_CFG.OPEN
  const { Icon, color, bg, label } = cfg
  const isClosed         = conflict.status === "CLOSED"
  const isParty          = user?.id === conflict.complainant.id || user?.id === conflict.respondent.id
  const canResolve       = isParty && !isClosed
  const canAddEvidence   = isParty && !isClosed && conflict.evidence.length < 10

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-5">

      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#0E0B08]/50 hover:text-[#0E0B08] transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Conflicts
      </button>

      {/* Status header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-xl text-[#0E0B08]">Conflict Case</h2>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: bg, color }}
            >
              {label}
            </span>
          </div>
          <p className="text-xs text-[#0E0B08]/40">Filed {formatDate(conflict.createdAt)}</p>
        </div>
      </div>

      {/* Parties */}
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#0E0B08]/60 uppercase tracking-wider">Parties</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div
            className="rounded-xl p-3 space-y-1"
            style={{ background: "rgba(176,58,30,0.06)", border: "1px solid rgba(176,58,30,0.12)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#B03A1E]/70">Complainant</p>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#B03A1E" }}>
                <User className="h-3 w-3 text-white" />
              </div>
              <p className="text-sm font-semibold text-[#0E0B08]">{conflict.complainant.name}</p>
            </div>
            {user?.id === conflict.complainant.id && (
              <p className="text-[10px] text-[#0E0B08]/40 italic">You</p>
            )}
          </div>

          <div
            className="rounded-xl p-3 space-y-1"
            style={{ background: "rgba(42,107,124,0.06)", border: "1px solid rgba(42,107,124,0.12)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#2A6B7C]/70">Respondent</p>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#2A6B7C" }}>
                <User className="h-3 w-3 text-white" />
              </div>
              <p className="text-sm font-semibold text-[#0E0B08]">{conflict.respondent.name}</p>
            </div>
            {user?.id === conflict.respondent.id && (
              <p className="text-[10px] text-[#0E0B08]/40 italic">You</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#0E0B08]/40" />
            Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#0E0B08]/80 leading-relaxed whitespace-pre-wrap">
            {conflict.description}
          </p>
        </CardContent>
      </Card>

      {/* Evidence */}
      {conflict.evidence.length > 0 && (
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[#0E0B08]/40" />
              Evidence
              <span className="text-[10px] font-normal text-[#0E0B08]/40">
                ({conflict.evidence.length}/10)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {conflict.evidence.map((e, i) => (
              <a
                key={i}
                href={e}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-mono transition-colors hover:bg-black/[0.06] group"
                style={{ background: "rgba(14,11,8,0.04)" }}
              >
                <span className="flex-1 truncate text-[#0E0B08]/70">{e}</span>
                <ExternalLink className="h-3 w-3 text-[#0E0B08]/30 group-hover:text-[#0E0B08]/60 flex-shrink-0 transition-colors" />
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add evidence */}
      {canAddEvidence && !showEvidenceForm && (
        <button
          onClick={() => setShowEvidenceForm(true)}
          className="flex items-center gap-2 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ color: "#2A6B7C" }}
        >
          <Link2 className="h-3.5 w-3.5" />
          Add evidence ({10 - conflict.evidence.length} slots remaining)
        </button>
      )}

      {canAddEvidence && showEvidenceForm && (
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" style={{ color: "#2A6B7C" }} />
              Add Evidence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-[#0E0B08]/50">
              Attach links to documents, photos, or any supporting material (e.g. Google Drive, Dropbox, government portal).
            </p>
            <div className="space-y-2">
              {evidenceUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => {
                      const next = [...evidenceUrls]
                      next[i] = e.target.value
                      setEvidenceUrls(next)
                    }}
                    placeholder="https://…"
                    className="flex-1 h-9 rounded-xl border border-black/10 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A6B7C]/30"
                  />
                  {evidenceUrls.length > 1 && (
                    <button
                      onClick={() => setEvidenceUrls(evidenceUrls.filter((_, j) => j !== i))}
                      className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-[#0E0B08]/40" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {evidenceUrls.length < 5 && (
              <button
                onClick={() => setEvidenceUrls([...evidenceUrls, ""])}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#2A6B7C] hover:opacity-80 transition-opacity"
              >
                <Plus className="h-3.5 w-3.5" /> Add another link
              </button>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => evidenceMutation.mutate()}
                disabled={!evidenceUrls.some((u) => u.trim()) || evidenceMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: "#2A6B7C", color: "#fff" }}
              >
                {evidenceMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Submit Evidence
              </button>
              <button
                onClick={() => { setShowEvidenceForm(false); setEvidenceUrls([""]) }}
                className="rounded-xl px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: "rgba(0,0,0,0.05)", color: "#0E0B08" }}
              >
                Cancel
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resolution (if closed) */}
      {isClosed && conflict.resolution && (
        <Card className="border-0 shadow-card" style={{ borderLeft: "3px solid #1D4731" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: "#1D4731" }}>
              <Gavel className="h-4 w-4" />
              Resolution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-[#0E0B08]/80 leading-relaxed whitespace-pre-wrap">
              {conflict.resolution}
            </p>
            {conflict.resolvedAt && (
              <p className="text-[10px] text-[#0E0B08]/40">
                Closed {formatDate(conflict.resolvedAt)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resolve action */}
      {canResolve && !showResolveForm && (
        <div
          className="rounded-2xl p-4 flex items-center justify-between gap-4"
          style={{ background: "rgba(29,71,49,0.06)", border: "1px solid rgba(29,71,49,0.12)" }}
        >
          <div>
            <p className="text-sm font-semibold text-[#1D4731]">Ready to close this case?</p>
            <p className="text-xs text-[#0E0B08]/50 mt-0.5">Both parties can record a resolution and mark the case closed.</p>
          </div>
          <Button
            onClick={() => setShowResolveForm(true)}
            className="rounded-xl font-semibold flex-shrink-0"
            style={{ background: "#1D4731", color: "#fff" }}
          >
            <Gavel className="h-3.5 w-3.5 mr-1.5" />
            Resolve
          </Button>
        </div>
      )}

      {/* Resolve form */}
      {showResolveForm && (
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Gavel className="h-4 w-4" style={{ color: "#1D4731" }} />
              Record Resolution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-[#0E0B08]/50">
              Describe how this conflict was resolved. This text will be permanently recorded and visible to both parties.
            </p>
            <Textarea
              placeholder="e.g. Both parties agreed to… / The matter was settled by… / No further action required because…"
              rows={5}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />
            <p className="text-[10px] text-[#0E0B08]/40">{resolution.length} / 2000 · minimum 10 characters</p>
            <div className="flex gap-2">
              <Button
                onClick={() => resolveMutation.mutate()}
                disabled={resolution.trim().length < 10 || resolveMutation.isPending}
                className="flex-1 rounded-xl font-semibold"
                style={{ background: "#1D4731", color: "#fff" }}
              >
                {resolveMutation.isPending ? "Closing case…" : "Close Case"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowResolveForm(false); setResolution("") }}
                className="rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Closed notice */}
      {isClosed && (
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: "rgba(29,71,49,0.06)", border: "1px solid rgba(29,71,49,0.12)" }}
        >
          <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: "#1D4731" }} />
          <p className="text-sm text-[#1D4731] font-medium">This case is closed. No further action required.</p>
        </div>
      )}
    </div>
  )
}
