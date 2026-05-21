"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ArrowRight,
  Coins,
  Award,
  Zap,
  ChevronDown,
  RefreshCw,
  LogIn,
  Send,
  Globe,
  MapPin,
  Landmark,
  Home,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { postsApi, type PostDto, type PostScope } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

// ─── Time helper ──────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return "1d"
  return `${days}d`
}

// ─── Scope config ─────────────────────────────────────────────

const SCOPE_CONFIG: Record<
  PostScope,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  WARD:         { label: "Ward",         icon: Home,     color: "#1D4731", bg: "rgba(29,71,49,0.10)"  },
  CONSTITUENCY: { label: "Constituency", icon: Landmark, color: "#2A6B7C", bg: "rgba(42,107,124,0.10)" },
  COUNTY:       { label: "County",       icon: MapPin,   color: "#7A4F1E", bg: "rgba(122,79,30,0.10)" },
  NATIONAL:     { label: "National",     icon: Globe,    color: "#C9922A", bg: "rgba(201,146,42,0.12)" },
}

// ─── Filter tabs ──────────────────────────────────────────────

type Filter = "all" | PostScope

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",         label: "All"         },
  { key: "WARD",        label: "My Ward"     },
  { key: "CONSTITUENCY",label: "Constituency"},
  { key: "COUNTY",      label: "County"      },
  { key: "NATIONAL",    label: "National"    },
]

// ─── Author avatar ────────────────────────────────────────────

function AuthorAvatar({ initials, scope }: { initials: string; scope: PostScope }) {
  const cfg = SCOPE_CONFIG[scope]
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-extrabold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {initials}
    </div>
  )
}

// ─── Scope badge ──────────────────────────────────────────────

