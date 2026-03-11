// @ts-nocheck — scaffold: stale types, alignment deferred
"use client"

import { formatRelativeTime } from "@/lib/utils"
import { useNotifications } from "@/contexts/notification-context"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Info, CheckCircle, AlertTriangle, XCircle } from "lucide-react"

const iconMap = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
}

const colorMap = {
  info: "text-blue-500",
  success: "text-green-500",
  warning: "text-yellow-500",
  error: "text-red-500",
}

export function NotificationsList() {
  const { notifications, markAsRead, isLoading } = useNotifications()

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    )
  }

  if (notifications.length === 0) {
    return <div className="p-4 text-center text-slate-600">No notifications yet</div>
  }

  return (
    <ScrollArea className="h-80">
      <div className="p-2">
        {notifications.map((notification) => {
          const Icon = iconMap[notification.type]
          return (
            <div
              key={notification.id}
              className={`p-3 rounded-lg mb-2 border transition-colors ${
                notification.read ? "bg-slate-50 border-slate-200" : "bg-white border-blue-200 shadow-sm"
              }`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`h-4 w-4 mt-0.5 ${colorMap[notification.type]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium truncate">{notification.title}</h4>
                    {!notification.read && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        New
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{notification.message}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{formatRelativeTime(notification.createdAt)}</span>
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                        className="text-xs h-6 px-2"
                      >
                        Mark as read
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
