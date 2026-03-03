"use client"

import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { StatsGrid } from "@/components/layout/stats-grid"
import { GroupsList } from "@/components/groups/groups-list"
import { communityApi } from "@/lib/api"
import { Plus, Users, Crown, Shield, Network } from "lucide-react"

export default function GroupsPage() {
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["my-groups-stats"],
    queryFn: communityApi.getMyGroups,
    staleTime: 60_000,
  })

  const adminCount    = groups.filter((g) => g.role === "LEADER" || g.role === "ADMIN").length
  const systemCount   = groups.filter((g) => g.isSystem).length
  const voluntaryCount = groups.filter((g) => !g.isSystem).length

  const handleCreateGroup = () => {
    window.location.href = "/groups/create"
  }

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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#C9922A] border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageHeader
        title="Community Groups"
        description="Join groups, collaborate with like-minded individuals, and build stronger communities together."
        actions={
          <button
            onClick={handleCreateGroup}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "#D4911E", color: "#0A1F14" }}
          >
            <Plus className="h-4 w-4" />
            Create Group
          </button>
        }
      />

      <StatsGrid stats={stats} />

      <GroupsList />
    </div>
  )
}
