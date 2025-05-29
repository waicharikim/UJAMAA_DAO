"use client"

import { PageHeader } from "@/components/layout/page-header"
import { StatsGrid } from "@/components/layout/stats-grid"
import { UserProfile } from "@/components/user/user-profile"
import { useAuth } from "@/contexts/auth-context"
import { Award, Coins, Users, TrendingUp } from "lucide-react"

export default function ProfilePage() {
  const { user } = useAuth()

  const stats = [
    {
      title: "Impact Points",
      value: user?.impactPoints?.global || 0,
      change: "+85 this month",
      changeType: "positive" as const,
      icon: Award,
      color: "bg-gradient-to-br from-orange-500 to-orange-600",
      description: "Total earned",
    },
    {
      title: "Token Balance",
      value: user?.tokenBalance || 0,
      change: "Available to use",
      changeType: "neutral" as const,
      icon: Coins,
      color: "bg-gradient-to-br from-yellow-500 to-yellow-600",
      description: "Governance tokens",
    },
    {
      title: "Group Memberships",
      value: user?.roles?.length || 0,
      change: "Active roles",
      changeType: "neutral" as const,
      icon: Users,
      color: "bg-gradient-to-br from-purple-500 to-purple-600",
      description: "Community involvement",
    },
    {
      title: "Activity Score",
      value: "92%",
      change: "+5% this week",
      changeType: "positive" as const,
      icon: TrendingUp,
      color: "bg-gradient-to-br from-green-500 to-green-600",
      description: "Participation rate",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageHeader
        title="My Profile"
        description="Manage your account settings, view your achievements, and track your community impact."
        gradient
      />

      <StatsGrid stats={stats} />

      <div className="max-w-2xl mx-auto">
        <UserProfile />
      </div>
    </div>
  )
}
