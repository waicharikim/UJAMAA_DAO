"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { FileText, Search, Download, User, Shield, DollarSign, Vote, Settings } from "lucide-react"

interface AuditLog {
  id: string
  timestamp: string
  userId: string
  userEmail: string
  action: string
  category: "user" | "governance" | "financial" | "system" | "security"
  details: string
  ipAddress: string
  userAgent: string
  status: "success" | "failed" | "warning"
  metadata?: Record<string, any>
}

export function AuditLogs() {
  const [logs] = useState<AuditLog[]>([
    {
      id: "1",
      timestamp: "2024-01-20T14:30:00Z",
      userId: "user_123",
      userEmail: "john.doe@example.com",
      action: "user_role_updated",
      category: "user",
      details: "User role changed from 'user' to 'county_admin'",
      ipAddress: "192.168.1.100",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      status: "success",
      metadata: { previousRole: "user", newRole: "county_admin", updatedBy: "admin_456" },
    },
    {
      id: "2",
      timestamp: "2024-01-20T14:25:00Z",
      userId: "user_789",
      userEmail: "sarah.wilson@example.com",
      action: "proposal_created",
      category: "governance",
      details: "New proposal created: 'Community Solar Initiative'",
      ipAddress: "10.0.0.50",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      status: "success",
      metadata: { proposalId: "prop_001", title: "Community Solar Initiative", tokensCost: 10 },
    },
    {
      id: "3",
      timestamp: "2024-01-20T14:20:00Z",
      userId: "system",
      userEmail: "system@platform.com",
      action: "token_transfer",
      category: "financial",
      details: "Milestone funding disbursed: 5000 tokens",
      ipAddress: "127.0.0.1",
      userAgent: "System/1.0",
      status: "success",
      metadata: { amount: 5000, projectId: "proj_001", milestoneId: "mile_001" },
    },
    {
      id: "4",
      timestamp: "2024-01-20T14:15:00Z",
      userId: "user_456",
      userEmail: "admin@example.com",
      action: "system_settings_updated",
      category: "system",
      details: "Governance parameters updated",
      ipAddress: "192.168.1.10",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      status: "success",
      metadata: { setting: "quorum_percentage", oldValue: 70, newValue: 75 },
    },
    {
      id: "5",
      timestamp: "2024-01-20T14:10:00Z",
      userId: "user_999",
      userEmail: "suspicious@example.com",
      action: "failed_login_attempt",
      category: "security",
      details: "Multiple failed login attempts detected",
      ipAddress: "203.0.113.1",
      userAgent: "curl/7.68.0",
      status: "failed",
      metadata: { attemptCount: 5, blocked: true },
    },
  ])

  const [filters, setFilters] = useState({
    search: "",
    category: "all",
    status: "all",
    dateRange: "all",
  })

  const filteredLogs = logs.filter((log) => {
    if (
      filters.search &&
      !log.action.toLowerCase().includes(filters.search.toLowerCase()) &&
      !log.details.toLowerCase().includes(filters.search.toLowerCase()) &&
      !log.userEmail.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false
    }
    if (filters.category !== "all" && log.category !== filters.category) return false
    if (filters.status !== "all" && log.status !== filters.status) return false
    return true
  })

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "user":
        return <User className="h-4 w-4" />
      case "governance":
        return <Vote className="h-4 w-4" />
      case "financial":
        return <DollarSign className="h-4 w-4" />
      case "system":
        return <Settings className="h-4 w-4" />
      case "security":
        return <Shield className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "user":
        return "bg-blue-100 text-blue-800"
      case "governance":
        return "bg-purple-100 text-purple-800"
      case "financial":
        return "bg-green-100 text-green-800"
      case "system":
        return "bg-gray-100 text-gray-800"
      case "security":
        return "bg-red-100 text-red-800"
      default:
        return "bg-slate-100 text-slate-800"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800"
      case "failed":
        return "bg-red-100 text-red-800"
      case "warning":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const exportLogs = () => {
    // Mock export functionality
    const csvContent = [
      "Timestamp,User,Action,Category,Status,Details,IP Address",
      ...filteredLogs.map(
        (log) =>
          `${log.timestamp},${log.userEmail},${log.action},${log.category},${log.status},"${log.details}",${log.ipAddress}`,
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Audit Logs
            </CardTitle>
            <Button onClick={exportLogs} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search logs..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>

            <Select
              value={filters.category}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="governance">Governance</SelectItem>
                <SelectItem value="financial">Financial</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="security">Security</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.dateRange}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, dateRange: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Logs Table */}
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div key={log.id} className="border rounded-lg p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center ${getCategoryColor(log.category)}`}
                    >
                      {getCategoryIcon(log.category)}
                    </div>
                    <div>
                      <div className="font-medium">
                        {log.action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </div>
                      <div className="text-sm text-slate-600">{log.details}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getCategoryColor(log.category)}>{log.category}</Badge>
                    <Badge className={getStatusColor(log.status)}>{log.status}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-slate-600">
                  <div>
                    <span className="font-medium">User:</span> {log.userEmail}
                  </div>
                  <div>
                    <span className="font-medium">Time:</span> {formatRelativeTime(log.timestamp)}
                  </div>
                  <div>
                    <span className="font-medium">IP:</span> {log.ipAddress}
                  </div>
                  <div>
                    <span className="font-medium">Date:</span> {formatDate(log.timestamp)}
                  </div>
                </div>

                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="mt-3 p-3 bg-slate-100 rounded text-sm">
                    <span className="font-medium">Metadata:</span>
                    <pre className="mt-1 text-xs overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
