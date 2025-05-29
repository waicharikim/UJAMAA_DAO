"use client"

import { useState } from "react"
import { Bell, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useNotifications } from "@/contexts/notification-context"
import { useAuth } from "@/contexts/auth-context"
import { NotificationsList } from "./notifications-list"
import { NotificationPreferences } from "./notification-preferences"

export function NotificationsPanel() {
  const [showPreferences, setShowPreferences] = useState(false)
  const { unreadCount, isLoading } = useNotifications()
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return null
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <Button variant="ghost" size="sm" onClick={() => setShowPreferences(!showPreferences)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {showPreferences ? <NotificationPreferences onBack={() => setShowPreferences(false)} /> : <NotificationsList />}
      </PopoverContent>
    </Popover>
  )
}
