"use client"

import { useState } from "react"
import { startAuthentication } from "@simplewebauthn/browser"
import { webAuthnApi, tokenStore } from "@/lib/api"
import { useRouter } from "next/navigation"
import { Fingerprint, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PasskeyLoginButtonProps {
  email: string
}

export function PasskeyLoginButton({ email }: PasskeyLoginButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  async function handlePasskeyLogin() {
    if (!email.trim()) {
      toast({ title: "Enter your email first", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const options = await webAuthnApi.getLoginOptions(email.trim())
      const authResponse = await startAuthentication({ optionsJSON: options })
      const result = await webAuthnApi.verifyLogin(email.trim(), authResponse)
      // Store the session token and do a hard redirect so auth state re-initialises
      tokenStore.set(result.sessionToken)
      window.location.href = "/dashboard"
    } catch (err: any) {
      // User cancelled the biometric prompt — don't show an error
      if (err?.name === "NotAllowedError") return
      toast({
        title: "Passkey sign-in failed",
        description: err?.message ?? "Try the magic link instead.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handlePasskeyLogin}
      disabled={loading || !email.trim()}
      className="w-full flex items-center justify-center gap-2 h-11 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40"
      style={{
        background: "rgba(29,71,49,0.08)",
        color: "#1D4731",
        border: "1px solid rgba(29,71,49,0.15)",
      }}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Fingerprint className="h-4 w-4" />
      )}
      {loading ? "Verifying\u2026" : "Sign in with passkey"}
    </button>
  )
}
