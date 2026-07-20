"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { projectApi, type ScanQrResponseDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { CheckCircle2, AlertTriangle, Loader2, QrCode } from "lucide-react"

// ─────────────────────────────────────────────────────────
// Inner component (uses useSearchParams — must be inside Suspense)
// ─────────────────────────────────────────────────────────

function ScanInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  const secret = searchParams.get("secret") ?? ""

  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "error">("idle")
  const [result, setResult] = useState<ScanQrResponseDto | null>(null)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    if (authLoading) return
    if (!secret) {
      setStatus("error")
      setErrorMsg("No QR secret found in URL.")
      return
    }
    if (!isAuthenticated) return // wait for auth — handled below in render

    if (status === "idle") {
      setStatus("scanning")
      projectApi
        .scanQr(secret)
        .then((data) => {
          setResult(data)
          setStatus("success")
        })
        .catch((err) => {
          setErrorMsg(err?.message ?? "Check-in failed. The session may have expired.")
          setStatus("error")
        })
    }
  }, [authLoading, isAuthenticated, secret, status])

  const handleSignIn = () => {
    // Store the scan URL so we can return after auth
    if (typeof window !== "undefined") {
      sessionStorage.setItem("ujamaa-post-auth-redirect", window.location.href)
    }
    router.push("/auth/callback")
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "#F7F2E8" }}
    >
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / header */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "#1D4731" }}
          >
            <QrCode className="h-7 w-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="font-display font-bold text-xl text-[#0E0B08]">Work Session</h1>
            <p className="text-xs text-[#0E0B08]/50 mt-0.5">Physical presence check-in</p>
          </div>
        </div>

        {/* Auth loading */}
        {authLoading && (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[#1D4731]" />
            <span className="text-sm text-[#0E0B08]/50">Loading…</span>
          </div>
        )}

        {/* Not authenticated */}
        {!authLoading && !isAuthenticated && (
          <div
            className="rounded-2xl p-6 text-center space-y-4"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <p className="text-sm font-semibold text-[#0E0B08]">Sign in to check in</p>
            <p className="text-xs text-[#0E0B08]/50">
              You need to be logged in to record your attendance at this work session.
            </p>
            <button
              onClick={handleSignIn}
              className="w-full rounded-xl py-2.5 text-sm font-bold transition-all hover:opacity-90"
              style={{ background: "#1D4731", color: "#fff" }}
            >
              Sign In
            </button>
          </div>
        )}

        {/* Scanning */}
        {status === "scanning" && (
          <div
            className="rounded-2xl p-6 text-center space-y-3"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <Loader2 className="h-8 w-8 animate-spin text-[#1D4731] mx-auto" />
            <p className="text-sm font-semibold text-[#0E0B08]">Checking you in…</p>
          </div>
        )}

        {/* Success */}
        {status === "success" && result && (
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(29,71,49,0.1)" }}
              >
                <CheckCircle2 className="h-6 w-6" style={{ color: "#1D4731" }} />
              </div>
              <h2 className="font-bold text-lg text-[#0E0B08]">You&apos;re checked in!</h2>
              <p className="text-xs text-[#0E0B08]/50">
                {result.depth === 0
                  ? "Recorded as a direct scan — your attendance anchors this session."
                  : `Recorded at chain depth ${result.depth} — attested by a team member.`}
              </p>
            </div>

            <div
              className="rounded-xl px-4 py-3 text-center text-xs font-semibold"
              style={{ background: "rgba(29,71,49,0.07)", color: "#1D4731" }}
            >
              {result.depth === 0
                ? "Chain depth: Direct scan (depth 0)"
                : `Chain depth: ${result.depth}`}
            </div>

            <p className="text-[11px] text-center text-[#0E0B08]/40">
              You&apos;ll earn 10 Impact Points when the session is approved.
            </p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(176,58,30,0.1)" }}
              >
                <AlertTriangle className="h-6 w-6" style={{ color: "#B03A1E" }} />
              </div>
              <h2 className="font-bold text-lg text-[#0E0B08]">Check-in failed</h2>
              <p className="text-xs text-[#0E0B08]/50">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Back link */}
        {!authLoading && (
          <div className="text-center">
            <Link
              href="/projects"
              className="text-xs text-[#0E0B08]/40 hover:text-[#0E0B08]/70 transition-colors"
            >
              ← Back to projects
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Page export — Suspense boundary required for useSearchParams
// ─────────────────────────────────────────────────────────

export default function ScanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F7F2E8" }}>
        <Loader2 className="h-6 w-6 animate-spin text-[#1D4731]" />
      </div>
    }>
      <ScanInner />
    </Suspense>
  )
}
