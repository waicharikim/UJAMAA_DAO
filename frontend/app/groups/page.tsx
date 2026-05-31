"use client"

import React, { useState, useCallback, useRef, useEffect } from "react"
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query"
import Link from "next/link"
import Image from "next/image"
import {
  communityApi, governanceApi, leaderboardApi, postsApi,
  type GroupDiscoveryDto, type GroupMembershipDto,
  type LeaderboardEntryDto, type ProposalDto, type PostType,
} from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useContextualNav } from "@/hooks/use-contextual-nav"
import { PostCard, TYPE_CONFIG } from "@/components/feed/post-card"
import { GroupTreasuryCard } from "@/components/groups/group-treasury-card"
import {
  Home, Building2, Landmark, Globe, MapPin, Users, Plus, Search,
  ChevronRight, Trophy, Star, Zap, BarChart3, Medal, Award,
  ShieldCheck, Loader2, Vote, X, MoreHorizontal, Navigation,
  Rss, RefreshCw, Send, Scale, AlertTriangle, User, LayoutDashboard,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer"

// ─── Types ─────────────────────────────────────────────────────────────────

type HierarchyLevel = "ward" | "constituency" | "county" | "national"
type CommunityContext = "home" | "origin" | "visiting"

interface HierarchyInfo {
  wardId?: string
  wardName?: string
  constituencyId?: string
  constituencyName?: string
  countyId?: string
  countyName?: string
}

// ─── Hierarchy helpers ──────────────────────────────────────────────────────

const LEVEL_META: Record<HierarchyLevel, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  ward:         { icon: Home,     label: "Ward",         color: "#1A6B3C", bg: "rgba(26,107,60,0.08)"  },
  constituency: { icon: Building2,label: "Constituency", color: "#7A4F1E", bg: "rgba(122,79,30,0.08)"  },
  county:       { icon: Landmark, label: "County",       color: "#1D4731", bg: "rgba(29,71,49,0.08)"   },
  national:     { icon: Globe,    label: "Kenya",        color: "#C9922A", bg: "rgba(201,146,42,0.08)" },
}

function levelName(level: HierarchyLevel, h: HierarchyInfo): string {
  if (level === "ward")         return h.wardName ?? "Ward"
  if (level === "constituency") return h.constituencyName ?? "Constituency"
  if (level === "county")       return h.countyName ?? "County"
  return "Kenya"
}

function levelGroupQuery(level: HierarchyLevel, h: HierarchyInfo) {
  if (level === "ward")         return { wardId: h.wardId }
  if (level === "constituency") return { constituencyId: h.constituencyId }
  if (level === "county")       return { countyId: h.countyId }
  return {}
}

// ─── Context switcher pill ──────────────────────────────────────────────────

function ContextSwitcher({
  ctx, setCtx, hasOrigin, visiting,
  onCheckin, onClearVisit,
}: {
  ctx: CommunityContext
  setCtx: (c: CommunityContext) => void
  hasOrigin: boolean
  visiting?: { wardName: string; until: string }
  onCheckin: () => void
  onClearVisit: () => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => setCtx("home")}
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all"
        style={ctx === "home"
          ? { background: "#1D4731", color: "#F7F2E8" }
          : { background: "rgba(29,71,49,0.07)", color: "#1D4731" }}
      >
        <Home className="h-3 w-3" /> Home
      </button>

      {hasOrigin && (
        <button
          onClick={() => setCtx("origin")}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all"
          style={ctx === "origin"
            ? { background: "#7A4F1E", color: "#F7F2E8" }
            : { background: "rgba(122,79,30,0.07)", color: "#7A4F1E" }}
        >
          <MapPin className="h-3 w-3" /> Origin
        </button>
      )}

      {visiting ? (
        <button
          onClick={() => setCtx("visiting")}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all"
          style={ctx === "visiting"
            ? { background: "#B03A1E", color: "#F7F2E8" }
            : { background: "rgba(176,58,30,0.07)", color: "#B03A1E" }}
        >
          <Navigation className="h-3 w-3" />
          {visiting.wardName}
          <button
            onClick={(e) => { e.stopPropagation(); onClearVisit() }}
            className="ml-1 opacity-60 hover:opacity-100"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </button>
      ) : (
        <button
          onClick={onCheckin}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium border transition-all"
          style={{ borderColor: "rgba(0,0,0,0.10)", color: "#7A6E60", background: "transparent" }}
        >
          <Navigation className="h-3 w-3" /> Check in
        </button>
      )}
    </div>
  )
}

// ─── Hierarchy breadcrumb ───────────────────────────────────────────────────

function HierarchyBreadcrumb({
  level, setLevel, h,
}: {
  level: HierarchyLevel
  setLevel: (l: HierarchyLevel) => void
  h: HierarchyInfo
}) {
  const levels: HierarchyLevel[] = ["ward", "constituency", "county", "national"]
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {levels.map((l, i) => {
        const active = l === level
        const { color } = LEVEL_META[l]
        const name = levelName(l, h)
        return (
          <span key={l} className="flex items-center gap-1">
            <button
              onClick={() => setLevel(l)}
              className="text-[12px] font-semibold rounded-md px-2 py-0.5 transition-all"
              style={active
                ? { background: `${color}18`, color }
                : { color: "rgba(14,11,8,0.35)" }}
            >
              {name}
            </button>
            {i < levels.length - 1 && (
              <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: "rgba(14,11,8,0.20)" }} />
            )}
          </span>
        )
      })}
    </div>
  )
}

