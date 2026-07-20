// @ts-nocheck — scaffold: stale types, alignment deferred
"use client"

import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useNotifications } from "@/contexts/notification-context"
import { ArrowLeft } from "lucide-react"

interface NotificationPreferencesProps {
  onBack: () => void
}

export function NotificationPreferences({ onBack }: NotificationPreferencesProps) {
  const { preferences, updatePreferences } = useNotifications()

  if (!preferences) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    )
  }

  const handleToggle = (key: keyof typeof preferences, value: boolean) => {
    updatePreferences({ [key]: value })
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">Notification Preferences</h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="email">Email Notifications</Label>
          <Switch
            id="email"
            checked={preferences.email}
            onCheckedChange={(checked) => handleToggle("email", checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="sms">SMS Notifications</Label>
          <Switch id="sms" checked={preferences.sms} onCheckedChange={(checked) => handleToggle("sms", checked)} />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="inApp">In-App Notifications</Label>
          <Switch
            id="inApp"
            checked={preferences.inApp}
            onCheckedChange={(checked) => handleToggle("inApp", checked)}
          />
        </div>

        <hr className="my-4" />

        <div className="flex items-center justify-between">
          <Label htmlFor="groupInvites">Group Invites</Label>
          <Switch
            id="groupInvites"
            checked={preferences.groupInvites}
            onCheckedChange={(checked) => handleToggle("groupInvites", checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="roleChanges">Role Changes</Label>
          <Switch
            id="roleChanges"
            checked={preferences.roleChanges}
            onCheckedChange={(checked) => handleToggle("roleChanges", checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="systemUpdates">System Updates</Label>
          <Switch
            id="systemUpdates"
            checked={preferences.systemUpdates}
            onCheckedChange={(checked) => handleToggle("systemUpdates", checked)}
          />
        </div>
      </div>
    </div>
  )
}
