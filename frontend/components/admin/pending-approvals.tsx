"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ShieldCheck,
  MapPin,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  User,
  Clock,
} from "lucide-react"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric", month: "short", year: "numeric",
  })
}

// ── Review row ────────────────────────────────────────────

function ReviewRow({
  id,
  label,
  sublabel,
  meta,
  onApprove,
  onReject,
  isPending,
}: {
  id: string
  label: string
  sublabel: string
  meta: string
  onApprove: (reason: string) => void
  onReject: (reason: string) => void
  isPending: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [reason, setReason] = useState("")

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(0,0,0,0.07)" }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] transition-colors text-left"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(42,107,124,0.08)" }}
        >
          <User className="h-4 w-4" style={{ color: "#2A6B7C" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#0E0B08] truncate">{label}</p>
          <p className="text-[11px] text-[#0E0B08]/50 truncate">{sublabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-[#0E0B08]/40">{meta}</span>
          {expanded
            ? <ChevronUp className="h-3.5 w-3.5 text-[#0E0B08]/30" />
            : <ChevronDown className="h-3.5 w-3.5 text-[#0E0B08]/30" />
          }
        </div>
      </button>

      {expanded && (
        <div
          className="px-4 pb-4 pt-2 space-y-3"
          style={{ background: "rgba(0,0,0,0.015)", borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Add a reason (required for rejections, optional for approvals)…"
            rows={2}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1D4731]/20 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onApprove(reason.trim() || "Approved")}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "#1D4731", color: "#fff" }}
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Approve
            </button>
            <button
              onClick={() => {
                if (!reason.trim()) return
                onReject(reason.trim())
              }}
              disabled={isPending || !reason.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "rgba(176,58,30,0.10)", color: "#B03A1E" }}
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Reject
            </button>
          </div>
          {!reason.trim() && (
            <p className="text-[10px] text-[#0E0B08]/35">A reason is required to reject.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Pending verifications ─────────────────────────────────

function PendingVerifications() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "pending-verifications"],
    queryFn:  () => adminApi.getPendingVerifications({ pageSize: 20 }),
    staleTime: 30_000,
  })

  const mut = useMutation({
    mutationFn: (dto: { requestId: string; approved: boolean; reason: string }) =>
      adminApi.approveVerification(dto),
    onSuccess: (_, vars) => {
      toast({ title: vars.approved ? "Verification approved" : "Verification rejected" })
      queryClient.invalidateQueries({ queryKey: ["admin", "pending-verifications"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] })
    },
    onError: (e: any) => toast({ title: "Action failed", description: e?.message, variant: "destructive" }),
  })

  const requests = data?.requests ?? []
  const total = data?.pagination?.total ?? 0

  return (
    <Card className="border-0 shadow-sm" style={{ background: "#fff" }}>
      <CardHeader className="pb-3 px-5 pt-5">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#0E0B08]">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(29,71,49,0.10)" }}
          >
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "#1D4731" }} />
          </div>
          Community Verification Requests
          {total > 0 && (
            <span
              className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(201,146,42,0.12)", color: "#C9922A" }}
            >
              {total} pending
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8">
            <ShieldCheck className="h-8 w-8 mx-auto mb-2" style={{ color: "rgba(29,71,49,0.20)" }} />
            <p className="text-xs text-[#0E0B08]/40">No pending verification requests</p>
          </div>
        ) : (
          requests.map((r: any) => (
            <ReviewRow
              key={r.id}
              id={r.id}
              label={r.user?.name ?? r.userId?.slice(0, 8) ?? "Unknown"}
              sublabel={r.user?.email ?? r.ward?.name ?? ""}
              meta={r.createdAt ? formatDate(r.createdAt) : ""}
              isPending={mut.isPending && (mut.variables as any)?.requestId === r.id}
              onApprove={(reason) => mut.mutate({ requestId: r.id, approved: true, reason })}
              onReject={(reason) => mut.mutate({ requestId: r.id, approved: false, reason })}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}

// ── Pending residence changes ─────────────────────────────

function PendingResidenceChanges() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "pending-residence"],
    queryFn:  () => adminApi.getPendingResidenceChanges({ pageSize: 20 }),
    staleTime: 30_000,
  })

  const mut = useMutation({
    mutationFn: (dto: { requestId: string; approved: boolean; reason: string }) =>
      adminApi.approveResidenceChange(dto),
    onSuccess: (_, vars) => {
      toast({ title: vars.approved ? "Residence change approved" : "Request rejected" })
      queryClient.invalidateQueries({ queryKey: ["admin", "pending-residence"] })
    },
    onError: (e: any) => toast({ title: "Action failed", description: e?.message, variant: "destructive" }),
  })

  const requests = data?.requests ?? []
  const total = data?.pagination?.total ?? 0

  return (
    <Card className="border-0 shadow-sm" style={{ background: "#fff" }}>
      <CardHeader className="pb-3 px-5 pt-5">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#0E0B08]">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(42,107,124,0.08)" }}
          >
            <MapPin className="h-3.5 w-3.5" style={{ color: "#2A6B7C" }} />
          </div>
          Residence Change Requests
          {total > 0 && (
            <span
              className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(201,146,42,0.12)", color: "#C9922A" }}
            >
              {total} pending
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-8 w-8 mx-auto mb-2" style={{ color: "rgba(42,107,124,0.20)" }} />
            <p className="text-xs text-[#0E0B08]/40">No pending residence change requests</p>
          </div>
        ) : (
          requests.map((r: any) => (
            <ReviewRow
              key={r.id}
              id={r.id}
              label={r.user?.name ?? r.userId?.slice(0, 8) ?? "Unknown"}
              sublabel={
                r.newWard?.name
                  ? `Moving to ${r.newWard.name}`
                  : r.reason ?? "No reason given"
              }
              meta={r.createdAt ? formatDate(r.createdAt) : ""}
              isPending={mut.isPending && (mut.variables as any)?.requestId === r.id}
              onApprove={(reason) => mut.mutate({ requestId: r.id, approved: true, reason })}
              onReject={(reason) => mut.mutate({ requestId: r.id, approved: false, reason })}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}

// ── Combined export ───────────────────────────────────────

export function PendingApprovals() {
  return (
    <div className="space-y-6">
      <PendingVerifications />
      <PendingResidenceChanges />
    </div>
  )
}
