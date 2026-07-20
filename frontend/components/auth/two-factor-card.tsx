"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { authApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ShieldCheck,
  ShieldOff,
  ScanLine,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react"

type Step = "idle" | "setup" | "disabling" | "regenerating" | "new-codes"

function CodeInput({
  value,
  onChange,
  placeholder = "6-digit code",
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      placeholder={placeholder}
      className="w-full h-10 rounded-xl border border-black/10 bg-white px-3 text-center text-lg font-mono tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[#1D4731]/30"
    />
  )
}

function BackupCodeGrid({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(codes.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {codes.map((c, i) => (
          <div
            key={i}
            className="rounded-lg px-3 py-2 text-center text-xs font-mono font-semibold"
            style={{ background: "rgba(0,0,0,0.04)", color: "#0E0B08" }}
          >
            {c}
          </div>
        ))}
      </div>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
        style={{ color: "#2A6B7C" }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied!" : "Copy all codes"}
      </button>
    </div>
  )
}

export function TwoFactorCard() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>("idle")
  const [code, setCode] = useState("")
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeUrl: string; backupCodes: string[] } | null>(null)
  const [newCodes, setNewCodes] = useState<string[]>([])

  const { data: status, isLoading } = useQuery({
    queryKey: ["2fa-status"],
    queryFn:  () => authApi.get2FAStatus(),
    staleTime: 60_000,
  })

  const enableMut = useMutation({
    mutationFn: () => authApi.enable2FA(),
    onSuccess: (data) => {
      setSetupData(data)
      setStep("setup")
      setCode("")
    },
    onError: (e: any) => toast({ title: "Failed to start 2FA setup", description: e?.message, variant: "destructive" }),
  })

  const verifyMut = useMutation({
    mutationFn: () => authApi.verify2FA(code),
    onSuccess: () => {
      toast({ title: "Two-factor authentication enabled" })
      queryClient.invalidateQueries({ queryKey: ["2fa-status"] })
      setStep("idle")
      setSetupData(null)
      setCode("")
    },
    onError: (e: any) => toast({ title: "Invalid code", description: e?.message ?? "Try again.", variant: "destructive" }),
  })

  const disableMut = useMutation({
    mutationFn: () => authApi.disable2FA(code),
    onSuccess: () => {
      toast({ title: "Two-factor authentication disabled" })
      queryClient.invalidateQueries({ queryKey: ["2fa-status"] })
      setStep("idle")
      setCode("")
    },
    onError: (e: any) => toast({ title: "Invalid code", description: e?.message ?? "Try again.", variant: "destructive" }),
  })

  const regenMut = useMutation({
    mutationFn: () => authApi.regenerateBackupCodes(code),
    onSuccess: (data) => {
      setNewCodes(data.backupCodes)
      setStep("new-codes")
      queryClient.invalidateQueries({ queryKey: ["2fa-status"] })
      setCode("")
    },
    onError: (e: any) => toast({ title: "Invalid code", description: e?.message ?? "Try again.", variant: "destructive" }),
  })

  const cancel = () => { setStep("idle"); setCode(""); setSetupData(null); setNewCodes([]) }

  return (
    <Card className="rounded-2xl border-0 shadow-sm" style={{ background: "#fff" }}>
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#0E0B08]">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: status?.enabled ? "rgba(29,71,49,0.10)" : "rgba(176,58,30,0.08)" }}
          >
            {status?.enabled
              ? <ShieldCheck className="h-3.5 w-3.5" style={{ color: "#1D4731" }} />
              : <ShieldOff className="h-3.5 w-3.5" style={{ color: "#B03A1E" }} />
            }
          </div>
          Two-Factor Authentication
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-9 w-32 rounded-xl" />
          </div>
        ) : (

          /* ── Idle state ─────────────────────────────────── */
          step === "idle" && (
            <div className="space-y-3">
              {status?.enabled ? (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold" style={{ color: "#1D4731" }}>
                      Authenticator app linked
                    </p>
                    <p className="text-[11px] text-[#0E0B08]/50">
                      {status.backupCodesRemaining} backup code{status.backupCodesRemaining !== 1 ? "s" : ""} remaining
                      {status.backupCodesRemaining <= 3 && (
                        <span className="ml-1.5 font-semibold" style={{ color: "#C9922A" }}>
                          — running low
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep("regenerating")}
                      className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{ background: "rgba(42,107,124,0.08)", color: "#2A6B7C" }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> New backup codes
                    </button>
                    <button
                      onClick={() => setStep("disabling")}
                      className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{ background: "rgba(176,58,30,0.08)", color: "#B03A1E" }}
                    >
                      Disable 2FA
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-[#0E0B08]/55 leading-relaxed">
                    Add a second layer of security. When enabled you'll need a code from your authenticator app to sign in.
                  </p>
                  <button
                    onClick={() => enableMut.mutate()}
                    disabled={enableMut.isPending}
                    className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: "#1D4731", color: "#fff" }}
                  >
                    {enableMut.isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <ScanLine className="h-3.5 w-3.5" />
                    }
                    Set up 2FA
                  </button>
                </>
              )}
            </div>
          )
        )}

        {/* ── Setup: QR + backup codes + verify ─────────── */}
        {step === "setup" && setupData && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-[#0E0B08] mb-1">1. Scan this QR code</p>
              <p className="text-[11px] text-[#0E0B08]/50 mb-3">
                Open Google Authenticator, Authy, or any TOTP app and scan:
              </p>
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={setupData.qrCodeUrl}
                  alt="2FA QR code"
                  className="w-44 h-44 rounded-xl"
                  style={{ border: "1px solid rgba(0,0,0,0.07)" }}
                />
              </div>
              <details className="mt-2">
                <summary className="text-[11px] text-[#0E0B08]/40 cursor-pointer select-none hover:text-[#0E0B08]/70 transition-colors">
                  Can't scan? Enter key manually
                </summary>
                <p className="mt-1.5 text-[11px] font-mono bg-black/[0.04] rounded-lg px-3 py-2 break-all text-[#0E0B08]/70">
                  {setupData.secret}
                </p>
              </details>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#0E0B08] mb-1">2. Save your backup codes</p>
              <p className="text-[11px] text-[#0E0B08]/50 mb-2">
                Store these somewhere safe. Each can be used once if you lose your phone.
              </p>
              <BackupCodeGrid codes={setupData.backupCodes} />
            </div>

            <div>
              <p className="text-xs font-semibold text-[#0E0B08] mb-2">3. Enter the 6-digit code from your app</p>
              <div className="space-y-2">
                <CodeInput value={code} onChange={setCode} />
                <div className="flex gap-2">
                  <button
                    onClick={() => verifyMut.mutate()}
                    disabled={code.length < 6 || verifyMut.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ background: "#1D4731", color: "#fff" }}
                  >
                    {verifyMut.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                    Verify & Enable
                  </button>
                  <button
                    onClick={cancel}
                    className="rounded-xl px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{ background: "rgba(0,0,0,0.05)", color: "#0E0B08" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Disable confirm ────────────────────────────── */}
        {step === "disabling" && (
          <div className="space-y-3">
            <div
              className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
              style={{ background: "rgba(176,58,30,0.07)", color: "#7A2010" }}
            >
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              Disabling 2FA makes your account less secure. Enter your current authenticator code to confirm.
            </div>
            <CodeInput value={code} onChange={setCode} />
            <div className="flex gap-2">
              <button
                onClick={() => disableMut.mutate()}
                disabled={code.length < 6 || disableMut.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: "#B03A1E", color: "#fff" }}
              >
                {disableMut.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Disable 2FA
              </button>
              <button
                onClick={cancel}
                className="rounded-xl px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: "rgba(0,0,0,0.05)", color: "#0E0B08" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Regenerate: confirm with code ─────────────── */}
        {step === "regenerating" && (
          <div className="space-y-3">
            <p className="text-xs text-[#0E0B08]/55">
              Your existing backup codes will be invalidated. Enter your authenticator code to continue.
            </p>
            <CodeInput value={code} onChange={setCode} />
            <div className="flex gap-2">
              <button
                onClick={() => regenMut.mutate()}
                disabled={code.length < 6 || regenMut.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: "#2A6B7C", color: "#fff" }}
              >
                {regenMut.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Generate new codes
              </button>
              <button
                onClick={cancel}
                className="rounded-xl px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: "rgba(0,0,0,0.05)", color: "#0E0B08" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── New codes display ──────────────────────────── */}
        {step === "new-codes" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#1D4731]">New backup codes generated — save these now</p>
            <BackupCodeGrid codes={newCodes} />
            <button
              onClick={cancel}
              className="w-full rounded-xl py-2 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: "rgba(29,71,49,0.08)", color: "#1D4731" }}
            >
              Done
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
