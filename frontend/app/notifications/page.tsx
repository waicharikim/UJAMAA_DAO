"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  BellOff, CheckCheck, Vote, Coins, Zap, Users, AlertCircle, Info,
} from "lucide-react"
import { notificationsApi, type NotificationDto } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

// ── Helpers ────────────────────────────────────────────────────
function notifColor(type: string): string {
  const t = type.toLowerCase()
  if (t.includes("emergency")) return "#B03A1E"
  if (t.includes("vote") || t.includes("proposal") || t.includes("governance")) return "#1D4731"
  if (t.includes("pr") || t.includes("economy") || t.includes("dues")) return "#C9922A"
  if (t.includes("election")) return "#2A5F80"
  return "#7A4F1E"
}

function NotifIcon({ type }: { type: string }) {
  const t = type.toLowerCase()
  if (t.includes("vote") || t.includes("proposal") || t.includes("governance"))
    return <Vote className="h-4 w-4" />
  if (t.includes("pr") || t.includes("economy"))
    return <Coins className="h-4 w-4" />
  if (t.includes("election"))
    return <Users className="h-4 w-4" />
  if (t.includes("emergency"))
    return <AlertCircle className="h-4 w-4" />
  if (t.includes("token") || t.includes("ut"))
    return <Zap className="h-4 w-4" />
  return <Info className="h-4 w-4" />
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

// ── Notification row ───────────────────────────────────────────
function NotifRow({ notif }: { notif: NotificationDto }) {
  const color = notifColor(notif.type)
  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5 transition-colors"
      style={{ background: notif.isRead ? "transparent" : "rgba(201,146,42,0.04)" }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${color}18`, color }}
      >
        <NotifIcon type={notif.type} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug" style={{ color: "#1A120B" }}>
            {notif.title}
          </p>
          {!notif.isRead && (
            <div
              className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
              style={{ background: "#C9922A" }}
            />
          )}
        </div>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#7A6E60" }}>
          {notif.message}
        </p>
        <p className="text-[11px] mt-1.5 font-medium" style={{ color: "#A09080" }}>
          {timeAgo(notif.createdAt)}
        </p>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const qc = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", filter],
    queryFn: () => notificationsApi.getNotifications(filter === "unread"),
    staleTime: 30_000,
  })

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] })
      qc.invalidateQueries({ queryKey: ["notifications-count"] })
    },
  })

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold" style={{ color: "#1A120B" }}>
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm mt-0.5" style={{ color: "#7A6E60" }}>
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="text-xs font-semibold gap-1.5 rounded-full px-3"
            style={{ color: "#1D4731" }}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      <div
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: "rgba(0,0,0,0.05)" }}
      >
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all"
            style={
              filter === f
                ? {
                    background: "#fff",
                    color: "#1D4731",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  }
                : { color: "#7A6E60" }
            }
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3.5 border-b last:border-b-0" style={{ borderColor: "rgba(0,0,0,0.04)" }}>
              <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(201,146,42,0.10)" }}
          >
            <BellOff className="h-6 w-6" style={{ color: "#C9922A" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "#1A120B" }}>No notifications</p>
          <p className="text-xs" style={{ color: "#7A6E60" }}>
            {filter === "unread"
              ? "You're all caught up."
              : "You'll see updates here when there's activity."}
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
        >
          <div className="divide-y" style={{ borderColor: "rgba(0,0,0,0.04)" }}>
            {notifications.map((n) => (
              <NotifRow key={n.id} notif={n} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
