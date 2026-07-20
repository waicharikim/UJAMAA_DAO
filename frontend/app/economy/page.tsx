"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Coins, Zap, TrendingUp, Calendar, ChevronRight,
  ArrowUpRight, CheckCircle, Lock,
} from "lucide-react"
import { economyApi, utWithdrawalApi } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import Image from "next/image"

const TABS = ["pr", "dues", "ut"] as const
type Tab = typeof TABS[number]
const TAB_LABELS: Record<Tab, string> = { pr: "Rights", dues: "Dues", ut: "Tokens" }

// ── Locked state ───────────────────────────────────────────────
function LockedState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(201,146,42,0.12)" }}
      >
        <Lock className="h-6 w-6" style={{ color: "#C9922A" }} />
      </div>
      <div>
        <p className="font-semibold text-base" style={{ color: "#1A120B" }}>Community verification required</p>
        <p className="text-sm mt-1" style={{ color: "#7A6E60" }}>
          Complete verification to access your economy dashboard.
        </p>
      </div>
      <Link
        href="/profile"
        className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full"
        style={{ background: "#1D4731", color: "#fff" }}
      >
        Go to Profile <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

// ── PR tab ─────────────────────────────────────────────────────
function PRTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["economy-pr"],
    queryFn: () => economyApi.getPRBalance(),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
      </div>
    )
  }

  const history = data?.history ?? []

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-5"
        style={{ background: "linear-gradient(135deg, #1D4731, #2A5F45)" }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "rgba(247,242,232,0.6)" }}
        >
          Participation Rights
        </p>
        <p className="text-4xl font-bold mt-1" style={{ color: "#F7F2E8" }}>
          {(data?.balance ?? 0).toLocaleString()}
        </p>
        <p className="text-xs mt-2" style={{ color: "rgba(247,242,232,0.5)" }}>
          Non-transferable · Earned through participation
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#7A6E60" }}>
          Earning History
        </p>
        {history.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "#7A6E60" }}>No PR history yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((entry, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-3 px-4 rounded-xl"
                style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: entry.amount > 0 ? "rgba(29,71,49,0.10)" : "rgba(176,58,30,0.10)",
                  }}
                >
                  <TrendingUp
                    className="h-4 w-4"
                    style={{ color: entry.amount > 0 ? "#1D4731" : "#B03A1E" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#1A120B" }}>
                    {entry.reason}
                  </p>
                  <p className="text-xs" style={{ color: "#7A6E60" }}>
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className="text-sm font-bold flex-shrink-0"
                  style={{ color: entry.amount > 0 ? "#1D4731" : "#B03A1E" }}
                >
                  {entry.amount > 0 ? "+" : ""}
                  {entry.amount} PR
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Dues tab ───────────────────────────────────────────────────
function DuesTab() {
  const { data: commitments, isLoading: loadingC } = useQuery({
    queryKey: ["economy-commitments"],
    queryFn: () => economyApi.getCommitments(),
    staleTime: 60_000,
  })
  const { data: history, isLoading: loadingH } = useQuery({
    queryKey: ["economy-dues-history"],
    queryFn: () => economyApi.getDuesHistory(),
    staleTime: 60_000,
  })

  if (loadingC || loadingH) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
      </div>
    )
  }

  const totals = history?.totals
  const payments: any[] = history?.payments ?? []
  const active = (commitments as any[] ?? []).filter((c: any) => c.status === "ACTIVE")

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: "rgba(29,71,49,0.08)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#7A6E60" }}>
            Total Paid
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#1D4731" }}>
            KES {(totals?.totalPaidKes ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "rgba(201,146,42,0.08)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#7A6E60" }}>
            PR Earned
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#C9922A" }}>
            {(totals?.totalPaidPR ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      {active.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7A6E60" }}>
            Active Commitment
          </p>
          {active.map((c: any) => (
            <div
              key={c.id}
              className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: "rgba(29,71,49,0.06)", border: "1px solid rgba(29,71,49,0.12)" }}
            >
              <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: "#1D4731" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#1A120B" }}>
                  {c.tier} tier · KES {c.monthlyAmountKes}/month
                </p>
                <p className="text-xs" style={{ color: "#7A6E60" }}>Since {c.startPeriod}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7A6E60" }}>
          Payment History
        </p>
        {payments.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "#7A6E60" }}>No dues payments yet.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center gap-3 py-3 px-4 rounded-xl"
                style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}
              >
                <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: "#7A6E60" }} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "#1A120B" }}>{p.period}</p>
                  <p className="text-xs" style={{ color: "#7A6E60" }}>
                    {new Date(p.paidAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: "#1D4731" }}>KES {p.amountKes}</p>
                  <p className="text-xs" style={{ color: "#C9922A" }}>+{p.prAwarded} PR</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── UT tab ─────────────────────────────────────────────────────
function UTTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["economy-ut"],
    queryFn: () => utWithdrawalApi.getWithdrawals(),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
      </div>
    )
  }

  const balances = data?.balances
  const withdrawals = data?.withdrawals ?? []

  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: "linear-gradient(135deg, #1A2A4C, #2A3A5C)" }}
      >
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "rgba(247,242,232,0.5)" }}
          >
            Earned UT
          </p>
          <p className="text-3xl font-bold" style={{ color: "#F7F2E8" }}>
            {(balances?.earnedUtBalance ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "rgba(247,242,232,0.4)" }}>
            From governance participation · No cash-out path
          </p>
        </div>
        <div
          className="border-t pt-4"
          style={{ borderColor: "rgba(247,242,232,0.10)" }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "rgba(247,242,232,0.5)" }}
          >
            Cashable UT
          </p>
          <p className="text-3xl font-bold" style={{ color: "#C9922A" }}>
            {(balances?.fiatBackedUtBalance ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "rgba(247,242,232,0.4)" }}>
            From M-Pesa dues · Redeemable to M-Pesa
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7A6E60" }}>
          Withdrawal History
        </p>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "#7A6E60" }}>No withdrawals yet.</p>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-3 py-3 px-4 rounded-xl"
                style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}
              >
                <ArrowUpRight
                  className="h-4 w-4 flex-shrink-0"
                  style={{
                    color:
                      w.status === "COMPLETED"
                        ? "#1D4731"
                        : w.status === "PENDING"
                          ? "#C9922A"
                          : "#B03A1E",
                  }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "#1A120B" }}>{w.mpesaPhone}</p>
                  <p className="text-xs" style={{ color: "#7A6E60" }}>
                    {new Date(w.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: "#1A120B" }}>
                    KES {w.amountKes}
                  </p>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4"
                    style={{
                      color:
                        w.status === "COMPLETED"
                          ? "#1D4731"
                          : w.status === "PENDING"
                            ? "#C9922A"
                            : "#B03A1E",
                      borderColor: "currentColor",
                    }}
                  >
                    {w.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export default function EconomyPage() {
  const [activeTab, setActiveTab] = useState<Tab>("pr")
  const { user } = useAuth()

  const isCommunityVerified =
    user?.verificationLevel === "COMMUNITY_VERIFIED" ||
    user?.verificationLevel === "FULL_VERIFIED"

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      {/* Photo hero */}
      <div className="relative h-36 rounded-2xl overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&q=80"
          alt="Economy"
          fill
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgba(29,71,49,0.82) 0%, rgba(29,71,49,0.50) 100%)" }}
        />
        <div className="absolute inset-0 flex items-end p-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Coins className="h-4 w-4 text-white/70" />
              <span className="text-white/70 text-xs font-medium uppercase tracking-wide">Token Economy</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-white">Your Economy</h1>
            <p className="text-white/70 text-sm mt-0.5">Participation Rights, dues &amp; Utility Tokens</p>
          </div>
        </div>
      </div>

      {!isCommunityVerified ? (
        <LockedState />
      ) : (
        <>
          <div
            className="flex gap-1 p-1 rounded-xl"
            style={{ background: "rgba(0,0,0,0.05)" }}
          >
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all"
                style={
                  activeTab === tab
                    ? {
                        background: "#fff",
                        color: "#1D4731",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      }
                    : { color: "#7A6E60" }
                }
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {activeTab === "pr" && <PRTab />}
          {activeTab === "dues" && <DuesTab />}
          {activeTab === "ut" && <UTTab />}
        </>
      )}
    </div>
  )
}
