"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  BarChart3,
} from "lucide-react"

interface Transaction {
  id: string
  type: "deposit" | "withdrawal" | "transfer" | "reward" | "penalty"
  amount: number
  currency: "fiat" | "token"
  description: string
  timestamp: string
  status: "completed" | "pending" | "failed"
  fromAddress?: string
  toAddress?: string
}

export function FinancialOverview() {
  const [activeTab, setActiveTab] = useState("overview")

  const [financialData] = useState({
    totalFiatBalance: 125000,
    totalTokenBalance: 50000,
    monthlyInflow: 15000,
    monthlyOutflow: 8500,
    pendingTransactions: 3,
    totalTransactions: 1247,
  })

  const [recentTransactions] = useState<Transaction[]>([
    {
      id: "1",
      type: "deposit",
      amount: 5000,
      currency: "fiat",
      description: "Community funding deposit",
      timestamp: "2024-01-20T14:30:00Z",
      status: "completed",
      toAddress: "treasury_wallet",
    },
    {
      id: "2",
      type: "withdrawal",
      amount: 2500,
      currency: "fiat",
      description: "Milestone funding disbursement",
      timestamp: "2024-01-20T13:15:00Z",
      status: "completed",
      fromAddress: "treasury_wallet",
    },
    {
      id: "3",
      type: "reward",
      amount: 100,
      currency: "token",
      description: "Voting participation reward",
      timestamp: "2024-01-20T12:00:00Z",
      status: "completed",
    },
    {
      id: "4",
      type: "transfer",
      amount: 1000,
      currency: "token",
      description: "Group funding allocation",
      timestamp: "2024-01-20T11:30:00Z",
      status: "pending",
      fromAddress: "main_treasury",
      toAddress: "group_wallet_001",
    },
  ])

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <ArrowDownRight className="h-4 w-4 text-green-600" />
      case "withdrawal":
        return <ArrowUpRight className="h-4 w-4 text-red-600" />
      case "transfer":
        return <ArrowUpRight className="h-4 w-4 text-blue-600" />
      case "reward":
        return <TrendingUp className="h-4 w-4 text-purple-600" />
      case "penalty":
        return <TrendingDown className="h-4 w-4 text-orange-600" />
      default:
        return <DollarSign className="h-4 w-4" />
    }
  }

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "deposit":
        return "text-green-600"
      case "withdrawal":
        return "text-red-600"
      case "transfer":
        return "text-blue-600"
      case "reward":
        return "text-purple-600"
      case "penalty":
        return "text-orange-600"
      default:
        return "text-slate-600"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
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
                        <div className="text-2xl font-bold">${financialData.totalFiatBalance.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Total Fiat Balance</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-blue-500" />
                      <div>
                        <div className="text-2xl font-bold">{financialData.totalTokenBalance.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Total Token Balance</div>
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
                      <Progress value={75} className="h-3 bg-green-100">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: "75%" }} />
                      </Progress>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Monthly Outflow</span>
                        <span>${financialData.monthlyOutflow.toLocaleString()}</span>
                      </div>
                      <Progress value={45} className="h-3 bg-red-100">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: "45%" }} />
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
                  <div className="flex items-center justify-between">
                    <CardTitle>Recent Transactions</CardTitle>
                    <Badge variant="secondary">{financialData.pendingTransactions} pending</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentTransactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getTransactionIcon(transaction.type)}
                          <div>
                            <div className="font-medium">{transaction.description}</div>
                            <div className="text-sm text-slate-600">
                              {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)} •
                              {new Date(transaction.timestamp).toLocaleDateString()}
                            </div>
                            {transaction.fromAddress && transaction.toAddress && (
                              <div className="text-xs text-slate-500">
                                {transaction.fromAddress} → {transaction.toAddress}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${getTransactionColor(transaction.type)}`}>
                            {transaction.type === "withdrawal" || transaction.type === "penalty" ? "-" : "+"}
                            {transaction.currency === "fiat" ? "$" : ""}
                            {transaction.amount.toLocaleString()}
                            {transaction.currency === "token" ? " tokens" : ""}
                          </div>
                          <Badge className={getStatusColor(transaction.status)}>{transaction.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full mt-4" variant="outline">
                    View All Transactions
                  </Button>
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
                  <CardTitle>Financial Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-slate-500">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Financial Reports</h3>
                    <p>Detailed financial analytics and reports will be available here.</p>
                    <Button className="mt-4" variant="outline">
                      Generate Report
                    </Button>
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
