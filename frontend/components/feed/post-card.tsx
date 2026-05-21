"use client"

import Link from "next/link"
import {
  Megaphone,
  BookOpen,
  FileText,
  ExternalLink,
  ArrowUpRight,
  Clock,
} from "lucide-react"
import type { PostDto, PostScope, PostType } from "@/lib/api"
import { formatDate } from "@/lib/utils"

// ── Time ──────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return days === 1 ? "1d" : `${days}d`
}

// ── Config ────────────────────────────────────────────────────

const SCOPE_CONFIG: Record<PostScope, { color: string; bg: string }> = {
  WARD:         { color: "#1D4731", bg: "rgba(29,71,49,0.10)"   },
  CONSTITUENCY: { color: "#2A6B7C", bg: "rgba(42,107,124,0.10)" },
  COUNTY:       { color: "#7A4F1E", bg: "rgba(122,79,30,0.10)"  },
  NATIONAL:     { color: "#C9922A", bg: "rgba(201,146,42,0.12)" },
}

export const TYPE_CONFIG: Record<
  PostType,
  { label: string; icon: React.ElementType; color: string; bg: string; placeholder: string }
> = {
  NOTICE:       { label: "Notice",       icon: FileText,  color: "#7A6E60", bg: "rgba(122,110,96,0.10)", placeholder: "Share a community notice…"        },
  ANNOUNCEMENT: { label: "Announcement", icon: Megaphone, color: "#B03A1E", bg: "rgba(176,58,30,0.10)", placeholder: "Share an important announcement…"  },
  RESOURCE:     { label: "Resource",     icon: BookOpen,  color: "#2A6B7C", bg: "rgba(42,107,124,0.10)",placeholder: "Describe this learning resource…"  },
}

const PROPOSAL_STATUS_COLOR: Record<string, string> = {
  DRAFT:               "#7A6E60",
  PENDING_REVIEW:      "#7A4F1E",
  APPROVED_FOR_VOTING: "#2A6B7C",
  VOTING:              "#6B4F9E",
  PASSED:              "#1D4731",
  REJECTED:            "#B03A1E",
}

// ── Shared author row ─────────────────────────────────────────

function AuthorRow({ post }: { post: PostDto }) {
  const scope = post.scope as PostScope
  const scopeCfg = SCOPE_CONFIG[scope]
  const typeCfg = TYPE_CONFIG[post.type]
  const TypeIcon = typeCfg.icon

  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold"
        style={{ background: scopeCfg.bg, color: scopeCfg.color }}
      >
        {post.authorInitials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[13px] font-semibold" style={{ color: "#0E0B08" }}>
            {post.authorName}
          </span>
          {post.wardName && (
            <>
              <span style={{ color: "rgba(14,11,8,0.25)" }}>·</span>
              <span className="text-[11px]" style={{ color: "rgba(14,11,8,0.40)" }}>
                {post.wardName}
              </span>
            </>
          )}
          <span style={{ color: "rgba(14,11,8,0.25)" }}>·</span>
          <span className="text-[11px]" style={{ color: "rgba(14,11,8,0.38)" }}>
            {relativeTime(post.createdAt)}
          </span>
        </div>
      </div>
      <span
        className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
        style={{ color: typeCfg.color, background: typeCfg.bg }}
      >
        <TypeIcon className="h-2.5 w-2.5" />
        {typeCfg.label}
      </span>
    </div>
  )
}

// ── Proposal context panel ────────────────────────────────────

