"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle, XCircle, Clock, Vote, FileText, ChevronDown, ChevronUp, Play, Ban, Loader, PackageCheck } from "lucide-react"
import type { ProposalStatus } from "@/lib/api"
import { governanceApi, auditApi, type ProposalDto } from "@/lib/api"
import { formatRelativeTime, formatDate } from "@/lib/utils"

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
  APPROVED_FOR_VOTING: "bg-blue-100 text-blue-800",
  VOTING: "bg-purple-100 text-purple-800",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-200 text-red-900",
  CANCELLED: "bg-gray-200 text-gray-600",
  EXECUTING: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-teal-100 text-teal-800",
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Review row ────────────────────────────────────────────────────────────────

export function ProposalReviewRow({ proposal }: { proposal: ProposalDto }) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState("")
  const [progressNote, setProgressNote] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const qc = useQueryClient()

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["admin", "proposals"] })
    qc.invalidateQueries({ queryKey: ["admin", "needs-action"] })
    qc.invalidateQueries({ queryKey: ["admin", "audit-governance"] })
  }

  const { mutate: review, isPending: isReviewing } = useMutation({
    mutationFn: (decision: "APPROVE" | "REJECT") =>
      governanceApi.reviewProposal(proposal.id, decision, note || undefined),
    onSuccess: () => { invalidateAll(); setNote(""); setErrorMsg(null); setExpanded(false) },
    onError: (err: unknown) => setErrorMsg(err instanceof Error ? err.message : "Action failed"),
  })

  const { mutate: startVote, isPending: isStartingVote } = useMutation({
    mutationFn: () => governanceApi.startVoting(proposal.id),
    onSuccess: () => { invalidateAll(); setErrorMsg(null); setExpanded(false) },
    onError: (err: unknown) => setErrorMsg(err instanceof Error ? err.message : "Action failed"),
  })

  const { mutate: cancel, isPending: isCancelling } = useMutation({
    mutationFn: () => governanceApi.cancelProposal(proposal.id),
    onSuccess: () => { invalidateAll(); setErrorMsg(null); setExpanded(false) },
    onError: (err: unknown) => setErrorMsg(err instanceof Error ? err.message : "Action failed"),
  })

  const { mutate: progress, isPending: isProgressing } = useMutation({
    mutationFn: (status: "EXECUTING" | "COMPLETED") =>
      governanceApi.updateProgress(proposal.id, status, progressNote || undefined),
    onSuccess: () => { invalidateAll(); setProgressNote(""); setErrorMsg(null); setExpanded(false) },
    onError: (err: unknown) => setErrorMsg(err instanceof Error ? err.message : "Action failed"),
  })

  const anyPending = isReviewing || isStartingVote || isCancelling || isProgressing

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Summary row */}
      <button
        className="w-full flex items-start justify-between p-4 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0 pr-4">
          <div className="font-semibold text-sm">{proposal.title}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {proposal.creator?.name ?? "Unknown"} · {proposal.group?.name ?? "—"} · {formatRelativeTime(proposal.createdAt)}
          </div>
          <div className="flex gap-2 mt-1 flex-wrap">
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              {proposal.proposalScope === "COMMUNITY" ? "Community-wide" : "Group"} scope
            </span>
            {proposal.group?.locationScope && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                {proposal.group.locationScope.charAt(0) + proposal.group.locationScope.slice(1).toLowerCase()} level
              </span>
            )}
            {proposal.group?.voluntaryType && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                Voluntary
              </span>
            )}
          </div>
          {proposal.budget && (
            <div className="text-xs text-amber-700 mt-0.5">
              Budget: KES {Number(proposal.budget).toLocaleString()}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge className={STATUS_COLORS[proposal.status] ?? "bg-gray-100 text-gray-700"}>
            {statusLabel(proposal.status)}
          </Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded detail + actions */}
      {expanded && (
        <div className="border-t p-4 bg-slate-50 space-y-4">
          <p className="text-sm text-slate-700 whitespace-pre-line">{proposal.description}</p>

          {/* ── Stage 1 / Stage 2 review actions ── */}
          {(proposal.status === "PENDING_REVIEW" || proposal.status === "DRAFT") && (
            <div className="space-y-3">
              {proposal.status === "DRAFT" && (
                <p className="text-xs text-slate-500 bg-slate-100 rounded p-2">
                  Forwarding moves this into the admin review queue. Rejecting closes it immediately.
                </p>
              )}
              <Textarea
                placeholder="Review note (optional)…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={anyPending} onClick={() => review("APPROVE")}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {proposal.status === "DRAFT" ? "Forward for Review" : "Approve"}
                </Button>
                <Button size="sm" variant="destructive" disabled={anyPending} onClick={() => review("REJECT")}>
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                {proposal.status === "DRAFT" && (
                  <Button size="sm" variant="outline" disabled={anyPending} onClick={() => cancel()}>
                    <Ban className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Start voting ── */}
          {proposal.status === "APPROVED_FOR_VOTING" && (
            <div className="space-y-2">
              <p className="text-xs text-blue-700 bg-blue-50 rounded p-2">
                This proposal is approved. Open the voting period to let members cast their votes.
              </p>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={anyPending} onClick={() => startVote()}>
                <Play className="h-4 w-4 mr-1" />
                Open Voting
              </Button>
            </div>
          )}

          {/* ── Progress tracking ── */}
          {(proposal.status === "APPROVED" || proposal.status === "EXECUTING") && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 bg-slate-100 rounded p-2">
                {proposal.status === "APPROVED"
                  ? "The proposal passed. Mark it as executing once implementation begins."
                  : "Mark this proposal as completed once all work is done."}
              </p>
              <Textarea
                placeholder="Progress note (optional)…"
                value={progressNote}
                onChange={(e) => setProgressNote(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <Button
                size="sm"
                className={proposal.status === "APPROVED" ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-teal-600 hover:bg-teal-700 text-white"}
                disabled={anyPending}
                onClick={() => progress(proposal.status === "APPROVED" ? "EXECUTING" : "COMPLETED")}
              >
                {proposal.status === "APPROVED"
                  ? <><Loader className="h-4 w-4 mr-1" />Mark as Executing</>
                  : <><PackageCheck className="h-4 w-4 mr-1" />Mark as Completed</>}
              </Button>
            </div>
          )}

          {errorMsg && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {errorMsg}
            </div>
          )}

          {proposal.reviewNote && (
            <div className="text-xs text-slate-600 bg-white border rounded p-2">
              <span className="font-medium">Review note: </span>{proposal.reviewNote}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GovernanceReview() {
  const [statusFilter, setStatusFilter] = useState("all")

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "proposals", statusFilter],
    queryFn: () =>
      governanceApi.getProposals(
        statusFilter !== "all"
          ? { status: statusFilter as ProposalStatus, limit: 50 }
          : { limit: 50 }
      ),
    staleTime: 30_000,
  })

  const { data: auditData } = useQuery({
    queryKey: ["admin", "audit-governance"],
    queryFn: () => auditApi.search({ limit: 20 }),
    staleTime: 30_000,
  })

  const governanceLogs = (auditData?.logs ?? []).filter((l) => {
    const et = (l.entityType ?? "").toUpperCase()
    const ac = l.action.toUpperCase()
    return et.includes("PROPOSAL") || ac.includes("PROPOSAL") || ac.includes("VOTE") || ac.includes("MILESTONE") || ac.includes("PROJECT")
  })

  const proposals = data?.proposals ?? []

  const pendingCount = proposals.filter((p) => p.status === "PENDING_REVIEW").length

  return (
    <div className="space-y-6">
      {/* Proposal queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5" />
              Proposals
              {pendingCount > 0 && (
                <Badge className="bg-yellow-100 text-yellow-800 ml-1">
                  {pendingCount} awaiting review
                </Badge>
              )}
            </CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
                <SelectItem value="APPROVED_FOR_VOTING">Approved for Voting</SelectItem>
                <SelectItem value="VOTING">Voting Open</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="EXECUTING">Executing</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C9922A] border-t-transparent" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Vote className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No proposals found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Pending review shown first */}
              {[...proposals]
                .sort((a, b) =>
                  a.status === "PENDING_REVIEW" && b.status !== "PENDING_REVIEW" ? -1 : 1
                )
                .map((p) => (
                  <ProposalReviewRow key={p.id} proposal={p} />
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Governance activity log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Governance &amp; Project Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {governanceLogs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No governance activity yet</p>
          ) : (
            <div className="space-y-3">
              {governanceLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border text-sm">
                  <Clock className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      {log.action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </div>
                    <div className="text-xs text-slate-500">
                      {log.user?.name ?? log.user?.email ?? "system"}
                      {log.entityId ? ` · ${log.entityType} ${log.entityId.slice(0, 8)}…` : ""}
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-1 text-xs text-slate-600">
                        {Object.entries(log.metadata)
                          .filter(([k]) => !["userId", "id"].includes(k))
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex-shrink-0">{formatRelativeTime(log.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
