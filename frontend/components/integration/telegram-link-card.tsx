"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { integrationApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Send, Loader2, Unlink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"

/**
 * Profile → Settings card for managing the Telegram link.
 * Shows connection status and a self-service "Disconnect" so a member who
 * changed their phone / Telegram account can unlink and re-verify from the new
 * one (the /verify safe-binding guard blocks a new Telegram while one is bound).
 */
export function TelegramLinkCard() {
  const { isAuthenticated } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["telegram-link"],
    queryFn: integrationApi.getTelegramLink,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const disconnectMutation = useMutation({
    mutationFn: integrationApi.disconnectTelegram,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["telegram-link"] })
      toast({
        title: res.disconnected ? "Telegram disconnected" : "No Telegram was linked",
        description: res.disconnected
          ? "Send /verify from your new Telegram to re-link this account."
          : undefined,
      })
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't disconnect Telegram",
        description: err?.message,
        variant: "destructive",
      })
    },
  })

  const connected = Boolean(data?.connected)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4" />
          Telegram
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking…
          </div>
        ) : connected ? (
          <>
            <p className="text-sm">
              Connected{data?.handle ? ` as @${data.handle}` : ""}. You can chat with Buda and mark
              baraza attendance from Telegram.
            </p>
            <button
              type="button"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4" />
              )}
              Disconnect Telegram
            </button>
            <p className="text-[12px] text-muted-foreground">
              Changed your phone or Telegram account? Disconnect here, then send{" "}
              <code>/verify</code> from your new Telegram to re-link.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No Telegram linked. Open a UjamaaDAO baraza group on Telegram and send{" "}
            <code>/verify</code> to connect this account.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
