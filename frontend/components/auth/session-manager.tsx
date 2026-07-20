"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { authApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Shield, Monitor, Smartphone, Loader2, LogOut } from "lucide-react"

interface SessionInfo {
  id: string
  deviceInfo?: string
  ipAddress?: string
  lastActiveAt?: string
  createdAt?: string
  isCurrent?: boolean
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "Unknown"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function deviceIcon(info?: string) {
  if (!info) return Monitor
  const lower = info.toLowerCase()
  if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) return Smartphone
  return Monitor
}

export function SessionManager() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: sessions, isLoading } = useQuery<SessionInfo[]>({
    queryKey: ["sessions"],
    queryFn:  () => authApi.getSessions(),
    staleTime: 60_000,
  })

  const revokeMut = useMutation({
    mutationFn: (sessionId: string) => authApi.revokeSession(sessionId),
    onSuccess: () => {
      toast({ title: "Session revoked" })
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
    },
    onError: (e: any) => toast({ title: "Failed to revoke", description: e?.message, variant: "destructive" }),
  })

  return (
    <Card className="rounded-2xl border-0 shadow-sm" style={{ background: "#fff" }}>
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#0E0B08]">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(176,58,30,0.08)" }}
          >
            <Shield className="h-3.5 w-3.5" style={{ color: "#B03A1E" }} />
          </div>
          Active Sessions
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <p className="text-xs text-[#0E0B08]/45 py-1">No active sessions found.</p>
        ) : (
          sessions.map((s) => {
            const DeviceIcon = deviceIcon(s.deviceInfo)
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: s.isCurrent ? "rgba(29,71,49,0.06)" : "rgba(0,0,0,0.025)" }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: s.isCurrent ? "rgba(29,71,49,0.12)" : "rgba(0,0,0,0.05)" }}
                >
                  <DeviceIcon
                    className="h-4 w-4"
                    style={{ color: s.isCurrent ? "#1D4731" : "rgba(14,11,8,0.45)" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-[#0E0B08] truncate">
                      {s.deviceInfo ?? "Unknown device"}
                    </p>
                    {s.isCurrent && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: "rgba(29,71,49,0.12)", color: "#1D4731" }}
                      >
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#0E0B08]/40 mt-0.5">
                    {s.ipAddress ? `${s.ipAddress} · ` : ""}
                    Active {timeAgo(s.lastActiveAt ?? s.createdAt)}
                  </p>
                </div>
                {!s.isCurrent && (
                  <button
                    onClick={() => revokeMut.mutate(s.id)}
                    disabled={revokeMut.isPending && revokeMut.variables === s.id}
                    className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-40 flex-shrink-0"
                    style={{ background: "rgba(176,58,30,0.08)", color: "#B03A1E" }}
                  >
                    {revokeMut.isPending && revokeMut.variables === s.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <LogOut className="h-3 w-3" />
                    }
                    Revoke
                  </button>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
