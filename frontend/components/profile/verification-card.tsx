"use client"

import React, { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { authApi, userApi } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Circle, Loader2, Phone, Users, ShieldCheck, MessageCircle, Send } from "lucide-react"
import { PaymentModal } from "@/components/payments/payment-modal"

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

type Channel = "sms" | "whatsapp" | "telegram"

const CHANNELS: { id: Channel; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: "sms",      label: "SMS",      icon: <Phone className="h-3.5 w-3.5" />,          hint: "Text message to your phone" },
  { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="h-3.5 w-3.5" />,  hint: "Message via WhatsApp" },
  { id: "telegram", label: "Telegram", icon: <Send className="h-3.5 w-3.5" />,           hint: "Via @Ujamaadaobot" },
]

// ─── Phone verification step ───────────────────────────────
function PhoneStep() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const [phone, setPhone] = useState(user?.phone ?? "")
  const [channel, setChannel] = useState<Channel>("sms")
  const [code, setCode] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [devCode, setDevCode] = useState<string | undefined>()
  const [telegramCode, setTelegramCode] = useState<string | undefined>()
  const [verified, setVerified] = useState(false)

  const sendMutation = useMutation({
    mutationFn: () => authApi.sendPhoneCode(phone, channel),
    onSuccess: (data) => {
      setCodeSent(true)
      if (data?.telegramCode) {
        setTelegramCode(data.telegramCode)
      } else if (data?.devCode) {
        setDevCode(data.devCode)
        toast({ title: "Dev mode", description: `SMS not enabled. Code: ${data.devCode}` })
      } else {
        const channelLabel = channel === "whatsapp" ? "WhatsApp" : "SMS"
        toast({ title: "Code sent", description: `Check your ${channelLabel} for the 6-digit code.` })
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
        toast({ title: "Incorrect code", description: "Try again.", variant: "destructive" })
      }
    },
    onError: (err: any) => {
      toast({ title: "Verification failed", description: err?.message ?? "Try again.", variant: "destructive" })
    },
  })

  // Telegram: poll refreshUser until phoneVerified flips
  const checkTelegramMutation = useMutation({
    mutationFn: async () => {
      await refreshUser()
      return user?.phone !== undefined || true
    },
    onSuccess: async () => {
      await refreshUser()
      if (user?.verificationLevel !== "EMAIL_VERIFIED") {
        setVerified(true)
      } else {
        toast({ title: "Not yet verified", description: "Send the command to @Ujamaadaobot first, then check again.", variant: "destructive" })
      }
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
        Verify your Kenyan mobile number to unlock community features. Choose how you'd like to receive your code.
      </p>

      {/* Channel selector */}
      {!codeSent && (
        <div className="flex gap-2">
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setChannel(ch.id)}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold border transition-all"
              style={
                channel === ch.id
                  ? { background: "#1E3D2F", color: "#fff", borderColor: "#1E3D2F" }
                  : { background: "white", color: "#0E0B08", borderColor: "rgba(0,0,0,0.12)" }
              }
            >
              {ch.icon}
              {ch.label}
            </button>
          ))}
        </div>
      )}

      {/* Phone input */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[#0E0B08]">Phone number</label>
        <div className="flex gap-2">
          <input
            type="tel"
            placeholder="+254712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={codeSent}
            className="flex-1 h-10 rounded-lg border border-black/10 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9922A]/30 disabled:opacity-50"
          />
          {!codeSent && (
            <button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !phone.match(/^\+254[17]\d{8}$/)}
              className="flex-shrink-0 h-10 rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "#1E3D2F", color: "#fff" }}
            >
              {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send code"}
            </button>
          )}
        </div>
        <p className="text-[10px] text-[#0E0B08]/40">Format: +254 7XX XXX XXX or +254 1XX XXX XXX</p>
      </div>

      {/* Telegram instructions */}
      {codeSent && channel === "telegram" && telegramCode && (
        <div className="space-y-3">
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ background: "rgba(34,158,217,0.08)", border: "1px solid rgba(34,158,217,0.2)" }}
          >
            <p className="text-xs font-semibold" style={{ color: "#1A7DB5" }}>Open @Ujamaadaobot on Telegram and send:</p>
            <div
              className="rounded-lg px-3 py-2 font-mono text-sm font-bold tracking-wider text-center select-all"
              style={{ background: "rgba(34,158,217,0.12)", color: "#1A7DB5" }}
            >
              /verify {telegramCode}
            </div>
            <p className="text-[10px] text-[#0E0B08]/40">
              This also links your Telegram account so /present works in baraza groups.
            </p>
          </div>
          <button
            onClick={() => checkTelegramMutation.mutate()}
            disabled={checkTelegramMutation.isPending}
            className="w-full h-10 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: "#1E3D2F", color: "#fff" }}
          >
            {checkTelegramMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "I've sent it — check verification"}
          </button>
          <button
            onClick={() => { setCodeSent(false); setTelegramCode(undefined) }}
            className="text-[11px] text-[#0E0B08]/40 hover:text-[#0E0B08]/70 transition-colors w-full text-center"
          >
            Use a different number
          </button>
        </div>
      )}

      {/* SMS / WhatsApp code entry */}
      {codeSent && channel !== "telegram" && (
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
          <label className="text-xs font-semibold text-[#0E0B08]">6-digit code</label>
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
            onClick={() => { setCodeSent(false); setCode(""); setDevCode(undefined) }}
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
  const [payModalOpen, setPayModalOpen] = useState(false)
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

  async function handleVerificationPaymentSuccess() {
    setPayModalOpen(false)
    await refreshUser()
    queryClient.invalidateQueries({ queryKey: ["community-verification-status"] })
    toast({ title: "Payment verified", description: "You are now community verified!" })
  }

  const vouchesReceived = status?.vouchesReceived ?? 0
  const vouchesNeeded  = status?.vouchesNeeded  ?? 3
  const isVouching     = status?.status === "VOUCHING"
  const hasNoRequest   = !status || status.status === "EXPIRED" || status.status === "REJECTED"

  return (
    <>
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
          onClick={() => setPayModalOpen(true)}
          className="text-xs font-semibold underline underline-offset-2"
          style={{ color: "#C9922A" }}
        >
          Or pay KES 100 via M-Pesa / Card instead
        </button>
      </div>
    </div>

    <PaymentModal
      open={payModalOpen}
      onClose={() => setPayModalOpen(false)}
      purpose="VERIFICATION"
      amount={100}
      label="Community verification fee"
      onSuccess={handleVerificationPaymentSuccess}
    />
    </>
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
