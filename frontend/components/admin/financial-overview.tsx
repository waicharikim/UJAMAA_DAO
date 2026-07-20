"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
  BarChart3,
  Download,
  Loader2,
} from "lucide-react"
import { type AdminStatsDto, adminApi } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"

interface Props {
  stats?: AdminStatsDto
}

export function FinancialOverview({ stats }: Props) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("overview")
  const [reportType, setReportType] = useState<"users" | "governance" | "economy">("economy")
  const [generatingReport, setGeneratingReport] = useState(false)

  async function handleGenerateReport() {
    setGeneratingReport(true)
    try {
      const report = await adminApi.generateReport(reportType, { format: "json" }) as { columns: string[]; rows: Record<string, unknown>[] }
      const csv = [
        report.columns.join(","),
        ...report.rows.map((row: Record<string, unknown>) =>
          report.columns.map((col: string) => JSON.stringify(row[col] ?? "")).join(",")
        ),
      ].join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `report-${reportType}-${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Report downloaded", description: `${reportType} report exported as CSV.` })
    } catch {
      toast({ title: "Report failed", description: "Could not generate report.", variant: "destructive" })
    } finally {
      setGeneratingReport(false)
    }
  }

  const financialData = {
    totalPR: stats?.economy.totalParticipationRights ?? 0,
    totalUT: stats?.economy.totalUtilityTokens ?? 0,
    monthlyInflow: 0,
    monthlyOutflow: 0,
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Financial Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="budgets">Budgets</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Financial Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-green-500" />
                      <div>
                        <div className="text-2xl font-bold">{financialData.totalPR.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Total PR</div>
                        <div className="text-xs text-gray-400">Participation Rights in circulation</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-blue-500" />
                      <div>
                        <div className="text-2xl font-bold">{financialData.totalUT.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Total UT</div>
                        <div className="text-xs text-gray-400">Utility Tokens in circulation</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-purple-500" />
                      <div>
                        <div className="text-2xl font-bold">${financialData.monthlyInflow.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Monthly Inflow</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-orange-500" />
                      <div>
                        <div className="text-2xl font-bold">${financialData.monthlyOutflow.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Monthly Outflow</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Cash Flow Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Cash Flow Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Monthly Inflow</span>
                        <span>${financialData.monthlyInflow.toLocaleString()}</span>
                      </div>
                      <Progress value={0} className="h-3 bg-green-100">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: "0%" }} />
                      </Progress>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Monthly Outflow</span>
                        <span>${financialData.monthlyOutflow.toLocaleString()}</span>
                      </div>
                      <Progress value={0} className="h-3 bg-red-100">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: "0%" }} />
                      </Progress>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex justify-between font-semibold">
                        <span>Net Flow</span>
                        <span className="text-green-600">
                          +${(financialData.monthlyInflow - financialData.monthlyOutflow).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-slate-500">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Transaction history will be available here once the treasury module is wired.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="budgets" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Budget Allocation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { category: "Project Funding", allocated: 40000, spent: 25000, percentage: 62.5 },
                      { category: "Community Rewards", allocated: 15000, spent: 12000, percentage: 80 },
                      { category: "Operations", allocated: 10000, spent: 7500, percentage: 75 },
                      { category: "Emergency Fund", allocated: 20000, spent: 0, percentage: 0 },
                    ].map((budget, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{budget.category}</span>
                          <span>
                            ${budget.spent.toLocaleString()} / ${budget.allocated.toLocaleString()}
                          </span>
                        </div>
                        <Progress value={budget.percentage} className="h-2" />
                        <div className="text-xs text-slate-500">{budget.percentage.toFixed(1)}% utilized</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Generate Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center gap-6 py-8">
                    <BarChart3 className="h-12 w-12 opacity-40 text-slate-500" />
                    <p className="text-sm text-slate-500 text-center">Select a report type and download as CSV.</p>
                    <div className="flex gap-3 items-center">
                      <Select value={reportType} onValueChange={(v) => setReportType(v as typeof reportType)}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="users">User Activity</SelectItem>
                          <SelectItem value="governance">Governance</SelectItem>
                          <SelectItem value="economy">Economy</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        disabled={generatingReport}
                        onClick={handleGenerateReport}
                      >
                        {generatingReport
                          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
                          : <><Download className="h-4 w-4 mr-2" />Download CSV</>
                        }
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
