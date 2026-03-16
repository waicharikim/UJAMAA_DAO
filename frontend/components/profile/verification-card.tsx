"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { authApi, userApi } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Circle, Loader2, Phone, Users, ShieldCheck } from "lucide-react"

// ─── Verification level ordering ──────────────────────────
const LEVELS = ["EMAIL_VERIFIED", "PHONE_VERIFIED", "COMMUNITY_VERIFIED", "FULL_VERIFIED"] as const
type Level = typeof LEVELS[number]

const LEVEL_LABELS: Record<Level, string> = {
  EMAIL_VERIFIED:     "Email verified",
  PHONE_VERIFIED:     "Phone verified",
  COMMUNITY_VERIFIED: "Community verified",
  FULL_VERIFIED:      "Fully verified",
}

function levelIndex(level: string | undefined) {
  return LEVELS.indexOf((level ?? "") as Level)
}

// ─── Phone verification step ───────────────────────────────
function PhoneStep() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const [phone, setPhone] = useState(user?.phone ?? "")
  const [code, setCode] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [devCode, setDevCode] = useState<string | undefined>()
  const [verified, setVerified] = useState(false)

  const sendMutation = useMutation({
    mutationFn: () => authApi.sendPhoneCode(phone),
    onSuccess: (data) => {
      setCodeSent(true)
      if (data?.devCode) {
        setDevCode(data.devCode)
        toast({ title: "Dev mode — code auto-filled", description: `SMS not enabled. Code: ${data.devCode}` })
      } else {
        toast({ title: "Code sent", description: "Check your phone for the 6-digit SMS code." })
      }
    },
    onError: (err: any) => {
      toast({ title: "Failed to send code", description: err?.message ?? "Try again.", variant: "destructive" })
    },
  })

  const verifyMutation = useMutation({
    mutationFn: () => authApi.verifyPhoneCode(phone, code || devCode || ""),
    onSuccess: async (data) => {
      if (data?.verified) {
        setVerified(true)
        await refreshUser()
      } else {
        toast({ title: "Incorrect code", description: "Check the SMS and try again.", variant: "destructive" })
      }
    },
    onError: (err: any) => {
      toast({ title: "Verification failed", description: err?.message ?? "Try again.", variant: "destructive" })
    },
  })

  if (verified) {
    return (
      <div
        className="flex items-center gap-3 rounded-xl p-4"
        style={{ background: "rgba(42,82,64,0.08)", border: "1px solid rgba(42,82,64,0.2)" }}
      >
        <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: "#1E3D2F" }} />
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: "#1E3D2F" }}>Phone verified!</p>
          <p className="text-xs text-[#0E0B08]/50 mt-0.5">Moving to community verification…</p>
        </div>
        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" style={{ color: "#1E3D2F" }} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#0E0B08]/60 leading-relaxed">
        Verify your Kenyan mobile number to unlock community verification and economic features.
        A 6-digit code will be sent by SMS.
      </p>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-[#0E0B08]">Phone number (Kenyan format)</label>
        <div className="flex gap-2">
          <input
            type="tel"
            placeholder="+254712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={codeSent}
            className="flex-1 h-10 rounded-lg border border-black/10 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9922A]/30 disabled:opacity-50"
          />
          <button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !phone.match(/^\+254[17]\d{8}$/) || codeSent}
            className="flex-shrink-0 h-10 rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: "#1E3D2F", color: "#fff" }}
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send code"}
          </button>
        </div>
        <p className="text-[10px] text-[#0E0B08]/40">Format: +254 7XX XXX XXX or +254 1XX XXX XXX</p>
      </div>

      {codeSent && (
        <div className="space-y-2">
          {devCode && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-mono"
              style={{ background: "rgba(201,146,42,0.1)", color: "#C9922A", border: "1px dashed rgba(201,146,42,0.4)" }}
            >
              <span className="font-sans font-semibold">DEV — code:</span>
              <span className="tracking-widest font-bold">{devCode}</span>
            </div>
          )}
          <label className="text-xs font-semibold text-[#0E0B08]">6-digit SMS code</label>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="123456"
              maxLength={6}
              value={devCode && !code ? devCode : code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="flex-1 h-10 rounded-lg border border-black/10 bg-white px-3 text-sm tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-[#C9922A]/30"
            />
            <button
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending || (code || devCode || "").length !== 6}
              className="flex-shrink-0 h-10 rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "#C9922A", color: "#fff" }}
            >
              {verifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
            </button>
          </div>
          <button
            onClick={() => { setCodeSent(false); setCode("") }}
            className="text-[11px] text-[#0E0B08]/40 hover:text-[#0E0B08]/70 transition-colors"
          >
            Use a different number
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Community verification step ──────────────────────────
function CommunityStep() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [txId, setTxId] = useState("")
  const [showPayment, setShowPayment] = useState(false)
  const [copied, setCopied] = useState(false)

  const profileUrl = typeof window !== "undefined"
    ? `${window.location.origin}/profile/${user?.id}`
    : ""

  function copyLink() {
    navigator.clipboard.writeText(profileUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["community-verification-status"],
    queryFn: () => userApi.getVerificationStatus(),
    staleTime: 30_000,
    retry: false,
  })

  const requestMutation = useMutation({
    mutationFn: () => userApi.requestCommunityVerification(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-verification-status"] })
      toast({ title: "Verification requested", description: "Share your ward with 3 neighbours and ask them to vouch for you." })
    },
    onError: (err: any) => {
      toast({ title: "Request failed", description: err?.message ?? "Try again.", variant: "destructive" })
    },
  })

  const paymentMutation = useMutation({
    mutationFn: () => userApi.payForVerification(txId),
    onSuccess: async () => {
      await refreshUser()
      toast({ title: "Payment verified", description: "You are now community verified!" })
    },
    onError: (err: any) => {
      toast({ title: "Payment failed", description: err?.message ?? "Check your transaction ID and try again.", variant: "destructive" })
    },
  })

  const vouchesReceived = status?.vouchesReceived ?? 0
  const vouchesNeeded  = status?.vouchesNeeded  ?? 3
  const isVouching     = status?.status === "VOUCHING"
  const hasNoRequest   = !status || status.status === "EXPIRED" || status.status === "REJECTED"

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#0E0B08]/60 leading-relaxed">
        Get vouched for by 3 community-verified neighbours in your ward, or pay a one-time KES 100 verification fee.
      </p>

      {/* Share profile link */}
      <div
        className="rounded-xl p-3 space-y-2"
        style={{ background: "rgba(14,11,8,0.04)", border: "1px solid rgba(14,11,8,0.08)" }}
      >
        <p className="text-xs font-semibold text-[#0E0B08]">Share your profile link with ward neighbours</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={profileUrl}
            className="flex-1 h-9 rounded-lg border border-black/10 bg-white px-3 text-xs font-mono text-[#0E0B08]/60 focus:outline-none"
          />
          <button
            onClick={copyLink}
            className="flex-shrink-0 h-9 rounded-lg px-3 text-xs font-semibold transition-all hover:opacity-90"
            style={{ background: copied ? "rgba(42,82,64,0.12)" : "#1E3D2F", color: copied ? "#1E3D2F" : "#fff" }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="text-[10px] text-[#0E0B08]/40">
          Ask 3 community-verified neighbours in your ward to open this link and click "Vouch".
        </p>
      </div>

      {statusLoading ? (
        <div className="h-16 rounded-xl bg-black/4 animate-pulse" />
      ) : isVouching ? (
        // ── Active vouching phase ──
        <div className="space-y-3">
          <div
            className="rounded-xl p-4"
            style={{ background: "rgba(42,82,64,0.06)", border: "1px solid rgba(42,82,64,0.15)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-[#1E3D2F]">Vouches received</span>
              <span className="text-sm font-bold text-[#1E3D2F]">{vouchesReceived} / {vouchesNeeded}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(42,82,64,0.12)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(vouchesReceived / vouchesNeeded) * 100}%`, background: "#1E3D2F" }}
              />
            </div>
            {status?.expiresAt && (
              <p className="text-[10px] text-[#0E0B08]/40 mt-2">
                Expires {new Date(status.expiresAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
              </p>
            )}
          </div>
          <p className="text-xs text-[#0E0B08]/50">
            Share your profile with community-verified ward neighbours and ask them to go to your profile to vouch for you.
          </p>
        </div>
      ) : hasNoRequest ? (
        // ── No active request ──
        <button
          onClick={() => requestMutation.mutate()}
          disabled={requestMutation.isPending}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: "#1E3D2F", color: "#fff" }}
        >
          {requestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          {requestMutation.isPending ? "Requesting…" : "Start verification — get 3 vouches"}
        </button>
      ) : null}

      {/* Payment fallback */}
      <div>
        <button
          onClick={() => setShowPayment((v) => !v)}
          className="text-xs font-semibold underline underline-offset-2"
          style={{ color: "#C9922A" }}
        >
          {showPayment ? "Hide payment option" : "Or pay KES 100 via M-Pesa instead"}
        </button>

        {showPayment && (
          <div
            className="mt-3 rounded-xl p-4 space-y-3"
            style={{ background: "rgba(201,146,42,0.06)", border: "1px solid rgba(201,146,42,0.15)" }}
          >
            <p className="text-xs text-[#0E0B08]/60 leading-relaxed">
              Send <strong>KES 100</strong> to <strong>Paybill 400200, Account: UJAMAA</strong>, then enter your M-Pesa confirmation code below.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. RGH7X2MNOP"
                value={txId}
                onChange={(e) => setTxId(e.target.value.toUpperCase())}
                className="flex-1 h-10 rounded-lg border border-black/10 bg-white px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#C9922A]/30"
              />
              <button
                onClick={() => paymentMutation.mutate()}
                disabled={paymentMutation.isPending || txId.length < 10}
                className="flex-shrink-0 h-10 rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: "#C9922A", color: "#fff" }}
              >
                {paymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main card ─────────────────────────────────────────────
export function VerificationCard() {
  const { user } = useAuth()
  const currentLevel = user?.verificationLevel ?? "EMAIL_VERIFIED"
  const currentIdx   = levelIndex(currentLevel)

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" style={{ color: "#1E3D2F" }} />
          Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress stepper */}
        <div className="flex items-center gap-1">
          {LEVELS.map((level, idx) => {
            const done    = idx <= currentIdx
            const active  = idx === currentIdx + 1
            const isLast  = idx === LEVELS.length - 1
            return (
              <div key={level} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  {done ? (
                    <CheckCircle className="h-5 w-5" style={{ color: "#1E3D2F" }} />
                  ) : (
                    <Circle
                      className="h-5 w-5"
                      style={{ color: active ? "#C9922A" : "rgba(14,11,8,0.18)" }}
                    />
                  )}
                  <span
                    className="text-[9px] font-semibold text-center leading-tight"
                    style={{ color: done ? "#1E3D2F" : active ? "#C9922A" : "rgba(14,11,8,0.3)", maxWidth: 54 }}
                  >
                    {LEVEL_LABELS[level]}
                  </span>
                </div>
                {!isLast && (
                  <div
                    className="flex-1 h-0.5 mx-1 mb-4"
                    style={{ background: idx < currentIdx ? "#1E3D2F" : "rgba(14,11,8,0.1)" }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Active step content */}
        {currentLevel === "EMAIL_VERIFIED" && (
          <div className="pt-2 border-t border-black/6">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="h-4 w-4" style={{ color: "#C9922A" }} />
              <p className="text-sm font-semibold text-[#0E0B08]">Next: verify your phone</p>
            </div>
            <PhoneStep />
          </div>
        )}

        {currentLevel === "PHONE_VERIFIED" && (
          <div className="pt-2 border-t border-black/6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4" style={{ color: "#C9922A" }} />
              <p className="text-sm font-semibold text-[#0E0B08]">Next: get community verified</p>
            </div>
            <CommunityStep />
          </div>
        )}

        {(currentLevel === "COMMUNITY_VERIFIED" || currentLevel === "FULL_VERIFIED") && (
          <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: "rgba(42,82,64,0.07)" }}>
            <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: "#1E3D2F" }} />
            <p className="text-sm font-semibold" style={{ color: "#1E3D2F" }}>
              {currentLevel === "FULL_VERIFIED" ? "Fully verified — all features unlocked." : "Community verified — you can vote, propose, and trade."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
