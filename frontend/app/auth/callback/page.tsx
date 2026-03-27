"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"

// Lazy-load passkey button — keeps @simplewebauthn/browser out of the initial bundle
const PasskeyLoginButton = dynamic(
  () => import("@/components/auth/passkey-login-button").then((m) => ({ default: m.PasskeyLoginButton })),
  { ssr: false, loading: () => null }
)

// JWT magic-link tokens have exactly 2 dots (3 base64url segments).
// Email verification tokens are hex strings with no dots.
function isJwtToken(token: string): boolean {
  return (token.match(/\./g) ?? []).length === 2
}

// ── Token processor — only mounted when ?token= is present ────────────────
function TokenProcessor({ token }: { token: string }) {
  const router = useRouter()
  const { verifyMagicLink, verifyEmailToken } = useAuth()
  const called = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const verify = isJwtToken(token) ? verifyMagicLink(token) : verifyEmailToken(token)
    verify
      .then(({ needsProfileCompletion }) => {
        window.location.href = needsProfileCompletion ? "/profile" : "/dashboard"
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Login link is invalid or expired."
        setError(msg)
      })
  }, [token, verifyMagicLink, verifyEmailToken, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">⚠️</div>
          <p className="font-semibold text-chai">Sign-in failed</p>
          <p className="text-sm text-chai/60">{error}</p>
          <Link
            href="/auth/callback"
            className="inline-flex items-center gap-2 rounded-full bg-amber px-6 py-2.5 text-sm font-semibold text-tea-dark hover:bg-amber-bright transition-colors"
          >
            Try again
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

// ── Sign-in form — shown when no token is present ──────────────────────────
function SignInForm() {
  const { requestMagicLink } = useAuth()
  const { toast } = useToastShim()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleMagicLink() {
    if (!email.trim()) return
    setLoading(true)
    try {
      await requestMagicLink({ email: email.trim() })
      setSent(true)
    } catch (err: any) {
      alert(err?.message ?? "Failed to send link. Try again.")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center space-y-3">
        <div className="text-4xl">📬</div>
        <p className="font-semibold text-chai">Check your email</p>
        <p className="text-sm text-chai/60">We sent a sign-in link to <strong>{email}</strong></p>
        <button
          onClick={() => setSent(false)}
          className="text-xs text-chai/40 hover:text-chai/70 underline underline-offset-2 transition-colors"
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-chai/70">Email address</label>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleMagicLink()}
          className="w-full h-11 rounded-xl border border-black/10 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9922A]/30"
        />
      </div>

      <button
        onClick={handleMagicLink}
        disabled={loading || !email.trim()}
        className="w-full h-11 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40"
        style={{ background: "#1D4731", color: "#fff" }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Send magic link"}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-black/8" />
        <span className="text-[11px] text-black/30 font-medium">or</span>
        <div className="flex-1 h-px bg-black/8" />
      </div>

      <PasskeyLoginButton email={email} />

      <p className="text-center text-xs text-chai/40">
        No account?{" "}
        <Link href="/auth/register" className="underline underline-offset-2 hover:text-chai/70 transition-colors">
          Create one
        </Link>
      </p>
    </div>
  )
}

// Simple toast shim so we don't add a dep just for the form
function useToastShim() {
  return { toast: (msg: { title: string }) => console.log(msg.title) }
}

// ── Page shell ─────────────────────────────────────────────────────────────
function CallbackInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  if (token) return <TokenProcessor token={token} />

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#F7F2E8" }}>
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-1">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center font-serif font-bold text-[22px] mx-auto"
            style={{ background: "linear-gradient(135deg, #D4911E 0%, #E9A52E 100%)", color: "#142F22", letterSpacing: "-1px" }}
          >
            UJ
          </div>
          <h1 className="font-serif font-bold text-2xl text-chai mt-3">Welcome back</h1>
          <p className="text-sm text-chai/50">Sign in to UjamaaDAO</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
          <SignInForm />
        </div>
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
