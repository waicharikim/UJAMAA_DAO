"use client"

import Link from "next/link"
import { Bell } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useNotifications } from "@/contexts/notification-context"
import { useAuth } from "@/contexts/auth-context"
import type { Notification } from "@/lib/types"

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function NotificationRow({
  notification,
  onRead,
}: {
  notification: Notification
  onRead: (id: string) => void
}) {
  const handleRead = () => {
    if (!notification.read) onRead(notification.id)
  }

  return (
    <div
      className="px-3 py-2.5 transition-colors hover:bg-[rgba(201,146,42,0.06)] rounded-lg"
      style={{
        borderLeft: notification.read ? "none" : "3px solid #D4911E",
        paddingLeft: notification.read ? "12px" : "9px",
      }}
    >
      <button onClick={handleRead} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-[#0E0B08] leading-snug">{notification.title}</p>
          <span className="text-[10px] text-[#0E0B08]/40 flex-shrink-0 mt-0.5">
            {relativeTime(notification.createdAt)}
          </span>
        </div>
        <p className="text-xs text-[#0E0B08]/55 mt-0.5 leading-snug line-clamp-2">
          {notification.message}
        </p>
      </button>
      {notification.actionUrl && (
        <Link
          href={notification.actionUrl}
          onClick={handleRead}
          className="inline-block mt-1.5 text-[11px] font-semibold rounded-md px-2 py-0.5 transition-colors hover:opacity-80"
          style={{ color: "#C9922A", background: "rgba(201,146,42,0.10)" }}
        >
          {notification.actionLabel ?? "View →"}
        </Link>
      )}
    </div>
  )
}

export function NotificationsPopover() {
  const { isAuthenticated } = useAuth()
  const { notifications, unreadCount, markAsRead, isLoading } = useNotifications()

  const handleMarkAllRead = () => {
    notifications.filter((n) => !n.read).forEach((n) => markAsRead(n.id))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-8 w-8 p-0 rounded-lg hover:bg-[rgba(212,145,30,0.10)]"
          aria-label="Notifications"
        >
          <Bell className="h-[17px] w-[17px] text-chai" />
          {isAuthenticated && unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-0.5"
              style={{ background: "#C43D28" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-72 p-0 border-0 shadow-gold"
        style={{ background: "#FAF7F2" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "rgba(26,18,11,0.07)" }}
        >
          <span className="text-sm font-bold text-[#0E0B08]">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: "#C9922A" }}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[320px] overflow-y-auto p-2">
          {!isAuthenticated ? (
            <p className="py-6 text-center text-sm text-[#0E0B08]/40">Sign in to see notifications.</p>
          ) : isLoading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="h-6 w-6 mx-auto mb-2" style={{ color: "rgba(14,11,8,0.15)" }} />
              <p className="text-sm text-[#0E0B08]/40">No notifications yet.</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {notifications.slice(0, 20).map((n) => (
                <NotificationRow key={n.id} notification={n} onRead={markAsRead} />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