// ─── Level hero card ────────────────────────────────────────────────────────

const LEVEL_HERO: Record<HierarchyLevel, string> = {
  ward:         "https://images.unsplash.com/photo-1494389945381-0c69f0f3e5a1?w=800&q=80",
  constituency: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
  county:       "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=800&q=80",
  national:     "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80",
}

function LevelHero({
  level, h, myGroups,
}: {
  level: HierarchyLevel
  h: HierarchyInfo
  myGroups: GroupMembershipDto[]
}) {
  const { icon: Icon, color } = LEVEL_META[level]
  const name = levelName(level, h)
  const systemGroup = myGroups.find((g) =>
    g.isSystem && g.systemType === level.toUpperCase()
  )

  return (
    <div className="relative h-36 rounded-2xl overflow-hidden">
      <img
        src={LEVEL_HERO[level]}
        alt={name}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(160deg, rgba(14,11,8,0.75) 0%, rgba(14,11,8,0.35) 100%)" }}
      />
      <div className="absolute inset-0 flex flex-col justify-end p-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${color}30`, border: `1px solid ${color}40` }}>
            <Icon className="h-3.5 w-3.5" style={{ color }} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
            {LEVEL_META[level].label}
          </span>
        </div>
        <h2 className="text-xl font-serif font-bold text-white leading-tight">{name}</h2>
        {systemGroup && (
          <p className="text-[11px] text-white/50 mt-0.5">
            {systemGroup.memberCount?.toLocaleString() ?? "—"} members
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Level proposals ────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  VOTING_OPEN:    { label: "Voting",   color: "#1A6B3C" },
  PENDING_REVIEW: { label: "Review",   color: "#7A4F1E" },
  DRAFT:          { label: "Draft",    color: "#999"    },
  PASSED:         { label: "Passed",   color: "#1E3D2F" },
  FAILED:         { label: "Failed",   color: "#B03A1E" },
}

function LevelProposals({ level, h, groupId }: { level: HierarchyLevel; h: HierarchyInfo; groupId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["level-proposals", level, groupId],
    queryFn: () => governanceApi.getProposals({ groupId, limit: 8 }),
    staleTime: 60_000,
    enabled: !!groupId,
  })

  const createHref = groupId ? `/proposals/create?groupId=${groupId}` : "/proposals/create"

  if (!groupId) return (
    <div className="text-center py-10" style={{ color: "rgba(14,11,8,0.35)" }}>
      <Vote className="h-8 w-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm">Join this community to see its proposals.</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {/* Create button */}
      <Link href={createHref}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.01]"
        style={{ background: "#1D4731", color: "#fff" }}>
        <Plus className="h-3.5 w-3.5" /> Create Proposal
      </Link>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : !data?.proposals?.length ? (
        <div className="text-center py-10" style={{ color: "rgba(14,11,8,0.35)" }}>
          <Vote className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No proposals yet. Start one.</p>
        </div>
      ) : (
        <>
          {data.proposals.map((p: ProposalDto) => {
            const badge = STATUS_BADGE[p.status] ?? { label: p.status, color: "#999" }
            return (
              <Link key={p.id} href={`/proposals/${p.id}`}
                className="flex items-start gap-3 p-3 rounded-xl border transition-all hover:shadow-sm"
                style={{ border: "1px solid rgba(29,71,49,0.08)", background: "#fff" }}>
                <Vote className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#1E3D2F" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0E0B08] line-clamp-2 leading-snug">{p.title}</p>
                  {p.group && <p className="text-[11px] mt-0.5" style={{ color: "rgba(14,11,8,0.4)" }}>{p.group.name}</p>}
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: `${badge.color}18`, color: badge.color }}>
                  {badge.label}
                </span>
              </Link>
            )
          })}
          <Link href="/proposals" className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold"
            style={{ color: "#1A6B3C" }}>
            All proposals <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </>
      )}
    </div>
  )
}

// ─── Leaderboard panel ──────────────────────────────────────────────────────

const LB_METRICS = [
  { value: "combined", label: "All",    icon: BarChart3 },
  { value: "ip",       label: "Impact", icon: Star      },
  { value: "pr",       label: "Rep",    icon: Zap       },
] as const
type LbMetric = typeof LB_METRICS[number]["value"]