function ProposalPanel({ proposal }: { proposal: NonNullable<PostDto["proposal"]> }) {
  const statusColor = PROPOSAL_STATUS_COLOR[proposal.status] ?? "#7A6E60"
  const totalVotes = proposal.votesFor + proposal.votesAgainst
  const forPct = totalVotes > 0 ? Math.round((proposal.votesFor / totalVotes) * 100) : null
  const isVoting = proposal.status === "APPROVED_FOR_VOTING" || proposal.status === "VOTING"

  return (
    <Link
      href={`/proposals/${proposal.id}`}
      className="block group rounded-xl overflow-hidden hover:opacity-95 transition-opacity"
      style={{ background: "rgba(176,58,30,0.05)", border: "1px solid rgba(176,58,30,0.14)" }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-3 pt-3 pb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(176,58,30,0.10)" }}
        >
          <FileText className="h-3.5 w-3.5" style={{ color: "#B03A1E" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold leading-snug line-clamp-2" style={{ color: "#B03A1E" }}>
            {proposal.title}
          </p>
        </div>
        <span
          className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
          style={{ color: statusColor, background: `${statusColor}18` }}
        >
          {proposal.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Vote data */}
      {totalVotes > 0 && (
        <div className="px-3 pb-2 border-t" style={{ borderColor: "rgba(176,58,30,0.10)", paddingTop: "8px" }}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-3 text-[10px] font-semibold">
              <span style={{ color: "#1D4731" }}>✓ {proposal.votesFor} for</span>
              <span style={{ color: "#B03A1E" }}>✗ {proposal.votesAgainst} against</span>
            </div>
            <span className="text-[10px] font-bold" style={{ color: "#7A6E60" }}>
              {totalVotes} votes
            </span>
          </div>
          {forPct !== null && (
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(176,58,30,0.12)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${forPct}%`,
                  background: "linear-gradient(to right, #1D4731, #2A7A4B)",
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Deadline */}
      {isVoting && proposal.votingEndsAt && (
        <div
          className="flex items-center gap-1.5 px-3 py-2 border-t"
          style={{ borderColor: "rgba(176,58,30,0.10)" }}
        >
          <Clock className="h-3 w-3 flex-shrink-0" style={{ color: "#C9922A" }} />
          <span className="text-[10px] font-semibold" style={{ color: "#C9922A" }}>
            Voting closes {formatDate(proposal.votingEndsAt)}
          </span>
          <ArrowUpRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#B03A1E" }} />
        </div>
      )}

      {/* View link (when no deadline row) */}
      {!(isVoting && proposal.votingEndsAt) && (
        <div
          className="flex items-center justify-end px-3 py-2 border-t gap-1"
          style={{ borderColor: "rgba(176,58,30,0.10)" }}
        >
          <span className="text-[10px] font-semibold" style={{ color: "#B03A1E" }}>
            View proposal
          </span>
          <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#B03A1E" }} />
        </div>
      )}
    </Link>
  )
}

// ── Card variants ─────────────────────────────────────────────

const BORDER = { borderColor: "rgba(14,11,8,0.05)" }

export function PostCard({ post }: { post: PostDto }) {
  if (post.type === "ANNOUNCEMENT") {
    return (
      <div
        className="px-4 py-4 border-b last:border-0"
        style={{ ...BORDER, borderLeft: "3px solid #B03A1E" }}
      >
        <AuthorRow post={post} />
        <p className="text-[14px] leading-relaxed font-medium mb-3" style={{ color: "#0E0B08" }}>
          {post.content}
        </p>
        {post.proposal && <ProposalPanel proposal={post.proposal} />}
      </div>
    )
  }

  if (post.type === "RESOURCE") {
    return (
      <div className="px-4 py-4 border-b last:border-0" style={BORDER}>
        <AuthorRow post={post} />
        <p className="text-[14px] leading-relaxed mb-3" style={{ color: "#0E0B08" }}>
          {post.content}
        </p>
        {post.resourceUrl && (
          <a
            href={post.resourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl group hover:opacity-90 transition-opacity"
            style={{ background: "rgba(42,107,124,0.07)", border: "1px solid rgba(42,107,124,0.15)" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(42,107,124,0.12)" }}
            >
              <BookOpen className="h-3.5 w-3.5" style={{ color: "#2A6B7C" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold truncate" style={{ color: "#2A6B7C" }}>
                {post.resourceTitle || post.resourceUrl}
              </p>
              {post.resourceTitle && (
                <p className="text-[10px] truncate" style={{ color: "rgba(14,11,8,0.40)" }}>
                  {post.resourceUrl}
                </p>
              )}
            </div>
            <ExternalLink className="h-3 w-3 flex-shrink-0" style={{ color: "#2A6B7C" }} />
          </a>
        )}
      </div>
    )
  }

  // NOTICE
  return (
    <div className="px-4 py-4 border-b last:border-0" style={BORDER}>
      <AuthorRow post={post} />
      <p className="text-[14px] leading-relaxed" style={{ color: "#0E0B08" }}>
        {post.content}
      </p>
    </div>
  )
}
