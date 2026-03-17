"use client"

/**
 * @file app/treasury/page.tsx
 *
 * Ward Treasury page.
 *
 * Flow:
 * 1. Fetch the user's group memberships.
 * 2. Find their WARD system group (primary ward).
 * 3. Fetch that group's treasury + transaction history.
 *
 * Only shows groups where systemType === "WARD" (system groups auto-joined
 * on community verification).  If none found, shows an empty state.
 *
 * Deposit / withdraw are SUPER_ADMIN only — not exposed here.
 */

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { communityApi, treasuryApi, type WalletTransactionDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  Coins,
  ChevronLeft,
  ChevronRight,
  ArrowUpCircle,
  ArrowDownCircle,
  MapPin,
  RefreshCw,
} from "lucide-react"

// ── Helpers ───────────────────────────────────────────────

const REF_LABELS: Record<string, string> = {
  DUES:     "Dues",
  MANUAL:   "Manual",
  PROJECT:  "Project",
  PROPOSAL: "Proposal",
}

const REF_COLORS: Record<string, string> = {
  DUES:     "rgba(30,61,47,0.12)",
  MANUAL:   "rgba(14,11,8,0.08)",
  PROJECT:  "rgba(201,146,42,0.12)",
  PROPOSAL: "rgba(176,58,30,0.08)",
}

const REF_TEXT: Record<string, string> = {
  DUES:     "#1E3D2F",
  MANUAL:   "#0E0B08",
  PROJECT:  "#C9922A",
  PROPOSAL: "#B03A1E",
}

// ── Sub-components ────────────────────────────────────────

function TreasurySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}

