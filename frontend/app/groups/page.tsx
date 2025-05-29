"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { StatsGrid } from "@/components/layout/stats-grid"
import { GroupsList } from "@/components/groups/groups-list"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Plus, Users, Crown, TrendingUp, MessageCircle } from "lucide-react"

export default function GroupsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading
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
      color: "bg-gradient-to-br from-blue-500 to-blue-600",
      description: "Active memberships",
    },
    {
      title: "Admin Roles",
      value: 1,
      change: "Leadership position",
      changeType: "neutral" as const,
      icon: Crown,
      color: "bg-gradient-to-br from-purple-500 to-purple-600",
      description: "Groups you manage",
    },
    {
      title: "Group Impact",
      value: 2450,
      change: "+320 this month",
      changeType: "positive" as const,
      icon: TrendingUp,
      color: "bg-gradient-to-br from-green-500 to-green-600",
      description: "Collective points",
    },
    {
      title: "Active Discussions",
      value: 8,
      change: "2 need response",
      changeType: "neutral" as const,
      icon: MessageCircle,
      color: "bg-gradient-to-br from-orange-500 to-orange-600",
      description: "Ongoing conversations",
    },
  ]

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageHeader
        title="Community Groups"
        description="Join groups, collaborate with like-minded individuals, and build stronger communities together."
        gradient
        actions={
          <Button
            onClick={handleCreateGroup}
            size="lg"
            className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        }
      />

      <StatsGrid stats={stats} />

      <GroupsList />
    </div>
  )
}
