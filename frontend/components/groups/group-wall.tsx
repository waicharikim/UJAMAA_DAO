"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { governanceApi, projectApi, electionsApi, type ProposalDto, type ProjectListItemDto, type ElectionSummaryDto } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Vote, Briefcase, ArrowUpRight, CheckCircle2, Clock, XCircle, Circle, ScrollText, Users, CalendarDays } from "lucide-react"
import { formatDate } from "@/lib/utils"

// ── Status config ─────────────────────────────────────────

const PROPOSAL_STATUS: Record<
  string,
  { label: string; color: string; bg: string; Icon: React.ElementType }
> = {
  DRAFT:               { label: "Draft",            color: "#7A6E60", bg: "rgba(122,110,96,0.10)", Icon: Circle        },
  PENDING_REVIEW:      { label: "Pending Review",   color: "#7A4F1E", bg: "rgba(122,79,30,0.10)",  Icon: Clock         },
  APPROVED_FOR_VOTING: { label: "Open for Voting",  color: "#2A6B7C", bg: "rgba(42,107,124,0.10)", Icon: Vote          },
  VOTING:              { label: "Voting Active",    color: "#6B4F9E", bg: "rgba(107,79,158,0.10)", Icon: Vote          },
  PASSED:              { label: "Passed",           color: "#1D4731", bg: "rgba(29,71,49,0.10)",   Icon: CheckCircle2  },
  REJECTED:            { label: "Rejected",         color: "#B03A1E", bg: "rgba(176,58,30,0.10)",  Icon: XCircle       },
}

const PROJECT_STATUS: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  PLANNING:   { label: "Planning",   color: "#7A4F1E", bg: "rgba(122,79,30,0.10)"  },
  ACTIVE:     { label: "Active",     color: "#1D4731", bg: "rgba(29,71,49,0.10)"   },
  ON_HOLD:    { label: "On Hold",    color: "#7A6E60", bg: "rgba(122,110,96,0.10)" },
  CANCELLED:  { label: "Cancelled",  color: "#B03A1E", bg: "rgba(176,58,30,0.10)" },
  COMPLETED:  { label: "Completed",  color: "#2A7A4B", bg: "rgba(42,122,75,0.10)" },
}

// ── Proposal card ─────────────────────────────────────────

function ProposalCard({ proposal }: { proposal: ProposalDto }) {
  const cfg = PROPOSAL_STATUS[proposal.status] ?? PROPOSAL_STATUS.DRAFT
  const { Icon, color, bg, label } = cfg
  const voteCount = proposal._count?.votes ?? 0

  return (
    <Link href={`/proposals/${proposal.id}`} className="block group">
      <div className="bg-white rounded-xl border border-black/[0.06] p-4 hover:border-black/[0.12] hover:shadow-sm transition-all duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#0E0B08] leading-snug line-clamp-2 group-hover:text-[#1D4731] transition-colors">
              {proposal.title}
            </p>
            <p className="text-xs mt-1.5 line-clamp-1 text-[#0E0B08]/50">
              {proposal.description}
            </p>
          </div>
          <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#1D4731" }} />
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {/* Status badge */}
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ color, background: bg }}
          >
            <Icon className="h-2.5 w-2.5" />
            {label}
          </span>

          {/* Vote count */}
          {voteCount > 0 && (
            <span className="text-[10px] font-medium text-[#7A6E60]">
              {voteCount} {voteCount === 1 ? "vote" : "votes"}
            </span>
          )}

          {/* Date */}
          <span className="text-[10px] text-[#7A6E60] ml-auto">
            {formatDate(proposal.createdAt)}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Project card ──────────────────────────────────────────

