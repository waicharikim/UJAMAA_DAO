"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"
import Link from "next/link"

// JWT magic-link tokens have exactly 2 dots (3 base64url segments).
// Email verification tokens are hex strings with no dots.
function isJwtToken(token: string): boolean {
  return (token.match(/\./g) ?? []).length === 2
}

function CallbackInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { verifyMagicLink, verifyEmailToken } = useAuth()
  const called = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const token = searchParams.get("token")
    if (!token) {
      setError("No token found in the link. Please request a new login link.")
      return
    }

    const verify = isJwtToken(token) ? verifyMagicLink(token) : verifyEmailToken(token)
    verify
      .then(() => {
        // Hard redirect so the page fully re-initialises auth state
        window.location.href = "/dashboard"
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Login link is invalid or expired."
        setError(msg)
      })
  }, [searchParams, verifyMagicLink, verifyEmailToken, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">⚠️</div>
          <p className="font-semibold text-chai">Sign-in failed</p>
          <p className="text-sm text-chai/60">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-amber px-6 py-2.5 text-sm font-semibold text-tea-dark hover:bg-amber-bright transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: "#D4911E" }} />
        <p className="text-sm text-chai/60">Signing you in…</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#D4911E" }} />
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  )
}
