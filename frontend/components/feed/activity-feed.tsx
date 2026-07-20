"use client"

import Link from "next/link"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { Vote, Users, Briefcase, AlertTriangle, Rss, RefreshCw, ArrowRight, BookOpen, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { feedApi, type FeedItemDto } from "@/lib/api"
import { useLanguage } from "@/contexts/language-context"

// ─── Relative timestamp ───────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return "yesterday"
  return `${days}d ago`
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY = {
  governance:  { Icon: Vote,          color: "#C9922A", bg: "rgba(201,146,42,0.12)", label: "Governance"  },
  community:   { Icon: Users,         color: "#1D4731", bg: "rgba(29,71,49,0.10)",   label: "Community"   },
  project:     { Icon: Briefcase,     color: "#2A6B7C", bg: "rgba(42,107,124,0.10)", label: "Project"     },
  emergency:   { Icon: AlertTriangle, color: "#B03A1E", bg: "rgba(176,58,30,0.10)",  label: "Emergency"   },
  marketplace: { Icon: ShoppingBag,   color: "#6B4F9E", bg: "rgba(107,79,158,0.10)", label: "Marketplace" },
  education:   { Icon: BookOpen,      color: "#2A7A4B", bg: "rgba(42,122,75,0.10)",  label: "Learning"    },
} as const

// ─── Detail chips ─────────────────────────────────────────────────────────────

const SCOPE_LABEL: Record<string, string> = { COMMUNITY: "Platform-wide", GROUP: "Group" }
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  DRAFT:                { label: "Draft",           color: "#6B7280" },
  PENDING_REVIEW:       { label: "In Review",       color: "#B45309" },
  APPROVED_FOR_VOTING:  { label: "Open for Voting", color: "#2563EB" },
  VOTING:               { label: "Voting",          color: "#7C3AED" },
  PASSED:               { label: "Passed",          color: "#16A34A" },
  REJECTED:             { label: "Rejected",        color: "#DC2626" },
}
const EMERGENCY_ICON: Record<string, string> = {
  FIRE: "🔥", FLOOD: "🌊", MEDICAL: "🚑", SECURITY: "🔒", ACCIDENT: "🚗", OTHER: "⚠️",
}

function DetailChips({ item }: { item: FeedItemDto }) {
  const chips: { label: string; color: string; bg: string }[] = []

  if (item.category === "governance") {
    const scope = item.meta?.scope as string | undefined
    const newStatus = item.meta?.newStatus as string | undefined
    if (scope && SCOPE_LABEL[scope]) {
      chips.push({ label: SCOPE_LABEL[scope], color: "#C9922A", bg: "rgba(201,146,42,0.10)" })
    }
    if (newStatus && STATUS_LABEL[newStatus]) {
      const s = STATUS_LABEL[newStatus]
      chips.push({ label: s.label, color: s.color, bg: `${s.color}1A` })
    }
  }

  if (item.category === "project") {
    const approved = item.meta?.approved as boolean | undefined
    const projectTitle = item.meta?.projectTitle as string | undefined
    if (approved !== undefined) {
      chips.push(
        approved
          ? { label: "Approved ✓", color: "#16A34A", bg: "rgba(22,163,74,0.10)" }
          : { label: "Rejected", color: "#DC2626", bg: "rgba(220,38,38,0.10)" }
      )
    }
    if (projectTitle) {
      chips.push({ label: projectTitle, color: "#2A6B7C", bg: "rgba(42,107,124,0.10)" })
    }
  }

  if (item.category === "emergency") {
    const type = item.meta?.type as string | undefined
    if (type) {
      const icon = EMERGENCY_ICON[type] ?? "⚠️"
      chips.push({ label: `${icon} ${type.charAt(0) + type.slice(1).toLowerCase()}`, color: "#B03A1E", bg: "rgba(176,58,30,0.10)" })
    }
  }

  if (item.category === "marketplace") {
    const type = item.meta?.type as string | undefined
    if (type) {
      chips.push({ label: type.charAt(0) + type.slice(1).toLowerCase(), color: "#6B4F9E", bg: "rgba(107,79,158,0.10)" })
    }
  }

  if (!chips.length) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2.5">
      {chips.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ color: c.color, background: c.bg }}
        >
          {c.label}
        </span>
      ))}
    </div>
  )
}

// ─── Deep-link helper ─────────────────────────────────────────────────────────

function entityHref(item: FeedItemDto): string | null {
  switch (item.category) {
    case "governance":
      return item.entityId ? `/proposals/${item.entityId}` : null
    case "community":
      // GROUP_JOINED / GROUP_CREATED: entityId = groupId
      return item.entityId ? `/groups/${item.entityId}` : null
    case "project": {
      // PROJECT_CREATED: entityId = projectId  ✓
      // MILESTONE_*:     entityId = milestoneId — use meta.projectId instead
      const projectId =
        (item.meta?.projectId as string | undefined) ?? item.entityId
      return projectId ? `/projects/${projectId}` : null
    }
    case "marketplace": return `/marketplace`
    case "education":   return `/education`
    default:            return null
  }
}

