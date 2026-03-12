"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { StatsGrid } from "@/components/layout/stats-grid"
import { communityApi, GroupDiscoveryDto, GroupMembershipDto } from "@/lib/api"
import { Plus, Users, Crown, Shield, Network, Search, Globe, ChevronRight } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"

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
        <p className="text-xs mt-1 opacity-70">Explore the Explore tab to find and join groups.</p>
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

function ExploreGroups() {
  const [search, setSearch] = useState("")
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["groups-discover", search],
    queryFn: () => communityApi.getGroups({ isSystem: false, search: search || undefined, limit: 50 }),
    staleTime: 30_000,
  })

  const joinMutation = useMutation({
    mutationFn: (groupId: string) => communityApi.joinGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups-discover"] })
      queryClient.invalidateQueries({ queryKey: ["my-groups-stats"] })
      queryClient.invalidateQueries({ queryKey: ["my-groups-list"] })
    },
  })

  const groups = data?.groups ?? []

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B5E4E]" />
        <Input
          placeholder="Search groups…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white border-[#C9922A]/30 focus:border-[#C9922A]"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C9922A] border-t-transparent" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#6B5E4E]">
          <Globe className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">{search ? "No groups match your search." : "No voluntary groups yet."}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g: GroupDiscoveryDto) => (
            <div
              key={g.id}
              className="rounded-xl border border-[#C9922A]/20 bg-white p-5 space-y-3 hover:shadow-md transition-shadow"
            >
              <Link href={`/groups/${g.id}`} className="block">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#0A1F14] leading-tight hover:text-[#C9922A] transition-colors">
                      {g.name}
                    </p>
                    {g.voluntaryType && (
                      <p className="text-xs text-[#6B5E4E] mt-0.5">
                        {g.voluntaryType.replace(/_/g, " ")}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 flex items-center gap-1 text-xs text-[#6B5E4E]">
                    <Users className="h-3.5 w-3.5" />
                    {g.memberCount}
                  </span>
                </div>

                {g.description && (
                  <p className="text-xs text-[#6B5E4E] line-clamp-2">{g.description}</p>
                )}
              </Link>

              {g.isMember ? (
                <span className="inline-block text-xs font-medium text-[#1E3D2F] bg-[#1E3D2F]/10 rounded-full px-3 py-1">
                  {g.myRole ?? "Member"}
                </span>
              ) : (
                <button
                  onClick={() => joinMutation.mutate(g.id)}
                  disabled={joinMutation.isPending}
                  className="w-full rounded-full py-1.5 text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "#D4911E", color: "#0A1F14" }}
                >
                  {joinMutation.isPending ? "Joining…" : "Join"}
                </button>
              )}
            </div>
          ))}
        </div>
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
        </TabsList>

        <TabsContent value="my-groups" className="mt-6">
          <MyGroupsList />
        </TabsContent>

        <TabsContent value="explore" className="mt-6">
          <ExploreGroups />
        </TabsContent>
      </Tabs>
    </div>
  )
}
