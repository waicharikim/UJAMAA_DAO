"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowDownToLine, Clock, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { utWithdrawalApi, UtWithdrawalDto } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

function statusIcon(status: UtWithdrawalDto["status"]) {
  if (status === "COMPLETED") return <CheckCircle className="h-3.5 w-3.5 text-green-500" />
  if (status === "FAILED")    return <XCircle    className="h-3.5 w-3.5 text-red-500" />
  return <Clock className="h-3.5 w-3.5 text-amber-500" />
}

export function UtWithdrawalCard() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [amount, setAmount] = useState("")
  const [phone, setPhone] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["ut-withdrawals"],
    queryFn: utWithdrawalApi.getWithdrawals,
    staleTime: 30_000,
  })

  const withdrawMutation = useMutation({
    mutationFn: () =>
      utWithdrawalApi.withdraw({
        amountKes: Number(amount),
        mpesaPhone: phone.trim(),
      }),
    onSuccess: () => {
      toast({ title: "Withdrawal requested", description: "M-Pesa prompt sent" })
      setShowForm(false)
      setAmount("")
      setPhone("")
      qc.invalidateQueries({ queryKey: ["ut-withdrawals"] })
    },
    onError: (e: Error) => toast({ title: "Withdrawal failed", description: e.message, variant: "destructive" }),
  })

  const fiatBalance = data?.balances.fiatBackedUtBalance ?? 0
  const earnedBalance = data?.balances.earnedUtBalance ?? 0

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowDownToLine className="h-4 w-4" style={{ color: "#1E3D2F" }} />
          Utility Token Withdrawal
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
        ) : (
          <>
            {/* Balance display */}
            <div
              className="rounded-xl p-4 grid grid-cols-2 gap-4"
              style={{ background: "rgba(29,71,49,0.04)", border: "1px solid rgba(29,71,49,0.08)" }}
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Withdrawable UT
                </p>
                <p className="text-[22px] font-bold text-gray-900 mt-0.5">
                  {fiatBalance.toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-400">Fiat-backed (KES-equivalent)</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Earned UT
                </p>
                <p className="text-[22px] font-bold text-gray-900 mt-0.5">
                  {earnedBalance.toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-400">Non-withdrawable</p>
              </div>
            </div>

            {/* Withdraw form toggle */}
            {fiatBalance > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                style={{ borderColor: "rgba(29,71,49,0.25)", color: "#1E3D2F" }}
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? "Cancel" : "Withdraw via M-Pesa"}
              </Button>
            )}

            {/* Withdraw form */}
            {showForm && (
              <div
                className="rounded-xl p-4 space-y-3"
                style={{ background: "rgba(29,71,49,0.03)", border: "1px solid rgba(29,71,49,0.10)" }}
              >
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600">
                    Amount (KES) — min 10, max 10,000
                  </Label>
                  <Input
                    type="number"
                    min={10}
                    max={Math.min(10000, fiatBalance)}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 500"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600">
                    M-Pesa number (e.g. +254712345678)
                  </Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254..."
                    className="h-9 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  style={{ background: "#1D4731", color: "white" }}
                  onClick={() => withdrawMutation.mutate()}
                  disabled={
                    withdrawMutation.isPending ||
                    !amount ||
                    !phone ||
                    Number(amount) < 10 ||
                    Number(amount) > fiatBalance
                  }
                >
                  {withdrawMutation.isPending && (
                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  )}
                  Confirm withdrawal
                </Button>
                <p className="text-[11px] text-gray-400">
                  1 UT = 1 KES. Withdrawals are processed within 24 hours.
                </p>
              </div>
            )}

            {/* History toggle */}
            {(data?.withdrawals.length ?? 0) > 0 && (
              <button
                className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-700 transition-colors"
                onClick={() => setShowHistory((v) => !v)}
              >
                {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Withdrawal history ({data!.withdrawals.length})
              </button>
            )}

            {showHistory && (
              <div className="space-y-1.5">
                {data!.withdrawals.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5"
                    style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)" }}
                  >
                    <div className="flex items-center gap-2">
                      {statusIcon(w.status)}
                      <div>
                        <p className="text-[13px] font-semibold text-gray-800">
                          KES {w.amountKes.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {w.mpesaPhone} · {new Date(w.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={
                        w.status === "COMPLETED"
                          ? { background: "rgba(42,122,75,0.10)", color: "#2A7A4B" }
                          : w.status === "FAILED"
                          ? { background: "rgba(176,58,30,0.10)", color: "#B03A1E" }
                          : { background: "rgba(201,146,42,0.10)", color: "#C9922A" }
                      }
                    >
                      {w.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
