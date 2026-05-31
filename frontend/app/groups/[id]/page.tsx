"use client"

import { use, useState, useRef, useEffect } from "react"
import Link from "next/link"
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query"
import {
  apiClient,
  communityApi,
  governanceApi,
  projectApi,
  electionsApi,
  postsApi,
  integrationApi,
  type GroupDetailDto,
  type PostDto,
  type PostScope,
  type PostType,
  type ProposalDto,
  type ProjectListItemDto,
  type ElectionSummaryDto,
} from "@/lib/api"
import { GroupTreasuryCard } from "@/components/groups/group-treasury-card"
import { GroupMembers } from "@/components/groups/group-members"
import { LeaderAdminPanel } from "@/components/groups/group-detail"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { useAuth } from "@/contexts/auth-context"
import { useContextualNav } from "@/hooks/use-contextual-nav"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer"
import {
  Globe,
  MapPin,
  Home,
  Users,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  Rss,
  Vote,
  ScrollText,
  Briefcase,
  Landmark,
  Settings,
  Send,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  XCircle,
  Circle,
  RefreshCw,
  Plus,
  Loader2,
  MoreHorizontal,
  X,
} from "lucide-react"
import { cn, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { PostCard, TYPE_CONFIG } from "@/components/feed/post-card"

// ── Level config ──────────────────────────────────────────────

const LEVEL_CONFIG: Record<
  string,
  { label: string; Icon: React.ElementType; color: string; bg: string }
> = {
  NATIONAL:     { label: "National",     Icon: Globe,    color: "#1D4731", bg: "rgba(29,71,49,0.10)" },
  COUNTY:       { label: "County",       Icon: MapPin,   color: "#B03A1E", bg: "rgba(176,58,30,0.10)" },
  CONSTITUENCY: { label: "Constituency", Icon: Landmark, color: "#7A4F1E", bg: "rgba(122,79,30,0.10)" },
  WARD:         { label: "Ward",         Icon: Home,     color: "#1A6B3C", bg: "rgba(26,107,60,0.10)" },
}

function groupScope(group: GroupDetailDto): PostScope {
  const s = (group.locationScope ?? group.systemType ?? "WARD").toUpperCase()
  if (s === "CONSTITUENCY") return "CONSTITUENCY"
  if (s === "COUNTY") return "COUNTY"
  if (s === "NATIONAL") return "NATIONAL"
  return "WARD"
}

// ── Hub tab types ────────────────────────────────────────────

type HubTab = "feed" | "proposals" | "elections" | "projects" | "treasury" | "members" | "sessions" | "admin"

// ── Breadcrumb ───────────────────────────────────────────────

function Breadcrumb({ group }: { group: GroupDetailDto }) {
  const parts = [group.county?.name, group.constituency?.name, group.ward?.name].filter(Boolean)
  if (!parts.length) return null
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" style={{ color: "#7A6E60" }} />}
          <span className="text-xs font-medium" style={{ color: "#7A6E60" }}>{p}</span>
        </span>
      ))}
    </div>
  )
}

// ── Group header ─────────────────────────────────────────────