// ─── Skeleton cards ───────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl shadow-card border-l-[3px] p-4"
          style={{ borderLeftColor: "rgba(201,146,42,0.3)" }}
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-3 w-12 flex-shrink-0" />
          </div>
          <Skeleton className="h-4 w-full mb-1.5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  )
}

// ─── Single feed card ─────────────────────────────────────────────────────────

function FeedCard({ item, compact }: { item: FeedItemDto; compact: boolean }) {
  const cfg = CATEGORY[item.category] ?? CATEGORY.community
  const { Icon, color, bg, label } = cfg
  const href = entityHref(item)

  const card = (
    <div
      className="bg-white rounded-2xl shadow-card border-l-[3px] transition-shadow hover:shadow-md"
      style={{ borderLeftColor: color }}
    >
      <div className={compact ? "p-3" : "p-4"}>
        {/* Top row: icon + category label + timestamp */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: bg }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color }}
            >
              {label}
            </span>
          </div>
          <span className="text-[11px] text-[#0E0B08]/40 flex-shrink-0 pt-0.5 whitespace-nowrap">
            {relativeTime(item.timestamp)}
          </span>
        </div>

        {/* Description — 2 lines allowed */}
        <p className="text-sm font-medium text-[#0E0B08] leading-snug line-clamp-2">
          {item.description}
        </p>

        {/* Contextual detail chips */}
        <DetailChips item={item} />

        {/* View link — full mode only, when deep-linkable */}
        {!compact && href && (
          <div className="mt-3 flex justify-end">
            <span className="text-xs font-semibold" style={{ color }}>
              View →
            </span>
          </div>
        )}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href} className="block">{card}</Link>
  }
  return card
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ActivityFeedProps {
  compact?: boolean
}

export function ActivityFeed({ compact = false }: ActivityFeedProps) {
  const queryClient = useQueryClient()
  const { t } = useLanguage()

  // Stable main feed — no auto-refetch, user-triggered only
  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["activity-feed"],
    queryFn: ({ pageParam }) => feedApi.getFeed(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: Infinity,
  })

  // Silent poll every 60s — only to detect new items
  const { data: pollData } = useQuery({
    queryKey: ["feed-poll"],
    queryFn: () => feedApi.getFeed(),
    refetchInterval: compact ? false : 60_000,
    staleTime: 60_000,
  })

  const allItems = data?.pages.flatMap((p) => p.items) ?? []
  const displayed = compact ? allItems.slice(0, 8) : allItems

  // Detect new items in the background
  const firstDisplayed = allItems[0]?.timestamp
  const firstPolled = pollData?.items[0]?.timestamp
  const hasNewItems = !!(
    firstPolled &&
    firstDisplayed &&
    new Date(firstPolled) > new Date(firstDisplayed)
  )

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ["activity-feed"] })
    queryClient.invalidateQueries({ queryKey: ["feed-poll"] })
  }

  return (
    <div className="space-y-3">
      {/* Full-mode heading */}
      {!compact && (
        <div className="flex items-center gap-2 mb-1">
          <Rss className="h-5 w-5" style={{ color: "#C9922A" }} />
          <h2 className="font-display font-bold text-xl text-[#0E0B08]">{t("feed.title")}</h2>
        </div>
      )}

      {/* New-items banner (full mode only) */}
      {!compact && hasNewItems && (
        <button
          onClick={handleRefresh}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: "rgba(201,146,42,0.12)", color: "#C9922A" }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("feed.new_activity")}
        </button>
      )}

      {/* Loading state */}
      {isLoading && <FeedSkeleton />}

      {/* Cards */}
      {!isLoading && displayed.length > 0 && (
        <div className="space-y-3">
          {displayed.map((item) => (
            <FeedCard key={item.id} item={item} compact={compact} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && displayed.length === 0 && (
        <p className="text-sm py-8 text-center" style={{ color: "rgba(14,11,8,0.35)" }}>
          {t("feed.empty")}
        </p>
      )}

      {/* Compact footer */}
      {compact && allItems.length > 0 && (
        <Link
          href="/dashboard"
          className="flex items-center justify-end gap-1 text-xs font-medium pt-1"
          style={{ color: "#C9922A" }}
        >
          View all activity <ArrowRight className="h-3 w-3" />
        </Link>
      )}

      {/* Load more (full mode) */}
      {!compact && hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? "Loading…" : t("feed.load_more")}
        </Button>
      )}
    </div>
  )
}
