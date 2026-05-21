"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Coins,
  Award,
  Zap,
  ChevronDown,
  RefreshCw,
  LogIn,
  Send,
  Megaphone,
  BookOpen,
  FileText,
  Check,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { postsApi, type PostScope, type PostType } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { PostCard, TYPE_CONFIG } from "@/components/feed/post-card"

// ─── Types ────────────────────────────────────────────────────

type Filter = "all" | PostScope

type CommunityOption = {
  scope: PostScope
  wardId?: string
  label: string
  sublabel?: string
}

// ─── Scope reach colors (used for filter pills and avatar reach indicator) ─

const SCOPE_COLOR: Record<PostScope, { color: string; bg: string }> = {
  WARD:         { color: "#1D4731", bg: "rgba(29,71,49,0.10)"   },
  CONSTITUENCY: { color: "#2A6B7C", bg: "rgba(42,107,124,0.10)" },
  COUNTY:       { color: "#7A4F1E", bg: "rgba(122,79,30,0.10)"  },
  NATIONAL:     { color: "#C9922A", bg: "rgba(201,146,42,0.12)" },
}

// ─── Build community options from user's geography ────────────

function buildCommunityOptions(
  user: ReturnType<typeof useAuth>["user"],
): CommunityOption[] {
  if (!user) return []

  const hasBothWards =
    !!user.secondaryWardId && user.secondaryWardId !== user.primaryWardId

  const opts: CommunityOption[] = []

  if (user.primaryWardId) {
    opts.push({
      scope: "WARD",
      wardId: user.primaryWardId,
      label: user.primaryWardName ?? "My Ward",
      sublabel: hasBothWards ? "primary home" : undefined,
    })
  }

  if (hasBothWards && user.secondaryWardId) {
    opts.push({
      scope: "WARD",
      wardId: user.secondaryWardId,
      label: user.secondaryWardName ?? "Secondary Ward",
      sublabel: "secondary home",
    })
  }

  opts.push({
    scope: "CONSTITUENCY",
    label: user.residenceConstituency || "My Constituency",
  })
  opts.push({
    scope: "COUNTY",
    label: user.residenceCounty || "My County",
  })
  opts.push({ scope: "NATIONAL", label: "All of Kenya" })

  return opts
}

// ─── Post type list ───────────────────────────────────────────

const POST_TYPES: { value: PostType; label: string; icon: React.ElementType }[] = [
  { value: "NOTICE",       label: "Notice",       icon: FileText  },
  { value: "ANNOUNCEMENT", label: "Announcement", icon: Megaphone },
  { value: "RESOURCE",     label: "Resource",     icon: BookOpen  },
]

// ─── Post skeleton ────────────────────────────────────────────