function GroupHeader({ group, groupId }: { group: GroupDetailDto; groupId: string }) {
  const queryClient = useQueryClient()
  const levelKey = (group.locationScope ?? group.systemType ?? "WARD").toUpperCase()
  const { Icon: LevelIcon, color, bg, label } = LEVEL_CONFIG[levelKey] ?? LEVEL_CONFIG.WARD
  const isMember = !!group.userRole

  const joinMutation = useMutation({
    mutationFn: () => communityApi.joinGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    },
  })

  const leaveMutation = useMutation({
    mutationFn: () => communityApi.leaveGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    },
  })

  return (
    <div
      className="px-4 pt-5 pb-4"
      style={{ background: "#fff", borderBottom: "1px solid rgba(14,11,8,0.06)" }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: bg }}
          >
            <LevelIcon className="h-7 w-7" style={{ color }} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-xl leading-tight" style={{ color: "#0E0B08" }}>
              {group.groupName}
            </h1>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ color, background: bg }}
              >
                <LevelIcon className="h-2.5 w-2.5" />
                {label}
              </span>
              {group.isSystem ? (
                <span
                  className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{ color: "#1D4731", background: "rgba(29,71,49,0.08)" }}
                >
                  Official
                </span>
              ) : group.voluntaryType ? (
                <span
                  className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{ color: "#7A4F1E", background: "rgba(201,146,42,0.10)" }}
                >
                  {group.voluntaryType.replace(/_/g, " ")}
                </span>
              ) : null}
            </div>

            <div className="mt-1.5">
              <Breadcrumb group={group} />
            </div>
          </div>

          {/* Join / Leave */}
          {!group.isSystem && (
            isMember ? (
              <button
                onClick={() => leaveMutation.mutate()}
                disabled={leaveMutation.isPending}
                className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{ borderColor: "#B03A1E", color: "#B03A1E" }}
              >
                {leaveMutation.isPending ? "Leaving…" : "Leave"}
              </button>
            ) : (
              <button
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
                className="flex-shrink-0 text-xs font-semibold px-4 py-1.5 rounded-full transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{ background: "#1D4731", color: "#fff" }}
              >
                {joinMutation.isPending ? "Joining…" : "Join"}
              </button>
            )
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-5 mt-4">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" style={{ color: "#C9922A" }} />
            <span className="text-xs font-bold" style={{ color: "#0E0B08" }}>
              {group.memberCount.toLocaleString()}
            </span>
            <span className="text-xs" style={{ color: "#7A6E60" }}>members</span>
          </div>
          {isMember && group.userRole && (
            <div className="flex items-center gap-1.5">
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ color: "#1A6B3C", background: "rgba(26,107,60,0.10)" }}
              >
                {group.userRole.toLowerCase()}
              </span>
            </div>
          )}
          <span className="text-xs ml-auto" style={{ color: "#7A6E60" }}>
            Est. {formatDate(group.createdAt)}
          </span>
        </div>

        {group.description && (
          <p className="text-sm mt-3 leading-relaxed" style={{ color: "rgba(14,11,8,0.60)" }}>
            {group.description}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Feed tab ─────────────────────────────────────────────────

const POST_TYPE_LIST: { value: PostType; label: string; icon: React.ElementType }[] = [
  { value: "NOTICE",       label: "Notice",       icon: Send     },
  { value: "ANNOUNCEMENT", label: "Announcement", icon: Settings  },
  { value: "RESOURCE",     label: "Resource",     icon: Globe     },
]

function FeedTab({ group }: { group: GroupDetailDto }) {
  const { user, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  // ── Derived values (not hooks) ───────────────────────────────
  const scope            = groupScope(group)
  const groupWardId         = group.ward?.id
  const groupConstituencyId = group.constituency?.id
  const groupCountyId       = group.county?.id
  const maxScopeIndex    = ["WARD", "CONSTITUENCY", "COUNTY", "NATIONAL"].indexOf(scope)
  const availableScopes: PostScope[] = group.isSystem
    ? [scope]
    : (["WARD", "CONSTITUENCY", "COUNTY", "NATIONAL"] as PostScope[]).slice(0, maxScopeIndex + 1)
  const locationParams = {
    ...(groupWardId         ? { wardId: groupWardId }                 : {}),
    ...(groupConstituencyId ? { constituencyId: groupConstituencyId } : {}),
    ...(groupCountyId       ? { countyId: groupCountyId }             : {}),
  }

  // ── All hooks — declared together, in consistent order ───────
  const [content, setContent]         = useState("")
  const [focused, setFocused]         = useState(false)
  const [type, setType]               = useState<PostType>("NOTICE")
  const [resourceUrl, setResourceUrl] = useState("")
  const [resourceTitle, setResourceTitle] = useState("")
  const [postScope, setPostScope]     = useState<PostScope>(scope)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typeCfg = TYPE_CONFIG[type]

  const canPost =
    isAuthenticated &&
    (user?.verificationLevel === "COMMUNITY_VERIFIED" ||
      user?.verificationLevel === "FULL_VERIFIED")

  const postMutation = useMutation({
    mutationFn: () =>
      postsApi.createPost({
        content: content.trim(),
        scope: postScope,
        type,
        wardId: groupWardId,
        resourceUrl: type === "RESOURCE" && resourceUrl.trim() ? resourceUrl.trim() : undefined,
        resourceTitle: type === "RESOURCE" && resourceTitle.trim() ? resourceTitle.trim() : undefined,
      }),
    onSuccess: () => {
      setContent("")
      setResourceUrl("")
      setResourceTitle("")
      setFocused(false)
      queryClient.invalidateQueries({ queryKey: ["group-feed", scope, groupWardId, groupConstituencyId, groupCountyId] })
    },
  })

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [content])

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["group-feed", scope, groupWardId, groupConstituencyId, groupCountyId],
    queryFn: ({ pageParam }) =>
      postsApi.getPosts({ scope, ...locationParams, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  })

  const posts = data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="space-y-3">
      {/* Compose */}
      {isAuthenticated && (
        canPost ? (
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
            {/* "Posting in" context + optional scope selector */}
            <div className="flex items-center gap-2 px-4 pt-3 flex-wrap">
              <span className="text-[11px]" style={{ color: "rgba(14,11,8,0.35)" }}>
                Posting in
              </span>
              <span
                className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: LEVEL_CONFIG[groupScope(group)]?.bg ?? "rgba(29,71,49,0.10)",
                  color: LEVEL_CONFIG[groupScope(group)]?.color ?? "#1D4731",
                }}
              >
                {group.groupName}
              </span>
              {/* Scope selector — only for voluntary groups where multiple scopes are available */}
              {!group.isSystem && availableScopes.length > 1 && (
                <div className="flex items-center gap-1 ml-1">
                  <span className="text-[11px]" style={{ color: "rgba(14,11,8,0.35)" }}>reach:</span>
                  {availableScopes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setPostScope(s)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full transition-all"
                      style={postScope === s
                        ? { background: LEVEL_CONFIG[s]?.bg ?? "rgba(29,71,49,0.10)", color: LEVEL_CONFIG[s]?.color ?? "#1D4731" }
                        : { background: "rgba(14,11,8,0.04)", color: "rgba(14,11,8,0.35)" }}
                    >
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Type selector */}
            <div className="flex gap-1 px-3 pt-2.5">
              {POST_TYPE_LIST.map(({ value, label, icon: Icon }) => (
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

            {/* Resource fields */}
            {type === "RESOURCE" && (
              <div className="px-4 pt-3 space-y-2">
                <input
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  placeholder="https://… (link to the resource)"
                  className="w-full h-8 rounded-lg border bg-white/60 px-3 text-[13px] outline-none"
                  style={{ borderColor: "rgba(42,107,124,0.3)", color: "#0E0B08" }}
                />
                <input
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  placeholder="Resource title (optional)"
                  className="w-full h-8 rounded-lg border bg-white/60 px-3 text-[13px] outline-none"
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
                {user?.username?.slice(0, 2).toUpperCase() ?? user?.email?.slice(0, 2).toUpperCase() ?? "Me"}
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

            {(focused || content.length > 0) && (
              <div
                className="flex items-center justify-between px-4 pb-3 pt-1 border-t"
                style={{ borderColor: "rgba(14,11,8,0.06)" }}
              >
                <span
                  className="text-[11px] font-medium"
                  style={{ color: content.length > 450 ? (content.length > 480 ? "#B03A1E" : "#C9922A") : "rgba(14,11,8,0.30)" }}
                >
                  {500 - content.length}
                </span>
                <button
                  onClick={() => postMutation.mutate()}
                  disabled={postMutation.isPending || content.trim().length === 0}
                  className="flex items-center gap-1.5 text-[12px] font-bold px-4 py-1.5 rounded-full transition-all hover:scale-[1.02] disabled:opacity-40"
                  style={{ background: "#1D4731", color: "#fff" }}
                >
                  {postMutation.isPending
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Send className="h-3 w-3" />
                  }
                  Post
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: "rgba(201,146,42,0.07)", border: "1px dashed rgba(201,146,42,0.3)" }}
          >
            <span className="text-lg flex-shrink-0">🌿</span>
            <p className="text-[12px] flex-1" style={{ color: "rgba(14,11,8,0.55)" }}>
              Verified members can share updates and resources.
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
      )}

      {/* Feed list */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "#fff", boxShadow: "0 1px 6px rgba(14,11,8,0.07), 0 0 0 1px rgba(14,11,8,0.04)" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(14,11,8,0.06)" }}>
          <span className="text-xs font-semibold" style={{ color: "#7A6E60" }}>
            {group.groupName} updates
          </span>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-70"
            style={{ color: "#7A6E60" }}
          >
            <RefreshCw className={cn("h-3 w-3", isRefetching && "animate-spin")} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="divide-y" style={{ borderColor: "rgba(14,11,8,0.05)" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-4">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium" style={{ color: "#7A6E60" }}>No updates yet.</p>
            <p className="text-xs mt-1" style={{ color: "rgba(14,11,8,0.35)" }}>
              Share a project update, announcement, or resource above.
            </p>
          </div>
        ) : (
          <>
            {posts.map((post) => <PostCard key={post.id} post={post} />)}
            {hasNextPage && (
              <div className="px-4 py-3 border-t" style={{ borderColor: "rgba(14,11,8,0.05)" }}>
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="w-full text-xs font-semibold py-2 rounded-xl transition-colors hover:bg-black/[0.03] flex items-center justify-center gap-1.5"
                  style={{ color: "#1D4731" }}
                >
                  {isFetchingNextPage ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Proposal status config ────────────────────────────────────

const PROPOSAL_STATUS: Record<
  string,
  { label: string; color: string; bg: string; Icon: React.ElementType }
> = {
  DRAFT:               { label: "Draft",           color: "#7A6E60", bg: "rgba(122,110,96,0.10)", Icon: Circle        },
  PENDING_REVIEW:      { label: "Pending Review",  color: "#7A4F1E", bg: "rgba(122,79,30,0.10)",  Icon: Clock         },
  APPROVED_FOR_VOTING: { label: "Open for Voting", color: "#2A6B7C", bg: "rgba(42,107,124,0.10)", Icon: Vote          },
  VOTING:              { label: "Voting Active",   color: "#6B4F9E", bg: "rgba(107,79,158,0.10)", Icon: Vote          },
  PASSED:              { label: "Passed",          color: "#1D4731", bg: "rgba(29,71,49,0.10)",   Icon: CheckCircle2  },
  REJECTED:            { label: "Rejected",        color: "#B03A1E", bg: "rgba(176,58,30,0.10)",  Icon: XCircle       },
}

const PROJECT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PLANNING:  { label: "Planning",  color: "#7A4F1E", bg: "rgba(122,79,30,0.10)"  },
  ACTIVE:    { label: "Active",    color: "#1D4731", bg: "rgba(29,71,49,0.10)"   },
  ON_HOLD:   { label: "On Hold",  color: "#7A6E60", bg: "rgba(122,110,96,0.10)" },
  CANCELLED: { label: "Cancelled",color: "#B03A1E", bg: "rgba(176,58,30,0.10)"  },
  COMPLETED: { label: "Completed",color: "#2A7A4B", bg: "rgba(42,122,75,0.10)"  },
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm font-medium" style={{ color: "#7A6E60" }}>No {label} yet.</p>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-black/[0.06] p-4 space-y-2" style={{ background: "#fff" }}>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ── Sessions tab ──────────────────────────────────────────────
function SessionsTab({ groupId }: { groupId: string }) {
  const { data: barazaGroups = [] } = useQuery({
    queryKey: ["baraza-groups"],
    queryFn: () => integrationApi.getBarazaGroups(),
    staleTime: 60_000,
  })

  const barazaGroup = barazaGroups.find((bg) => bg.groupId === groupId)

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["baraza-sessions", barazaGroup?.id],
    queryFn: () => integrationApi.getSessions(barazaGroup!.id),
    enabled: !!barazaGroup,
    staleTime: 60_000,
  })

  if (!barazaGroup) {
    return (
      <div className="py-12 text-center space-y-2">
        <CalendarDays className="h-8 w-8 mx-auto" style={{ color: "rgba(14,11,8,0.2)" }} />
        <p className="text-sm" style={{ color: "#7A6E60" }}>
          No Telegram baraza registered for this group yet.
        </p>
      </div>
    )
  }

  if (isLoading) return <ListSkeleton />

  if (sessions.length === 0) {
    return (
      <div className="py-12 text-center space-y-2">
        <CalendarDays className="h-8 w-8 mx-auto" style={{ color: "rgba(14,11,8,0.2)" }} />
        <p className="text-sm" style={{ color: "#7A6E60" }}>No sessions recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => {
        const status = session.closedAt ? "closed" : session.openedAt ? "open" : "scheduled"
        const statusColor =
          status === "closed" ? "#1D4731" : status === "open" ? "#C9922A" : "#7A6E60"
        const statusBg =
          status === "closed"
            ? "rgba(29,71,49,0.10)"
            : status === "open"
              ? "rgba(201,146,42,0.12)"
              : "rgba(0,0,0,0.06)"
        return (
          <div
            key={session.id}
            className="rounded-xl px-4 py-3 flex items-start gap-3"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: statusBg, color: statusColor }}
            >
              <CalendarDays className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: "#1A120B" }}>
                  {new Date(session.scheduledAt).toLocaleDateString("en-KE", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize"
                  style={{ background: statusBg, color: statusColor }}
                >
                  {status}
                </span>
              </div>
              {session.closedAt && (
                <p className="text-xs mt-0.5" style={{ color: "#7A6E60" }}>
                  Closed at{" "}
                  {new Date(session.closedAt).toLocaleTimeString("en-KE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Proposals tab ─────────────────────────────────────────────

function ProposalsTab({ groupId, canCreate }: { groupId: string; canCreate: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["group-proposals", groupId],
    queryFn: () => governanceApi.getProposals({ groupId, limit: 30 }),
    staleTime: 30_000,
  })
  const proposals = data?.proposals ?? []

  return (
    <div className="space-y-3">
      {canCreate && (
        <Link
          href={`/proposals/create?groupId=${groupId}`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-xs font-bold transition-all hover:scale-[1.01]"
          style={{ background: "#1D4731", color: "#fff" }}
        >
          <Plus className="h-3.5 w-3.5" />
          Create Proposal
        </Link>
      )}
      {isLoading ? <ListSkeleton /> : proposals.length === 0 ? <EmptyState label="proposals" /> : (
        <div className="space-y-3">
          {proposals.map((p) => {
            const cfg = PROPOSAL_STATUS[p.status] ?? PROPOSAL_STATUS.DRAFT
            const { Icon, color, bg, label } = cfg
            return (
              <Link key={p.id} href={`/proposals/${p.id}`} className="block group">
                <div className="rounded-xl border border-black/[0.06] p-4 hover:border-black/[0.12] hover:shadow-sm transition-all" style={{ background: "#fff" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[#1D4731] transition-colors" style={{ color: "#0E0B08" }}>
                        {p.title}
                      </p>
                      {p.description && (
                        <p className="text-xs mt-1 line-clamp-1" style={{ color: "rgba(14,11,8,0.50)" }}>{p.description}</p>
                      )}
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#1D4731" }} />
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color, background: bg }}>
                      <Icon className="h-2.5 w-2.5" />
                      {label}
                    </span>
                    {(p._count?.votes ?? 0) > 0 && (
                      <span className="text-[10px] font-medium" style={{ color: "#7A6E60" }}>
                        {p._count!.votes} votes
                      </span>
                    )}
                    <span className="text-[10px] ml-auto" style={{ color: "#7A6E60" }}>{formatDate(p.createdAt)}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Elections tab ─────────────────────────────────────────────

function ElectionsTab({ groupId }: { groupId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["group-elections", groupId],
    queryFn: () => electionsApi.listElections({ groupId, limit: 30 }),
    staleTime: 30_000,
  })
  const elections = data?.elections ?? []

  return (
    <div className="space-y-3">
      {isLoading ? <ListSkeleton /> : elections.length === 0 ? <EmptyState label="elections" /> : (
        <div className="space-y-3">
          {elections.map((e) => {
            const statusColor =
              e.status === "VOTING_OPEN"        ? "#C9922A"
              : e.status === "NOMINATIONS_OPEN" ? "#2A7A4B"
              : "#888"
            return (
              <Link key={e.id} href={`/elections/${e.id}`} className="block group">
                <div className="rounded-xl border border-black/[0.06] p-4 hover:border-black/[0.12] hover:shadow-sm transition-all" style={{ background: "#fff" }}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold leading-snug group-hover:text-[#1D4731] transition-colors" style={{ color: "#0E0B08" }}>
                      {e.roleKey.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                    <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#1D4731" }} />
                  </div>
                  <div className="flex items-center gap-3 mt-3 flex-wrap text-[10px]">
                    <span className="font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: statusColor, background: `${statusColor}22` }}>
                      {e.status.replace(/_/g, " ")}
                    </span>
                    <span className="flex items-center gap-1" style={{ color: "#7A6E60" }}>
                      <Users className="h-2.5 w-2.5" />
                      {e.candidateCount} candidate{e.candidateCount !== 1 ? "s" : ""}
                    </span>
                    {e.status === "VOTING_OPEN" && (
                      <span className="ml-auto" style={{ color: "#7A6E60" }}>
                        Closes {formatDate(e.votingCloseAt)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Projects tab ──────────────────────────────────────────────

function ProjectsTab({ groupId, canCreate }: { groupId: string; canCreate: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["group-projects", groupId],
    queryFn: () => projectApi.getProjects({ ownerGroupId: groupId, limit: 30 }),
    staleTime: 30_000,
  })
  const projects = data?.projects ?? []

  return (
    <div className="space-y-3">
      {canCreate && (
        <Link
          href={`/proposals/create?groupId=${groupId}`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-xs font-bold transition-all hover:scale-[1.01]"
          style={{ background: "#1D4731", color: "#fff" }}
        >
          <Plus className="h-3.5 w-3.5" />
          Create Project
        </Link>
      )}
      {isLoading ? <ListSkeleton /> : projects.length === 0 ? <EmptyState label="projects" /> : (
        <div className="space-y-3">
          {projects.map((p) => {
            const cfg = PROJECT_STATUS[p.status] ?? PROJECT_STATUS.PLANNING
            const progress = p.milestonesCount > 0
              ? Math.round((p.completedMilestonesCount / p.milestonesCount) * 100)
              : null
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="block group">
                <div className="rounded-xl border border-black/[0.06] p-4 hover:border-black/[0.12] hover:shadow-sm transition-all" style={{ background: "#fff" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[#1D4731] transition-colors" style={{ color: "#0E0B08" }}>
                        {p.title}
                      </p>
                      {p.description && (
                        <p className="text-xs mt-1 line-clamp-1" style={{ color: "rgba(14,11,8,0.50)" }}>{p.description}</p>
                      )}
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#1D4731" }} />
                  </div>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>
                      {cfg.label}
                    </span>
                    {progress !== null && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <div className="h-1 w-16 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.07)" }}>
                          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "#1D4731" }} />
                        </div>
                        <span className="text-[10px]" style={{ color: "#7A6E60" }}>
                          {p.completedMilestonesCount}/{p.milestonesCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Hub ───────────────────────────────────────────────────────

// Primary tabs shown in mobile bottom nav; secondary tabs in More drawer
const PRIMARY_TABS: HubTab[] = ["feed", "proposals", "projects", "members"]

function GroupHub({ groupId }: { groupId: string }) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<HubTab>("feed")
  const [groupMoreOpen, setGroupMoreOpen] = useState(false)

  const { data: group, isLoading, error } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => apiClient.getGroup(groupId),
  })

  const isMember = !!group?.userRole
  const isLeader = group?.userRole === "LEADER"
  const canCreate =
    isMember &&
    (user?.verificationLevel === "COMMUNITY_VERIFIED" ||
      user?.verificationLevel === "FULL_VERIFIED")

  const ALL_TABS: { id: HubTab; label: string; Icon: React.ElementType }[] = [
    { id: "feed",      label: "Feed",      Icon: Rss        },
    { id: "proposals", label: "Proposals", Icon: Vote       },
    { id: "elections", label: "Elections", Icon: ScrollText },
    { id: "projects",  label: "Projects",  Icon: Briefcase  },
    { id: "treasury",  label: "Treasury",  Icon: Landmark   },
    { id: "members",   label: "Members",   Icon: Users        },
    { id: "sessions",  label: "Sessions",  Icon: CalendarDays },
    ...(isLeader && !group?.isSystem ? [{ id: "admin" as HubTab, label: "Admin", Icon: Settings }] : []),
  ]

  // Contextual bottom nav — primary tabs + More
  useContextualNav(
    () => [
      ...PRIMARY_TABS.map((id) => {
        const tab = ALL_TABS.find(t => t.id === id)!
        return {
          key: id,
          label: tab.label,
          icon: tab.Icon,
          active: activeTab === id,
          onClick: () => { setActiveTab(id); setGroupMoreOpen(false) },
        }
      }),
      {
        key: "more",
        label: "More",
        icon: MoreHorizontal,
        active: !PRIMARY_TABS.includes(activeTab),
        onClick: () => setGroupMoreOpen(true),
      },
    ],
    [activeTab, groupId]
  )

  const TABS = ALL_TABS

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="flex gap-4">
          <Skeleton className="w-14 h-14 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <ListSkeleton />
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-sm font-medium" style={{ color: "#B03A1E" }}>Failed to load community.</p>
        <Link href="/groups" className="text-xs mt-2 inline-block" style={{ color: "#1D4731" }}>← Back to communities</Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <GroupHeader group={group} groupId={groupId} />

      {/* Tab strip — desktop only, mobile uses bottom nav */}
      <div
        className="hidden md:block sticky top-[52px] z-30 backdrop-blur-sm border-b"
        style={{ background: "rgba(247,242,232,0.95)", borderColor: "rgba(14,11,8,0.06)" }}
      >
        <div className="flex gap-0 overflow-x-auto scrollbar-none max-w-3xl mx-auto px-4">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex items-center gap-1.5 px-3 py-3.5 text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors"
              style={
                activeTab === id
                  ? id === "admin"
                    ? { color: "#C9922A", borderBottom: "2px solid #C9922A" }
                    : { color: "#1D4731", borderBottom: "2px solid #1D4731" }
                  : { color: "#7A6E60" }
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-4 pb-28">
        {activeTab === "feed"      && <FeedTab group={group} />}
        {activeTab === "proposals" && <ProposalsTab groupId={groupId} canCreate={canCreate} />}
        {activeTab === "elections" && <ElectionsTab groupId={groupId} />}
        {activeTab === "projects"  && <ProjectsTab groupId={groupId} canCreate={canCreate} />}
        {activeTab === "treasury"  && (
          isMember
            ? <GroupTreasuryCard groupId={groupId} />
            : <div className="py-12 text-center">
                <p className="text-sm" style={{ color: "#7A6E60" }}>Join this group to view the treasury.</p>
              </div>
        )}
        {activeTab === "members"   && <GroupMembers groupId={groupId} />}
        {activeTab === "sessions"  && <SessionsTab groupId={groupId} />}
        {activeTab === "admin"     && isLeader && !group.isSystem && (
          <LeaderAdminPanel group={group} />
        )}
      </div>

      {/* Group More drawer — secondary tabs + back to community */}
      <Drawer open={groupMoreOpen} onOpenChange={setGroupMoreOpen}>
        <DrawerContent className="rounded-t-[24px]" style={{ background: "#17382A", border: "1px solid rgba(212,145,30,0.12)" }}>
          <DrawerHeader className="flex items-center justify-between px-5 pt-6 pb-2">
            <div>
              <DrawerTitle className="font-serif text-cream text-[17px] leading-tight">{group.groupName}</DrawerTitle>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(247,242,232,0.40)" }}>
                {group.voluntaryType?.replace(/_/g, " ") ?? group.systemType ?? "Group"}
              </p>
            </div>
            <button onClick={() => setGroupMoreOpen(false)}
              className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(247,242,232,0.07)", border: "1px solid rgba(247,242,232,0.06)" }}>
              <X className="h-3.5 w-3.5 text-cream opacity-60" />
            </button>
          </DrawerHeader>

          <div className="px-4 pb-10 mt-1 space-y-5">
            {/* Secondary tabs */}
            <div>
              <p className="px-1 pb-2 text-[9px] font-bold tracking-[2.5px] uppercase"
                style={{ color: "rgba(212,145,30,0.55)" }}>More</p>
              <div className="space-y-0.5">
                {TABS.filter(t => !PRIMARY_TABS.includes(t.id)).map(({ id, label, Icon }) => (
                  <button key={id}
                    onClick={() => { setActiveTab(id); setGroupMoreOpen(false) }}
                    className="w-full flex items-center gap-3.5 px-2 py-3 rounded-xl transition-all"
                    style={{ background: activeTab === id ? "rgba(212,145,30,0.12)" : "transparent" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: activeTab === id ? "rgba(212,145,30,0.20)" : "rgba(247,242,232,0.07)" }}>
                      <Icon className="h-[18px] w-[18px]"
                        style={{ color: activeTab === id ? "#E9A52E" : "rgba(247,242,232,0.55)" }} />
                    </div>
                    <span className="text-[14px] font-medium"
                      style={{ color: activeTab === id ? "#E9A52E" : "rgba(247,242,232,0.85)" }}>
                      {label}
                    </span>
                    {activeTab === id && <div className="ml-auto h-2 w-2 rounded-full" style={{ background: "#E9A52E" }} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Back to community */}
            <div>
              <p className="px-1 pb-2 text-[9px] font-bold tracking-[2.5px] uppercase"
                style={{ color: "rgba(212,145,30,0.55)" }}>Navigate</p>
              <Link href="/groups" onClick={() => setGroupMoreOpen(false)}
                className="flex items-center gap-3.5 px-2 py-3 rounded-xl transition-all"
                style={{ background: "transparent" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(247,242,232,0.07)" }}>
                  <ChevronLeft className="h-[18px] w-[18px]" style={{ color: "rgba(247,242,232,0.55)" }} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[14px] font-medium" style={{ color: "rgba(247,242,232,0.85)" }}>Back to Community</p>
                  <p className="text-[11px]" style={{ color: "rgba(247,242,232,0.35)" }}>Return to your community hub</p>
                </div>
              </Link>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <ProtectedRoute>
      <GroupHub groupId={id} />
    </ProtectedRoute>
  )
}
