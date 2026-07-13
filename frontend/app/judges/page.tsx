"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { ApiError } from "@/lib/api"
import { Sparkles, ArrowRight, MessageCircle, ScrollText } from "lucide-react"

const CREAM = "#F7F2E8"
const INK = "#0A1F14"
const GOLD = "#C9922A"
const TEAL = "#2A6B7C"

/**
 * Judges' door. A shared access code (no signup, no magic-link inbox) drops a
 * hackathon judge into a pre-seeded demo account, landing on the flagship
 * Baraza deliberation. Pairs with POST /auth/demo-login + the demo seed.
 */
export default function JudgesPage() {
  const router = useRouter()
  const { demoLogin, isLoading } = useAuth()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const { demoProposalId } = await demoLogin(code.trim())
      router.push(demoProposalId ? `/proposals/${demoProposalId}` : "/dashboard")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid access code.")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: CREAM }}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-sm p-8" style={{ border: `1px solid ${GOLD}33` }}>
        <div className="flex items-center gap-2 mb-1" style={{ color: GOLD }}>
          <Sparkles size={18} />
          <span className="text-xs font-semibold uppercase tracking-wider">Hackathon judges</span>
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: INK }}>
          Try the live AI layer
        </h1>
        <p className="text-sm mb-6" style={{ color: `${INK}AA` }}>
          Enter the access code to explore UjamaaDAO&apos;s Baraza AI council on the
          live deployment — no signup, no email needed.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access code"
            autoFocus
            className="w-full rounded-lg px-4 py-3 text-sm outline-none"
            style={{ border: `1px solid ${INK}22`, color: INK }}
          />
          {error && (
            <p className="text-sm" style={{ color: "#B00020" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isLoading || !code.trim()}
            className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: INK }}
          >
            {isLoading ? "Signing in…" : "Enter the demo"}
            {!isLoading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="mt-7 pt-5 space-y-3" style={{ borderTop: `1px solid ${INK}11` }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: `${INK}88` }}>
            Once inside
          </p>
          <div className="flex items-start gap-3">
            <ScrollText size={18} style={{ color: TEAL, marginTop: 2 }} />
            <p className="text-sm" style={{ color: `${INK}CC` }}>
              You land on a <strong>completed Baraza deliberation</strong> — the multi-agent
              council&apos;s readiness read, agent voices, tensions, and values check. Instant, full depth.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <MessageCircle size={18} style={{ color: TEAL, marginTop: 2 }} />
            <p className="text-sm" style={{ color: `${INK}CC` }}>
              Chat with <strong>Buda</strong> (bottom-right) — it answers live over Qwen + RAG in seconds.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Sparkles size={18} style={{ color: TEAL, marginTop: 2 }} />
            <p className="text-sm" style={{ color: `${INK}CC` }}>
              Optional: submit your own proposal to watch a <strong>fresh council run</strong> (~4–6 min on the worker).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
