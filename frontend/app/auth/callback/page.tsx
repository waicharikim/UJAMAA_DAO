"use client"

import { Suspense, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"

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

  useEffect(() => {
    if (called.current) return
    called.current = true

    const token = searchParams.get("token")
    if (!token) {
      router.replace("/?error=missing_token")
      return
    }

    const verify = isJwtToken(token) ? verifyMagicLink(token) : verifyEmailToken(token)
    verify
      .then(() => router.replace("/dashboard"))
      .catch(() => router.replace("/?error=invalid_token"))
  }, [searchParams, verifyMagicLink, verifyEmailToken, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: "#C9922A" }} />
        <p className="text-sm text-[#0E0B08]/60">Signing you in...</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#C9922A" }} />
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  )
}
