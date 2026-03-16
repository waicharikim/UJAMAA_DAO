"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { FileText, Search, Download, User, Shield, DollarSign, Vote, Settings } from "lucide-react"
import { auditApi, type AuditLogDto } from "@/lib/api"

export function AuditLogs() {
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [dateRange, setDateRange] = useState("all")

  const buildParams = () => {
    const params: Parameters<typeof auditApi.search>[0] = { limit: 50 }
    if (dateRange === "today") params.fromDate = new Date(new Date().setHours(0,0,0,0)).toISOString()
    else if (dateRange === "week") params.fromDate = new Date(Date.now() - 7*24*60*60*1000).toISOString()
    else if (dateRange === "month") params.fromDate = new Date(Date.now() - 30*24*60*60*1000).toISOString()
    return params
  }

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit-logs", category, dateRange],
    queryFn: () => auditApi.search(buildParams()),
    staleTime: 30_000,
  })

  const deriveCategory = (log: AuditLogDto): "user" | "governance" | "financial" | "system" | "security" => {
    const et = (log.entityType ?? "").toUpperCase()
    const ac = log.action.toUpperCase()
    if (et.includes("SECURITY") || ac.includes("SECURITY") || ac.includes("LOGIN") || ac.includes("AUTH")) return "security"
    if (et.includes("USER") || ac.includes("USER") || ac.includes("EMAIL") || ac.includes("PROFILE")) return "user"
    if (et.includes("PROPOSAL") || ac.includes("PROPOSAL") || ac.includes("VOTE")) return "governance"
    if (et.includes("ECONOMY") || et.includes("PR") || et.includes("PAYMENT") || ac.includes("PR_") || ac.includes("DUES")) return "financial"
    return "system"
  }

  const logs = (data?.logs ?? []).filter((log) => {
    if (category !== "all" && deriveCategory(log) !== category) return false
    if (search && !log.action.toLowerCase().includes(search.toLowerCase()) && !(log.user?.email ?? "").toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "user": return <User className="h-4 w-4" />
      case "governance": return <Vote className="h-4 w-4" />
      case "financial": return <DollarSign className="h-4 w-4" />
      case "system": return <Settings className="h-4 w-4" />
      case "security": return <Shield className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "user": return "bg-blue-100 text-blue-800"
      case "governance": return "bg-purple-100 text-purple-800"
      case "financial": return "bg-green-100 text-green-800"
      case "system": return "bg-gray-100 text-gray-800"
      case "security": return "bg-red-100 text-red-800"
      default: return "bg-slate-100 text-slate-800"
    }
  }

  const exportLogs = () => {
    const csvContent = [
      "Timestamp,User,Action,Category,Entity Type,Entity ID",
      ...logs.map((log) => {
        const cat = deriveCategory(log)
        return `${log.createdAt},${log.user?.email ?? "system"},${log.action},${cat},${log.entityType},${log.entityId ?? ""}`
      }),
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
              Audit Logs {data && <span className="text-sm font-normal text-slate-500">({data.pagination.total} total)</span>}
            </CardTitle>
            <Button onClick={exportLogs} variant="outline">
              <Download className="h-4 w-4 mr-2" />Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input placeholder="Search logs…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="governance">Governance</SelectItem>
                <SelectItem value="financial">Financial</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="security">Security</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger><SelectValue placeholder="Date Range" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C9922A] border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const cat = deriveCategory(log)
                return (
                  <div key={log.id} className="border rounded-lg p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${getCategoryColor(cat)}`}>
                          {getCategoryIcon(cat)}
                        </div>
                        <div>
                          <div className="font-medium">{log.action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</div>
                          <div className="text-sm text-slate-600">{log.entityType}{log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ""}</div>
                        </div>
                      </div>
                      <Badge className={getCategoryColor(cat)}>{cat}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                      <div><span className="font-medium">User:</span> {log.user?.email ?? log.user?.name ?? "system"}</div>
                      <div><span className="font-medium">Time:</span> {formatRelativeTime(log.createdAt)}</div>
                      <div><span className="font-medium">Date:</span> {formatDate(log.createdAt)}</div>
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-3 p-3 bg-slate-100 rounded text-sm">
                        <pre className="text-xs overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )
              })}
              {logs.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No audit logs found.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