function TransactionRow({ tx }: { tx: WalletTransactionDto }) {
  const isCredit = tx.transactionType === "CREDIT"
  const refLabel = REF_LABELS[tx.referenceType] ?? tx.referenceType
  const refBg    = REF_COLORS[tx.referenceType] ?? REF_COLORS.MANUAL
  const refColor = REF_TEXT[tx.referenceType]   ?? REF_TEXT.MANUAL

  return (
    <div
      className="flex items-center gap-3 py-3 border-b last:border-0"
      style={{ borderColor: "rgba(14,11,8,0.06)" }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: isCredit ? "rgba(30,61,47,0.1)" : "rgba(176,58,30,0.08)" }}
      >
        {isCredit
          ? <ArrowUpCircle   className="h-4 w-4" style={{ color: "#1E3D2F" }} />
          : <ArrowDownCircle className="h-4 w-4" style={{ color: "#B03A1E" }} />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0E0B08] truncate">
          {tx.description ?? refLabel}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold"
            style={{ background: refBg, color: refColor }}
          >
            {refLabel}
          </span>
          <span className="text-[10px] text-[#0E0B08]/40">
            {new Date(tx.createdAt).toLocaleDateString("en-KE", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </span>
        </div>
      </div>

      <span
        className="text-sm font-bold flex-shrink-0"
        style={{ color: isCredit ? "#1E3D2F" : "#B03A1E" }}
      >
        {isCredit ? "+" : "−"}KES {tx.amount.toLocaleString()}
      </span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function TreasuryPage() {
  const { user } = useAuth()
  const [page, setPage] = useState(1)

  // 1. Get user's group memberships
  const { data: memberships, isLoading: groupsLoading } = useQuery({
    queryKey: ["my-groups"],
    queryFn:  communityApi.getMyGroups,
    staleTime: 60_000,
    enabled:  !!user,
  })

  // 2. Find the WARD system group
  const wardGroup = memberships?.find(
    (m) => m.isSystem && m.systemType === "WARD"
  )

  // 3. Fetch treasury
  const { data: treasury, isLoading: treasuryLoading, refetch } = useQuery({
    queryKey: ["treasury", wardGroup?.groupId],
    queryFn:  () => treasuryApi.getTreasury(wardGroup!.groupId),
    staleTime: 30_000,
    enabled:  !!wardGroup,
  })

  // 4. Fetch transactions (paginated)
  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ["treasury-transactions", wardGroup?.groupId, page],
    queryFn:  () => treasuryApi.getTransactions(wardGroup!.groupId, { page, limit: 15 }),
    staleTime: 30_000,
    enabled:  !!wardGroup,
  })

  const isLoading = groupsLoading || treasuryLoading
  const totalPages = txData?.pagination.totalPages ?? 1

  // ── Location label ──────────────────────────────────────
  const locationParts = [wardGroup?.ward?.name, wardGroup?.constituency?.name, wardGroup?.county?.name].filter(Boolean)
  const locationLabel = locationParts.join(", ")

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-3xl text-[#0E0B08]">Ward Treasury</h2>
          <p className="text-sm text-[#0E0B08]/50 mt-1">
            {locationLabel
              ? <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 inline" /> {locationLabel}</span>
              : "Collective funds for your ward community."
            }
          </p>
        </div>
        {wardGroup && (
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: "rgba(30,61,47,0.08)", color: "#1E3D2F" }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        )}
      </div>

      {/* No ward group yet */}
      {!groupsLoading && !wardGroup && (
        <Card className="border-0 shadow-card text-center py-14">
          <CardContent>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(30,61,47,0.08)" }}>
              <Landmark className="h-6 w-6" style={{ color: "#1E3D2F" }} />
            </div>
            <p className="text-base font-bold text-[#0E0B08] mb-1">No ward treasury yet</p>
            <p className="text-sm text-[#0E0B08]/50 max-w-xs mx-auto">
              Complete community verification to be added to your ward group and see its treasury.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && <TreasurySkeleton />}

      {/* Treasury dashboard */}
      {!isLoading && treasury && (
        <>
          {/* Balance cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-0 shadow-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#0E0B08]/40 mb-1">KES Balance</p>
                    <p className="text-[28px] font-bold text-[#0E0B08] leading-none">
                      {treasury.balance.toLocaleString()}
                    </p>
                    <p className="text-xs text-[#0E0B08]/40 mt-1">Kenyan Shillings</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#1E3D2F" }}>
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#0E0B08]/40 mb-1">UT Balance</p>
                    <p className="text-[28px] font-bold text-[#0E0B08] leading-none">
                      {treasury.tokenBalance.toLocaleString()}
                    </p>
                    <p className="text-xs text-[#0E0B08]/40 mt-1">Utility Tokens</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#C9922A" }}>
                    <Coins className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick stats from transactions */}
          {txData && txData.pagination.total > 0 && (
            <div
              className="flex items-center justify-between rounded-2xl px-5 py-3"
              style={{ background: "rgba(30,61,47,0.05)", border: "1px solid rgba(30,61,47,0.1)" }}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: "#1E3D2F" }} />
                <span className="text-xs text-[#0E0B08]/60">{txData.pagination.total} transactions recorded</span>
              </div>
              <span className="text-xs text-[#0E0B08]/40">
                Updated {new Date(treasury.updatedAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
              </span>
            </div>
          )}

          {/* Transaction history */}
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="h-4 w-4" style={{ color: "#C9922A" }} />
                Transaction History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {txLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
                </div>
              ) : !txData?.transactions.length ? (
                <p className="text-sm text-center py-8" style={{ color: "rgba(14,11,8,0.35)" }}>
                  No transactions yet. Dues payments will appear here once received.
                </p>
              ) : (
                <>
                  <div>
                    {txData.transactions.map((tx) => (
                      <TransactionRow key={tx.id} tx={tx} />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: "rgba(14,11,8,0.06)" }}>
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-30"
                        style={{ background: "rgba(14,11,8,0.06)", color: "#0E0B08" }}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Previous
                      </button>
                      <span className="text-xs text-[#0E0B08]/40">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-30"
                        style={{ background: "rgba(14,11,8,0.06)", color: "#0E0B08" }}
                      >
                        Next <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Footer note */}
          <p className="text-xs text-center text-[#0E0B08]/30 pb-2">
            Treasury funds are managed by ward leadership. All transactions are recorded on-chain for transparency.
          </p>
        </>
      )}
    </div>
  )
}
