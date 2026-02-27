"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { StatsGrid } from "@/components/layout/stats-grid"
import { GroupsList } from "@/components/groups/groups-list"
import { useAuth } from "@/contexts/auth-context"
import { Plus, Users, Crown, TrendingUp, MessageCircle } from "lucide-react"

export default function GroupsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000)
  }, [])

  const handleCreateGroup = () => {
    window.location.href = "/groups/create"
  }

  const stats = [
    {
      title: "My Groups",
      value: 3,
      change: "+1 this month",
      changeType: "positive" as const,
      icon: Users,
      color: "bg-[#C9922A]",
      description: "Active memberships",
    },
    {
      title: "Admin Roles",
      value: 1,
      change: "Leadership position",
      changeType: "neutral" as const,
      icon: Crown,
      color: "bg-[#1E3D2F]",
      description: "Groups you manage",
    },
    {
      title: "Group Impact",
      value: 2450,
      change: "+320 this month",
      changeType: "positive" as const,
      icon: TrendingUp,
      color: "bg-[#B03A1E]",
      description: "Collective points",
    },
    {
      title: "Active Discussions",
      value: 8,
      change: "2 need response",
      changeType: "neutral" as const,
      icon: MessageCircle,
      color: "bg-[#2A5240]",
      description: "Ongoing conversations",
    },
  ]

  if (loading) {
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