function LevelLeaderboard({ level, h }: { level: HierarchyLevel; h: HierarchyInfo }) {
  const { user } = useAuth()
  const [metric, setMetric] = useState<LbMetric>("combined")

  const scope = level === "national" ? "global" : level === "county" ? "county" : level === "constituency" ? "county" : "ward"
  const scopeId = level === "ward" ? h.wardId : level === "constituency" ? h.constituencyId : h.countyId

  const { data, isLoading } = useQuery({
    queryKey: ["level-lb", level, metric, scopeId],
    queryFn: () => leaderboardApi.getLeaderboard({ metric, scope, scopeId, limit: 20 }),
    staleTime: 120_000,
    enabled: level === "national" || !!scopeId,
  })

  const score = (e: LeaderboardEntryDto) =>
    metric === "ip" ? e.globalImpactPoints : metric === "pr" ? e.participationRights : e.combinedScore
  const unit = metric === "ip" ? "IP" : metric === "pr" ? "PR" : "pts"

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {LB_METRICS.map(({ value, label, icon: Icon }) => (
          <button key={value} onClick={() => setMetric(value)}
            className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
            style={metric === value ? { background: "#C9922A", color: "#fff" } : { background: "rgba(201,146,42,0.08)", color: "#C9922A" }}>
            <Icon className="h-3 w-3" />{label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
      ) : !data?.entries?.length ? (
        <div className="text-center py-10" style={{ color: "rgba(14,11,8,0.35)" }}>
          <Medal className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No data yet.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.entries.map((e) => {
            const isMe = user?.id === e.userId
            return (
              <div key={e.userId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{
                  background: isMe ? "rgba(201,146,42,0.07)" : "white",
                  border: isMe ? "1px solid rgba(201,146,42,0.25)" : "1px solid rgba(29,71,49,0.07)",
                }}>
                <div className="w-6 flex items-center justify-center flex-shrink-0">
                  {e.rank <= 3
                    ? <span className="text-base">{e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : "🥉"}</span>
                    : <span className="text-[12px] font-bold" style={{ color: "#999" }}>{e.rank}</span>}
                </div>
                <Avatar className="h-8 w-8 rounded-xl flex-shrink-0">
                  <AvatarImage src={e.avatarUrl} />
                  <AvatarFallback className="rounded-xl bg-[#1D4731] text-white text-xs font-bold">
                    {(e.name || "U")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: "#1A120B" }}>
                    {e.name}
                    {isMe && <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ color: "#C9922A", background: "rgba(201,146,42,0.10)" }}>You</span>}
                  </p>
                </div>
                <span className="text-[13px] font-bold flex-shrink-0" style={{ color: "#1A120B" }}>
                  {score(e).toLocaleString()}
                  <span className="text-[10px] ml-0.5 font-normal opacity-50">{unit}</span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Level members ──────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<string, string> = {
  FULL_VERIFIED:      "#1A6B3C",
  COMMUNITY_VERIFIED: "#7A4F1E",
  PHONE_VERIFIED:     "#1E3D2F",
  EMAIL_VERIFIED:     "#555",
}

function LevelMembers({ level, h }: { level: HierarchyLevel; h: HierarchyInfo }) {
  // Members are only available at ward level — other levels show leaderboard
  if (level !== "ward" || !h.wardId) {
    return <LevelLeaderboard level={level} h={h} />
  }

  const { data: members, isLoading } = useQuery({
    queryKey: ["ward-members", h.wardId],
    queryFn: () => import("@/lib/api").then(m => m.userApi.getWardMembers(h.wardId!)),
    staleTime: 120_000,
  })

  if (isLoading) return (
    <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
  )
  if (!members?.length) return (
    <div className="text-center py-10" style={{ color: "rgba(14,11,8,0.35)" }}>
      <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm">No members found.</p>
    </div>
  )

  const counts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.verificationLevel] = (acc[m.verificationLevel] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(counts).map(([level, count]) => (
          <span key={level} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${LEVEL_COLOR[level] ?? "#555"}18`, color: LEVEL_COLOR[level] ?? "#555" }}>
            {count} {level.replace(/_/g, " ")}
          </span>
        ))}
      </div>
      <div className="space-y-1">
        {members.map((m, i) => (
          <div key={m.id} className="flex items-center gap-3 py-2.5 border-b last:border-0"
            style={{ borderColor: "rgba(26,18,11,0.06)" }}>
            <span className="w-5 text-xs font-bold text-center" style={{ color: "rgba(14,11,8,0.3)" }}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0E0B08] truncate">{m.name}</p>
              <p className="text-[10px]" style={{ color: LEVEL_COLOR[m.verificationLevel] ?? "#555" }}>
                {m.verificationLevel.replace(/_/g, " ")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Level feed ─────────────────────────────────────────────────────────────

const SCOPE_MAP: Record<HierarchyLevel, string> = {
  ward: "WARD", constituency: "CONSTITUENCY", county: "COUNTY", national: "NATIONAL",
}

function LevelFeed({ level, h }: { level: HierarchyLevel; h: HierarchyInfo }) {
  const { user, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const scope = SCOPE_MAP[level] as PostType // reuse PostType for scope label

  // Derived
  const locationParams = {
    ...(h.wardId         ? { wardId: h.wardId }                 : {}),
    ...(h.constituencyId ? { constituencyId: h.constituencyId } : {}),
    ...(h.countyId       ? { countyId: h.countyId }             : {}),
  }
  const { color } = LEVEL_META[level]

  // Hooks
  const [content, setContent]   = useState("")
  const [focused, setFocused]   = useState(false)
  const [postType, setPostType] = useState<PostType>("NOTICE")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typeCfg = TYPE_CONFIG[postType]

  const canPost =
    isAuthenticated &&
    (user?.verificationLevel === "COMMUNITY_VERIFIED" ||
      user?.verificationLevel === "FULL_VERIFIED")

  const postMutation = useMutation({
    mutationFn: () =>
      postsApi.createPost({
        content: content.trim(),
        scope: SCOPE_MAP[level] as any,
        type: postType,
        wardId: h.wardId,
      }),
    onSuccess: () => {
      setContent("")
      setFocused(false)
      queryClient.invalidateQueries({ queryKey: ["level-feed", level, h.wardId, h.constituencyId, h.countyId] })
    },
  })

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [content])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } =
    useInfiniteQuery({
      queryKey: ["level-feed", level, h.wardId, h.constituencyId, h.countyId],
      queryFn: ({ pageParam }) =>
        postsApi.getPosts({ scope: SCOPE_MAP[level] as any, ...locationParams, cursor: pageParam as string | undefined }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      staleTime: 30_000,
      enabled: level === "national" || !!(h.wardId || h.constituencyId || h.countyId),
    })

  const posts = data?.pages.flatMap(p => p.items) ?? []

  return (
    <div className="space-y-3">
      {/* Compose */}
      {isAuthenticated && (canPost ? (
        <div className="rounded-2xl overflow-hidden bg-white"
          style={{ boxShadow: focused ? "0 0 0 2px rgba(201,146,42,0.30), 0 1px 6px rgba(14,11,8,0.07)" : "0 1px 6px rgba(14,11,8,0.07), 0 0 0 1px rgba(14,11,8,0.04)", transition: "box-shadow 0.15s" }}>
          {/* Context label */}
          <div className="flex items-center gap-2 px-4 pt-3">
            <span className="text-[11px]" style={{ color: "rgba(14,11,8,0.35)" }}>Posting to</span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: `${color}18`, color }}>
              {levelName(level, h)}
            </span>
          </div>
          {/* Type pills */}
          <div className="flex gap-1 px-3 pt-2.5">
            {(["NOTICE", "ANNOUNCEMENT", "RESOURCE"] as PostType[]).map(t => {
              const Cfg = TYPE_CONFIG[t]
              const TypeIcon = Cfg.icon
              return (
                <button key={t} onClick={() => setPostType(t)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                  style={postType === t
                    ? { background: Cfg.bg, color: Cfg.color }
                    : { background: "rgba(14,11,8,0.04)", color: "rgba(14,11,8,0.40)" }}>
                  <TypeIcon className="h-2.5 w-2.5" />
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              )
            })}
          </div>
          {/* Textarea */}
          <div className="flex gap-3 px-4 pt-3 pb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold"
              style={{ background: typeCfg.bg, color: typeCfg.color }}>
              {user?.email?.slice(0, 2).toUpperCase() ?? "Me"}
            </div>
            <textarea ref={textareaRef} value={content}
              onChange={e => setContent(e.target.value)}
              onFocus={() => setFocused(true)}
              placeholder={typeCfg.placeholder}
              rows={1} maxLength={500}
              className="w-full flex-1 resize-none bg-transparent text-[14px] leading-relaxed outline-none"
              style={{ color: "#0E0B08", minHeight: "24px" }} />
          </div>
          {(focused || content.length > 0) && (
            <div className="flex items-center justify-between px-4 pb-3 pt-1 border-t"
              style={{ borderColor: "rgba(14,11,8,0.06)" }}>
              <span className="text-[11px]" style={{ color: content.length > 450 ? "#C9922A" : "rgba(14,11,8,0.30)" }}>
                {content.length}/500
              </span>
              <button
                onClick={() => postMutation.mutate()}
                disabled={!content.trim() || postMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-bold disabled:opacity-40 transition-all"
                style={{ background: "#1D4731", color: "#fff" }}>
                {postMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Post
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl"
          style={{ background: "rgba(29,71,49,0.05)", border: "1px solid rgba(29,71,49,0.10)" }}>
          <p className="text-xs" style={{ color: "#7A6E60" }}>
            Community verification required to post.
          </p>
          <Link href="/profile#verification"
            className="text-[11px] font-bold px-3 py-1.5 rounded-full flex-shrink-0"
            style={{ background: "#1D4731", color: "#fff" }}>
            Verify
          </Link>
        </div>
      ))}

      {/* Feed list */}
      <div className="rounded-2xl overflow-hidden bg-white"
        style={{ boxShadow: "0 1px 6px rgba(14,11,8,0.07), 0 0 0 1px rgba(14,11,8,0.04)" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "rgba(14,11,8,0.06)" }}>
          <span className="text-xs font-semibold" style={{ color: "#7A6E60" }}>
            {levelName(level, h)} updates
          </span>
          <button onClick={() => refetch()} disabled={isRefetching}
            className="flex items-center gap-1 text-[11px] transition-opacity hover:opacity-70"
            style={{ color: "#7A6E60" }}>
            <RefreshCw className={`h-3 w-3 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="divide-y" style={{ borderColor: "rgba(14,11,8,0.05)" }}>
            {[1,2,3].map(i => (
              <div key={i} className="flex gap-3 px-4 py-4">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <Skeleton className="h-3 w-28" /><Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium" style={{ color: "#7A6E60" }}>No posts yet.</p>
            <p className="text-xs mt-1" style={{ color: "rgba(14,11,8,0.35)" }}>
              Be the first to post to {levelName(level, h)}.
            </p>
          </div>
        ) : (
          <>
            {posts.map(post => <PostCard key={post.id} post={post} />)}
            {hasNextPage && (
              <div className="px-4 py-3 border-t" style={{ borderColor: "rgba(14,11,8,0.05)" }}>
                <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                  className="w-full text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5"
                  style={{ color: "#1D4731" }}>
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

// ─── Level content (tabbed) ─────────────────────────────────────────────────

function LevelContent({ level, h, groupId }: { level: HierarchyLevel; h: HierarchyInfo; groupId?: string }) {
  return (
    <Tabs defaultValue="feed">
      <TabsList className="w-full grid grid-cols-4 h-9 rounded-xl" style={{ background: "rgba(14,11,8,0.05)" }}>
        <TabsTrigger value="feed"      className="rounded-lg text-[11px] font-semibold">Feed</TabsTrigger>
        <TabsTrigger value="proposals" className="rounded-lg text-[11px] font-semibold">Proposals</TabsTrigger>
        <TabsTrigger value="treasury"  className="rounded-lg text-[11px] font-semibold">Treasury</TabsTrigger>
        <TabsTrigger value="members"   className="rounded-lg text-[11px] font-semibold">
          {level === "ward" ? "Members" : "Top"}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="feed"      className="mt-4"><LevelFeed level={level} h={h} /></TabsContent>
      <TabsContent value="proposals" className="mt-4"><LevelProposals level={level} h={h} groupId={groupId} /></TabsContent>
      <TabsContent value="treasury"  className="mt-4">
        {groupId ? (
          <GroupTreasuryCard groupId={groupId} />
        ) : (
          <div className="text-center py-10" style={{ color: "rgba(14,11,8,0.35)" }}>
            <p className="text-sm">Join this community to view the treasury.</p>
          </div>
        )}
      </TabsContent>
      <TabsContent value="members" className="mt-4"><LevelMembers level={level} h={h} /></TabsContent>
    </Tabs>
  )
}

// ─── My voluntary groups ────────────────────────────────────────────────────

function MyGroupsList({ level, h }: { level: HierarchyLevel; h: HierarchyInfo }) {
  const { data: groups = [], isLoading } = useQuery<GroupMembershipDto[]>({
    queryKey: ["my-groups-list"],
    queryFn: communityApi.getMyGroups,
    staleTime: 60_000,
  })

  const voluntary = groups.filter((g) => !g.isSystem)

  if (isLoading) return (
    <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
  )

  return (
    <div className="space-y-2">
      {voluntary.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: "rgba(14,11,8,0.35)" }}>
          No voluntary groups yet.
        </p>
      ) : (
        voluntary.map((g) => (
          <Link
            key={g.groupId}
            href={`/groups/${g.groupId}`}
            className="flex items-center gap-3 p-3.5 rounded-xl border bg-white hover:shadow-sm transition-shadow"
            style={{ border: "1px solid rgba(201,146,42,0.18)" }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(29,71,49,0.07)" }}>
              <Users className="h-4 w-4" style={{ color: "#1D4731" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0A1F14] truncate">{g.groupName}</p>
              <p className="text-[10px]" style={{ color: "rgba(14,11,8,0.4)" }}>
                {(g.voluntaryType ?? "Group").replace(/_/g, " ")}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {g.role === "LEADER" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(201,146,42,0.12)", color: "#C9922A" }}>
                  LEADER
                </span>
              )}
              <ChevronRight className="h-4 w-4" style={{ color: "rgba(201,146,42,0.5)" }} />
            </div>
          </Link>
        ))
      )}
      <Link
        href="/groups/create"
        className="flex items-center gap-2 p-3.5 rounded-xl border border-dashed transition-all hover:border-[#C9922A]/50"
        style={{ borderColor: "rgba(201,146,42,0.25)", color: "#C9922A" }}
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm font-semibold">Create a group</span>
        <span className="text-[11px] ml-auto opacity-60">100 PR</span>
      </Link>
    </div>
  )
}

// ─── Explore groups ─────────────────────────────────────────────────────────

function ExploreGroups({ level, h }: { level: HierarchyLevel; h: HierarchyInfo }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [joiningId, setJoiningId] = useState<string | null>(null)

  const locationFilter = levelGroupQuery(level, h)

  const { data, isLoading } = useQuery({
    queryKey: ["groups-explore", level, h.wardId, h.constituencyId, h.countyId, search],
    queryFn: () => communityApi.getGroups({
      ...locationFilter,
      search: search || undefined,
      limit: 30,
    }),
    staleTime: 30_000,
  })

  const joinMutation = useMutation({
    mutationFn: (id: string) => communityApi.joinGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups-explore"] })
      queryClient.invalidateQueries({ queryKey: ["my-groups-list"] })
      setJoiningId(null)
    },
    onError: () => setJoiningId(null),
  })

  const voluntary = (data?.groups ?? []).filter((g) => !g.isSystemGroup)

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#7A6E60" }} />
        <Input
          placeholder={`Search groups in ${levelName(level, h)}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white border-[#C9922A]/30 focus:border-[#C9922A] text-sm"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-2 grid-cols-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : voluntary.length === 0 ? (
        <div className="text-center py-10" style={{ color: "rgba(14,11,8,0.35)" }}>
          <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{search ? "No results." : `No voluntary groups in ${levelName(level, h)} yet.`}</p>
        </div>
      ) : (
        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3">
          {voluntary.map((g) => (
            <div key={g.id} className="rounded-xl overflow-hidden border bg-white"
              style={{ border: "1px solid rgba(201,146,42,0.18)" }}>
              <Link href={`/groups/${g.id}`} className="block p-3">
                <p className="text-[12px] font-semibold text-[#0A1F14] line-clamp-2 leading-tight">{g.name}</p>
                <p className="text-[10px] mt-1" style={{ color: "rgba(14,11,8,0.40)" }}>
                  {(g.voluntaryType ?? "Group").replace(/_/g, " ")} · {g.memberCount} members
                </p>
              </Link>
              <div className="px-3 pb-3">
                {g.isMember ? (
                  <span className="block text-center text-[10px] font-semibold py-1.5 rounded-full"
                    style={{ background: "rgba(29,71,49,0.08)", color: "#1E3D2F" }}>
                    {g.myRole ?? "Member"}
                  </span>
                ) : (
                  <button
                    onClick={() => { setJoiningId(g.id); joinMutation.mutate(g.id) }}
                    disabled={joiningId === g.id}
                    className="w-full py-1.5 rounded-full text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
                    style={{ background: "#D4911E", color: "#0A1F14" }}
                  >
                    {joiningId === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Join"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Check-in drawer ────────────────────────────────────────────────────────

function CheckInDrawer({
  open, onClose, onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (wardId: string, until: string) => void
}) {
  const [search, setSearch] = useState("")
  const [wardId, setWardId] = useState("")
  const [wardName, setWardName] = useState("")
  const [days, setDays] = useState(7)

  // Simplified: user types a ward name and we'll resolve via search
  // Full location picker (county → constituency → ward cascade) can be added later
  const handleConfirm = () => {
    if (!wardId) return
    const until = new Date()
    until.setDate(until.getDate() + days)
    onConfirm(wardId, until.toISOString())
    onClose()
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="rounded-t-[24px]" style={{ background: "#F7F2E8" }}>
        <DrawerHeader className="px-5 pt-6 pb-3">
          <DrawerTitle className="font-serif text-[18px] text-[#0E0B08]">Check in somewhere</DrawerTitle>
          <p className="text-[12px] mt-0.5" style={{ color: "rgba(14,11,8,0.45)" }}>
            See local content and earn IP for activities in another ward. No governance rights.
          </p>
        </DrawerHeader>
        <div className="px-5 pb-10 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#7A6E60" }}>
              Ward name
            </label>
            <Input
              placeholder="e.g. Mombasa Island"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white"
            />
            <p className="text-[10px]" style={{ color: "rgba(14,11,8,0.35)" }}>
              Full ward search coming soon — ask an admin to set this for you for now.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#7A6E60" }}>
              Duration
            </label>
            <div className="flex gap-2">
              {[3, 7, 14, 30].map((d) => (
                <button key={d} onClick={() => setDays(d)}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all"
                  style={days === d
                    ? { background: "#1D4731", color: "#F7F2E8" }
                    : { background: "rgba(29,71,49,0.07)", color: "#1D4731" }}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleConfirm}
            disabled={!search}
            className="w-full py-3 rounded-full font-bold text-sm transition-all disabled:opacity-40"
            style={{ background: "#D4911E", color: "#0A1F14" }}
          >
            Check in
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const { user } = useAuth()
  const [ctx, setCtx] = useState<CommunityContext>("home")
  const [level, setLevel] = useState<HierarchyLevel>("ward")
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [commMoreOpen, setCommMoreOpen] = useState(false)
  const queryClient = useQueryClient()

  // Resolve current hierarchy from context
  const homeHierarchy: HierarchyInfo = {
    wardId: user?.primaryWardId,
    wardName: user?.primaryWardName,
    constituencyId: user?.primaryConstituencyId,
    constituencyName: user?.primaryConstituencyName,
    countyId: user?.primaryCountyId,
    countyName: user?.primaryCountyName,
  }
  const originHierarchy: HierarchyInfo = {
    wardId: user?.secondaryWardId,
    wardName: user?.secondaryWardName,
    constituencyId: user?.secondaryConstituencyId,
    constituencyName: user?.secondaryConstituencyName,
    countyId: user?.secondaryCountyId,
    countyName: user?.secondaryCountyName,
  }
  const visitingHierarchy: HierarchyInfo = {
    wardId: user?.currentLocationId,
    wardName: user?.currentLocationWardName,
  }

  const h = ctx === "origin" ? originHierarchy
    : ctx === "visiting" ? visitingHierarchy
    : homeHierarchy

  const hasOrigin = !!user?.secondaryWardId
  const visiting = user?.currentLocationId
    ? { wardName: user.currentLocationWardName ?? "Visiting", until: user.currentLocationUntil ?? "" }
    : undefined

  // Visiting context can only show ward level
  const effectiveLevel: HierarchyLevel = ctx === "visiting" ? "ward" : level

  // My groups — used for system group lookup (treasury, proposals, hero member count)
  const { data: myGroups = [] } = useQuery<GroupMembershipDto[]>({
    queryKey: ["my-groups-list"],
    queryFn: communityApi.getMyGroups,
    staleTime: 60_000,
  })

  // Resolve the system group ID for the current level + hierarchy
  const systemGroupId = myGroups.find(g => {
    if (!g.isSystem) return false
    const t = effectiveLevel.toUpperCase()
    if (effectiveLevel === "ward")         return g.systemType === t && g.ward?.id === h.wardId
    if (effectiveLevel === "constituency") return g.systemType === t && g.constituency?.id === h.constituencyId
    if (effectiveLevel === "county")       return g.systemType === t && g.county?.id === h.countyId
    return g.systemType === "NATIONAL"
  })?.groupId

  const clearVisitMutation = useMutation({
    mutationFn: () => import("@/lib/api").then(m => m.userApi.clearTemporaryLocation()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] })
      setCtx("home")
    },
  })

  const checkinMutation = useMutation({
    mutationFn: ({ wardId, until }: { wardId: string; until: string }) =>
      import("@/lib/api").then(m => m.userApi.setTemporaryLocation(wardId, until)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] })
      setCtx("visiting")
    },
  })

  // Contextual bottom nav: Home | Ward | Constituency | County | More
  // National is in the More drawer — keeps the back-to-home path always visible.
  const navLevels: HierarchyLevel[] = ctx === "visiting" ? ["ward"] : ["ward", "constituency", "county"]

  useContextualNav(
    useCallback(() => [
      {
        key: "home",
        label: "Home",
        icon: LayoutDashboard,
        href: "/dashboard",
      },
      ...navLevels.map((l) => {
        const { icon } = LEVEL_META[l]
        return {
          key: l,
          label: levelName(l, h),
          icon,
          active: effectiveLevel === l,
          onClick: () => setLevel(l),
        }
      }),
      {
        key: "more",
        label: "More",
        icon: MoreHorizontal,
        onClick: () => setCommMoreOpen(true),
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [effectiveLevel, ctx, h.wardName, h.constituencyName, h.countyName]),
    [effectiveLevel, ctx, h.wardName, h.constituencyName, h.countyName]
  )

  if (!user?.primaryWardId) {
    return (
      <div className="container mx-auto px-4 py-12 flex flex-col items-center text-center gap-4">
        <MapPin className="h-12 w-12 opacity-30" style={{ color: "#1D4731" }} />
        <h2 className="text-xl font-serif font-bold text-[#0E0B08]">Set your home ward first</h2>
        <p className="text-sm" style={{ color: "rgba(14,11,8,0.5)" }}>
          Your ward is your community's governance unit. Add it to your profile to get started.
        </p>
        <Link href="/profile" className="mt-2 px-5 py-2.5 rounded-full font-bold text-sm"
          style={{ background: "#D4911E", color: "#0A1F14" }}>
          Go to Profile
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-5 max-w-2xl">

      {/* Context switcher + New Group — desktop only (mobile uses More drawer) */}
      <div className="hidden md:flex items-center justify-between gap-3 flex-wrap">
        <ContextSwitcher
          ctx={ctx} setCtx={setCtx}
          hasOrigin={hasOrigin} visiting={visiting}
          onCheckin={() => setCheckinOpen(true)}
          onClearVisit={() => clearVisitMutation.mutate()}
        />
        <Link
          href="/groups/create"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-bold"
          style={{ background: "#D4911E", color: "#0A1F14" }}
        >
          <Plus className="h-3.5 w-3.5" /> New Group
        </Link>
      </div>

      {/* Mobile context label — shows which hierarchy is active */}
      <div className="flex md:hidden items-center gap-2">
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={
            ctx === "visiting" ? { background: "rgba(176,58,30,0.08)", color: "#B03A1E" }
            : ctx === "origin" ? { background: "rgba(122,79,30,0.08)", color: "#7A4F1E" }
            : { background: "rgba(29,71,49,0.08)", color: "#1D4731" }
          }>
          {ctx === "visiting" ? "Visiting" : ctx === "origin" ? "Origin" : "Home"}
        </span>
        <span className="text-xs" style={{ color: "rgba(14,11,8,0.35)" }}>·</span>
        <span className="text-xs font-medium" style={{ color: "rgba(14,11,8,0.50)" }}>
          {levelName(effectiveLevel, h)}
        </span>
      </div>

      {/* Hierarchy breadcrumb — desktop / hidden on mobile visiting (always ward) */}
      {ctx !== "visiting" && (
        <div className="hidden md:block">
          <HierarchyBreadcrumb level={level} setLevel={setLevel} h={h} />
        </div>
      )}

      {/* Level hero */}
      <LevelHero level={effectiveLevel} h={h} myGroups={myGroups} />

      {/* Level content tabs */}
      <LevelContent level={effectiveLevel} h={h} groupId={systemGroupId} />

      {/* Divider */}
      <div className="pt-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: "rgba(14,11,8,0.08)" }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(14,11,8,0.30)" }}>
            Your Groups
          </span>
          <div className="flex-1 h-px" style={{ background: "rgba(14,11,8,0.08)" }} />
        </div>
      </div>

      {/* Voluntary groups */}
      <MyGroupsList level={effectiveLevel} h={h} />

      {/* Divider */}
      <div className="pt-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: "rgba(14,11,8,0.08)" }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(14,11,8,0.30)" }}>
            Discover
          </span>
          <div className="flex-1 h-px" style={{ background: "rgba(14,11,8,0.08)" }} />
        </div>
      </div>

      {/* Explore */}
      <ExploreGroups level={effectiveLevel} h={h} />

      {/* Check-in drawer */}
      <CheckInDrawer
        open={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        onConfirm={(wardId, until) => checkinMutation.mutate({ wardId, until })}
      />

      {/* Community More drawer */}
      <Drawer open={commMoreOpen} onOpenChange={setCommMoreOpen}>
        <DrawerContent className="rounded-t-[24px]" style={{ background: "#17382A", border: "1px solid rgba(212,145,30,0.12)" }}>
          <DrawerHeader className="flex items-center justify-between px-5 pt-6 pb-2">
            <DrawerTitle className="font-serif text-cream text-[18px]">Community</DrawerTitle>
            <button onClick={() => setCommMoreOpen(false)}
              className="h-8 w-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(247,242,232,0.07)", border: "1px solid rgba(247,242,232,0.06)" }}>
              <X className="h-3.5 w-3.5 text-cream opacity-60" />
            </button>
          </DrawerHeader>

          <div className="px-4 pb-10 mt-1 space-y-5">

            {/* Context switcher */}
            <div>
              <p className="px-1 pb-2 text-[9px] font-bold tracking-[2.5px] uppercase"
                style={{ color: "rgba(212,145,30,0.55)" }}>Your Communities</p>
              <div className="space-y-0.5">
                {([
                  { id: "home" as CommunityContext,    label: "Home",    sub: user?.primaryWardName ?? "Primary ward",    icon: Home    },
                  ...(hasOrigin ? [{ id: "origin" as CommunityContext, label: "Origin",  sub: user?.secondaryWardName ?? "Secondary ward", icon: MapPin  }] : []),
                  ...(visiting  ? [{ id: "visiting" as CommunityContext,label: "Visiting",sub: visiting.wardName,                          icon: Navigation }] : []),
                ] as { id: CommunityContext; label: string; sub: string; icon: React.ElementType }[]).map(({ id, label, sub, icon: Icon }) => (
                  <button key={id}
                    onClick={() => { setCtx(id); setCommMoreOpen(false) }}
                    className="w-full flex items-center gap-3.5 px-2 py-3 rounded-xl transition-all"
                    style={{ background: ctx === id ? "rgba(212,145,30,0.12)" : "transparent" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: ctx === id ? "rgba(212,145,30,0.20)" : "rgba(247,242,232,0.07)" }}>
                      <Icon className="h-[18px] w-[18px]"
                        style={{ color: ctx === id ? "#E9A52E" : "rgba(247,242,232,0.55)" }} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[14px] font-semibold"
                        style={{ color: ctx === id ? "#E9A52E" : "rgba(247,242,232,0.90)" }}>{label}</p>
                      <p className="text-[11px]" style={{ color: "rgba(247,242,232,0.40)" }}>{sub}</p>
                    </div>
                    {ctx === id && <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: "#E9A52E" }} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <p className="px-1 pb-2 text-[9px] font-bold tracking-[2.5px] uppercase"
                style={{ color: "rgba(212,145,30,0.55)" }}>Actions</p>
              <div className="space-y-0.5">
                <Link href="/groups/create" onClick={() => setCommMoreOpen(false)}
                  className="flex items-center gap-3.5 px-2 py-3 rounded-xl transition-all"
                  style={{ background: "transparent" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(212,145,30,0.12)" }}>
                    <Plus className="h-[18px] w-[18px]" style={{ color: "#E9A52E" }} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[14px] font-semibold" style={{ color: "rgba(247,242,232,0.90)" }}>Create Group</p>
                    <p className="text-[11px]" style={{ color: "rgba(247,242,232,0.40)" }}>100 PR · starts a new voluntary group</p>
                  </div>
                </Link>

                <button
                  onClick={() => { setCommMoreOpen(false); visiting ? clearVisitMutation.mutate() : setCheckinOpen(true) }}
                  className="w-full flex items-center gap-3.5 px-2 py-3 rounded-xl transition-all"
                  style={{ background: "transparent" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: visiting ? "rgba(176,58,30,0.15)" : "rgba(247,242,232,0.07)" }}>
                    <Navigation className="h-[18px] w-[18px]"
                      style={{ color: visiting ? "#E9A52E" : "rgba(247,242,232,0.55)" }} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[14px] font-semibold" style={{ color: "rgba(247,242,232,0.90)" }}>
                      {visiting ? `Clear visit · ${visiting.wardName}` : "Check in somewhere"}
                    </p>
                    <p className="text-[11px]" style={{ color: "rgba(247,242,232,0.40)" }}>
                      {visiting ? "Remove temporary location" : "See local content while travelling"}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Navigate — escape hatch back to the rest of the app */}
            <div>
              <p className="px-1 pb-2 text-[9px] font-bold tracking-[2.5px] uppercase"
                style={{ color: "rgba(212,145,30,0.55)" }}>Navigate</p>
              <div className="space-y-0.5">
                {([
                  { label: "Home",       href: "/dashboard",  icon: LayoutDashboard, sub: "Your activity feed"       },
                  { label: "Governance", href: "/proposals",  icon: Scale,           sub: "Proposals & voting"       },
                  { label: "Emergency",  href: "/emergency",  icon: AlertTriangle,   sub: "Report urgent issues"     },
                  { label: "Profile",    href: "/profile",    icon: User,            sub: "Your account & settings"  },
                ] as { label: string; href: string; icon: React.ElementType; sub: string }[]).map(({ label, href, icon: Icon, sub }) => (
                  <Link key={href} href={href} onClick={() => setCommMoreOpen(false)}
                    className="flex items-center gap-3.5 px-2 py-2.5 rounded-xl transition-all"
                    style={{ background: "transparent" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(247,242,232,0.07)" }}>
                      <Icon className="h-[18px] w-[18px]" style={{ color: "rgba(247,242,232,0.55)" }} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[14px] font-medium" style={{ color: "rgba(247,242,232,0.85)" }}>{label}</p>
                      <p className="text-[11px]" style={{ color: "rgba(247,242,232,0.35)" }}>{sub}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: "rgba(247,242,232,0.20)" }} />
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