function ScopeBadge({ scope }: { scope: PostScope }) {
  const cfg = SCOPE_CONFIG[scope]
  const Icon = cfg.icon
  if (scope === "WARD") return null // ward is the default — no badge needed
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────

function PostSkeleton() {
  return (
    <div className="divide-y" style={{ borderColor: "rgba(14,11,8,0.05)" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-4 py-4">
          <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Single post row ──────────────────────────────────────────

function PostRow({ post }: { post: PostDto }) {
  const scope = post.scope as PostScope
  const cfg = SCOPE_CONFIG[scope]

  return (
    <div className="flex gap-3 px-4 py-4">
      <AuthorAvatar initials={post.authorInitials} scope={scope} />

      <div className="flex-1 min-w-0">
        {/* Author name + time */}
        <div className="flex items-baseline gap-1.5 mb-0.5 flex-wrap">
          <span className="text-[13px] font-semibold" style={{ color: "#0E0B08" }}>
            {post.authorName}
          </span>
          {post.wardName && (
            <>
              <span className="text-[11px]" style={{ color: "rgba(14,11,8,0.25)" }}>·</span>
              <span className="text-[11px]" style={{ color: "rgba(14,11,8,0.40)" }}>
                {post.wardName}
              </span>
            </>
          )}
          <span className="text-[11px]" style={{ color: "rgba(14,11,8,0.25)" }}>·</span>
          <span className="text-[11px]" style={{ color: "rgba(14,11,8,0.38)" }}>
            {relativeTime(post.createdAt)}
          </span>
        </div>

        {/* Content */}
        <p
          className="text-[14px] leading-relaxed"
          style={{ color: "#0E0B08" }}
        >
          {post.content}
        </p>

        {/* Scope badge (non-ward) */}
        <div className="mt-1.5">
          <ScopeBadge scope={scope} />
        </div>
      </div>
    </div>
  )
}

// ─── Compose box ─────────────────────────────────────────────

const SCOPE_OPTIONS: { value: PostScope; label: string }[] = [
  { value: "WARD",         label: "My Ward"      },
  { value: "CONSTITUENCY", label: "Constituency" },
  { value: "COUNTY",       label: "County"       },
  { value: "NATIONAL",     label: "National"     },
]

function ComposeBox() {
  const { user, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [content, setContent] = useState("")
  const [scope, setScope] = useState<PostScope>("WARD")
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const canPost =
    isAuthenticated &&
    (user?.verificationLevel === "COMMUNITY_VERIFIED" ||
      user?.verificationLevel === "FULL_VERIFIED")

  const mutation = useMutation({
    mutationFn: () => postsApi.createPost({ content: content.trim(), scope }),
    onSuccess: () => {
      setContent("")
      setFocused(false)
      queryClient.invalidateQueries({ queryKey: ["posts"] })
    },
  })

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [content])

  if (!isAuthenticated) return null

  if (!canPost) {
    return (
      <div
        className="mx-3 mt-3 rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{
          background: "rgba(201,146,42,0.07)",
          border: "1px dashed rgba(201,146,42,0.3)",
        }}
      >
        <span className="text-lg">🌿</span>
        <p className="text-[12px]" style={{ color: "rgba(14,11,8,0.55)" }}>
          Complete community verification to post in your ward.
        </p>
      </div>
    )
  }

  return (
    <div
      className="mx-3 mt-3 rounded-2xl overflow-hidden"
      style={{
        background: "#fff",
        boxShadow: focused
          ? "0 0 0 2px rgba(201,146,42,0.35), 0 1px 6px rgba(14,11,8,0.07)"
          : "0 1px 6px rgba(14,11,8,0.07), 0 0 0 1px rgba(14,11,8,0.04)",
        transition: "box-shadow 0.15s",
      }}
    >
      <div className="flex gap-3 px-4 pt-4 pb-3">
        {/* Author avatar initials */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-extrabold"
          style={{ background: "rgba(29,71,49,0.10)", color: "#1D4731" }}
        >
          {user?.username
            ? user.username.slice(0, 2).toUpperCase()
            : user?.email?.slice(0, 2).toUpperCase() ?? "Me"}
        </div>

        {/* Input */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="What's happening in your ward?"
            rows={1}
            maxLength={500}
            className="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-[rgba(14,11,8,0.35)]"
            style={{ color: "#0E0B08", minHeight: "24px" }}
          />
        </div>
      </div>

      {/* Actions row — shown when focused or has content */}
      {(focused || content.length > 0) && (
        <div
          className="flex items-center justify-between px-4 pb-3 pt-1 border-t"
          style={{ borderColor: "rgba(14,11,8,0.06)" }}
        >
          {/* Scope selector */}
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as PostScope)}
            className="text-[11px] font-semibold rounded-full px-2.5 py-1 outline-none cursor-pointer appearance-none"
            style={{
              background: SCOPE_CONFIG[scope].bg,
              color: SCOPE_CONFIG[scope].color,
              border: "none",
            }}
          >
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-3">
            {/* Character count */}
            <span
              className="text-[11px] font-medium"
              style={{
                color: content.length > 450
                  ? content.length > 480 ? "#B03A1E" : "#C9922A"
                  : "rgba(14,11,8,0.30)",
              }}
            >
              {500 - content.length}
            </span>

            {/* Post button */}
            <button
              onClick={() => mutation.mutate()}
              disabled={!content.trim() || mutation.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-bold transition-all disabled:opacity-40"
              style={{ background: "#1D4731", color: "#fff" }}
            >
              {mutation.isPending ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stats strip ──────────────────────────────────────────────

function StatsStrip() {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated || !user) return null

  const chips = [
    { icon: Coins, label: "PR", value: user.tokenBalance,              color: "#C9922A" },
    { icon: Award, label: "IP", value: user.impactPoints?.global ?? 0, color: "#1D4731" },
    { icon: Zap,   label: "UT", value: user.utBalance ?? 0,             color: "#7A4F1E" },
  ]

  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none border-b"
      style={{ background: "#F7F2E8", borderColor: "rgba(14,11,8,0.06)" }}
    >
      {chips.map(({ icon: Icon, label, value, color }) => (
        <div
          key={label}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold flex-shrink-0"
          style={{ background: `${color}13`, color }}
        >
          <Icon className="h-3 w-3" />
          <span>{value.toLocaleString()}</span>
          <span className="opacity-55 font-medium">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Filter pills ─────────────────────────────────────────────

function FilterPills({ active, onChange }: { active: Filter; onChange: (f: Filter) => void }) {
  return (
    <div
      className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none border-b"
      style={{ background: "#F7F2E8", borderColor: "rgba(14,11,8,0.06)" }}
    >
      {FILTERS.map(({ key, label }) => {
        const isActive = active === key
        const color = key === "all" ? "#0E0B08" : SCOPE_CONFIG[key as PostScope].color
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="flex-shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all"
            style={
              isActive
                ? { background: color, color: "#fff" }
                : { background: "rgba(14,11,8,0.06)", color: "rgba(14,11,8,0.50)" }
            }
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Unauthenticated state ────────────────────────────────────

function UnauthenticatedState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
        style={{ background: "rgba(201,146,42,0.12)" }}
      >
        <span className="text-4xl">🌿</span>
      </div>
      <h2 className="font-display font-bold text-2xl mb-2" style={{ color: "#0E0B08" }}>
        Karibu UjamaaDAO
      </h2>
      <p className="text-sm mb-6 max-w-xs" style={{ color: "rgba(14,11,8,0.5)" }}>
        Sign in to read and post in your ward community.
      </p>
      <Link
        href="/auth/callback"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all hover:opacity-90"
        style={{ background: "#1D4731", color: "#fff" }}
      >
        <LogIn className="h-4 w-4" />
        Sign In
      </Link>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

export function HomeFeed() {
  const { isAuthenticated } = useAuth()
  const [filter, setFilter] = useState<Filter>("all")
  const queryClient = useQueryClient()

  const scope = filter === "all" ? undefined : (filter as PostScope)

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useInfiniteQuery({
      queryKey: ["posts", scope],
      queryFn: ({ pageParam }) =>
        postsApi.getPosts({ scope, cursor: pageParam as string | undefined }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      staleTime: 30_000,
      enabled: isAuthenticated,
    })

  const allPosts = data?.pages.flatMap((p) => p.items) ?? []

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["posts"] })
  }

  if (!isAuthenticated) {
    return (
      <div style={{ background: "#F7F2E8", minHeight: "100%" }}>
        <UnauthenticatedState />
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ background: "#F7F2E8", minHeight: "100%" }}>
      {/* Stats strip */}
      <StatsStrip />

      {/* Filter pills */}
      <FilterPills active={filter} onChange={(f) => { setFilter(f); refresh() }} />

      {/* Compose box */}
      <ComposeBox />

      {/* Posts container */}
      <div
        className="mx-3 mt-3 rounded-2xl overflow-hidden"
        style={{
          background: "#fff",
          boxShadow: "0 1px 6px rgba(14,11,8,0.07), 0 0 0 1px rgba(14,11,8,0.04)",
        }}
      >
        {isLoading && <PostSkeleton />}

        {!isLoading && allPosts.length > 0 && (
          <div className="divide-y" style={{ borderColor: "rgba(14,11,8,0.05)" }}>
            {allPosts.map((post) => (
              <PostRow key={post.id} post={post} />
            ))}
          </div>
        )}

        {!isLoading && allPosts.length === 0 && (
          <div className="py-16 px-6 text-center">
            <p className="text-4xl mb-3">🌿</p>
            <p className="text-sm font-semibold mb-1" style={{ color: "#0E0B08" }}>
              Hakuna machapisho bado
            </p>
            <p className="text-xs" style={{ color: "rgba(14,11,8,0.40)" }}>
              {filter === "all"
                ? "Be the first to post something in your ward."
                : `No ${filter.toLowerCase()} posts yet. Be the first.`}
            </p>
          </div>
        )}

        {/* Load more */}
        {!isLoading && hasNextPage && (
          <div className="border-t px-4 py-3" style={{ borderColor: "rgba(14,11,8,0.05)" }}>
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-colors disabled:opacity-60"
              style={{ background: "rgba(14,11,8,0.04)", color: "rgba(14,11,8,0.55)" }}
            >
              {isFetchingNextPage ? (
                <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading…</>
              ) : (
                <><ChevronDown className="h-3.5 w-3.5" /> Load more</>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="h-4 flex-shrink-0" />
    </div>
  )
}
