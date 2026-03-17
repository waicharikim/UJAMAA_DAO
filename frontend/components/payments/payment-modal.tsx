"use client"

/**
 * @file components/payments/payment-modal.tsx
 *
 * Universal payment modal. Handles two flows:
 *
 * M-Pesa (Buni STK Push):
 *   1. User confirms phone → POST /payments/initiate (method: MPESA)
 *   2. STK push arrives on phone — user enters PIN
 *   3. Polls GET /payments/status/:txRef every 3 s until COMPLETED or FAILED (90 s timeout)
 *
 * Card (Flutterwave hosted checkout):
 *   1. POST /payments/initiate (method: CARD) → paymentLink
 *   2. Opens in new tab; user completes payment
 *   3. Polls status every 3 s — auto-resolves when COMPLETED
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import { paymentApi, type PaymentMethod, type PaymentPurpose } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Smartphone, CreditCard, CheckCircle2, XCircle, ExternalLink } from "lucide-react"

// ── Types ─────────────────────────────────────────────────

export interface PaymentModalProps {
  open:        boolean
  onClose:     () => void
  purpose:     PaymentPurpose
  purposeMeta?: Record<string, unknown>
  amount:      number          // KES amount to display
  label:       string          // e.g. "Monthly dues — Ordinary tier"
  onSuccess:   (txRef: string) => void
}

type Step = "select" | "mpesa-confirm" | "mpesa-waiting" | "card-waiting" | "success" | "failed"

const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS  = 90_000   // 90 s — STK push expires

// ── Component ─────────────────────────────────────────────

export function PaymentModal({ open, onClose, purpose, purposeMeta, amount, label, onSuccess }: PaymentModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [step,    setStep]    = useState<Step>("select")
  const [method,  setMethod]  = useState<PaymentMethod>("MPESA")
  const [phone,   setPhone]   = useState(user?.phone ?? "")
  const [txRef,   setTxRef]   = useState<string | null>(null)
  const [cardLink, setCardLink] = useState<string | null>(null)

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>  | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep("select")
      setTxRef(null)
      setCardLink(null)
      setPhone(user?.phone ?? "")
    }
  }, [open, user?.phone])

  // Cleanup polling on unmount / close
  useEffect(() => {
    return () => {
      if (pollRef.current)    clearInterval(pollRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current)    { clearInterval(pollRef.current);  pollRef.current    = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }, [])

  const startPolling = useCallback((ref: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const record = await paymentApi.getStatus(ref)
        if (record.status === "COMPLETED") {
          stopPolling()
          setStep("success")
          onSuccess(ref)
        } else if (record.status === "FAILED") {
          stopPolling()
          setStep("failed")
        }
      } catch {
        // network error during polling — keep trying
      }
    }, POLL_INTERVAL_MS)

    timeoutRef.current = setTimeout(() => {
      stopPolling()
      if (step !== "success" && step !== "failed") setStep("failed")
    }, POLL_TIMEOUT_MS)
  }, [onSuccess, step, stopPolling])

  // ── Initiate mutation ────────────────────────────────────

  const initiateMutation = useMutation({
    mutationFn: () =>
      paymentApi.initiate({
        method,
        purpose,
        purposeMeta: method === "MPESA"
          ? { ...purposeMeta, phoneNumber: phone }
          : purposeMeta,
      }),
    onSuccess: (data) => {
      setTxRef(data.txRef)
      if (method === "MPESA") {
        setStep("mpesa-waiting")
        startPolling(data.txRef)
      } else {
        if (data.paymentLink) {
          setCardLink(data.paymentLink)
          window.open(data.paymentLink, "_blank", "noopener,noreferrer")
        }
        setStep("card-waiting")
        startPolling(data.txRef)
      }
    },
    onError: (err: any) => {
      toast({ title: "Payment failed to start", description: err?.message ?? "Try again.", variant: "destructive" })
    },
  })

  function handleClose() {
    stopPolling()
    onClose()
  }

  // ── Render helpers ────────────────────────────────────────

  const phoneValid = /^\+254[17]\d{8}$/.test(phone)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-[420px] border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{label}</DialogTitle>
          <p className="text-sm text-[#0E0B08]/50 font-semibold mt-0.5">KES {amount.toLocaleString()}</p>
        </DialogHeader>

        {/* ── Method selection ── */}
        {step === "select" && (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-[#0E0B08]/50">Choose payment method</p>

            <button
              onClick={() => { setMethod("MPESA"); setStep("mpesa-confirm") }}
              className="w-full flex items-center gap-4 rounded-xl p-4 transition-all border-2 text-left hover:border-[#1E3D2F]/40"
              style={{ border: "2px solid rgba(30,61,47,0.15)", background: "rgba(30,61,47,0.03)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#1E3D2F" }}>
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0E0B08]">M-Pesa</p>
                <p className="text-xs text-[#0E0B08]/50 mt-0.5">STK push to your phone. Enter PIN to pay.</p>
              </div>
            </button>

            <button
              onClick={() => { setMethod("CARD"); initiateMutation.mutate() }}
              disabled={initiateMutation.isPending}
              className="w-full flex items-center gap-4 rounded-xl p-4 transition-all text-left"
              style={{ border: "2px solid rgba(201,146,42,0.2)", background: "rgba(201,146,42,0.04)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#C9922A" }}>
                {initiateMutation.isPending && method === "CARD"
                  ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                  : <CreditCard className="h-5 w-5 text-white" />
                }
              </div>
              <div>
                <p className="text-sm font-bold text-[#0E0B08]">Card</p>
                <p className="text-xs text-[#0E0B08]/50 mt-0.5">Visa / Mastercard. Secure hosted checkout.</p>
              </div>
            </button>
          </div>
        )}

        {/* ── M-Pesa: confirm phone ── */}
        {step === "mpesa-confirm" && (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-[#0E0B08]/60 leading-relaxed">
              An M-Pesa payment prompt will be sent to your phone. Enter your PIN to complete.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0E0B08]">M-Pesa phone number</label>
              <input
                type="tel"
                placeholder="+254712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-11 rounded-xl border border-black/10 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3D2F]/20"
              />
              <p className="text-[10px] text-[#0E0B08]/40">Format: +254 7XX XXX XXX</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep("select")}
                className="flex-1 h-11 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                style={{ background: "rgba(14,11,8,0.06)", color: "#0E0B08" }}
              >
                Back
              </button>
              <button
                onClick={() => initiateMutation.mutate()}
                disabled={!phoneValid || initiateMutation.isPending}
                className="flex-1 h-11 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "#1E3D2F", color: "#fff" }}
              >
                {initiateMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                  : <><Smartphone className="h-4 w-4" /> Send KES {amount}</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ── M-Pesa: waiting for PIN ── */}
        {step === "mpesa-waiting" && (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(30,61,47,0.1)" }}>
              <Smartphone className="h-8 w-8 animate-pulse" style={{ color: "#1E3D2F" }} />
            </div>
            <div>
              <p className="text-base font-bold text-[#0E0B08]">Check your phone</p>
              <p className="text-sm text-[#0E0B08]/50 mt-1">
                Enter your M-Pesa PIN on <strong>{phone}</strong> to complete the payment.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-[#0E0B08]/40">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Waiting for confirmation…
            </div>
            <button
              onClick={handleClose}
              className="text-xs text-[#0E0B08]/40 hover:text-[#0E0B08]/70 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Card: waiting for checkout ── */}
        {step === "card-waiting" && (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(201,146,42,0.1)" }}>
              <CreditCard className="h-8 w-8" style={{ color: "#C9922A" }} />
            </div>
            <div>
              <p className="text-base font-bold text-[#0E0B08]">Complete payment in new tab</p>
              <p className="text-sm text-[#0E0B08]/50 mt-1">
                A secure Flutterwave checkout was opened. Come back here once done.
              </p>
            </div>
            {cardLink && (
              <a
                href={cardLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2"
                style={{ color: "#C9922A" }}
              >
                Reopen checkout <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <div className="flex items-center justify-center gap-2 text-xs text-[#0E0B08]/40">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Waiting for confirmation…
            </div>
            <button
              onClick={handleClose}
              className="text-xs text-[#0E0B08]/40 hover:text-[#0E0B08]/70 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Success ── */}
        {step === "success" && (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(30,61,47,0.1)" }}>
              <CheckCircle2 className="h-8 w-8" style={{ color: "#1E3D2F" }} />
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: "#1E3D2F" }}>Payment confirmed!</p>
              <p className="text-sm text-[#0E0B08]/50 mt-1">KES {amount.toLocaleString()} received.</p>
            </div>
            <button
              onClick={handleClose}
              className="w-full h-11 rounded-xl text-sm font-bold transition-all hover:opacity-90"
              style={{ background: "#1E3D2F", color: "#fff" }}
            >
              Done
            </button>
          </div>
        )}

        {/* ── Failed ── */}
        {step === "failed" && (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(176,58,30,0.08)" }}>
              <XCircle className="h-8 w-8" style={{ color: "#B03A1E" }} />
            </div>
            <div>
              <p className="text-base font-bold text-[#0E0B08]">Payment failed</p>
              <p className="text-sm text-[#0E0B08]/50 mt-1">
                The payment was cancelled or timed out. Please try again.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 h-11 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(14,11,8,0.06)", color: "#0E0B08" }}
              >
                Close
              </button>
              <button
                onClick={() => setStep("select")}
                className="flex-1 h-11 rounded-xl text-sm font-bold hover:opacity-90"
                style={{ background: "#1E3D2F", color: "#fff" }}
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
