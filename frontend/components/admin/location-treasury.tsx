"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Landmark, TrendingUp, TrendingDown, Loader2, PlusCircle } from "lucide-react"
import { communityApi, treasuryApi } from "@/lib/api"
import { FundGroupModal } from "@/components/payments/fund-group-modal"
import { formatRelativeTime } from "@/lib/utils"

export function LocationTreasury() {
  const [fundOpen, setFundOpen] = useState(false)

  const { data: myGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => communityApi.getMyGroups(),
  })

  const systemGroup = myGroups?.find((g) => g.isSystem)

  const { data: treasury, isLoading: treasuryLoading } = useQuery({
    queryKey: ["treasury", systemGroup?.groupId],
    queryFn: () => treasuryApi.getTreasury(systemGroup!.groupId),
    enabled: !!systemGroup?.groupId,
  })

  const { data: txResult, isLoading: txLoading } = useQuery({
    queryKey: ["treasury", systemGroup?.groupId, "transactions"],
    queryFn: () => treasuryApi.getTransactions(systemGroup!.groupId, { limit: 20 }),
    enabled: !!systemGroup?.groupId,
  })

  const isLoading = groupsLoading || treasuryLoading || txLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!systemGroup) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-slate-500">
          No system group found for your location. Contact a super admin.
        </CardContent>
      </Card>
    )
  }

  const balance = treasury?.balance ?? 0
  const transactions = txResult?.transactions ?? []

  return (
    <>
      {/* Balance card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <Landmark className="h-8 w-8 text-amber-500 shrink-0" />
            <div>
              <div className="text-2xl font-bold">
                KES {Number(balance).toLocaleString("en-KE", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-sm text-slate-600">
                {systemGroup.groupName} — platform allocation
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500 mb-1">Fund this group</div>
              <div className="text-xs text-slate-400">
                Accept contributions from community members
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFundOpen(true)}
              className="gap-1"
            >
              <PlusCircle className="h-4 w-4" />
              Fund
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Transaction history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No transactions yet</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    {tx.transactionType === "CREDIT" ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <div className="text-sm font-medium">
                        {tx.description ?? tx.referenceType}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatRelativeTime(tx.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={
                        tx.transactionType === "CREDIT"
                          ? "text-green-700 font-semibold text-sm"
                          : "text-red-600 font-semibold text-sm"
                      }
                    >
                      {tx.transactionType === "CREDIT" ? "+" : "-"}
                      KES {Number(tx.amount).toLocaleString()}
                    </span>
                    <div className="mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {tx.referenceType}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fund modal pre-filled with this group */}
      <FundGroupModal
        open={fundOpen}
        onClose={() => setFundOpen(false)}
        preselectedGroupId={systemGroup.groupId}
        preselectedGroupName={systemGroup.groupName}
      />
    </>
  )
}
