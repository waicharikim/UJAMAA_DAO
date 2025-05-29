"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserManagement } from "./user-management"
import { SystemSettings } from "./system-settings"
import { AuditLogs } from "./audit-logs"
import { FinancialOverview } from "./financial-overview"
import { Settings, FileText, DollarSign, Shield, AlertTriangle, CheckCircle, Clock } from "lucide-react"

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview")

  const recentActions = [
    {
      id: "1",
      action: "User role updated",
      user: "john.doe@example.com",
      details: "Promoted to County Admin",
      timestamp: "2 minutes ago",
      type: "role_change",
      status: "completed",
    },
    {
      id: "2",
      action: "Proposal flagged",
      user: "system",
      details: "Inappropriate content detected",
      timestamp: "15 minutes ago",
      type: "content_moderation",
      status: "pending",
    },
    {
      id: "3",
      action: "Financial transaction",
      user: "treasury.wallet",
      details: "Milestone funding disbursed: $5,000",
      timestamp: "1 hour ago",
      type: "financial",
      status: "completed",
    },
    {
      id: "4",
      action: "System backup",
      user: "system",
      details: "Daily backup completed successfully",
      timestamp: "3 hours ago",
      type: "system",
      status: "completed",
    },
  ]

  const pendingApprovals = [
    {
      id: "1",
      type: "Group Registration",
      title: "Tech Innovation Hub",
      requester: "sarah.wilson@example.com",
      priority: "high",
      daysWaiting: 2,
    },
    {
      id: "2",
      type: "Role Elevation",
      title: "County Admin Request",
      requester: "mike.johnson@example.com",
      priority: "medium",
      daysWaiting: 5,
    },
    {
      id: "3",
      type: "Funding Request",
      title: "Emergency Community Support",
      requester: "community.fund@example.com",
      priority: "high",
      daysWaiting: 1,
    },
  ]

  const getActionIcon = (type: string) => {
    switch (type) {
      case "role_change":
        return <Shield className="h-4 w-4" />
      case "content_moderation":
        return <AlertTriangle className="h-4 w-4" />
      case "financial":
        return <DollarSign className="h-4 w-4" />
      case "system":
        return <Settings className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600 bg-green-100"
      case "pending":
        return "text-yellow-600 bg-yellow-100"
      case "failed":
        return "text-red-600 bg-red-100"
      default:
        return "text-gray-600 bg-gray-100"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600 bg-red-100"
      case "medium":
        return "text-yellow-600 bg-yellow-100"
      case "low":
        return "text-green-600 bg-green-100"
      default:
        return "text-gray-600 bg-gray-100"
    }
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent System Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent System Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActions.map((action) => (
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

            {/* Pending Approvals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Pending Approvals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pendingApprovals.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.title}</div>
                        <div className="text-xs text-slate-600">{item.type}</div>
                        <div className="text-xs text-slate-500">By: {item.requester}</div>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge className={getPriorityColor(item.priority)}>{item.priority}</Badge>
                        <div className="text-xs text-slate-500">{item.daysWaiting} days waiting</div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button className="w-full mt-4" variant="outline">
                  View All Pending Items
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* System Health Monitoring */}
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
                  <div className="text-sm text-yellow-700">Syncing</div>
                  <div className="text-xs text-yellow-600 mt-1">2 blocks behind</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="financial">
          <FinancialOverview />
        </TabsContent>

        <TabsContent value="settings">
          <SystemSettings />
        </TabsContent>

        <TabsContent value="logs">
          <AuditLogs />
        </TabsContent>
      </Tabs>
    </div>
  )
}
