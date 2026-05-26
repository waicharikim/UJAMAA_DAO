"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { StatsGrid } from "@/components/layout/stats-grid"
import { communityApi, leaderboardApi, userApi, GroupDiscoveryDto, GroupMembershipDto, LeaderboardEntryDto } from "@/lib/api"
import { Plus, Users, Crown, Shield, Network, Search, Globe, ChevronRight, Trophy, Star, Zap, BarChart3, Medal, MapPin, Home, Building2, Landmark, ShieldCheck, Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/auth-context"

// ─── My Groups tab ──────────────────────────────────────────────────────────

function MyGroupsList() {
  const { data: groups = [], isLoading } = useQuery<GroupMembershipDto[]>({
    queryKey: ["my-groups-list"],
    queryFn: communityApi.getMyGroups,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C9922A] border-t-transparent" />
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#6B5E4E]">
        <Users className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">You haven&apos;t joined any groups yet.</p>
        <p className="text-xs mt-1 opacity-70">Switch to the Explore tab to find groups near you.</p>
      </div>
    )
  }

  const system    = groups.filter((g) => g.isSystem)
  const voluntary = groups.filter((g) => !g.isSystem)

  function GroupRow({ g }: { g: GroupMembershipDto }) {
    return (
      <Link
        href={`/groups/${g.groupId}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-[#C9922A]/20 bg-white p-4 hover:shadow-md transition-shadow"
      >
        <div className="min-w-0">
          <p className="font-semibold text-[#0A1F14] truncate leading-tight">{g.groupName}</p>
          {(g.voluntaryType ?? g.systemType) && (
            <p className="text-xs text-[#6B5E4E] mt-0.5">
              {(g.voluntaryType ?? g.systemType)!.replace(/_/g, " ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-xs font-medium rounded-full px-2.5 py-0.5"
            style={
              g.role === "LEADER"
                ? { background: "#C9922A22", color: "#C9922A" }
                : { background: "#1E3D2F22", color: "#1E3D2F" }
            }
          >
            {g.role}
          </span>
          <ChevronRight className="h-4 w-4 text-[#C9922A]/60" />
        </div>
      </Link>
    )
  }

  return (
    <div className="space-y-6">
      {system.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6B5E4E]">Geographic Groups</p>
          <div className="space-y-2">
            {system.map((g) => <GroupRow key={g.groupId} g={g} />)}
          </div>
        </div>
      )}
      {voluntary.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6B5E4E]">Voluntary Groups</p>
          <div className="space-y-2">
            {voluntary.map((g) => <GroupRow key={g.groupId} g={g} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Explore tab ───────────────────────────────────────────────────────────

function LocationSelect({
  label, value, onChange, options, disabled, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { id: string; name: string }[]; disabled?: boolean; placeholder: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-[#7A6E60]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg px-3 py-2 text-sm font-medium appearance-none outline-none transition-all disabled:opacity-40"
        style={{
          background: disabled ? "rgba(0,0,0,0.03)" : "#fff",
          border: "1px solid rgba(0,0,0,0.10)",
          color: value ? "#1A120B" : "#7A6E60",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  )
}

function ExploreGroups() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [search, setSearch]             = useState("")
  const [countyId, setCountyId]         = useState("")
  const [constituencyId, setConstituencyId] = useState("")
  const [wardId, setWardId]             = useState("")
  const [joiningId, setJoiningId]       = useState<string | null>(null)

  useEffect(() => {
    if (user?.primaryCountyId)       setCountyId(user.primaryCountyId)
    if (user?.primaryConstituencyId) setConstituencyId(user.primaryConstituencyId)
    if (user?.primaryWardId)         setWardId(user.primaryWardId)
  }, [user?.primaryCountyId, user?.primaryConstituencyId, user?.primaryWardId])

  const { data: counties = [] } = useQuery({
    queryKey: ["counties"],
    queryFn: () => userApi.getCounties(),
    staleTime: Infinity,
  })
  const { data: constituencies = [] } = useQuery({
    queryKey: ["constituencies", countyId],
    queryFn: () => userApi.getConstituencies(countyId),
    enabled: !!countyId,
    staleTime: Infinity,
  })
  const { data: wards = [] } = useQuery({
    queryKey: ["wards", constituencyId],
    queryFn: () => userApi.getWards(constituencyId),
    enabled: !!constituencyId,
    staleTime: Infinity,
  })

  const locationFilter = wardId ? { wardId }
    : constituencyId ? { constituencyId }
    : countyId ? { countyId }
    : {}

  const { data, isLoading } = useQuery({
    queryKey: ["groups-explore", locationFilter, search],
    queryFn: () => communityApi.getGroups({ ...locationFilter, search: search || undefined, limit: 50 }),
    staleTime: 30_000,
  })

  const joinMutation = useMutation({
    mutationFn: (id: string) => communityApi.joinGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups-explore"] })
      queryClient.invalidateQueries({ queryKey: ["my-groups-stats"] })
      queryClient.invalidateQueries({ queryKey: ["my-groups-list"] })
      setJoiningId(null)
    },
    onError: () => setJoiningId(null),
  })

  function handleJoin(id: string) { setJoiningId(id); joinMutation.mutate(id) }

  const allGroups  = data?.groups ?? []
  const system     = allGroups.filter((g) => g.isSystemGroup)
  const voluntary  = allGroups.filter((g) => !g.isSystemGroup)

  function GroupCard({ g }: { g: GroupDiscoveryDto }) {
    const Icon = g.isSystemGroup
      ? g.locationScope === "WARD" ? Home
        : g.locationScope === "CONSTITUENCY" ? Building2 : Landmark
      : Users

    return (
      <div
        className="rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow"
        style={{
          background: g.isSystemGroup ? "rgba(29,71,49,0.03)" : "#fff",
          border: `1px solid ${g.isSystemGroup ? "rgba(29,71,49,0.12)" : "rgba(201,146,42,0.20)"}`,
        }}
      >
        <Link href={`/groups/${g.id}`} className="block">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: g.isSystemGroup ? "rgba(29,71,49,0.10)" : "rgba(201,146,42,0.10)",
                color: g.isSystemGroup ? "#1D4731" : "#C9922A",
              }}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#0A1F14] leading-tight hover:text-[#C9922A] transition-colors truncate">
                {g.name}
              </p>
              <p className="text-xs text-[#6B5E4E] mt-0.5">
                {g.isSystemGroup
                  ? `${(g.locationScope ?? "Ward").toLowerCase()} group`
                  : (g.voluntaryType ?? "Voluntary").replace(/_/g, " ")}
                {" · "}{g.memberCount} members
              </p>
            </div>
          </div>
          {g.description && (
            <p className="text-xs text-[#6B5E4E] line-clamp-2 mt-2">{g.description}</p>
          )}
        </Link>

        {g.isMember ? (
          <span className="inline-block text-xs font-medium text-[#1E3D2F] bg-[#1E3D2F]/10 rounded-full px-3 py-1">
            {g.myRole ?? "Member"}
          </span>
        ) : g.isSystemGroup ? (
          <div className="flex items-center gap-1 text-xs font-medium text-[#7A6E60]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Auto-join on verification
          </div>
        ) : (
          <button
            onClick={() => handleJoin(g.id)}
            disabled={joiningId === g.id}
            className="w-full rounded-full py-1.5 text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
            style={{ background: "#D4911E", color: "#0A1F14" }}
          >
            {joiningId === g.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Join"}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Filters row */}
      <div className="space-y-3 p-4 rounded-xl" style={{ background: "rgba(29,71,49,0.03)", border: "1px solid rgba(29,71,49,0.08)" }}>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-[#1D4731]" />
          <span className="text-sm font-semibold text-[#1A120B]">Filter by location</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <LocationSelect label="County" value={countyId}
            onChange={(v) => { setCountyId(v); setConstituencyId(""); setWardId("") }}
            options={counties} placeholder="All counties" />
          <LocationSelect label="Constituency" value={constituencyId}
            onChange={(v) => { setConstituencyId(v); setWardId("") }}
            options={constituencies} disabled={!countyId} placeholder={countyId ? "All" : "—"} />
          <LocationSelect label="Ward" value={wardId}
            onChange={setWardId}
            options={wards} disabled={!constituencyId} placeholder={constituencyId ? "All" : "—"} />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B5E4E]" />
          <Input
            placeholder="Search groups by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white border-[#C9922A]/30 focus:border-[#C9922A]"
          />
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C9922A] border-t-transparent" />
        </div>
      ) : allGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#6B5E4E]">
          <Globe className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">{search ? "No groups match your search." : "No groups found for this location."}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {system.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B5E4E]">Geographic Groups</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {system.map((g) => <GroupCard key={g.id} g={g} />)}
              </div>
            </div>
          )}
          {voluntary.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B5E4E]">Voluntary Groups</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {voluntary.map((g) => <GroupCard key={g.id} g={g} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Leaderboard tab ───────────────────────────────────────────────────────

const LB_METRIC_TABS = [
  { value: "combined", label: "Combined", icon: BarChart3 },
  { value: "ip",       label: "Impact",   icon: Star },
  { value: "pr",       label: "Rep",      icon: Zap },
] as const
type LbMetric = typeof LB_METRIC_TABS[number]["value"]

const LB_SCOPE_TABS = [
  { value: "global", label: "Global" },
  { value: "county", label: "County" },
  { value: "ward",   label: "Ward" },
] as const
type LbScope = typeof LB_SCOPE_TABS[number]["value"]

function lbScore(entry: LeaderboardEntryDto, metric: LbMetric) {
  if (metric === "ip") return entry.globalImpactPoints
  if (metric === "pr") return entry.participationRights
  return entry.combinedScore
}
function lbLabel(metric: LbMetric) {
  return metric === "ip" ? "IP" : metric === "pr" ? "PR" : "Score"
}

function PodiumItem({ entry, metric, position }: { entry: LeaderboardEntryDto; metric: LbMetric; position: 1 | 2 | 3 }) {
  const colors = { 1: "#D4911E", 2: "rgba(247,242,232,0.6)", 3: "rgba(247,242,232,0.4)" }
  const heights = { 1: "h-20", 2: "h-14", 3: "h-10" }
  return (
    <div className="flex flex-col items-center gap-2 flex-1 max-w-[90px]">
      <Avatar className="h-10 w-10 rounded-xl border-2" style={{ borderColor: colors[position] }}>
        <AvatarImage src={entry.avatarUrl} />
        <AvatarFallback className="rounded-xl bg-[#2A5C40] text-white text-sm font-bold">
          {(entry.name || "U")[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <p className="text-[11px] font-semibold text-cream truncate w-full text-center">{entry.name.split(" ")[0]}</p>
      <p className="text-[10px]" style={{ color: colors[position] }}>{lbScore(entry, metric).toLocaleString()} {lbLabel(metric)}</p>
      <div className={`w-full ${heights[position]} rounded-t-lg flex items-end justify-center pb-2`}
        style={{ background: `${colors[position]}22`, border: `1px solid ${colors[position]}44` }}>
        <span className="text-[18px]">{position === 1 ? "🥇" : position === 2 ? "🥈" : "🥉"}</span>
      </div>
    </div>
  )
}

function LeaderboardContent() {
  const { user } = useAuth()
  const [metric, setMetric] = useState<LbMetric>("combined")
  const [scope, setScope] = useState<LbScope>("global")

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", metric, scope],
    queryFn: () => leaderboardApi.getLeaderboard({ metric, scope, limit: 50 }),
  })

  return (
    <div className="space-y-5">
      {/* Top 3 podium */}
      {!isLoading && data?.entries && data.entries.length >= 3 && (
        <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #1D4731 0%, #142F22 100%)" }}>
          <div className="flex items-end justify-center gap-4">
            <PodiumItem entry={data.entries[1]} metric={metric} position={2} />
            <PodiumItem entry={data.entries[0]} metric={metric} position={1} />
            <PodiumItem entry={data.entries[2]} metric={metric} position={3} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {LB_METRIC_TABS.map(({ value, label, icon: Icon }) => (
            <button key={value} onClick={() => setMetric(value)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all"
              style={metric === value ? { background: "#C9922A", color: "white" } : { background: "rgba(201,146,42,0.08)", color: "#C9922A" }}>
              <Icon className="h-3 w-3" />{label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {LB_SCOPE_TABS.map(({ value, label }) => (
            <button key={value} onClick={() => setScope(value)}
              className="px-3 py-1 rounded-full text-[12px] font-medium transition-all"
              style={scope === value ? { background: "#1D4731", color: "white" } : { background: "rgba(29,71,49,0.06)", color: "#555" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-9 w-9 rounded-xl" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-2.5 w-20" /></div>
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
      ) : !data?.entries.length ? (
        <div className="text-center py-16 text-gray-400">
          <Medal className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No data yet for this scope</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.entries.map((entry) => {
            const isMe = user?.id === entry.userId
            return (
              <div key={entry.userId} className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                style={{
                  background: isMe ? "rgba(201,146,42,0.07)" : entry.rank <= 3 ? "rgba(29,71,49,0.04)" : "white",
                  border: isMe ? "1px solid rgba(201,146,42,0.25)" : "1px solid rgba(29,71,49,0.07)",
                }}>
                <div className="w-7 flex items-center justify-center flex-shrink-0">
                  {entry.rank <= 3
                    ? <span className="text-[16px]">{entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}</span>
                    : <span className="w-7 text-center text-[13px] font-bold" style={{ color: "#999" }}>{entry.rank}</span>}
                </div>
                <Avatar className="h-9 w-9 rounded-xl flex-shrink-0">
                  <AvatarImage src={entry.avatarUrl} />
                  <AvatarFallback className="rounded-xl bg-[#1D4731] text-white text-sm font-semibold">
                    {(entry.name || "U")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-gray-800 truncate">
                    {entry.name}
                    {isMe && <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">You</span>}
                  </p>
                  {entry.ward && (
                    <p className="text-[11px] text-gray-400 truncate">
                      {entry.ward.name}{entry.county ? `, ${entry.county.name}` : ""}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[14px] font-bold text-gray-800">{lbScore(entry, metric).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">{lbLabel(metric)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {data && (
        <p className="text-center text-[11px] text-gray-400">
          Showing {data.entries.length} of {data.total} members
        </p>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function GroupsPage() {
  const { data: groups = [], isLoading } = useQuery<GroupMembershipDto[]>({
    queryKey: ["my-groups-stats"],
    queryFn: communityApi.getMyGroups,
    staleTime: 60_000,
  })

  const adminCount     = groups.filter((g) => g.role === "LEADER").length
  const systemCount    = groups.filter((g) => g.isSystem).length
  const voluntaryCount = groups.filter((g) => !g.isSystem).length

  const stats = [
    {
      title: "My Groups",
      value: isLoading ? "—" : groups.length,
      change: "Active memberships",
      changeType: "positive" as const,
      icon: Users,
      color: "bg-[#C9922A]",
      description: "Active memberships",
    },
    {
      title: "Admin Roles",
      value: isLoading ? "—" : adminCount,
      change: "Leadership positions",
      changeType: "neutral" as const,
      icon: Crown,
      color: "bg-[#1E3D2F]",
      description: "Groups you manage",
    },
    {
      title: "System Groups",
      value: isLoading ? "—" : systemCount,
      change: "Ward, constituency, county",
      changeType: "neutral" as const,
      icon: Shield,
      color: "bg-[#B03A1E]",
      description: "Official community groups",
    },
    {
      title: "Voluntary",
      value: isLoading ? "—" : voluntaryCount,
      change: "Interest & project groups",
      changeType: "positive" as const,
      icon: Network,
      color: "bg-[#2A5240]",
      description: "Groups you chose to join",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageHeader
        title="Community Groups"
        description="Join groups, collaborate with like-minded individuals, and build stronger communities together."
        actions={
          <Link
            href="/groups/create"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "#D4911E", color: "#0A1F14" }}
          >
            <Plus className="h-4 w-4" />
            Create Group
          </Link>
        }
      />

      <StatsGrid stats={stats} />

      <Tabs defaultValue="my-groups">
        <TabsList className="bg-[#F7F2E8] border border-[#C9922A]/20">
          <TabsTrigger value="my-groups" className="data-[state=active]:bg-[#1E3D2F] data-[state=active]:text-[#F7F2E8]">
            My Groups
          </TabsTrigger>
          <TabsTrigger value="explore" className="data-[state=active]:bg-[#1E3D2F] data-[state=active]:text-[#F7F2E8]">
            Explore
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="data-[state=active]:bg-[#1E3D2F] data-[state=active]:text-[#F7F2E8]">
            <Trophy className="h-3.5 w-3.5 mr-1.5" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-groups" className="mt-6">
          <MyGroupsList />
        </TabsContent>

        <TabsContent value="explore" className="mt-6">
          <ExploreGroups />
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-6">
          <LeaderboardContent />
        </TabsContent>
      </Tabs>
    </div>
  )
}
