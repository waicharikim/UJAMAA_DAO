"use client"

import { use, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { governanceApi, communityApi, projectApi, onboardingApi, type ProposalAnnotationDto } from "@/lib/api"
import { AnnotatableText } from "@/components/governance/annotatable-text"
import { AnnotationSidebar } from "@/components/governance/annotation-sidebar"
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  MinusCircle,
  Clock,
  Users,
  TrendingUp,
  Briefcase,
  ShieldCheck,
  AlertTriangle,
  Info,
  BookMarked,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Archive,
} from "lucide-react"

const STATUS_META: Record<string, { label: string; className: string }> = {
  DRAFT:               { label: "Draft",                className: "bg-warm-gray/20 text-warm-gray" },
  PENDING_REVIEW:      { label: "Pending Admin Review", className: "bg-amber/20 text-amber-700" },
  APPROVED_FOR_VOTING: { label: "Ready for Voting",     className: "bg-tea-green/20 text-tea-green" },
  VOTING:              { label: "Voting",               className: "bg-amber/20 text-amber" },
  APPROVED:            { label: "Approved",             className: "bg-tea-green/20 text-tea-green" },
  REJECTED:            { label: "Rejected",             className: "bg-red-100 text-red-700" },
}

const TYPE_LABEL: Record<string, string> = {
  COMMUNITY_INITIATIVE: "Community Initiative",
  MAJOR_PROJECT:        "Major Project",
  STRATEGIC_DECISION:   "Strategic Decision",
  EMERGENCY:            "Emergency",
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
}

function relativeTime(iso: string | null) {
  if (!iso) return "—"
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const days  = Math.floor(abs / 86_400_000)
  const hours = Math.floor(abs / 3_600_000)
  const mins  = Math.floor(abs / 60_000)
  if (days > 0)  return diff > 0 ? `${days}d remaining` : `ended ${days}d ago`
  if (hours > 0) return diff > 0 ? `${hours}h remaining` : `ended ${hours}h ago`
  return diff > 0 ? `${mins}m remaining` : `ended ${mins}m ago`
}

function VoteBar({ yes, no, total }: { yes: number; no: number; total: number }) {
  if (total === 0) return <div className="h-2 rounded-full bg-cream w-full" />
  const yesPct = Math.round((yes / total) * 100)
  const noPct  = Math.round((no  / total) * 100)
  const absPct = Math.max(0, 100 - yesPct - noPct)
  return (
    <div className="h-2 rounded-full overflow-hidden flex w-full bg-cream">
      <div className="bg-tea-green transition-all" style={{ width: `${yesPct}%` }} />
      <div className="bg-red-400 transition-all"  style={{ width: `${noPct}%`  }} />
      <div className="bg-warm-gray/30 transition-all" style={{ width: `${absPct}%` }} />
    </div>
  )
}

/** Returns a label describing which admin is needed to approve the proposal */
function pendingAdminLabel(group: { wardId?: string | null; constituencyId?: string | null; countyId?: string | null; locationScope?: string } | null): string {
  if (!group) return "platform administrator"
  if (group.wardId)         return "ward administrator"
  if (group.constituencyId) return "constituency administrator"
  if (group.countyId)       return "county administrator"
  if (group.locationScope === "NATIONAL") return "compliance officer"
  return "platform administrator"
}

