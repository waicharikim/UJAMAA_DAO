"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { startRegistration } from "@simplewebauthn/browser"
import { webAuthnApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Fingerprint, Trash2, Plus, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"

export function PasskeyManager() {
  const { isAuthenticated } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [registering, setRegistering] = useState(false)

  const { data: passkeys = [], isLoading } = useQuery({
    queryKey: ["passkeys"],
    queryFn: webAuthnApi.listCredentials,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => webAuthnApi.deleteCredential(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["passkeys"] })
      toast({ title: "Passkey removed" })
    },
    onError: (err: any) => {
      toast({
        title: "Failed to remove passkey",
        description: err?.message,
        variant: "destructive",
      })
    },
  })

  async function handleAddPasskey() {
    setRegistering(true)
    try {
      const options = await webAuthnApi.getRegistrationOptions()
      const regResponse = await startRegistration({ optionsJSON: options })
      const result = await webAuthnApi.verifyRegistration(regResponse)
      queryClient.invalidateQueries({ queryKey: ["passkeys"] })
      toast({
        title: "Passkey added",
        description: `Saved as "${result.credentialName ?? "Passkey"}"`,
      })
    } catch (err: any) {
      if (err?.name === "NotAllowedError") return // user cancelled
      toast({
        title: "Passkey setup failed",
        description: err?.message ?? "Try again.",
        variant: "destructive",
      })
    } finally {
      setRegistering(false)
    }
  }

  if (!isAuthenticated) return null

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Fingerprint className="h-4 w-4" style={{ color: "#1D4731" }} />
          Passkeys
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-[#0E0B08]/60 leading-relaxed">
          Sign in instantly with Face ID, Touch ID, or a security key — no password or link needed.
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-black/5 animate-pulse" />
            ))}
          </div>
        ) : passkeys.length === 0 ? (
          <p className="text-xs text-[#0E0B08]/40 text-center py-3">No passkeys yet.</p>
        ) : (
          <div className="space-y-2">
            {passkeys.map((pk) => (
              <div
                key={pk.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{
                  background: "rgba(29,71,49,0.05)",
                  border: "1px solid rgba(29,71,49,0.1)",
                }}
              >
                <Fingerprint
                  className="h-4 w-4 flex-shrink-0"
                  style={{ color: "#1D4731" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0E0B08] truncate">
                    {pk.credentialName ?? "Passkey"}
                  </p>
                  <p className="text-[10px] text-[#0E0B08]/40">
                    Last used{" "}
                    {pk.lastUsedAt
                      ? new Date(pk.lastUsedAt).toLocaleDateString("en-KE")
                      : "never"}
                  </p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(pk.id)}
                  disabled={deleteMutation.isPending}
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  aria-label="Remove passkey"
                >
                  <Trash2
                    className="h-3.5 w-3.5"
                    style={{ color: "rgba(196,61,40,0.5)" }}
                  />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleAddPasskey}
          disabled={registering}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: "#1D4731", color: "#fff" }}
        >
          {registering ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {registering ? "Setting up\u2026" : "Add passkey"}
        </button>
      </CardContent>
    </Card>
  )
}
