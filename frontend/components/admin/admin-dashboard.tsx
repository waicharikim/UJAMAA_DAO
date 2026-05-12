"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserManagement } from "./user-management"
import { SystemSettings } from "./system-settings"
import { AuditLogs } from "./audit-logs"
import { FinancialOverview } from "./financial-overview"
import { GovernanceReview, ProposalReviewRow } from "./governance-review"
import { LocationTreasury } from "./location-treasury"
import { Settings, FileText, DollarSign, Shield, AlertTriangle, CheckCircle, Clock, Coins, Vote } from "lucide-react"
import { adminApi, auditApi, governanceApi, type AdminStatsDto } from "@/lib/api"
import { BarazaManagement } from "./baraza-management"
import { formatRelativeTime } from "@/lib/utils"

interface Props {
  stats?: AdminStatsDto
  isLocationAdmin?: boolean
}

export function AdminDashboard({ stats, isLocationAdmin = false }: Props) {
  const { data: auditResult } = useQuery({
    queryKey: ["admin", "audit-recent"],
    queryFn: () => auditApi.search({ limit: 5 }),
    staleTime: 30_000,
  })

  const { data: pendingVerifs } = useQuery({
    queryKey: ["admin", "pending-verifications"],
    queryFn: () => adminApi.getPendingVerifications({ pageSize: 5 }),
    staleTime: 30_000,
    enabled: !isLocationAdmin,
  })

  const { data: pendingProposalsData } = useQuery({
    queryKey: ["admin", "needs-action"],
    queryFn: () => governanceApi.getNeedsAction(),
    staleTime: 30_000,
  })

  const pendingProposals = pendingProposalsData?.proposals ?? []

  const recentActions = (auditResult?.logs ?? []).map((log) => {
    const et = log.entityType?.toUpperCase() ?? ""
    const type = et.includes("USER") ? "role_change"
      : et.includes("PROPOSAL") ? "content_moderation"
      : et.includes("ECONOMY") || et.includes("PR") ? "financial"
      : "system"
    return {
      id: log.id,
      action: log.action.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
      user: log.user?.email ?? log.user?.name ?? "system",
      details: `${log.entityType}${log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ""}`,
      timestamp: formatRelativeTime(log.createdAt),
      type,
      status: "completed",
    }
  })

  const pendingApprovals = (pendingVerifs?.requests ?? []).map((req: any) => {
    const createdAt = new Date(req.createdAt)
    const daysWaiting = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    return {
      id: req.id,
      type: "Verification Request",
      title: req.user?.name ?? "Unknown user",
      requester: req.user?.phoneNumber ?? "—",
      priority: daysWaiting > 7 ? "high" : daysWaiting > 3 ? "medium" : "low",
      daysWaiting,
    }
  })

  const getActionIcon = (type: string) => {
    switch (type) {
      case "role_change": return <Shield className="h-4 w-4" />
      case "content_moderation": return <AlertTriangle className="h-4 w-4" />
      case "financial": return <DollarSign className="h-4 w-4" />
      case "system": return <Settings className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-600 bg-green-100"
      case "pending": return "text-yellow-600 bg-yellow-100"
      case "failed": return "text-red-600 bg-red-100"
      default: return "text-gray-600 bg-gray-100"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-red-600 bg-red-100"
      case "medium": return "text-yellow-600 bg-yellow-100"
      case "low": return "text-green-600 bg-green-100"
      default: return "text-gray-600 bg-gray-100"
    }
  }

  // Tab layout: location admins get overview/governance/financial/barazas/logs (5 cols)
  const tabCols = isLocationAdmin ? "grid-cols-5" : "grid-cols-7"

  return (
    <div className="space-y-6">
      <Tabs defaultValue={isLocationAdmin ? "governance" : "overview"}>
        <TabsList className={`grid w-full ${tabCols}`}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
          {!isLocationAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="barazas">Barazas</TabsTrigger>
          {!isLocationAdmin && <TabsTrigger value="settings">Settings</TabsTrigger>}
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {isLocationAdmin ? (
            /* Location admin overview: pending proposals in their area */
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Vote className="h-5 w-5" />
                    Proposals Awaiting Your Review
                    {pendingProposals.length > 0 && (
                      <Badge className="bg-yellow-100 text-yellow-800 ml-1">
                        {pendingProposals.length} pending
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingProposals.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">
                      No proposals pending review in your area
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {pendingProposals.map((p) => (
                        <ProposalReviewRow key={p.id} proposal={p} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentActions.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">No recent actions</p>
                    ) : recentActions.map((action) => (
                      <div key={action.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                          {getActionIcon(action.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{action.action}</div>
                          <div className="text-xs text-slate-600 truncate">{action.details}</div>
                          <div className="text-xs text-slate-500">{action.timestamp}</div>
                        </div>
                        <Badge className={getStatusColor(action.status)}>{action.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Super admin overview: system actions + pending verifications + economy stats */
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Recent System Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentActions.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No recent actions</p>
                      ) : recentActions.map((action) => (
                        <div key={action.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            {getActionIcon(action.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{action.action}</div>
                            <div className="text-xs text-slate-600 truncate">{action.details}</div>
                            <div className="text-xs text-slate-500">{action.timestamp}</div>
                          </div>
                          <Badge className={getStatusColor(action.status)}>{action.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Pending Verifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {pendingApprovals.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No pending verifications</p>
                      ) : pendingApprovals.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{item.title}</div>
                            <div className="text-xs text-slate-600">{item.type}</div>
                            <div className="text-xs text-slate-500">{item.requester}</div>
                          </div>
                          <div className="text-right space-y-1">
                            <Badge className={getPriorityColor(item.priority)}>{item.priority}</Badge>
                            <div className="text-xs text-slate-500">{item.daysWaiting}d waiting</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {pendingProposals.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Vote className="h-5 w-5 text-yellow-600" />
                      Proposals Awaiting Review
                      <Badge className="bg-yellow-100 text-yellow-800 ml-1">
                        {pendingProposals.length} pending
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {pendingProposals.map((p) => (
                        <ProposalReviewRow key={p.id} proposal={p} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <Coins className="h-8 w-8 text-amber-500" />
                      <div>
                        <div className="text-2xl font-bold">{stats.economy.totalParticipationRights.toLocaleString()}</div>
                        <div className="text-sm text-slate-600">Total PR in Circulation</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <DollarSign className="h-8 w-8 text-blue-500" />
                      <div>
                        <div className="text-2xl font-bold">{stats.economy.totalUtilityTokens.toLocaleString()}</div>
                        <div className="text-sm text-slate-600">Total UT in Circulation</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    System Health Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 rounded-lg bg-green-50">
                      <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <div className="font-semibold text-green-900">Database</div>
                      <div className="text-sm text-green-700">Operational</div>
                      <div className="text-xs text-green-600 mt-1">99.9% uptime</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-green-50">
                      <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <div className="font-semibold text-green-900">API Services</div>
                      <div className="text-sm text-green-700">Operational</div>
                      <div className="text-xs text-green-600 mt-1">Response: 120ms</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-yellow-50">
                      <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                      <div className="font-semibold text-yellow-900">Blockchain Sync</div>
                      <div className="text-sm text-yellow-700">Pending Deploy</div>
                      <div className="text-xs text-yellow-600 mt-1">Base Sepolia not configured</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="governance"><GovernanceReview /></TabsContent>
        {!isLocationAdmin && <TabsContent value="users"><UserManagement /></TabsContent>}
        <TabsContent value="financial">
          {isLocationAdmin ? <LocationTreasury /> : <FinancialOverview stats={stats} />}
        </TabsContent>
        <TabsContent value="barazas"><BarazaManagement /></TabsContent>
        {!isLocationAdmin && <TabsContent value="settings"><SystemSettings /></TabsContent>}
        <TabsContent value="logs"><AuditLogs /></TabsContent>
      </Tabs>
    </div>
  )
}
