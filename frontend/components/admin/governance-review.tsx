"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle, XCircle, Clock, Vote, FileText, ChevronDown, ChevronUp } from "lucide-react"
import type { ProposalStatus } from "@/lib/api"
import { governanceApi, auditApi, type ProposalDto } from "@/lib/api"
import { formatRelativeTime, formatDate } from "@/lib/utils"

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
  APPROVED_FOR_VOTING: "bg-blue-100 text-blue-800",
  VOTING: "bg-purple-100 text-purple-800",
  PASSED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  REJECTED: "bg-red-200 text-red-900",
  IMPLEMENTED: "bg-teal-100 text-teal-800",
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Review row ────────────────────────────────────────────────────────────────

function ProposalReviewRow({ proposal }: { proposal: ProposalDto }) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState("")
  const qc = useQueryClient()

  const { mutate: review, isPending } = useMutation({
    mutationFn: (decision: "APPROVE" | "REJECT") =>
      governanceApi.reviewProposal(proposal.id, decision, note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "proposals"] })
      setNote("")
      setExpanded(false)
    },
  })

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

          {proposal.status === "PENDING_REVIEW" && (
            <div className="space-y-3">
              <Textarea
                placeholder="Review note (optional)…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={isPending}
                  onClick={() => review("APPROVE")}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => review("REJECT")}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
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
                <SelectItem value="PASSED">Passed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
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