function ProjectCard({ project }: { project: ProjectListItemDto }) {
  const cfg = PROJECT_STATUS[project.status] ?? PROJECT_STATUS.PLANNING
  const progress = project.milestonesCount > 0
    ? Math.round((project.completedMilestonesCount / project.milestonesCount) * 100)
    : null

  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <div className="bg-white rounded-xl border border-black/[0.06] p-4 hover:border-black/[0.12] hover:shadow-sm transition-all duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#0E0B08] leading-snug line-clamp-2 group-hover:text-[#1D4731] transition-colors">
              {project.title}
            </p>
            {project.description && (
              <p className="text-xs mt-1.5 line-clamp-1 text-[#0E0B08]/50">{project.description}</p>
            )}
          </div>
          <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#1D4731" }} />
        </div>

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {/* Status badge */}
          <span
            className="inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ color: cfg.color, background: cfg.bg }}
          >
            {cfg.label}
          </span>

          {/* Milestone progress */}
          {progress !== null && (
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="h-1 w-16 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.07)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, background: "#1D4731" }}
                />
              </div>
              <span className="text-[10px] text-[#7A6E60]">
                {project.completedMilestonesCount}/{project.milestonesCount} milestones
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Election card ─────────────────────────────────────────

function ElectionCard({ election }: { election: ElectionSummaryDto }) {
  const statusColor =
    election.status === "VOTING_OPEN"
      ? "#C9922A"
      : election.status === "NOMINATIONS_OPEN"
      ? "#2A7A4B"
      : "#888"

  return (
    <Link href={`/elections/${election.id}`} className="block group">
      <div className="bg-white rounded-xl border border-black/[0.06] p-4 hover:border-black/[0.12] hover:shadow-sm transition-all duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#0E0B08] leading-snug line-clamp-2 group-hover:text-[#1D4731] transition-colors">
              {election.roleKey.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
            </p>
          </div>
          <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#1D4731" }} />
        </div>

        <div className="flex items-center gap-3 mt-3 flex-wrap text-[10px]">
          <span
            className="font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ color: statusColor, background: `${statusColor}22` }}
          >
            {election.status.replace(/_/g, " ")}
          </span>
          <span className="flex items-center gap-1 text-[#7A6E60]">
            <Users className="h-2.5 w-2.5" />
            {election.candidateCount} candidate{election.candidateCount !== 1 ? "s" : ""}
          </span>
          {election.status === "VOTING_OPEN" && (
            <span className="flex items-center gap-1 text-[#7A6E60] ml-auto">
              <CalendarDays className="h-2.5 w-2.5" />
              Closes {formatDate(election.votingCloseAt)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Empty state ───────────────────────────────────────────

function Empty({ label }: { label: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-[#7A6E60]">No {label} yet.</p>
    </div>
  )
}

// ── Skeleton list ─────────────────────────────────────────

function WallSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-black/[0.06] p-4 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────

type Tab = "proposals" | "projects" | "elections"

interface GroupWallProps {
  groupId: string
}

export function GroupWall({ groupId }: GroupWallProps) {
  const [tab, setTab] = useState<Tab>("proposals")

  const {
    data: proposalsData,
    isLoading: loadingProposals,
  } = useQuery({
    queryKey: ["group-proposals", groupId],
    queryFn: () => governanceApi.getProposals({ groupId, limit: 20 }),
    staleTime: 30_000,
  })

  const {
    data: projectsData,
    isLoading: loadingProjects,
  } = useQuery({
    queryKey: ["group-projects", groupId],
    queryFn: () => projectApi.getProjects({ ownerGroupId: groupId, limit: 20 }),
    staleTime: 30_000,
  })

  const {
    data: electionsData,
    isLoading: loadingElections,
  } = useQuery({
    queryKey: ["group-elections", groupId],
    queryFn: () => electionsApi.listElections({ groupId, limit: 20 }),
    staleTime: 30_000,
  })

  const proposals = proposalsData?.proposals ?? []
  const projects = projectsData?.projects ?? []
  const elections = electionsData?.elections ?? []

  const tabs: { id: Tab; Icon: React.ElementType; label: string; count: number | null }[] = [
    { id: "proposals", Icon: Vote,       label: "Proposals", count: proposalsData?.total ?? null },
    { id: "projects",  Icon: Briefcase,  label: "Projects",  count: projectsData?.total ?? null  },
    { id: "elections", Icon: ScrollText, label: "Elections", count: electionsData?.total ?? null  },
  ]

  return (
    <Card className="border-0 shadow-card overflow-hidden">
      {/* Tab strip */}
      <div
        className="flex border-b px-4"
        style={{ borderColor: "rgba(0,0,0,0.06)" }}
      >
        {tabs.map(({ id, Icon, label, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-1.5 px-4 py-3.5 text-xs font-semibold transition-colors"
            style={
              tab === id
                ? { color: "#1D4731", borderBottom: "2px solid #1D4731" }
                : { color: "#7A6E60" }
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {count !== null && (
              <span
                className="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={
                  tab === id
                    ? { background: "rgba(29,71,49,0.10)", color: "#1D4731" }
                    : { background: "rgba(0,0,0,0.06)", color: "#7A6E60" }
                }
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      <CardContent className="p-4">
        {tab === "proposals" && (
          <>
            {loadingProposals && <WallSkeleton />}
            {!loadingProposals && proposals.length === 0 && <Empty label="proposals" />}
            {!loadingProposals && proposals.length > 0 && (
              <div className="space-y-3">
                {proposals.map((p) => <ProposalCard key={p.id} proposal={p} />)}
              </div>
            )}
          </>
        )}

        {tab === "projects" && (
          <>
            {loadingProjects && <WallSkeleton />}
            {!loadingProjects && projects.length === 0 && <Empty label="projects" />}
            {!loadingProjects && projects.length > 0 && (
              <div className="space-y-3">
                {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
              </div>
            )}
          </>
        )}

        {tab === "elections" && (
          <>
            {loadingElections && <WallSkeleton />}
            {!loadingElections && elections.length === 0 && <Empty label="elections" />}
            {!loadingElections && elections.length > 0 && (
              <div className="space-y-3">
                {elections.map((e) => <ElectionCard key={e.id} election={e} />)}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
