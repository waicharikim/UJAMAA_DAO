"use client"

import Link from "next/link"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { Vote, Users, Briefcase, AlertTriangle, Rss, RefreshCw, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { feedApi, type FeedItemDto } from "@/lib/api"

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
  governance: { Icon: Vote,          color: "#C9922A", bg: "rgba(201,146,42,0.12)" },
  community:  { Icon: Users,         color: "#1D4731", bg: "rgba(29,71,49,0.10)"   },
  project:    { Icon: Briefcase,     color: "#2A6B7C", bg: "rgba(42,107,124,0.10)" },
  emergency:  { Icon: AlertTriangle, color: "#B03A1E", bg: "rgba(176,58,30,0.10)"  },
} as const

// ─── Deep-link helper ─────────────────────────────────────────────────────────

function entityHref(item: FeedItemDto): string | null {
  if (!item.entityId) return null
  switch (item.category) {
    case "governance": return `/proposals/${item.entityId}`
    case "project":    return `/projects`
    case "emergency":  return `/emergency`
    default:           return null
  }
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-xl"
          style={{ background: "rgba(201,146,42,0.05)" }}
        >
          <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-3 w-12 flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ─── Single feed item ─────────────────────────────────────────────────────────

function FeedRow({ item }: { item: FeedItemDto }) {
  const cfg = CATEGORY[item.category] ?? CATEGORY.community
  const { Icon, color, bg } = cfg
  const href = entityHref(item)

  const inner = (
    <div
      className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:opacity-90"
      style={{ background: "rgba(201,146,42,0.05)" }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: bg }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0E0B08] truncate">{item.description}</p>
      </div>
      <span className="text-[10px] text-[#0E0B08]/40 flex-shrink-0 whitespace-nowrap">
        {relativeTime(item.timestamp)}
      </span>
    </div>
  )

  if (href) {
    return <Link href={href} className="block">{inner}</Link>
  }
  return inner
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ActivityFeedProps {
  compact?: boolean
}

export function ActivityFeed({ compact = false }: ActivityFeedProps) {
  const queryClient = useQueryClient()

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
          <h2 className="font-display font-bold text-xl text-[#0E0B08]">Community Feed</h2>
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
          New activity — tap to refresh
        </button>
      )}

      {/* Loading state */}
      {isLoading && <FeedSkeleton />}

      {/* Items */}
      {!isLoading && displayed.length > 0 && (
        <div className="space-y-2">
          {displayed.map((item) => (
            <FeedRow key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && displayed.length === 0 && (
        <p className="text-sm py-8 text-center" style={{ color: "rgba(14,11,8,0.35)" }}>
          No activity yet — be the first to create a proposal!
        </p>
      )}

      {/* Compact footer */}
      {compact && allItems.length > 0 && (
        <Link
          href="/feed"
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
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  )
}