function PostSkeleton() {
  return (
    <div className="divide-y" style={{ borderColor: "rgba(14,11,8,0.05)" }}>
      {Array.from({ length: 4 }).map((_, i) => (
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

// ─── Compose box ─────────────────────────────────────────────

function ComposeBox() {
  const { user, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const communityOptions = buildCommunityOptions(user)

  const [content, setContent] = useState("")
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityOption | null>(null)
  const [type, setType] = useState<PostType>("NOTICE")
  const [resourceUrl, setResourceUrl] = useState("")
  const [resourceTitle, setResourceTitle] = useState("")
  const [focused, setFocused] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeCommunity = selectedCommunity ?? communityOptions[0] ?? null

  const canPost =
    isAuthenticated &&
    (user?.verificationLevel === "COMMUNITY_VERIFIED" ||
      user?.verificationLevel === "FULL_VERIFIED")

  const mutation = useMutation({
    mutationFn: () =>
      postsApi.createPost({
        content: content.trim(),
        scope: activeCommunity?.scope ?? "WARD",
        type,
        wardId: activeCommunity?.wardId,
        resourceUrl: type === "RESOURCE" && resourceUrl.trim() ? resourceUrl.trim() : undefined,
        resourceTitle: type === "RESOURCE" && resourceTitle.trim() ? resourceTitle.trim() : undefined,
      }),
    onSuccess: () => {
      setContent("")
      setResourceUrl("")
      setResourceTitle("")
      setFocused(false)
      setPickerOpen(false)
      queryClient.invalidateQueries({ queryKey: ["posts"] })
    },
  })

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
        style={{ background: "rgba(201,146,42,0.07)", border: "1px dashed rgba(201,146,42,0.3)" }}
      >
        <span className="text-lg flex-shrink-0">🌿</span>
        <p className="text-[12px] flex-1" style={{ color: "rgba(14,11,8,0.55)" }}>
          Community members can share updates and resources.
        </p>
        <Link
          href="/profile#verification"
          className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-opacity hover:opacity-80"
          style={{ background: "#1D4731", color: "#fff" }}
        >
          Get verified
        </Link>
      </div>
    )
  }

  const typeCfg = TYPE_CONFIG[type]
  const scopeColor = activeCommunity ? SCOPE_COLOR[activeCommunity.scope] : SCOPE_COLOR.WARD

  return (
    <div className="mx-3 mt-3 relative">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#fff",
          boxShadow: focused
            ? "0 0 0 2px rgba(201,146,42,0.35), 0 1px 6px rgba(14,11,8,0.07)"
            : "0 1px 6px rgba(14,11,8,0.07), 0 0 0 1px rgba(14,11,8,0.04)",
          transition: "box-shadow 0.15s",
        }}
      >
        {/* "Posting to" context — always visible */}
        <div
          className="flex items-center gap-2 px-3 pt-3 pb-0"
        >
          <span className="text-[11px]" style={{ color: "rgba(14,11,8,0.35)" }}>
            Posting to
          </span>
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all"
            style={{ background: scopeColor.bg, color: scopeColor.color }}
          >
            {activeCommunity?.label ?? "My Ward"}
            {activeCommunity?.sublabel && (
              <span className="opacity-60 font-normal">· {activeCommunity.sublabel}</span>
            )}
            <ChevronDown className="h-3 w-3 ml-0.5" />
          </button>
        </div>

        {/* Type selector */}
        <div className="flex gap-1 px-3 pt-2.5 pb-0">
          {POST_TYPES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setType(value)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
              style={
                type === value
                  ? { background: TYPE_CONFIG[value].bg, color: TYPE_CONFIG[value].color }
                  : { background: "rgba(14,11,8,0.04)", color: "rgba(14,11,8,0.40)" }
              }
            >
              <Icon className="h-2.5 w-2.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Resource URL fields */}
        {type === "RESOURCE" && (
          <div className="px-4 pt-3 space-y-2">
            <input
              value={resourceUrl}
              onChange={(e) => setResourceUrl(e.target.value)}
              placeholder="https://… (link to the resource)"
              className="w-full h-8 rounded-lg border bg-white/60 px-3 text-[13px] outline-none focus:ring-1"
              style={{ borderColor: "rgba(42,107,124,0.3)", color: "#0E0B08" }}
            />
            <input
              value={resourceTitle}
              onChange={(e) => setResourceTitle(e.target.value)}
              placeholder="Resource title (optional)"
              className="w-full h-8 rounded-lg border bg-white/60 px-3 text-[13px] outline-none focus:ring-1"
              style={{ borderColor: "rgba(14,11,8,0.10)", color: "#0E0B08" }}
            />
          </div>
        )}

        {/* Textarea */}
        <div className="flex gap-3 px-4 pt-3 pb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold"
            style={{ background: typeCfg.bg, color: typeCfg.color }}
          >
            {user?.username
              ? user.username.slice(0, 2).toUpperCase()
              : user?.email?.slice(0, 2).toUpperCase() ?? "Me"}
          </div>
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setFocused(true)}
              placeholder={typeCfg.placeholder}
              rows={1}
              maxLength={500}
              className="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-[rgba(14,11,8,0.35)]"
              style={{ color: "#0E0B08", minHeight: "24px" }}
            />
          </div>
        </div>

        {/* Actions row */}
        {(focused || content.length > 0) && (
          <div
            className="flex items-center justify-end px-4 pb-3 pt-1 border-t gap-3"
            style={{ borderColor: "rgba(14,11,8,0.06)" }}
          >
            <span
              className="text-[11px] font-medium"
              style={{
                color:
                  content.length > 450
                    ? content.length > 480 ? "#B03A1E" : "#C9922A"
                    : "rgba(14,11,8,0.30)",
              }}
            >
              {500 - content.length}
            </span>
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
        )}
      </div>

      {/* Community picker dropdown */}
      {pickerOpen && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-20 rounded-2xl overflow-hidden"
          style={{
            background: "#fff",
            boxShadow: "0 4px 24px rgba(14,11,8,0.12), 0 0 0 1px rgba(14,11,8,0.06)",
          }}
        >
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(14,11,8,0.35)" }}>
              Post into
            </p>
          </div>
          {communityOptions.map((opt) => {
            const isActive =
              activeCommunity?.scope === opt.scope &&
              activeCommunity?.wardId === opt.wardId
            const color = SCOPE_COLOR[opt.scope]
            return (
              <button
                key={`${opt.scope}-${opt.wardId ?? ""}`}
                onClick={() => {
                  setSelectedCommunity(opt)
                  setPickerOpen(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[rgba(14,11,8,0.03)]"
              >
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ background: color.bg }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: "#0E0B08" }}>
                    {opt.label}
                  </p>
                  {opt.sublabel && (
                    <p className="text-[11px]" style={{ color: "rgba(14,11,8,0.40)" }}>
                      {opt.sublabel}
                    </p>
                  )}
                </div>
                {isActive && (
                  <Check className="h-4 w-4 flex-shrink-0" style={{ color: color.color }} />
                )}
              </button>
            )
          })}
          <div className="h-2" />
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
    { icon: Zap,   label: "UT", value: user.utBalance ?? 0,            color: "#7A4F1E" },
  ]

  return (
    <div
      className="md:hidden flex items-center gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none border-b"
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
  const { user } = useAuth()

  const hasBothWards =
    !!user?.secondaryWardId && user.secondaryWardId !== user?.primaryWardId

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    {
      key: "WARD",
      label: hasBothWards
        ? "My Wards"
        : (user?.primaryWardName ?? user?.primaryWardId ? "My Ward" : "Ward"),
    },
    { key: "CONSTITUENCY", label: user?.residenceConstituency || "Constituency" },
    { key: "COUNTY",       label: user?.residenceCounty || "County" },
    { key: "NATIONAL",     label: "All Kenya" },
  ]

  return (
    <div
      className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none border-b"
      style={{ background: "#F7F2E8", borderColor: "rgba(14,11,8,0.06)" }}
    >
      {filters.map(({ key, label }) => {
        const isActive = active === key
        const color = key === "all" ? "#0E0B08" : SCOPE_COLOR[key as PostScope].color
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
        Sign in to read and share updates in your ward community.
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

  if (!isAuthenticated) return <UnauthenticatedState />

  return (
    <div className="flex flex-col">
      <StatsStrip />
      <FilterPills active={filter} onChange={setFilter} />
      <ComposeBox />

      <div
        className="mx-3 mt-3 rounded-2xl overflow-hidden"
        style={{ background: "#fff", boxShadow: "0 1px 6px rgba(14,11,8,0.07), 0 0 0 1px rgba(14,11,8,0.04)" }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "rgba(14,11,8,0.06)" }}
        >
          <span className="text-xs font-semibold" style={{ color: "#7A6E60" }}>
            {filter === "all" ? "Community updates" : `${filter === "NATIONAL" ? "All Kenya" : filter.charAt(0) + filter.slice(1).toLowerCase()} updates`}
          </span>
          <button
            onClick={refresh}
            className="flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-70"
            style={{ color: "#7A6E60" }}
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <PostSkeleton />
        ) : allPosts.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px]" style={{ color: "rgba(14,11,8,0.40)" }}>
              No posts yet in this community.
            </p>
            <p className="text-[12px] mt-1" style={{ color: "rgba(14,11,8,0.28)" }}>
              Be the first to share something.
            </p>
          </div>
        ) : (
          <div>
            {allPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {hasNextPage && (
          <div className="px-4 py-3 border-t" style={{ borderColor: "rgba(14,11,8,0.05)" }}>
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full py-2 text-[12px] font-semibold rounded-xl transition-all"
              style={{ background: "rgba(14,11,8,0.04)", color: "rgba(14,11,8,0.50)" }}
            >
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