export default function ProposalDetailPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = use(params)
  const { isAuthenticated, user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [rejectNote, setRejectNote] = useState("")
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [showMemoryEdit, setShowMemoryEdit] = useState(false)
  const [memoryRationale, setMemoryRationale] = useState("")
  const [memoryAlternatives, setMemoryAlternatives] = useState("")
  const [outcomeText, setOutcomeText] = useState("")
  const [showOutcomeForm, setShowOutcomeForm] = useState(false)
  const [annotations, setAnnotations] = useState<ProposalAnnotationDto[]>([])

  const { data: proposal, isLoading, isError } = useQuery({
    queryKey: ["proposal", proposalId],
    queryFn: () => governanceApi.getProposal(proposalId),
    enabled: isAuthenticated,
    staleTime: 15_000,
    select: (data) => {
      setAnnotations(data.annotations ?? [])
      return data
    },
  })

  const canAnnotate =
    isAuthenticated &&
    (user?.verificationLevel === "COMMUNITY_VERIFIED") &&
    ["PENDING_REVIEW", "APPROVED_FOR_VOTING"].includes(proposal?.status ?? "")

  const handleAnnotationCreated = (ann: ProposalAnnotationDto) =>
    setAnnotations((prev) => [...prev, ann])

  const handleAnnotationDeleted = (id: string) =>
    setAnnotations((prev) => prev.filter((a) => a.id !== id))

  const handleAnnotationReacted = (
    id: string,
    upvotes: number,
    downvotes: number,
    myReaction: "UP" | "DOWN" | null
  ) =>
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, upvotes, downvotes, myReaction } : a))
    )

  const { data: myMembership } = useQuery({
    queryKey: ["group-my-role", proposal?.groupId],
    queryFn: () => communityApi.getMyRoleInGroup(proposal!.groupId!),
    enabled: !!proposal?.groupId && isAuthenticated,
    staleTime: 60_000,
  })

  // Group role
  const myGroupRole = myMembership?.role
  const isLeader = myGroupRole === "LEADER"

  // System / location roles
  const userRoles = (user?.roles as unknown as string[]) ?? []
  const isSuperAdmin        = userRoles.includes("system:super_admin")
  const isComplianceOfficer = userRoles.includes("system:compliance_officer")
  const isWardAdmin         = userRoles.includes("location:ward_admin")
  const isConstituencyAdmin = userRoles.includes("location:constituency_admin")
  const isCountyAdmin       = userRoles.includes("location:county_admin")

  // Can this user approve at stage 2 (location admin gate)?
  const group = proposal?.group
  const canLocationApprove =
    isSuperAdmin || isComplianceOfficer ||
    (!!group?.wardId         && isWardAdmin) ||
    (!!group?.constituencyId && isConstituencyAdmin) ||
    (!!group?.countyId       && isCountyAdmin) ||
    (group?.locationScope === "NATIONAL" && isComplianceOfficer)

  // Voluntary group checks
  const isVoluntaryGroup = !!group?.voluntaryType
  const isGroupScoped    = proposal?.proposalScope === "GROUP"

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] })
    queryClient.invalidateQueries({ queryKey: ["proposals"] })
    queryClient.invalidateQueries({ queryKey: ["proposals-needs-action"] })
  }

  const { mutate: castVote, isPending: voting } = useMutation({
    mutationFn: (option: "YES" | "NO" | "ABSTAIN") =>
      governanceApi.castVote({ proposalId, option }),
    onSuccess: () => {
      invalidate()
      toast({ title: "Vote recorded" })
      // Auto-complete governance_basics tutorial on first vote — fire-and-forget
      onboardingApi.completeTutorial("governance_basics").catch(() => {})
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] })
    },
    onError: (err: any) => toast({ title: "Vote failed", description: err?.message, variant: "destructive" }),
  })

  const { mutate: startVoting, isPending: startingVote } = useMutation({
    mutationFn: () => governanceApi.startVoting(proposalId),
    onSuccess: () => { invalidate(); toast({ title: "Voting opened", description: "Members can now cast their votes." }) },
    onError: (err: any) => toast({ title: "Failed to start voting", description: err?.message, variant: "destructive" }),
  })

  // Stage 1: LEADER reviews from DRAFT (APPROVE = forward; REJECT = reject)
  const { mutate: leaderReview, isPending: leaderReviewing } = useMutation({
    mutationFn: ({ decision, note }: { decision: "APPROVE" | "REJECT"; note?: string }) =>
      governanceApi.reviewProposal(proposalId, decision, note),
    onSuccess: (_, vars) => {
      invalidate()
      setShowRejectForm(false)
      if (vars.decision === "APPROVE") {
        toast({
          title: isVoluntaryGroup && isGroupScoped ? "Proposal approved for voting" : "Forwarded for admin review",
          description: isVoluntaryGroup && isGroupScoped
            ? "The proposal is ready — open voting when you are ready."
            : `Sent to the ${pendingAdminLabel(group ?? null)} for final approval.`,
        })
      } else {
        toast({ title: "Proposal rejected" })
      }
    },
    onError: (err: any) => toast({ title: "Review failed", description: err?.message, variant: "destructive" }),
  })

  // Stage 2: Location admin approves/rejects from PENDING_REVIEW
  const { mutate: adminReview, isPending: adminReviewing } = useMutation({
    mutationFn: ({ decision, note }: { decision: "APPROVE" | "REJECT"; note?: string }) =>
      governanceApi.reviewProposal(proposalId, decision, note),
    onSuccess: (_, vars) => {
      invalidate()
      setShowRejectForm(false)
      toast({ title: vars.decision === "APPROVE" ? "Proposal approved for voting" : "Proposal rejected" })
    },
    onError: (err: any) => toast({ title: "Review failed", description: err?.message, variant: "destructive" }),
  })

  const { mutate: tallyVotes, isPending: tallying } = useMutation({
    mutationFn: () => governanceApi.tallyVotes(proposalId),
    onSuccess: (data: any) => {
      invalidate()
      toast({ title: `Proposal ${data?.newStatus === "APPROVED" ? "approved" : "rejected"}` })
    },
    onError: (err: any) => toast({ title: "Tally failed", description: err?.message, variant: "destructive" }),
  })

  const { mutate: launchProject, isPending: launching } = useMutation({
    mutationFn: () => projectApi.createFromProposal(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      toast({ title: "Project launched" })
      window.location.href = "/projects"
    },
    onError: (err: any) => toast({ title: "Failed to launch project", description: err?.message, variant: "destructive" }),
  })

  const { mutate: saveMemory, isPending: savingMemory } = useMutation({
    mutationFn: () => governanceApi.updateMemory(proposalId, {
      rationale: memoryRationale || undefined,
      alternatives: memoryAlternatives || undefined,
    }),
    onSuccess: () => {
      invalidate()
      setShowMemoryEdit(false)
      toast({ title: "Memory saved" })
    },
    onError: (err: any) => toast({ title: "Save failed", description: err?.message, variant: "destructive" }),
  })

  const { mutate: saveOutcome, isPending: savingOutcome } = useMutation({
    mutationFn: () => governanceApi.recordOutcome(proposalId, outcomeText),
    onSuccess: () => {
      invalidate()
      setShowOutcomeForm(false)
      toast({ title: "Outcome recorded" })
    },
    onError: (err: any) => toast({ title: "Save failed", description: err?.message, variant: "destructive" }),
  })

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-sm text-warm-gray">
        Sign in to view this proposal.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-warm-gray" />
      </div>
    )
  }

  if (isError || !proposal) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-sm text-red-600 mb-4">Proposal not found.</p>
        <Link href="/proposals" className="text-sm text-amber hover:underline">← Back to proposals</Link>
      </div>
    )
  }

  const statusMeta = STATUS_META[proposal.status] ?? { label: proposal.status, className: "bg-gray-100 text-gray-600" }
  const summary    = proposal.votesSummary
  const yesWeight  = summary?.yesWeight ?? 0
  const noWeight   = summary?.noWeight  ?? 0
  const total      = summary?.total ?? proposal._count?.votes ?? 0
  const absWeight  = Math.max(0, total - yesWeight - noWeight)
  const adminLabel = pendingAdminLabel(group ?? null)

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      {/* Back */}
      <Link href="/proposals" className="inline-flex items-center gap-1.5 text-sm text-warm-gray hover:text-amber transition-colors">
        <ArrowLeft className="h-4 w-4" />
        All proposals
      </Link>

      {/* Header card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className={`text-xs font-semibold ${statusMeta.className}`}>{statusMeta.label}</Badge>
            {proposal.proposalType && (
              <Badge variant="outline" className="text-xs">{TYPE_LABEL[proposal.proposalType] ?? proposal.proposalType}</Badge>
            )}
            {proposal.group && (
              <Badge variant="outline" className="text-xs">{proposal.group.name}</Badge>
            )}
            {proposal.proposalScope === "GROUP" && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Internal</Badge>
            )}
            {proposal.proposalScope === "COMMUNITY" && (
              <Badge variant="outline" className="text-xs bg-tea-green/10 text-tea-green border-tea-green/20">Public</Badge>
            )}
          </div>

          <h1 className="text-xl font-bold text-[#0A1F14] leading-snug" style={{ fontFamily: "var(--font-cormorant, serif)" }}>
            {proposal.title}
          </h1>

          {proposal.description && (
            <AnnotatableText
              text={proposal.description}
              fieldKey="description"
              proposalId={proposal.id}
              annotations={annotations}
              currentUserId={user?.id ?? null}
              canAnnotate={canAnnotate}
              onCreated={handleAnnotationCreated}
              onDeleted={handleAnnotationDeleted}
              onReacted={handleAnnotationReacted}
            />
          )}

          {/* Rejection note */}
          {proposal.status === "REJECTED" && proposal.reviewNote && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-700">Rejection reason</p>
                <p className="text-xs text-red-600 mt-0.5">{proposal.reviewNote}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-cream text-xs text-warm-gray">
            {proposal.creator && (
              <div>
                <p className="font-semibold text-[#0A1F14] mb-0.5">Proposed by</p>
                <p>{proposal.creator.name}</p>
              </div>
            )}
            <div>
              <p className="font-semibold text-[#0A1F14] mb-0.5">Created</p>
              <p>{formatDate(proposal.createdAt)}</p>
            </div>
            {proposal.votingStartsAt && (
              <div>
                <p className="font-semibold text-[#0A1F14] mb-0.5">Voting started</p>
                <p>{formatDate(proposal.votingStartsAt)}</p>
              </div>
            )}
            {proposal.votingEndsAt && (
              <div>
                <p className="font-semibold text-[#0A1F14] mb-0.5">Voting deadline</p>
                <p className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {relativeTime(proposal.votingEndsAt)}
                </p>
              </div>
            )}
            {proposal.budget && (
              <div>
                <p className="font-semibold text-[#0A1F14] mb-0.5">Budget</p>
                <p>KES {Number(proposal.budget).toLocaleString()}</p>
              </div>
            )}
            {proposal.groupFundingAmount && (
              <div>
                <p className="font-semibold text-[#0A1F14] mb-0.5">Group contribution</p>
                <p>KES {Number(proposal.groupFundingAmount).toLocaleString()}</p>
              </div>
            )}
            {proposal.locationFundingRequest && (
              <div>
                <p className="font-semibold text-[#0A1F14] mb-0.5">Location funding request</p>
                <p>KES {Number(proposal.locationFundingRequest).toLocaleString()}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── REVIEW WORKFLOW ACTIONS ─────────────────────────────────── */}

      {/* DRAFT: LEADER reviews */}
      {proposal.status === "DRAFT" && isLeader && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-6 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber" />
              <h2 className="text-sm font-bold text-[#0A1F14]">
                {isVoluntaryGroup && isGroupScoped ? "Approve Internally" : "Forward for Review"}
              </h2>
            </div>
            <p className="text-xs text-warm-gray">
              {isVoluntaryGroup && isGroupScoped
                ? "This is an internal group proposal. Approve it directly to open it for a member vote."
                : `As group leader, review and forward this proposal to the ${adminLabel} for final approval.`}
            </p>

            {!showRejectForm ? (
              <div className="flex gap-3">
                <button
                  onClick={() => leaderReview({ decision: "APPROVE" })}
                  disabled={leaderReviewing}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-bold transition-all hover:scale-[1.01] disabled:opacity-50"
                  style={{ background: "#D4911E", color: "#0A1F14" }}
                >
                  {leaderReviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {isVoluntaryGroup && isGroupScoped ? "Approve Internally" : "Forward for Review"}
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-bold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Explain why this proposal is being rejected…"
                  rows={3}
                  className="w-full rounded-lg border border-cream bg-white px-3 py-2 text-sm text-[#0A1F14] placeholder:text-warm-gray/60 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => leaderReview({ decision: "REJECT", note: rejectNote })}
                    disabled={leaderReviewing || !rejectNote.trim()}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {leaderReviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Confirm Rejection
                  </button>
                  <button
                    onClick={() => { setShowRejectForm(false); setRejectNote("") }}
                    className="px-4 text-xs text-warm-gray hover:text-[#0A1F14]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* DRAFT: non-LEADER sees info */}
      {proposal.status === "DRAFT" && !isLeader && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex gap-3 items-start">
            <Info className="h-4 w-4 text-warm-gray flex-shrink-0 mt-0.5" />
            <p className="text-xs text-warm-gray">This proposal is a draft. The group leader needs to review and forward it.</p>
          </CardContent>
        </Card>
      )}

      {/* PENDING_REVIEW: location admin approves/rejects */}
      {proposal.status === "PENDING_REVIEW" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-6 space-y-3">
            {canLocationApprove ? (
              <>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber" />
                  <h2 className="text-sm font-bold text-[#0A1F14]">Administrator Review</h2>
                </div>
                <p className="text-xs text-warm-gray">
                  Approve this proposal to open it for a member vote, or reject it with an explanation.
                </p>
                {!showRejectForm ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => adminReview({ decision: "APPROVE" })}
                      disabled={adminReviewing}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-bold transition-all hover:scale-[1.01] disabled:opacity-50"
                      style={{ background: "#1D4731", color: "#fff" }}
                    >
                      {adminReviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => setShowRejectForm(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-bold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="Explain why this proposal is being rejected…"
                      rows={3}
                      className="w-full rounded-lg border border-cream bg-white px-3 py-2 text-sm text-[#0A1F14] placeholder:text-warm-gray/60 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => adminReview({ decision: "REJECT", note: rejectNote })}
                        disabled={adminReviewing || !rejectNote.trim()}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {adminReviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => { setShowRejectForm(false); setRejectNote("") }}
                        className="px-4 text-xs text-warm-gray hover:text-[#0A1F14]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex gap-3 items-start">
                <Info className="h-4 w-4 text-amber flex-shrink-0 mt-0.5" />
                <p className="text-xs text-warm-gray">
                  Awaiting approval from the{" "}
                  <span className="font-semibold text-[#0A1F14]">{adminLabel}</span>.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* APPROVED_FOR_VOTING: LEADER opens voting */}
      {proposal.status === "APPROVED_FOR_VOTING" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-6 space-y-3">
            {isLeader ? (
              <>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-tea-green" />
                  <h2 className="text-sm font-bold text-[#0A1F14]">Open for Voting</h2>
                </div>
                <p className="text-xs text-warm-gray">
                  This proposal has been approved. Open it so members can cast their votes.
                </p>
                <button
                  onClick={() => startVoting()}
                  disabled={startingVote}
                  className="w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "#D4911E", color: "#0A1F14" }}
                >
                  {startingVote ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                  {startingVote ? "Opening…" : "Start Voting"}
                </button>
              </>
            ) : (
              <div className="flex gap-3 items-start">
                <CheckCircle className="h-4 w-4 text-tea-green flex-shrink-0 mt-0.5" />
                <p className="text-xs text-warm-gray">Approved — waiting for the group leader to open the vote.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vote tally */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber" />
            <h2 className="text-sm font-bold text-[#0A1F14]">Vote Tally</h2>
            <span className="ml-auto flex items-center gap-1 text-xs text-warm-gray">
              <Users className="h-3 w-3" />
              {total} vote{total !== 1 ? "s" : ""}
            </span>
          </div>
          <VoteBar yes={yesWeight} no={noWeight} total={total} />
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-tea-green/10 py-3">
              <p className="text-xl font-bold text-tea-green">{yesWeight}</p>
              <p className="text-xs text-warm-gray mt-0.5">Yes</p>
            </div>
            <div className="rounded-xl bg-red-50 py-3">
              <p className="text-xl font-bold text-red-500">{noWeight}</p>
              <p className="text-xs text-warm-gray mt-0.5">No</p>
            </div>
            <div className="rounded-xl bg-cream py-3">
              <p className="text-xl font-bold text-warm-gray">{absWeight}</p>
              <p className="text-xs text-warm-gray mt-0.5">Abstain</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Close & tally */}
      {proposal.status === "VOTING" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#0A1F14]">Close & Tally</p>
              <p className="text-xs text-warm-gray">Finalise the result once the voting deadline has passed.</p>
            </div>
            <button
              onClick={() => tallyVotes()}
              disabled={tallying}
              className="flex-shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold border border-warm-gray/30 text-warm-gray hover:border-amber hover:text-amber transition-colors disabled:opacity-50"
            >
              {tallying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
              {tallying ? "Tallying…" : "Tally Votes"}
            </button>
          </CardContent>
        </Card>
      )}

      {/* Launch project */}
      {proposal.status === "APPROVED" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-tea-green" />
              <h2 className="text-sm font-bold text-[#0A1F14]">Launch Project</h2>
            </div>
            <p className="text-xs text-warm-gray leading-relaxed">
              This proposal has been approved. Launch a project to start tracking milestones.
            </p>
            <button
              onClick={() => launchProject()}
              disabled={launching}
              className="w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "#1D4731", color: "#fff" }}
            >
              {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
              {launching ? "Launching…" : "Launch Project"}
            </button>
          </CardContent>
        </Card>
      )}

      {/* Cast vote */}
      {proposal.status === "VOTING" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-6 space-y-3">
            <h2 className="text-sm font-bold text-[#0A1F14]">Cast your vote</h2>
            <p className="text-xs text-warm-gray">Your vote is weighted by your Participation Rights balance.</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => castVote("YES")}
                disabled={voting}
                className="flex flex-col items-center gap-1.5 rounded-xl py-4 text-sm font-semibold bg-tea-green/10 text-tea-green hover:bg-tea-green/20 transition-colors disabled:opacity-50"
              >
                {voting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                Yes
              </button>
              <button
                onClick={() => castVote("NO")}
                disabled={voting}
                className="flex flex-col items-center gap-1.5 rounded-xl py-4 text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {voting ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
                No
              </button>
              <button
                onClick={() => castVote("ABSTAIN")}
                disabled={voting}
                className="flex flex-col items-center gap-1.5 rounded-xl py-4 text-sm font-semibold bg-cream text-warm-gray hover:bg-cream/80 transition-colors disabled:opacity-50"
              >
                {voting ? <Loader2 className="h-5 w-5 animate-spin" /> : <MinusCircle className="h-5 w-5" />}
                Abstain
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Ward Memory Layer ─────────────────────────────────── */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookMarked className="h-4 w-4" style={{ color: "#C9922A" }} />
              <h2 className="text-sm font-bold text-[#0A1F14]">Ward Memory</h2>
            </div>
            {/* Creator edit button — only in draft/pending */}
            {proposal?.creatorId === user?.id &&
              ["DRAFT", "PENDING_REVIEW"].includes(proposal?.status ?? "") && (
                <button
                  onClick={() => {
                    setMemoryRationale(proposal?.rationale ?? "")
                    setMemoryAlternatives(proposal?.alternatives ?? "")
                    setShowMemoryEdit((v) => !v)
                  }}
                  className="text-xs font-semibold flex items-center gap-1"
                  style={{ color: "#C9922A" }}
                >
                  {showMemoryEdit ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showMemoryEdit ? "Cancel" : "Edit"}
                </button>
              )}
          </div>

          {/* Rationale */}
          {!showMemoryEdit && (proposal?.rationale || proposal?.alternatives) ? (
            <div className="space-y-4">
              {proposal.rationale && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#7A6E60" }}>
                    Why this approach
                  </p>
                  <AnnotatableText
                    text={proposal.rationale}
                    fieldKey="rationale"
                    proposalId={proposal.id}
                    annotations={annotations}
                    currentUserId={user?.id ?? null}
                    canAnnotate={canAnnotate}
                    onCreated={handleAnnotationCreated}
                    onDeleted={handleAnnotationDeleted}
                    onReacted={handleAnnotationReacted}
                  />
                </div>
              )}
              {proposal.alternatives && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#7A6E60" }}>
                    Alternatives considered
                  </p>
                  <AnnotatableText
                    text={proposal.alternatives}
                    fieldKey="alternatives"
                    proposalId={proposal.id}
                    annotations={annotations}
                    currentUserId={user?.id ?? null}
                    canAnnotate={canAnnotate}
                    onCreated={handleAnnotationCreated}
                    onDeleted={handleAnnotationDeleted}
                    onReacted={handleAnnotationReacted}
                  />
                </div>
              )}
            </div>
          ) : !showMemoryEdit ? (
            <p className="text-xs text-[#7A6E60]">
              No rationale or alternatives recorded yet.
              {proposal?.creatorId === user?.id && ["DRAFT", "PENDING_REVIEW"].includes(proposal?.status ?? "") &&
                " Add context above before submitting for vote."}
            </p>
          ) : null}

          {/* Edit form */}
          {showMemoryEdit && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#0A1F14]">Why this approach</label>
                <textarea
                  value={memoryRationale}
                  onChange={(e) => setMemoryRationale(e.target.value)}
                  placeholder="Explain the reasoning behind this proposal over other options…"
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-[#0A1F14] focus:outline-none focus:ring-2 focus:ring-amber/30 resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#0A1F14]">Alternatives considered</label>
                <textarea
                  value={memoryAlternatives}
                  onChange={(e) => setMemoryAlternatives(e.target.value)}
                  placeholder="What other options were evaluated and why were they not chosen?…"
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-[#0A1F14] focus:outline-none focus:ring-2 focus:ring-amber/30 resize-none"
                />
              </div>
              <button
                onClick={() => saveMemory()}
                disabled={savingMemory || (memoryRationale.length < 10 && memoryAlternatives.length < 10)}
                className="flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{ background: "#1D4731", color: "#fff" }}
              >
                {savingMemory && <Loader2 className="h-3 w-3 animate-spin" />}
                {savingMemory ? "Saving…" : "Save Memory"}
              </button>
            </div>
          )}

          {/* Outcome section — visible for passed proposals */}
          {["PASSED", "EXECUTING", "COMPLETED", "APPROVED"].includes(proposal?.status ?? "") && (
            <div className="border-t border-black/[0.06] pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#1D4731" }}>
                  Real-world outcome
                </p>
                {!proposal?.outcome &&
                  (proposal?.creatorId === user?.id || isLeader) && (
                    <button
                      onClick={() => setShowOutcomeForm((v) => !v)}
                      className="text-xs font-semibold flex items-center gap-1"
                      style={{ color: "#1D4731" }}
                    >
                      {showOutcomeForm ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {showOutcomeForm ? "Cancel" : "Record"}
                    </button>
                  )}
              </div>

              {proposal?.outcome ? (
                <div>
                  <p className="text-sm text-[#0A1F14]/80 leading-relaxed">{proposal.outcome}</p>
                  {proposal.outcomeRecordedAt && (
                    <p className="text-[11px] text-[#7A6E60] mt-1">
                      Recorded {formatDate(proposal.outcomeRecordedAt)}
                    </p>
                  )}
                </div>
              ) : !showOutcomeForm ? (
                <p className="text-xs text-[#7A6E60]">No outcome recorded yet.</p>
              ) : null}

              {showOutcomeForm && (
                <div className="space-y-2">
                  <textarea
                    value={outcomeText}
                    onChange={(e) => setOutcomeText(e.target.value)}
                    placeholder="What actually happened? Did the proposal achieve its goals?…"
                    rows={3}
                    maxLength={2000}
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-[#0A1F14] focus:outline-none focus:ring-2 focus:ring-tea-green/30 resize-none"
                  />
                  <button
                    onClick={() => saveOutcome()}
                    disabled={savingOutcome || outcomeText.length < 10}
                    className="flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-all hover:scale-[1.02] disabled:opacity-50"
                    style={{ background: "#1D4731", color: "#fff" }}
                  >
                    {savingOutcome && <Loader2 className="h-3 w-3 animate-spin" />}
                    {savingOutcome ? "Recording…" : "Record Outcome"}
                  </button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Community Opinions ───────────────────────────── */}
      {annotations.length > 0 && proposal && (
        <AnnotationSidebar
          annotations={annotations}
          proposalId={proposal.id}
          currentUserId={user?.id ?? null}
          canReact={canAnnotate}
          onDeleted={handleAnnotationDeleted}
          onReacted={handleAnnotationReacted}
        />
      )}

      {/* ── Failure Protocol: What next? ─────────────────── */}
      {proposal?.status === "REJECTED" && (
        <Card className="border-0 shadow-card" style={{ borderLeft: "3px solid #B03A1E" }}>
          <CardContent className="p-4 md:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: "#B03A1E" }} />
              <h2 className="text-sm font-bold" style={{ color: "#B03A1E" }}>This proposal was rejected</h2>
            </div>
            {proposal.reviewNote && (
              <div
                className="rounded-xl px-4 py-3 text-sm text-[#0A1F14]/70 leading-relaxed"
                style={{ background: "rgba(176,58,30,0.06)" }}
              >
                <span className="font-semibold">Review note: </span>{proposal.reviewNote}
              </div>
            )}
            <p className="text-xs text-[#7A6E60]">
              Rejection is not the end. Here are your options:
            </p>
            <div className="grid gap-3">
              {proposal?.groupId && (
                <Link
                  href={`/proposals/create?groupId=${proposal.groupId}`}
                  className="flex items-start gap-3 rounded-xl p-4 transition-colors hover:bg-[#F7F2E8]"
                  style={{ border: "1px solid rgba(201,146,42,0.2)" }}
                >
                  <RefreshCw className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: "#C9922A" }} />
                  <div>
                    <p className="text-sm font-semibold text-[#0A1F14]">Revise and resubmit</p>
                    <p className="text-xs text-[#7A6E60] mt-0.5">
                      Address the concerns raised and submit a revised proposal to your group.
                    </p>
                  </div>
                </Link>
              )}
              <div
                className="flex items-start gap-3 rounded-xl p-4"
                style={{ border: "1px solid rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.02)" }}
              >
                <Archive className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: "#7A6E60" }} />
                <div>
                  <p className="text-sm font-semibold text-[#0A1F14]">Preserved in ward memory</p>
                  <p className="text-xs text-[#7A6E60] mt-0.5">
                    Rejected proposals remain permanently in the governance record.
                    The deliberation, vote count, and any rationale you added are preserved.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
