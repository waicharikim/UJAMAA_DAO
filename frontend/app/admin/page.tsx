"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { StatsGrid } from "@/components/layout/stats-grid"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { Users, Shield, TrendingUp, AlertTriangle } from "lucide-react"

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    activeProposals: 0,
    systemHealth: 0,
    pendingActions: 0,
  })

  useEffect(() => {
    loadSystemStats()
  }, [])

  const loadSystemStats = async () => {
    try {
      setLoading(true)
      setSystemStats({
        totalUsers: 1247,
        activeProposals: 23,
        systemHealth: 98,
        pendingActions: 5,
      })
    } catch (error) {
      console.error("Failed to load system stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const stats = [
    {
      title: "Total Users",
      value: systemStats.totalUsers,
      change: "+45 this week",
      changeType: "positive" as const,
      icon: Users,
      color: "bg-[#C9922A]",
      description: "Platform members",
    },
    {
      title: "System Health",
      value: `${systemStats.systemHealth}%`,
      change: "All systems operational",
      changeType: "positive" as const,
      icon: Shield,
      color: "bg-[#1E3D2F]",
      description: "Platform status",
    },
    {
      title: "Active Proposals",
      value: systemStats.activeProposals,
      change: "+3 today",
      changeType: "positive" as const,
      icon: TrendingUp,
      color: "bg-[#2A5240]",
      description: "Governance activity",
    },
    {
      title: "Pending Actions",
      value: systemStats.pendingActions,
      change: "Requires attention",
      changeType: "neutral" as const,
      icon: AlertTriangle,
      color: "bg-[#B03A1E]",
      description: "Admin tasks",
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
    <ProtectedRoute requiredRoles={["admin", "super_admin"]} requiredScopes={["admin:read"]}>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <PageHeader
          title="System Administration"
          description="Monitor platform health, manage users, and configure system settings."
          badge="Admin Only"
        />

        <StatsGrid stats={stats} />

        <AdminDashboard />
      </div>
    </ProtectedRoute>
  )
}
