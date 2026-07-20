"use client"

/**
 * @file components/payments/dues-payment-card.tsx
 *
 * Shows monthly dues status and lets the user pay via M-Pesa or Card.
 * Tier amounts (KES): ORDINARY=60, SUPPORTER=200, SPONSOR=1000
 */

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { economyApi } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Banknote, CheckCircle2, AlertCircle } from "lucide-react"
import { PaymentModal } from "./payment-modal"

// ── Constants ─────────────────────────────────────────────

const TIERS = [
  { value: "ORDINARY",  label: "Ordinary",  amount: 60,   desc: "Core member" },
  { value: "SUPPORTER", label: "Supporter", amount: 200,  desc: "Enhanced contributor" },
  { value: "SPONSOR",   label: "Sponsor",   amount: 1000, desc: "Community sponsor" },
] as const

type Tier = typeof TIERS[number]["value"]

function currentPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// ── Component ─────────────────────────────────────────────

export function DuesPaymentCard() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [selectedTier, setSelectedTier] = useState<Tier>("ORDINARY")
  const [modalOpen, setModalOpen] = useState(false)

  const { data: history, isLoading, isError } = useQuery({
    queryKey: ["dues-history"],
    queryFn:  economyApi.getDuesHistory,
    staleTime: 60_000,
    enabled:  !!user,
    retry: false,
  })

  // Check if current month is already paid
  const period  = currentPeriod()
  const paidThisMonth = history?.payments?.some(
    (p: any) => p.period === period && p.status === "COMPLETED"
  ) ?? false

  const tier       = TIERS.find((t) => t.value === selectedTier)!
  const recentPaid = history?.payments?.slice(0, 3) ?? []

  function handleSuccess() {
    setModalOpen(false)
    queryClient.invalidateQueries({ queryKey: ["dues-history"] })
    queryClient.invalidateQueries({ queryKey: ["economy-pr"] })
  }

  return (
    <>
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4" style={{ color: "#1E3D2F" }} />
            Monthly Contributions
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
            </div>
          ) : isError ? (
            <div className="py-2 space-y-2">
              <p className="text-xs text-warm-gray">Unable to load contribution history.</p>
              <button
                onClick={() => queryClient.refetchQueries({ queryKey: ["dues-history"] })}
                className="text-xs font-semibold underline underline-offset-2"
                style={{ color: "#C9922A" }}
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {/* Current month status */}
              <div
                className="flex items-center gap-3 rounded-xl p-3"
                style={{
                  background: paidThisMonth ? "rgba(30,61,47,0.07)" : "rgba(201,146,42,0.07)",
                  border:     `1px solid ${paidThisMonth ? "rgba(30,61,47,0.15)" : "rgba(201,146,42,0.2)"}`,
                }}
              >
                {paidThisMonth
                  ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: "#1E3D2F" }} />
                  : <AlertCircle  className="h-4 w-4 flex-shrink-0" style={{ color: "#C9922A" }} />
                }
                <p className="text-sm font-semibold" style={{ color: paidThisMonth ? "#1E3D2F" : "#C9922A" }}>
                  {paidThisMonth
                    ? `Contribution paid for ${period}`
                    : `Contribution unpaid for ${period}`
                  }
                </p>
              </div>

              {/* Tier selector */}
              {!paidThisMonth && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-[#0E0B08]/60 mb-2">Select tier</p>
                    <div className="grid grid-cols-3 gap-2">
                      {TIERS.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setSelectedTier(t.value)}
                          className="rounded-xl p-3 text-center transition-all"
                          style={{
                            border:     `2px solid ${selectedTier === t.value ? "#1E3D2F" : "rgba(14,11,8,0.1)"}`,
                            background: selectedTier === t.value ? "rgba(30,61,47,0.07)" : "transparent",
                          }}
                        >
                          <p className="text-xs font-bold text-[#0E0B08]">{t.label}</p>
                          <p className="text-base font-extrabold mt-0.5" style={{ color: "#1E3D2F" }}>
                            {t.amount}
                          </p>
                          <p className="text-[9px] text-[#0E0B08]/40 mt-0.5">KES</p>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-[#0E0B08]/40 mt-1">{tier.desc}</p>
                  </div>

                  <button
                    onClick={() => setModalOpen(true)}
                    className="w-full h-11 rounded-xl text-sm font-bold transition-all hover:opacity-90 flex items-center justify-center gap-2"
                    style={{ background: "#1E3D2F", color: "#fff" }}
                  >
                    <Banknote className="h-4 w-4" />
                    Pay KES {tier.amount} — {tier.label}
                  </button>
                </>
              )}

              {/* Recent payments */}
              {recentPaid.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#0E0B08]/50 mb-2">Recent payments</p>
                  <div className="space-y-1.5">
                    {recentPaid.map((p: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs py-1.5 border-b last:border-0"
                        style={{ borderColor: "rgba(14,11,8,0.06)" }}
                      >
                        <span className="text-[#0E0B08]/60">{p.period ?? "—"}</span>
                        <span className="font-bold text-[#1E3D2F]">KES {Number(p.amount ?? 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!recentPaid.length && paidThisMonth === false && (
                <p className="text-xs text-center py-2" style={{ color: "rgba(14,11,8,0.35)" }}>
                  No contributions paid yet. Monthly contributions keep your membership active.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <PaymentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        purpose="DUES"
        purposeMeta={{ tier: selectedTier, period }}
        amount={tier.amount}
        label={`Monthly contribution — ${tier.label}`}
        onSuccess={handleSuccess}
      />
    </>
  )
}
