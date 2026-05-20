"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Landmark, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { treasuryApi, type WalletTransactionDto } from "@/lib/api"

function formatKes(amount: number) {
  return `KES ${amount.toLocaleString("en-KE", { minimumFractionDigits: 0 })}`
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString("en-KE", { day: "numeric", month: "short" })
}

function TxRow({ tx }: { tx: WalletTransactionDto }) {
  const isCredit = tx.transactionType === "CREDIT"
  return (
    <div className="flex items-center gap-3 py-2 border-b border-black/[0.04] last:border-0">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: isCredit ? "rgba(26,107,60,0.10)" : "rgba(176,58,30,0.08)" }}
      >
        {isCredit
          ? <TrendingUp className="h-3 w-3" style={{ color: "#1A6B3C" }} />
          : <TrendingDown className="h-3 w-3" style={{ color: "#B03A1E" }} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#0E0B08] truncate">
          {tx.description ?? tx.referenceType}
        </p>
        <p className="text-[10px] text-[#0E0B08]/40">{relativeTime(tx.createdAt)}</p>
      </div>
      <span
        className="text-xs font-bold flex-shrink-0"
        style={{ color: isCredit ? "#1A6B3C" : "#B03A1E" }}
      >
        {isCredit ? "+" : "−"}{formatKes(Math.abs(tx.amount))}
      </span>
    </div>
  )
}

interface GroupTreasuryCardProps {
  groupId: string
}

export function GroupTreasuryCard({ groupId }: GroupTreasuryCardProps) {
  const [showTxs, setShowTxs] = useState(false)

  const { data: treasury, isLoading: loadingTreasury } = useQuery({
    queryKey: ["treasury", groupId],
    queryFn: () => treasuryApi.getTreasury(groupId),
    staleTime: 60_000,
    retry: false,
  })

  const { data: txData, isLoading: loadingTxs } = useQuery({
    queryKey: ["treasury-txs", groupId],
    queryFn: () => treasuryApi.getTransactions(groupId, { limit: 5 }),
    enabled: showTxs,
    staleTime: 60_000,
    retry: false,
  })

  if (loadingTreasury) {
    return (
      <Card className="border-0 shadow-card">
        <CardContent className="p-4">
          <Skeleton className="h-16 w-full rounded-xl" />
        </CardContent>
      </Card>
    )
  }

  if (!treasury) return null

  const txs: WalletTransactionDto[] = txData?.transactions ?? []

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-sm font-bold text-chai flex items-center gap-2">
          <Landmark className="h-4 w-4" style={{ color: "#1D4731" }} />
          Group Treasury
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-1 space-y-3">
        {/* Balance strip */}
        <div className="grid grid-cols-2 gap-2">
          <div
            className="flex flex-col px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(29,71,49,0.07)", border: "1px solid rgba(29,71,49,0.12)" }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#0E0B08]/40">
              KES Balance
            </span>
            <span className="text-lg font-bold text-[#0E0B08] leading-tight mt-0.5">
              {formatKes(treasury.balance)}
            </span>
          </div>
          <div
            className="flex flex-col px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(201,146,42,0.07)", border: "1px solid rgba(201,146,42,0.12)" }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#0E0B08]/40">
              UT Balance
            </span>
            <span className="text-lg font-bold text-[#0E0B08] leading-tight mt-0.5">
              {treasury.tokenBalance.toLocaleString()} UT
            </span>
          </div>
        </div>

        {/* Recent transactions toggle */}
        <button
          onClick={() => setShowTxs((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
          style={{ color: "#C9922A" }}
        >
          {showTxs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showTxs ? "Hide" : "Recent transactions"}
        </button>

        {showTxs && (
          <div>
            {loadingTxs ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
              </div>
            ) : txs.length === 0 ? (
              <p className="text-xs text-[#0E0B08]/40 py-1">No transactions yet.</p>
            ) : (
              txs.map((tx) => <TxRow key={tx.id} tx={tx} />)
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
