"use client"

import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { StatsGrid } from "@/components/layout/stats-grid"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { Users, Shield, TrendingUp, AlertTriangle } from "lucide-react"
import { adminApi } from "@/lib/api"

export default function AdminPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => adminApi.getStats(),
    staleTime: 30_000,
  })

  const statsCards = [
    {
      title: "Total Users",
      value: isLoading ? "—" : (stats?.users.total ?? 0),
      change: isLoading ? "" : `${stats?.users.active ?? 0} active`,
      changeType: "positive" as const,
      icon: Users,
      color: "bg-[#C9922A]",
      description: "Platform members",
    },
    {
      title: "System Health",
      value: "98%",
      change: "All systems operational",
      changeType: "positive" as const,
      icon: Shield,
      color: "bg-[#1E3D2F]",
      description: "Platform status",
    },
    {
      title: "Active Proposals",
      value: isLoading ? "—" : (stats?.governance.activeProposals ?? 0),
      change: "In voting period",
      changeType: "positive" as const,
      icon: TrendingUp,
      color: "bg-[#2A5240]",
      description: "Governance activity",
    },
    {
      title: "Pending Actions",
      value: isLoading ? "—" : (stats?.pendingActions.total ?? 0),
      change: isLoading ? "" : `${stats?.pendingActions.verifications ?? 0} verifications, ${stats?.pendingActions.residenceChanges ?? 0} residence`,
      changeType: "neutral" as const,
      icon: AlertTriangle,
      color: "bg-[#B03A1E]",
      description: "Admin tasks",
    },
  ]

  return (
    <ProtectedRoute requiredRoles={["admin", "super_admin", "compliance_officer"]}>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <PageHeader
          title="System Administration"
          description="Monitor platform health, manage users, and configure system settings."
          badge="Admin Only"
        />

        <StatsGrid stats={statsCards} />

        <AdminDashboard stats={stats} />
      </div>
    </ProtectedRoute>
  )
}
